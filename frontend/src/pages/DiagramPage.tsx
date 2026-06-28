import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Connection as RFConnection, type Edge, type Node, type NodeChange, type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box, AppBar, Toolbar, IconButton, Typography, Button, Drawer,
  Divider, List, ListItemButton, ListItemText, ListSubheader,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import SaveIcon from '@mui/icons-material/Save'
import LayersIcon from '@mui/icons-material/Layers'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CabinetNode from '../nodes/CabinetNode'
import FieldComponentNode from '../nodes/FieldComponentNode'
import SpaceZoneNode from '../nodes/SpaceZoneNode'
import NodeDetailPanel from '../components/NodeDetailPanel'
import EdgeDetailPanel from '../components/EdgeDetailPanel'
import SpaceTree from '../components/SpaceTree'
import SchematicEdge from '../components/SchematicEdge'
import {
  projectsApi, cabinetsApi, fieldComponentsApi, connectionsApi,
  canvasApi, spacesApi,
} from '../api/client'
import type {
  CanvasNodeData, CanvasPositionUpdate, CabinetType, SpaceCreate,
} from '../api/types'
import { CABINET_TYPES, LEVEL_TYPES } from '../api/types'
import type { SpaceZoneData } from '../nodes/SpaceZoneNode'

type EdgeData = {
  [key: string]: unknown
  id: string
  label: string | null
  cable_ref: string | null
  cable_type: string | null
  cable_section: number | null
  cable_length: number | null
  routeOffset?: number
  edgeColor?: string
  sourceCrossings?: number[]
  targetCrossings?: number[]
  overrideSourceX?: number
  overrideTargetX?: number
  midYOverride?: number
}
type AppNodeData = CanvasNodeData | SpaceZoneData
type AppNode = Node<AppNodeData>
type AppEdge = Edge<EdgeData>

const NODE_TYPES = {
  cabinet: CabinetNode,
  fieldComponent: FieldComponentNode,
  spaceZone: SpaceZoneNode,
}
const EDGE_TYPES = {
  schematic: SchematicEdge,
}
const LEFT_WIDTH = 260
const NODE_X_GAP = 290
const NODE_Y_GAP = 180
const ZONE_X = 40
const ZONE_TOP_PAD = 78
const ZONE_SIDE_PAD = 56
const ZONE_BOTTOM_PAD = 56
const MAX_COLUMNS = 8
const NODE_WIDTH = 220
const NODE_HEIGHT_EST = 90
const TREE_LEAF_WIDTH = 180
const TREE_LEAF_GAP = 16
const TREE_PARENT_PADDING = 32
const SUBTREE_GAP = 16
const HANDLE_SPREAD = 0

const EDGE_PALETTE = [
  '#1565c0', '#c62828', '#2e7d32', '#6a1b9a',
  '#e65100', '#00695c', '#ad1457', '#f57f17',
  '#0277bd', '#558b2f', '#4527a0', '#00838f',
]

function nodeRank(node: Pick<AppNode, 'type' | 'data'>): number {
  if (node.type === 'fieldComponent') return 50
  if (node.type !== 'cabinet') return 100
  const cabinetType = (node.data as CanvasNodeData).cabinet_type
  if (cabinetType === 'hoofdverdeler') return 0
  if (cabinetType === 'onderverdeler') return 10
  if (cabinetType === 'besturingskast') return 20
  if (cabinetType === 'netwerkkast') return 30
  if (cabinetType === 'klemmenkast') return 35
  return 40
}

function nodeLabel(node: Pick<AppNode, 'data'>): string {
  const data = node.data as CanvasNodeData
  return `${data.function_designation ?? ''} ${data.space_designation ?? ''} ${data.tag ?? ''} ${data.name ?? ''}`
}

function edgeColorFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return EDGE_PALETTE[h % EDGE_PALETTE.length]
}

function shouldSwapEdgeDirection(source: AppNode, target: AppNode): boolean {
  const sourceRank = nodeRank(source)
  const targetRank = nodeRank(target)
  if (sourceRank !== targetRank) return sourceRank > targetRank
  if (Math.abs(source.position.y - target.position.y) > 20) return source.position.y > target.position.y
  return source.position.x > target.position.x
}

function orientEdge(edge: AppEdge, nodeById: Map<string, AppNode>): AppEdge {
  const sourceNode = nodeById.get(edge.source)
  const targetNode = nodeById.get(edge.target)
  if (!sourceNode || !targetNode) return edge

  const swapped = shouldSwapEdgeDirection(sourceNode, targetNode)
  const source = swapped ? targetNode : sourceNode
  const target = swapped ? sourceNode : targetNode

  return {
    ...edge,
    source: source.id,
    target: target.id,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
  }
}

function orientEdges(edges: AppEdge[], nodes: AppNode[]): AppEdge[] {
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const pairCounts = new Map<string, number>()
  return edges.map(edge => {
    const oriented = orientEdge(edge, nodeById)
    const pairKey = `${oriented.source}->${oriented.target}`
    const pairIndex = pairCounts.get(pairKey) ?? 0
    pairCounts.set(pairKey, pairIndex + 1)
    const offset = pairIndex === 0 ? 0 : pairIndex * 18
    const edgeData: EdgeData = oriented.data ?? {
      id: oriented.id,
      label: null,
      cable_ref: null,
      cable_type: null,
      cable_section: null,
      cable_length: null,
    }
    return {
      ...oriented,
      data: { ...edgeData, routeOffset: offset, edgeColor: edgeColorFromId(oriented.id) },
      label: edgeData.cable_ref || oriented.label,
      style: { ...(oriented.style ?? {}), strokeWidth: 1.4 },
      type: 'schematic',
    } satisfies AppEdge
  })
}

type EdgePath = { sx: number; sy: number; my: number; tx: number; ty: number }

function between(val: number, a: number, b: number): boolean {
  return val > Math.min(a, b) && val < Math.max(a, b)
}

function pushTo(map: Map<string, number[]>, key: string, val: number) {
  if (!map.has(key)) map.set(key, [])
  map.get(key)!.push(val)
}

