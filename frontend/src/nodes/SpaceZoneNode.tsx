import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography } from '@mui/material'

export interface SpaceZoneData {
  [key: string]: unknown
  id: string
  name: string
  designation: string | null
  level_type: string | null
}

export type SpaceZoneNodeType = Node<SpaceZoneData, 'spaceZone'>

const LEVEL_STYLE: Record<string, { bg: string; border: string }> = {
  gebouw:     { bg: 'rgba(227,242,253,0.55)', border: '#90caf9' },
  verdieping: { bg: 'rgba(232,245,233,0.55)', border: '#a5d6a7' },
  ruimte:     { bg: 'rgba(255,243,224,0.55)', border: '#ffcc80' },
  zone:       { bg: 'rgba(243,229,245,0.55)', border: '#ce93d8' },
}

const SpaceZoneNode = memo(({ data, selected }: NodeProps<SpaceZoneNodeType>) => {
  const style = LEVEL_STYLE[data.level_type ?? ''] ?? { bg: 'rgba(245,245,245,0.5)', border: '#bdbdbd' }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={140}
        lineStyle={{ borderColor: style.border }}
        handleStyle={{ borderColor: style.border, background: '#fff' }}
      />
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: style.bg,
          border: `2px dashed ${selected ? style.border : style.border + 'aa'}`,
          borderRadius: 2,
          pointerEvents: 'all',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderBottom: `1px dashed ${style.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {data.designation && (
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              {data.designation}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {data.name}
          </Typography>
          {data.level_type && (
            <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', textTransform: 'uppercase', fontSize: 9 }}>
              {data.level_type}
            </Typography>
          )}
        </Box>
      </Box>
    </>
  )
})

SpaceZoneNode.displayName = 'SpaceZoneNode'
export default SpaceZoneNode
