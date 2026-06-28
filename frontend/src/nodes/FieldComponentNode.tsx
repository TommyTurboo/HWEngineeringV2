import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography, Chip } from '@mui/material'
import type { CanvasNodeData } from '../api/types'

function buildRef(data: CanvasNodeData): string {
  if (data.description?.startsWith('==')) return data.description
  const parts: string[] = []
  if (data.function_designation) parts.push(`=${data.function_designation}`)
  if (data.space_designation) parts.push(data.space_designation)
  if (data.tag) parts.push(`-${data.tag}`)
  return parts.join('')
}

export type FieldComponentNodeType = Node<CanvasNodeData, 'fieldComponent'>

const handleStyle = {
  width: 8,
  height: 8,
  background: '#2e7d32',
  border: '1px solid #fff',
}

const FieldComponentNode = memo(({ data, selected }: NodeProps<FieldComponentNodeType>) => {
  const ref = buildRef(data)

  return (
    <Box
      sx={{
        width: 220,
        maxWidth: 220,
        border: selected ? '2px solid #2e7d32' : '2px solid #a5d6a7',
        borderRadius: 2,
        bgcolor: selected ? '#e8f5e9' : '#ffffff',
        boxShadow: selected ? '0 0 0 3px rgba(46,125,50,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          bgcolor: '#2e7d32',
          borderRadius: '6px 6px 0 0',
          px: 1.5,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <Typography variant="caption" fontWeight={700} color="#fff" noWrap sx={{ minWidth: 0 }}>
          {ref || data.name}
        </Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" display="block" fontWeight={600} color="text.primary" noWrap>
          {data.name}
        </Typography>
        {data.typical?.family && (
          <Chip
            label={data.typical.family}
            size="small"
            sx={{ fontSize: 11, height: 20, bgcolor: '#e8f5e9', color: '#2e7d32', textTransform: 'capitalize', mt: 0.5 }}
          />
        )}
      </Box>
      <Handle id="top" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />
      {(data.targetHandles ?? []).map(h => (
        <Handle key={h.id} id={h.id} type="target" position={Position.Top}
          style={{ ...handleStyle, left: `${h.leftPercent}%` }} />
      ))}
      {(data.sourceHandles ?? []).map(h => (
        <Handle key={h.id} id={h.id} type="source" position={Position.Bottom}
          style={{ ...handleStyle, left: `${h.leftPercent}%` }} />
      ))}
    </Box>
  )
})

FieldComponentNode.displayName = 'FieldComponentNode'
export default FieldComponentNode
