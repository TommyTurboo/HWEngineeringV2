import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

type SchematicEdgeData = {
  cable_ref?: string | null
  label?: string | null
  routeOffset?: number
  edgeColor?: string
  sourceCrossings?: number[]
  targetCrossings?: number[]
  overrideSourceX?: number
  overrideTargetX?: number
  midYOverride?: number
}

const BRIDGE_R = 6

function verticalWithBridges(x: number, from: number, to: number, crossings: number[]): string {
  const goingDown = from < to
  const pts = (crossings ?? [])
    .filter(cy => cy > Math.min(from, to) + BRIDGE_R && cy < Math.max(from, to) - BRIDGE_R)
    .sort((a, b) => goingDown ? a - b : b - a)
  let seg = ''
  for (const cy of pts) {
    if (goingDown) {
      seg += ` L ${x},${cy - BRIDGE_R} A ${BRIDGE_R} ${BRIDGE_R} 0 0 1 ${x},${cy + BRIDGE_R}`
    } else {
      seg += ` L ${x},${cy + BRIDGE_R} A ${BRIDGE_R} ${BRIDGE_R} 0 0 1 ${x},${cy - BRIDGE_R}`
    }
  }
  seg += ` L ${x},${to}`
  return seg
}

export default function SchematicEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as SchematicEdgeData
  const offset = edgeData.routeOffset ?? 0
  const color = edgeData.edgeColor ?? '#4f6f52'
  const sx = edgeData.overrideSourceX ?? sourceX
  const tx = edgeData.overrideTargetX ?? targetX
  const midY = edgeData.midYOverride !== undefined
    ? edgeData.midYOverride
    : sourceY + Math.max(54 + offset, (targetY - sourceY) / 2)

  const edgePath =
    `M ${sx},${sourceY}` +
    verticalWithBridges(sx, sourceY, midY, edgeData.sourceCrossings ?? []) +
    ` L ${tx},${midY}` +
    verticalWithBridges(tx, midY, targetY, edgeData.targetCrossings ?? [])

  const label = edgeData.cable_ref || edgeData.label

  // Vertical cable when sx ≈ tx: place label rotated 90° on the vertical segment
  const isVertical = Math.abs(sx - tx) < 20
  const labelX = isVertical ? sx : (sx + tx) / 2
  const labelY = isVertical ? (sourceY + targetY) / 2 : midY
  const labelTransform = isVertical
    ? `translate(-50%, -50%) translate(${labelX}px,${labelY}px) rotate(-90deg)`
    : `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 2.2 : 1.4,
          stroke: selected ? '#1565c0' : color,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: labelTransform,
              fontSize: 10,
              fontWeight: 700,
              color,
              background: 'rgba(255,255,255,0.92)',
              border: `1px solid ${color}55`,
              padding: '1px 4px',
              pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
