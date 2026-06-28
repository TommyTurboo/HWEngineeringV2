import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography, Chip } from '@mui/material'
import type { CanvasNodeData } from '../api/types'

const TYPE_COLOR: Record<string, string> = {
  hoofdverdeler: '#1565c0',
  onderverdeler: '#1976d2',
  besturingskast: '#6a1b9a',
  netwerkkast: '#00695c',
  klemmenkast: '#e65100',
}

const TYPE_LABEL: Record<string, string> = {
  hoofdverdeler: 'HV',
  onderverdeler: 'OV',
  besturingskast: 'BK',
  netwerkkast: 'NK',
  klemmenkast: 'KK',
}

function buildRef(data: CanvasNodeData): string {
  if (data.description?.startsWith('==')) return data.description
  const parts: string[] = []
  if (data.function_designation) parts.push(`=${data.function_designation}`)
  if (data.space_designation) parts.push(data.space_designation)
  if (data.tag) parts.push(`-${data.tag}`)
  return parts.join('')
}

export type CabinetNodeType = Node<CanvasNodeData, 'cabinet'>

const handleStyle = (color: string) => ({
  width: 8,
  height: 8,
  background: color,
  border: '1px solid #fff',
})

const CabinetNode = memo(({ data, selected }: NodeProps<CabinetNodeType>) => {
  const color = TYPE_COLOR[data.cabinet_type ?? ''] ?? '#1565c0'
  const ref = buildRef(data)
  const nodeWidth = data.nodeWidth ?? 220

  return (
    <Box
      sx={{
        width: nodeWidth,
        border: selected ? `2px solid ${color}` : '2px solid #90caf9',
        borderRadius: 2,
        bgcolor: selected ? '#e3f2fd' : '#ffffff',
        boxShadow: selected ? `0 0 0 3px ${color}33` : '0 2px 8px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          bgcolor: color,
          borderRadius: '6px 6px 0 0',
          px: 1.5,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        {data.cabinet_type && (
          <Typography variant="caption" fontWeight={800} color="#fff" sx={{ opacity: 0.85 }}>
            {TYPE_LABEL[data.cabinet_type]}
          </Typography>
        )}
        <Typography variant="caption" fontWeight={700} color="#fff" noWrap sx={{ flex: 1 }}>
          {ref || data.name}
        </Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" display="block" fontWeight={600} color="text.primary" noWrap>
          {data.name}
        </Typography>
        <Chip
          label={`${data.component_count ?? 0} comp.`}
          size="small"
          sx={{ fontSize: 11, height: 18, bgcolor: '#e3f2fd', color, mt: 0.5 }}
        />
      </Box>
      <Handle id="top" type="target" position={Position.Top} style={handleStyle(color)} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle(color)} />
      {(data.targetHandles ?? []).map(h => (
        <Handle key={h.id} id={h.id} type="target" position={Position.Top}
          style={{ ...handleStyle(color), left: `${h.leftPercent}%` }} />
      ))}
      {(data.sourceHandles ?? []).map(h => (
        <Handle key={h.id} id={h.id} type="source" position={Position.Bottom}
          style={{ ...handleStyle(color), left: `${h.leftPercent}%` }} />
      ))}
    </Box>
  )
})

CabinetNode.displayName = 'CabinetNode'
export default CabinetNode