function computeEdgePath(edge: AppEdge, nodeById: Map<string, AppNode>): EdgePath | null {
  const source = nodeById.get(edge.source)
  const target = nodeById.get(edge.target)
  if (!source || !target) return null
  const srcData = source.data as CanvasNodeData
  const tgtData = target.data as CanvasNodeData
  const sw = srcData.nodeWidth ?? NODE_WIDTH
  const tw = tgtData.nodeWidth ?? NODE_WIDTH

  let sx = source.position.x + sw / 2
  if (srcData.sourceHandles) {
    const h = srcData.sourceHandles.find(hd => hd.id === `b-${edge.id}`)
    if (h) sx = source.position.x + sw * h.leftPercent / 100
  }
  let tx = target.position.x + tw / 2
  if (tgtData.targetHandles) {
    const h = tgtData.targetHandles.find(hd => hd.id === `t-${edge.id}`)
    if (h) tx = target.position.x + tw * h.leftPercent / 100
  }

  const sy = source.position.y + NODE_HEIGHT_EST
  const ty = target.position.y
  const edData = (edge.data as EdgeData) ?? {}
  const offset = edData.routeOffset ?? 0
  const my = edData.midYOverride !== undefined
    ? edData.midYOverride
    : sy + Math.max(54 + offset, (ty - sy) / 2)
  return { sx, sy, my, tx, ty }
}

function addCrossingData(edges: AppEdge[], nodes: AppNode[]): AppEdge[] {
  const nodeById = new Map(nodes.filter(n => n.type !== 'spaceZone').map(n => [n.id, n]))
  const paths = new Map<string, EdgePath>()
  for (const edge of edges) {
    const path = computeEdgePath(edge, nodeById)
    if (path) paths.set(edge.id, path)
  }

  const srcCross = new Map<string, number[]>()
  const tgtCross = new Map<string, number[]>()
  const list = edges.filter(e => paths.has(e.id))

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const pA = paths.get(list[i].id)!
      const pB = paths.get(list[j].id)!
      // H_A crosses V1_B
      if (between(pB.sx, pA.sx, pA.tx) && between(pA.my, pB.sy, pB.my))
        pushTo(srcCross, list[j].id, pA.my)
      // H_A crosses V3_B
      if (between(pB.tx, pA.sx, pA.tx) && between(pA.my, pB.my, pB.ty))
        pushTo(tgtCross, list[j].id, pA.my)
      // H_B crosses V1_A
      if (between(pA.sx, pB.sx, pB.tx) && between(pB.my, pA.sy, pA.my))
        pushTo(srcCross, list[i].id, pB.my)
      // H_B crosses V3_A
      if (between(pA.tx, pB.sx, pB.tx) && between(pB.my, pA.my, pA.ty))
        pushTo(tgtCross, list[i].id, pB.my)
    }
  }

  return edges.map(edge => {
    const path = paths.get(edge.id)
    return {
      ...edge,
      data: {
        ...(edge.data ?? { id: edge.id, label: null, cable_ref: null, cable_type: null, cable_section: null, cable_length: null }),
        sourceCrossings: srcCross.get(edge.id) ?? [],
        targetCrossings: tgtCross.get(edge.id) ?? [],
        overrideSourceX: path?.sx,
        overrideTargetX: path?.tx,
      } as EdgeData,
    }
  })
}

const CROSS_ZONE_TRACK_GAP = 14  // px between parallel cross-zone cable bus lines

function assignCrossZoneOffsets(edges: AppEdge[], nodes: AppNode[]): AppEdge[] {
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const nodeZone = new Map<string, string>()
  nodes.forEach(n => nodeZone.set(n.id, (n.data as CanvasNodeData).space_id ?? '__no_zone__'))

  // Group cross-zone edges by (sourceZone → targetZone) corridor
  const corridorGroups = new Map<string, AppEdge[]>()
  edges.forEach(edge => {
    const srcZone = nodeZone.get(edge.source) ?? '__no_zone__'
    const tgtZone = nodeZone.get(edge.target) ?? '__no_zone__'
    if (srcZone === tgtZone) return
    const key = `${srcZone}→${tgtZone}`
    if (!corridorGroups.has(key)) corridorGroups.set(key, [])
    corridorGroups.get(key)!.push(edge)
  })

  // Sort each corridor by source X (left→right) and assign explicit midY per cable
  const midYOverrides = new Map<string, number>()
  corridorGroups.forEach(group => {
    const sorted = [...group].sort((a, b) => {
      const ax = nodeById.get(a.source)?.position.x ?? 0
      const bx = nodeById.get(b.source)?.position.x ?? 0
      return ax - bx
    })
    sorted.forEach((edge, i) => {
      const srcNode = nodeById.get(edge.source)
      if (!srcNode) return
      const sy = srcNode.position.y + NODE_HEIGHT_EST
      midYOverrides.set(edge.id, sy + 54 + i * CROSS_ZONE_TRACK_GAP)
    })
  })

  return edges.map(edge => {
    const midYOverride = midYOverrides.get(edge.id)
    if (midYOverride === undefined) return edge
    const edgeData = (edge.data ?? {}) as EdgeData
    return { ...edge, data: { ...edgeData, midYOverride } }
  })
}

function buildEdges(edges: AppEdge[], nodes: AppNode[]): AppEdge[] {
  return addCrossingData(assignCrossZoneOffsets(orientEdges(edges, nodes), nodes), nodes)
}

function minimizeCrossings(rows: AppNode[][], edges: AppEdge[]): AppNode[][] {
  if (rows.length <= 1) return rows
  const nodeRowIdx = new Map<string, number>()
  const nodeColIdx = new Map<string, number>()
  rows.forEach((row, ri) => row.forEach((n, ci) => { nodeRowIdx.set(n.id, ri); nodeColIdx.set(n.id, ci) }))

  const nbrs = new Map<string, string[]>()
  for (const e of edges) {
    if (!nbrs.has(e.source)) nbrs.set(e.source, [])
    if (!nbrs.has(e.target)) nbrs.set(e.target, [])
    nbrs.get(e.source)!.push(e.target)
    nbrs.get(e.target)!.push(e.source)
  }

  function bary(id: string, refRow: number): number {
    const ns = (nbrs.get(id) ?? []).filter(nid => nodeRowIdx.get(nid) === refRow)
    if (!ns.length) return nodeColIdx.get(id) ?? 0
    return ns.reduce((s, nid) => s + (nodeColIdx.get(nid) ?? 0), 0) / ns.length
  }

  const result = rows.map(r => [...r])
  for (let iter = 0; iter < 3; iter++) {
    for (let ri = 1; ri < result.length; ri++) {
      result[ri].sort((a, b) => bary(a.id, ri - 1) - bary(b.id, ri - 1))
      result[ri].forEach((n, ci) => nodeColIdx.set(n.id, ci))
    }
    for (let ri = result.length - 2; ri >= 0; ri--) {
      result[ri].sort((a, b) => bary(a.id, ri + 1) - bary(b.id, ri + 1))
      result[ri].forEach((n, ci) => nodeColIdx.set(n.id, ci))
    }
  }
  return result
}

function compareNodes(a: AppNode, b: AppNode): number {
  return nodeRank(a) - nodeRank(b) || nodeLabel(a).localeCompare(nodeLabel(b), 'nl')
}

function chunkNodes(nodes: AppNode[]): AppNode[][] {
  const chunks: AppNode[][] = []
  for (let i = 0; i < nodes.length; i += MAX_COLUMNS) chunks.push(nodes.slice(i, i + MAX_COLUMNS))
  return chunks
}

function buildNodeLevels(nodes: AppNode[], edges: AppEdge[]): Map<string, number> {
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const levels = new Map(nodes.map(n => [n.id, Math.floor(nodeRank(n) / 10)]))
  const orientedEdges = orientEdges(edges, nodes)

  for (let i = 0; i < nodes.length; i += 1) {
    let changed = false
    orientedEdges.forEach(edge => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target) return
      const sourceSpace = (source.data as CanvasNodeData).space_id ?? '__no_zone__'
      const targetSpace = (target.data as CanvasNodeData).space_id ?? '__no_zone__'
      if (sourceSpace !== targetSpace) return
      const nextLevel = (levels.get(source.id) ?? 0) + 1
      if (nextLevel > (levels.get(target.id) ?? 0)) {
        levels.set(target.id, nextLevel)
        changed = true
      }
    })
    if (!changed) break
  }

  return levels
}


function buildTreeLayout(currentNodes: AppNode[], currentEdges: AppEdge[] = []): AppNode[] {
  const zones = currentNodes
    .filter(n => n.type === 'spaceZone')
    .sort((a, b) => a.position.y - b.position.y || nodeLabel(a).localeCompare(nodeLabel(b), 'nl'))
  const regularNodes = currentNodes.filter(n => n.type !== 'spaceZone')

  const nodesByZone = new Map<string, AppNode[]>()
  regularNodes.forEach(n => {
    const sid = (n.data as CanvasNodeData).space_id ?? '__no_zone__'
    nodesByZone.set(sid, [...(nodesByZone.get(sid) ?? []), n])
  })

  const knownZoneIds = new Set(zones.map(z => z.id))
  const implicitZones: AppNode[] = [...nodesByZone.keys()]
    .filter(id => id !== '__no_zone__' && !knownZoneIds.has(id))
    .map(id => ({
      id, type: 'spaceZone', position: { x: ZONE_X, y: 0 }, zIndex: -1,
      style: { width: 320, height: 220 },
      data: { id, name: 'Locatie', designation: null, level_type: 'ruimte' },
    } satisfies AppNode))
  const layoutZones = [...zones, ...implicitZones]
  if (nodesByZone.has('__no_zone__')) {
    layoutZones.push({
      id: '__no_zone__', type: 'spaceZone', position: { x: ZONE_X, y: 0 }, zIndex: -1,
      style: { width: 320, height: 220 },
      data: { id: '__no_zone__', name: 'Niet toegewezen', designation: null, level_type: 'zone' },
    } satisfies AppNode)
  }

  const oriented = orientEdges(currentEdges, regularNodes)
  let zoneY = 40
  const laidOut = new Map<string, AppNode>()

  layoutZones.forEach(zone => {
    const zoneNodes = nodesByZone.get(zone.id) ?? []
    if (zoneNodes.length === 0) {
      laidOut.set(zone.id, {
        ...zone, position: { x: ZONE_X, y: zoneY }, zIndex: -1,
        style: { width: 600, height: 200 },
      })
      zoneY += 272
      return
    }

    const zoneNodeIds = new Set(zoneNodes.map(n => n.id))
    const nodeMap = new Map(zoneNodes.map(n => [n.id, n]))

    const intraChildren = new Map<string, string[]>()
    const intraParents = new Map<string, string[]>()
    zoneNodes.forEach(n => { intraChildren.set(n.id, []); intraParents.set(n.id, []) })
    oriented.forEach(e => {
      if (zoneNodeIds.has(e.source) && zoneNodeIds.has(e.target)) {
        const ch = intraChildren.get(e.source)!
        if (!ch.includes(e.target)) ch.push(e.target)
        const pa = intraParents.get(e.target)!
        if (!pa.includes(e.source)) pa.push(e.source)
      }
    })

    // Resolve DAG: nodes with multiple intra-zone parents are assigned to exactly one primary parent.
    // Without this, two parents sharing a child both compute the same cx → identical positions.
    zoneNodes.forEach(n => {
      const parents = intraParents.get(n.id) ?? []
      if (parents.length <= 1) return
      const primary = [...parents].sort((a, b) => compareNodes(nodeMap.get(a)!, nodeMap.get(b)!))[0]
      parents.forEach(p => {
        if (p === primary) return
        const ch = intraChildren.get(p) ?? []
        const idx = ch.indexOf(n.id)
        if (idx >= 0) ch.splice(idx, 1)
      })
      intraParents.set(n.id, [primary])
    })

    // Compute levels and compress to consecutive integers
    const rawLevels = buildNodeLevels(zoneNodes, currentEdges)
    const uniqueLevels = [...new Set(rawLevels.values())].sort((a, b) => a - b)
    const levelCompress = new Map(uniqueLevels.map((v, i) => [v, i]))
    const levels = new Map([...rawLevels.entries()].map(([k, v]) => [k, levelCompress.get(v)!]))

    // Crossing minimization: determine optimal node order per level to reduce line crossings
    const levelToNodesLocal = new Map<number, AppNode[]>()
    zoneNodes.forEach(n => {
      const lv = rawLevels.get(n.id) ?? 0
      levelToNodesLocal.set(lv, [...(levelToNodesLocal.get(lv) ?? []), n])
    })
    const sortedLvls = [...levelToNodesLocal.keys()].sort((a, b) => a - b)
    const rawRowsLocal = sortedLvls.map(lv => [...(levelToNodesLocal.get(lv) ?? [])].sort(compareNodes))
    const intraEdgesLocal = oriented.filter(e => zoneNodeIds.has(e.source) && zoneNodeIds.has(e.target))
    const orderedRowsLocal = minimizeCrossings(rawRowsLocal, intraEdgesLocal)
    const nodeMinOrder = new Map<string, number>()
    orderedRowsLocal.forEach(row => row.forEach((n, i) => nodeMinOrder.set(n.id, i)))

    // Bottom-up X layout — leafX in pixels prevents subtrees from overlapping
    const nodeCx = new Map<string, number>()
    const nodeW = new Map<string, number>()
    let leafX = 0
    const visited = new Set<string>()

    function layoutNode(id: string): void {
      if (visited.has(id)) return
      visited.add(id)
      const children = (intraChildren.get(id) ?? [])
        .sort((a, b) => {
          const aIsLeaf = (intraChildren.get(a) ?? []).length === 0
          const bIsLeaf = (intraChildren.get(b) ?? []).length === 0
          if (aIsLeaf !== bIsLeaf) return aIsLeaf ? -1 : 1
          return (nodeMinOrder.get(a) ?? 0) - (nodeMinOrder.get(b) ?? 0) || compareNodes(nodeMap.get(a)!, nodeMap.get(b)!)
        })
      children.forEach(cid => layoutNode(cid))
      if (children.length === 0) {
        nodeCx.set(id, leafX + TREE_LEAF_WIDTH / 2)
        nodeW.set(id, TREE_LEAF_WIDTH)
        leafX += TREE_LEAF_WIDTH + TREE_LEAF_GAP
      } else {
        const cxs = children.map(cid => nodeCx.get(cid)!)
        const ws = children.map(cid => nodeW.get(cid)!)
        const left = Math.min(...cxs.map((cx, i) => cx - ws[i] / 2))
        const right = Math.max(...cxs.map((cx, i) => cx + ws[i] / 2))
        nodeCx.set(id, (left + right) / 2)
        nodeW.set(id, Math.max(TREE_LEAF_WIDTH, right - left + 2 * TREE_PARENT_PADDING))
      }
    }

    zoneNodes
      .filter(n => (intraParents.get(n.id) ?? []).length === 0)
      .sort((a, b) => (nodeMinOrder.get(a.id) ?? 0) - (nodeMinOrder.get(b.id) ?? 0) || compareNodes(a, b))
      .forEach(n => {
        layoutNode(n.id)
        // Advance past this root's right edge + padding so the next subtree's parent never overlaps
        const rootRight = (nodeCx.get(n.id) ?? 0) + (nodeW.get(n.id) ?? TREE_LEAF_WIDTH) / 2
        leafX = Math.max(leafX, rootRight + SUBTREE_GAP + TREE_PARENT_PADDING)
      })
    zoneNodes.forEach(n => { if (!visited.has(n.id)) layoutNode(n.id) })

    const maxLevel = Math.max(0, ...[...levels.values()])

    const contentRight = zoneNodes.length > 0
      ? Math.max(...zoneNodes.map(n => (nodeCx.get(n.id) ?? 0) + (nodeW.get(n.id) ?? TREE_LEAF_WIDTH) / 2))
      : TREE_LEAF_WIDTH
    const zoneWidth = Math.max(600, contentRight + ZONE_SIDE_PAD * 2)
    const zoneHeight = Math.max(240, ZONE_TOP_PAD + (maxLevel + 1) * NODE_Y_GAP + ZONE_BOTTOM_PAD)

    zoneNodes.forEach(n => {
      const cx = nodeCx.get(n.id) ?? 0
      const w = nodeW.get(n.id) ?? TREE_LEAF_WIDTH
      const level = levels.get(n.id) ?? 0
      const x = ZONE_X + ZONE_SIDE_PAD + cx - w / 2
      const y = zoneY + ZONE_TOP_PAD + level * NODE_Y_GAP

      // Per-edge source handles: one dot per cable, spread around child's center X
      const intraEdgesFrom = oriented.filter(e => e.source === n.id && zoneNodeIds.has(e.target))
      const edgesByChild = new Map<string, AppEdge[]>()
      intraEdgesFrom.forEach(e => {
        if (!edgesByChild.has(e.target)) edgesByChild.set(e.target, [])
        edgesByChild.get(e.target)!.push(e)
      })
      const sourceHandles: Array<{ id: string; leftPercent: number }> = []
      edgesByChild.forEach((childEdges, cid) => {
        const childCx = nodeCx.get(cid) ?? cx
        childEdges.forEach((edge, i) => {
          const offset = (i - (childEdges.length - 1) / 2) * HANDLE_SPREAD
          const relX = (childCx + offset) - (cx - w / 2)
          sourceHandles.push({ id: `b-${edge.id}`, leftPercent: Math.max(2, Math.min(98, (relX / w) * 100)) })
        })
      })

      // Per-edge target handles: one dot per cable, spread at center of this node
      const intraEdgesTo = oriented.filter(e => e.target === n.id && zoneNodeIds.has(e.source))
      const edgesByParent = new Map<string, AppEdge[]>()
      intraEdgesTo.forEach(e => {
        if (!edgesByParent.has(e.source)) edgesByParent.set(e.source, [])
        edgesByParent.get(e.source)!.push(e)
      })
      const targetHandles: Array<{ id: string; leftPercent: number }> = []
      edgesByParent.forEach(parentEdges => {
        parentEdges.forEach((edge, i) => {
          const offset = (i - (parentEdges.length - 1) / 2) * HANDLE_SPREAD
          targetHandles.push({ id: `t-${edge.id}`, leftPercent: Math.max(2, Math.min(98, 50 + (offset / w) * 100)) })
        })
      })

      // Cross-zone handles: placed in the LEFT margin of the node (before leaf children start)
      // This prevents cross-zone cables from visually overlapping subtree-child nodes
      const crossEdgesFrom = oriented.filter(e => e.source === n.id && !zoneNodeIds.has(e.target))
      const nCF = crossEdgesFrom.length
      const subtreeChildren = (intraChildren.get(n.id) ?? []).filter(cid => (intraChildren.get(cid) ?? []).length > 0)
      // Left margin = [2%, leftmost subtree child's leftPercent - 5%], clamped to [2,48]
      const subtreeLeftPct = subtreeChildren.length > 0
        ? Math.min(...subtreeChildren.map(cid => {
          const scx = nodeCx.get(cid) ?? cx
          return Math.max(2, ((scx - (cx - w / 2)) / w) * 100 - 5)
        }))
        : 50
      const crossZoneRight = Math.min(48, subtreeLeftPct)
      crossEdgesFrom.forEach((edge, i) => {
        const lp = nCF === 1 ? crossZoneRight / 2 : (i + 1) / (nCF + 1) * crossZoneRight
        sourceHandles.push({ id: `b-${edge.id}`, leftPercent: Math.max(2, Math.min(48, lp)) })
      })
      const crossEdgesTo = oriented.filter(e => e.target === n.id && !zoneNodeIds.has(e.source))
      const nCT = crossEdgesTo.length
      crossEdgesTo.forEach((edge, i) => {
        const lp = nCT === 1 ? crossZoneRight / 2 : (i + 1) / (nCT + 1) * crossZoneRight
        targetHandles.push({ id: `t-${edge.id}`, leftPercent: Math.max(2, Math.min(48, lp)) })
      })

      laidOut.set(n.id, {
        ...n,
        position: { x, y },
        style: { ...(n.style ?? {}), width: w },
        data: { ...n.data, nodeWidth: w, sourceHandles, targetHandles } as CanvasNodeData,
      })
    })

    laidOut.set(zone.id, {
      ...zone, position: { x: ZONE_X, y: zoneY }, zIndex: -1,
      style: { width: zoneWidth, height: zoneHeight },
    })
    zoneY += zoneHeight + 72
  })

  return currentNodes.map(n => laidOut.get(n.id) ?? n)
}

export default function DiagramPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([])
  const [selectedNode, setSelectedNode] = useState<{
    id: string; type: 'cabinet' | 'fieldComponent'; data: CanvasNodeData
  } | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<{
    id: string
      data: EdgeData
  } | null>(null)
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)

  const [addCabinetOpen, setAddCabinetOpen] = useState(false)
  const [addFcOpen, setAddFcOpen] = useState(false)
  const [addSpaceOpen, setAddSpaceOpen] = useState(false)

  const [showZones, setShowZones] = useState(false)

  const [cabinetForm, setCabinetForm] = useState<{
    name: string; cabinet_type: CabinetType | ''; description: string; space_id: string; function_designation: string
  }>({ name: '', cabinet_type: '', description: '', space_id: '', function_designation: '' })

  const [fcForm, setFcForm] = useState({
    name: '', tag: '', description: '', space_id: '', function_designation: '',
  })

  const [spaceForm, setSpaceForm] = useState<SpaceCreate>({
    name: '', level_type: '', designation: '', parent_id: undefined,
  })

  const pendingPositions = useRef<Map<string, CanvasPositionUpdate>>(new Map())

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: canvas, isLoading } = useQuery({
    queryKey: ['canvas', projectId],
    queryFn: () => canvasApi.getOverview(projectId!),
    enabled: !!projectId,
  })

  const { data: spaceTree, refetch: refetchSpaces } = useQuery({
    queryKey: ['spaces', projectId],
    queryFn: () => spacesApi.listTree(projectId!),
    enabled: !!projectId,
  })

  const { data: spaceList, refetch: refetchSpaceList } = useQuery({
    queryKey: ['spaces-flat', projectId],
    queryFn: () => spacesApi.list(projectId!),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (!canvas) return
    let nextNodes: AppNode[] = canvas.nodes.map(n => ({
      ...n,
      type: n.type,
      zIndex: n.type === 'spaceZone' ? -1 : undefined,
    } satisfies AppNode))
    const nextEdges = canvas.edges.map(e => ({
      id: e.id, source: e.source, target: e.target,
      label: e.data?.cable_ref || e.label || undefined,
      data: e.data,
    } satisfies AppEdge))
    // Re-apply tree layout if nodes have custom widths (from a previous tree layout save)
    const hasCustomWidths = nextNodes.some(n =>
      n.type !== 'spaceZone' && (n.style?.width as number | undefined) !== undefined
      && (n.style?.width as number) !== NODE_WIDTH
    )
    if (hasCustomWidths) nextNodes = buildTreeLayout(nextNodes, nextEdges)
    setNodes(nextNodes)
    setEdges(buildEdges(nextEdges, nextNodes))
  }, [canvas, setNodes, setEdges])

  // Intercept dimension changes from NodeResizer to track space zone sizes
  const handleNodesChange = useCallback((changes: NodeChange<AppNode>[]) => {
    onNodesChange(changes)
    changes.forEach(change => {
      if (change.type === 'dimensions' && 'dimensions' in change && change.dimensions) {
        setNodes(ns => {
          const node = ns.find(n => n.id === change.id)
          if (node?.type === 'spaceZone') {
            pendingPositions.current.set(change.id, {
              entity_type: 'space',
              entity_id: change.id,
              canvas_type: 'overview',
              x: node.position.x,
              y: node.position.y,
              width: change.dimensions!.width,
              height: change.dimensions!.height,
            })
          }
          return ns
        })
      }
    })
  }, [onNodesChange, setNodes])

  const onConnect = useCallback(async (params: RFConnection) => {
    if (!projectId || !params.source || !params.target) return
    try {
      const sourceNode = nodes.find(n => n.id === params.source)
      const targetNode = nodes.find(n => n.id === params.target)
      if (sourceNode?.type === 'spaceZone' || targetNode?.type === 'spaceZone') return
      if (!sourceNode || !targetNode) return
      const swapped = shouldSwapEdgeDirection(sourceNode, targetNode)
      const upstreamNode = swapped ? targetNode : sourceNode
      const downstreamNode = swapped ? sourceNode : targetNode
      const conn = await connectionsApi.create(projectId, {
        source_type: upstreamNode.type === 'cabinet' ? 'cabinet' : 'field_component',
        source_id: upstreamNode.id,
        target_type: downstreamNode.type === 'cabinet' ? 'cabinet' : 'field_component',
        target_id: downstreamNode.id,
      })
      setEdges(eds => buildEdges(addEdge({ id: conn.id, source: conn.source_id, target: conn.target_id, data: {
        id: conn.id,
        label: conn.label,
        cable_ref: conn.cable_ref,
        cable_type: conn.cable_type,
        cable_section: conn.cable_section,
        cable_length: conn.cable_length,
      } }, eds), nodes))
    } catch {
      setSnack({ msg: 'Verbinding aanmaken mislukt', sev: 'error' })
    }
  }, [projectId, nodes, setEdges])

  const onEdgesDelete = useCallback(async (deletedEdges: AppEdge[]) => {
    for (const e of deletedEdges) {
      try { await connectionsApi.delete(e.id) }
      catch { setSnack({ msg: 'Verbinding verwijderen mislukt', sev: 'error' }) }
    }
  }, [])

  const onNodesDelete = useCallback(async (deletedNodes: AppNode[]) => {
    for (const n of deletedNodes) {
      try {
        if (n.type === 'cabinet') await cabinetsApi.delete(n.id)
        else if (n.type === 'fieldComponent') await fieldComponentsApi.delete(n.id)
        else if (n.type === 'spaceZone') {
          await spacesApi.delete(n.id)
          refetchSpaces()
          refetchSpaceList()
        }
      } catch { setSnack({ msg: 'Verwijderen mislukt', sev: 'error' }) }
    }
    if (selectedNode && deletedNodes.some(n => n.id === selectedNode.id)) setSelectedNode(null)
  }, [selectedNode, refetchSpaces, refetchSpaceList])

  const onNodeDragStop: OnNodeDrag<AppNode> = useCallback((_, node) => {
    if (node.type === 'spaceZone') {
      // Save space zone position
      const existing = pendingPositions.current.get(node.id)
      pendingPositions.current.set(node.id, {
        entity_type: 'space',
        entity_id: node.id,
        canvas_type: 'overview',
        x: node.position.x,
        y: node.position.y,
        width: existing?.width ?? (node.style as any)?.width ?? 300,
        height: existing?.height ?? (node.style as any)?.height ?? 200,
      })
      return
    }

    // Regular node: queue position
    pendingPositions.current.set(node.id, {
      entity_type: node.type === 'cabinet' ? 'cabinet' : 'field_component',
      entity_id: node.id,
      canvas_type: 'overview',
      x: node.position.x,
      y: node.position.y,
    })

    // Auto-assign to space zone if dropped inside one
    const spaceZones = nodes.filter(n => n.type === 'spaceZone')
    const containing = spaceZones.find(s => {
      const sw: number = (s.style as any)?.width ?? s.width ?? 300
      const sh: number = (s.style as any)?.height ?? s.height ?? 200
      return (
        node.position.x >= s.position.x &&
        node.position.x <= s.position.x + sw &&
        node.position.y >= s.position.y &&
        node.position.y <= s.position.y + sh
      )
    })

    const newSpaceId = containing?.id ?? null
    const currentSpaceId = (node.data as CanvasNodeData).space_id ?? null
    if (newSpaceId !== currentSpaceId) {
      const update = { space_id: newSpaceId ?? undefined }
      if (node.type === 'cabinet') cabinetsApi.update(node.id, update)
      else fieldComponentsApi.update(node.id, update)
      setNodes(ns => ns.map(n =>
        n.id === node.id ? { ...n, data: { ...n.data, space_id: newSpaceId } } : n
      ))
    }

    // Recompute edge overrideSourceX/overrideTargetX after drag so paths follow the node
    setEdges(eds => buildEdges(eds, nodes))
  }, [nodes, setNodes, setEdges])

  const savePositions = useCallback(async () => {
    if (!projectId) return
    // Also capture current space zone sizes at save time
    nodes.filter(n => n.type === 'spaceZone').forEach(n => {
      if (!pendingPositions.current.has(n.id)) {
        pendingPositions.current.set(n.id, {
          entity_type: 'space',
          entity_id: n.id,
          canvas_type: 'overview',
          x: n.position.x,
          y: n.position.y,
          width: (n.style as any)?.width ?? n.width ?? 300,
          height: (n.style as any)?.height ?? n.height ?? 200,
        })
      }
    })
    if (pendingPositions.current.size === 0) return
    try {
      await canvasApi.savePositions(projectId, Array.from(pendingPositions.current.values()))
      pendingPositions.current.clear()
      setSnack({ msg: 'Posities opgeslagen', sev: 'success' })
    } catch {
      setSnack({ msg: 'Opslaan mislukt', sev: 'error' })
    }
  }, [projectId, nodes])

  const applyTreeLayout = useCallback(async () => {
    if (!projectId) return
    const nextNodes = buildTreeLayout(nodes, edges)
    const positions = nextNodes.map(n => ({
      entity_type: n.type === 'spaceZone' ? 'space' : n.type === 'cabinet' ? 'cabinet' : 'field_component',
      entity_id: n.id,
      canvas_type: 'overview',
      x: n.position.x,
      y: n.position.y,
      width: Number((n.style as any)?.width ?? (n.type === 'spaceZone' ? 600 : NODE_WIDTH)),
      height: n.type === 'spaceZone' ? Number((n.style as any)?.height ?? 240) : undefined,
    }))
    setNodes(nextNodes)
    setEdges(eds => buildEdges(eds, nextNodes))
    setShowZones(true)
    try {
      await canvasApi.savePositions(projectId, positions)
      pendingPositions.current.clear()
      setSnack({ msg: 'Blokschema-layout toegepast', sev: 'success' })
    } catch {
      positions.forEach(p => pendingPositions.current.set(p.entity_id, p))
      setSnack({ msg: 'Layout toegepast, maar opslaan mislukt', sev: 'error' })
    }
  }, [projectId, nodes, setNodes, setEdges])

  const addCabinet = async () => {
    if (!projectId || !cabinetForm.cabinet_type) return
    try {
      const cab = await cabinetsApi.create(projectId, {
        name: cabinetForm.name.trim(),
        cabinet_type: cabinetForm.cabinet_type as CabinetType,
        description: cabinetForm.description || undefined,
        space_id: cabinetForm.space_id || undefined,
        function_designation: cabinetForm.function_designation || undefined,
      })
      const space = spaceList?.find(s => s.id === cab.space_id)
      setNodes(ns => [...ns, {
        id: cab.id, type: 'cabinet',
        position: { x: 100 + ns.length * 40, y: 120 },
        data: {
          id: cab.id, name: cab.name, tag: cab.tag,
          function_designation: cab.function_designation ?? null,
          cabinet_type: cab.cabinet_type, space_id: cab.space_id,
          space_designation: space?.designation ?? null,
          description: cab.description, component_count: 0,
        },
      }])
      setAddCabinetOpen(false)
      setCabinetForm({ name: '', cabinet_type: '', description: '', space_id: '', function_designation: '' })
    } catch { setSnack({ msg: 'Kast aanmaken mislukt', sev: 'error' }) }
  }

  const addFieldComponent = async () => {
    if (!projectId) return
    try {
      const fc = await fieldComponentsApi.create(projectId, {
        name: fcForm.name.trim(),
        tag: fcForm.tag || undefined,
        description: fcForm.description || undefined,
        space_id: fcForm.space_id || undefined,
        function_designation: fcForm.function_designation || undefined,
      })
      const fcSpace = spaceList?.find(s => s.id === fc.space_id)
      setNodes(ns => [...ns, {
        id: fc.id, type: 'fieldComponent',
        position: { x: 100 + ns.length * 40, y: 400 },
        data: {
          id: fc.id, name: fc.name, tag: fc.tag,
          function_designation: fc.function_designation ?? null,
          space_id: fc.space_id, space_designation: fcSpace?.designation ?? null,
          description: fc.description,
          typical: null,
        },
      }])
      setAddFcOpen(false)
      setFcForm({ name: '', tag: '', description: '', space_id: '', function_designation: '' })
    } catch { setSnack({ msg: 'Veld component aanmaken mislukt', sev: 'error' }) }
  }

  const addSpace = async () => {
    if (!projectId || !spaceForm.name.trim()) return
    try {
      const space = await spacesApi.create(projectId, {
        name: spaceForm.name.trim(),
        level_type: spaceForm.level_type || undefined,
        designation: spaceForm.designation || undefined,
        parent_id: spaceForm.parent_id || undefined,
      })
      // Add zone node immediately on canvas
      setNodes(ns => [...ns, {
        id: space.id,
        type: 'spaceZone',
        position: { x: 40 + ns.filter(n => n.type === 'spaceZone').length * 360, y: 40 },
        zIndex: -1,
        style: { width: 320, height: 220 },
        data: {
          id: space.id,
          name: space.name,
          designation: space.designation,
          level_type: space.level_type,
        } as SpaceZoneData,
      } satisfies AppNode])
      await refetchSpaces()
      qc.invalidateQueries({ queryKey: ['spaces-flat', projectId] })
      setAddSpaceOpen(false)
      setSpaceForm({ name: '', level_type: '', designation: '', parent_id: undefined })
    } catch { setSnack({ msg: 'Ruimte aanmaken mislukt', sev: 'error' }) }
  }

  const onNodeUpdated = useCallback((nodeId: string, updates: Partial<CanvasNodeData>) => {
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...updates } } : null)
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
  }, [setNodes])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'spaceZone') return
    setSelectedEdge(null)
    setSelectedNode({
      id: node.id,
      type: node.type as 'cabinet' | 'fieldComponent',
      data: node.data as unknown as CanvasNodeData,
    })
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNode(null)
    setSelectedEdge({ id: edge.id, data: edge.data as EdgeData })
  }, [])

  if (isLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" height="100vh"><CircularProgress /></Box>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={1} color="default">
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate('/projects')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            {project?.name ?? '…'}
          </Typography>
          <Tooltip title={showZones ? 'Zones verbergen' : 'Zones tonen'}>
            <Button
              startIcon={<LayersIcon />}
              onClick={() => setShowZones(v => !v)}
              size="small"
              variant={showZones ? 'contained' : 'outlined'}
              sx={{ mr: 1 }}
            >
              Zones
            </Button>
          </Tooltip>
          <Tooltip title="Blokschema: boomstructuur met breedte-aanpassende nodes en rechte verbindingen">
            <Button startIcon={<AccountTreeIcon />} onClick={applyTreeLayout} size="small" variant="outlined" sx={{ mr: 1 }}>
              Blokschema
            </Button>
          </Tooltip>
          <Tooltip title="Posities opslaan">
            <Button startIcon={<SaveIcon />} onClick={savePositions} size="small" variant="outlined" sx={{ mr: 1 }}>
              Opslaan
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <Box sx={{
          width: LEFT_WIDTH, flexShrink: 0,
          borderRight: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <List dense disablePadding sx={{ p: 1 }}>
            <ListSubheader disableSticky>Toevoegen</ListSubheader>
            <ListItemButton onClick={() => setAddCabinetOpen(true)}>
              <AddIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              <ListItemText primary="Kast" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
            <ListItemButton onClick={() => setAddFcOpen(true)}>
              <AddIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
              <ListItemText primary="Veld component" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          </List>

          <Divider />

          <List dense disablePadding sx={{ p: 1 }}>
            <ListSubheader disableSticky sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 0 }}>
              <span>Ruimtes</span>
              <IconButton size="small" onClick={() => setAddSpaceOpen(true)}><AddIcon fontSize="small" /></IconButton>
            </ListSubheader>
            <SpaceTree spaces={spaceTree ?? []} selectedId={selectedSpaceId} onSelect={setSelectedSpaceId} />
          </List>

        </Box>

        <Box sx={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={showZones ? nodes : nodes.filter(n => n.type !== 'spaceZone')}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null) }}
            deleteKeyCode="Delete"
            fitView
          >
            <Background />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </Box>

        <Drawer
          anchor="right"
          variant="persistent"
          open={!!(selectedNode || selectedEdge)}
          PaperProps={{ sx: { position: 'relative', width: 360 } }}
          SlideProps={{ container: document.body }}
        >
          {selectedNode && projectId && (
            <NodeDetailPanel
              nodeId={selectedNode.id}
              nodeType={selectedNode.type}
              data={selectedNode.data}
              projectId={projectId}
              spaceList={spaceList ?? []}
              onClose={() => setSelectedNode(null)}
              onNodeUpdated={onNodeUpdated}
            />
          )}
          {selectedEdge && (
            <EdgeDetailPanel
              edgeId={selectedEdge.id}
              data={selectedEdge.data}
              onClose={() => setSelectedEdge(null)}
              onDelete={async () => {
                try {
                  await connectionsApi.delete(selectedEdge.id)
                  setEdges(eds => eds.filter(e => e.id !== selectedEdge.id))
                  setSelectedEdge(null)
                } catch {
                  setSnack({ msg: 'Verbinding verwijderen mislukt', sev: 'error' })
                }
              }}
              onUpdated={(updated) => {
                setSelectedEdge(prev => prev ? { ...prev, data: updated } : null)
                setEdges(eds => eds.map(e =>
                  e.id === selectedEdge.id
                    ? { ...e, label: updated.cable_ref || updated.label || '', data: updated }
                    : e
                ))
              }}
            />
          )}
        </Drawer>
      </Box>

      {/* Kast toevoegen */}
      <Dialog open={addCabinetOpen} onClose={() => setAddCabinetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Kast toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth required>
            <InputLabel>Type</InputLabel>
            <Select value={cabinetForm.cabinet_type} label="Type" autoFocus
              onChange={e => setCabinetForm(f => ({ ...f, cabinet_type: e.target.value as CabinetType }))}>
              {CABINET_TYPES.map(ct => <MenuItem key={ct.value} value={ct.value}>{ct.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Naam" value={cabinetForm.name}
            onChange={e => setCabinetForm(f => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField
            label="Functie-aanduiding (=)"
            value={cabinetForm.function_designation}
            onChange={e => setCabinetForm(f => ({ ...f, function_designation: e.target.value }))}
            fullWidth
            helperText="IEC 81346 — bijv. A1, P01 (zonder = prefix)"
          />
          <FormControl fullWidth>
            <InputLabel>Ruimte (locatie +)</InputLabel>
            <Select value={cabinetForm.space_id} label="Ruimte (locatie +)"
              onChange={e => setCabinetForm(f => ({ ...f, space_id: e.target.value }))}>
              <MenuItem value=""><em>Geen</em></MenuItem>
              {spaceList?.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.designation ? `${s.designation} — ` : ''}{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Omschrijving" value={cabinetForm.description}
            onChange={e => setCabinetForm(f => ({ ...f, description: e.target.value }))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCabinetOpen(false)}>Annuleren</Button>
          <Button variant="contained" disabled={!cabinetForm.cabinet_type || !cabinetForm.name.trim()} onClick={addCabinet}>
            Toevoegen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Veld component toevoegen */}
      <Dialog open={addFcOpen} onClose={() => setAddFcOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Veld component toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Naam" value={fcForm.name} onChange={e => setFcForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <TextField label="Tag / toestelcode (-)" value={fcForm.tag} onChange={e => setFcForm(f => ({ ...f, tag: e.target.value }))} fullWidth helperText="IEC 81346 — bijv. M01, P02 (zonder - prefix)" />
          <TextField
            label="Functie-aanduiding (=)"
            value={fcForm.function_designation}
            onChange={e => setFcForm(f => ({ ...f, function_designation: e.target.value }))}
            fullWidth
            helperText="IEC 81346 — bijv. A1, P01 (zonder = prefix)"
          />
          <TextField label="Omschrijving" value={fcForm.description} onChange={e => setFcForm(f => ({ ...f, description: e.target.value }))} fullWidth />
          <FormControl fullWidth>
            <InputLabel>Ruimte (locatie +)</InputLabel>
            <Select value={fcForm.space_id} label="Ruimte (locatie +)" onChange={e => setFcForm(f => ({ ...f, space_id: e.target.value }))}>
              <MenuItem value=""><em>Geen</em></MenuItem>
              {spaceList?.map(s => <MenuItem key={s.id} value={s.id}>{s.designation ? `${s.designation} — ` : ''}{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFcOpen(false)}>Annuleren</Button>
          <Button variant="contained" disabled={!fcForm.name.trim()} onClick={addFieldComponent}>Toevoegen</Button>
        </DialogActions>
      </Dialog>

      {/* Ruimte toevoegen */}
      <Dialog open={addSpaceOpen} onClose={() => setAddSpaceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ruimte toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Naam" value={spaceForm.name} onChange={e => setSpaceForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={spaceForm.level_type ?? ''} label="Type" onChange={e => setSpaceForm(f => ({ ...f, level_type: e.target.value }))}>
              <MenuItem value=""><em>Geen</em></MenuItem>
              {LEVEL_TYPES.map(lt => <MenuItem key={lt.value} value={lt.value}>{lt.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Aanduiding IEC 81346 (bijv. +B01)"
            value={spaceForm.designation ?? ''}
            onChange={e => setSpaceForm(f => ({ ...f, designation: e.target.value }))}
            fullWidth helperText="Leeg = automatisch gegenereerd"
          />
          <FormControl fullWidth>
            <InputLabel>Bovenliggende ruimte</InputLabel>
            <Select value={spaceForm.parent_id ?? ''} label="Bovenliggende ruimte"
              onChange={e => setSpaceForm(f => ({ ...f, parent_id: e.target.value || undefined }))}>
              <MenuItem value=""><em>Geen (root)</em></MenuItem>
              {spaceList?.map(s => <MenuItem key={s.id} value={s.id}>{s.designation ? `${s.designation} — ` : ''}{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSpaceOpen(false)}>Annuleren</Button>
          <Button variant="contained" disabled={!spaceForm.name.trim()} onClick={addSpace}>Toevoegen</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.sev} onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
