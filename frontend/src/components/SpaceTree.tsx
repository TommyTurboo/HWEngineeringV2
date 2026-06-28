import { useState } from 'react'
import {
  List, ListItemButton, ListItemText, ListItemIcon,
  Collapse, IconButton, Box, Typography,
} from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ApartmentIcon from '@mui/icons-material/Apartment'
import LayersIcon from '@mui/icons-material/Layers'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import CropFreeIcon from '@mui/icons-material/CropFree'
import type { SpaceTree as SpaceTreeType } from '../api/types'

const LEVEL_ICON: Record<string, React.ReactElement> = {
  gebouw: <ApartmentIcon fontSize="small" />,
  verdieping: <LayersIcon fontSize="small" />,
  ruimte: <MeetingRoomIcon fontSize="small" />,
  zone: <CropFreeIcon fontSize="small" />,
}

interface SpaceNodeProps {
  space: SpaceTreeType
  level: number
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function SpaceNode({ space, level, selectedId, onSelect }: SpaceNodeProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = space.children.length > 0
  const icon = LEVEL_ICON[space.level_type ?? ''] ?? <CropFreeIcon fontSize="small" />

  return (
    <>
      <ListItemButton
        selected={selectedId === space.id}
        onClick={() => onSelect(selectedId === space.id ? null : space.id)}
        sx={{ pl: 1 + level * 1.5, py: 0.5, borderRadius: 1 }}
        dense
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={space.name}
          secondary={space.designation}
          primaryTypographyProps={{ variant: 'body2', fontWeight: selectedId === space.id ? 700 : 400 }}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        {hasChildren && (
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            sx={{ p: 0 }}
          >
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
      </ListItemButton>
      {hasChildren && (
        <Collapse in={open} unmountOnExit>
          <List disablePadding>
            {space.children.map(child => (
              <SpaceNode key={child.id} space={child} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  )
}

interface SpaceTreeProps {
  spaces: SpaceTreeType[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd?: () => void
}

export default function SpaceTree({ spaces, selectedId, onSelect, onAdd }: SpaceTreeProps) {
  if (spaces.length === 0) {
    return (
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.disabled">Geen ruimtes</Typography>
      </Box>
    )
  }
  return (
    <List disablePadding dense>
      {spaces.map(s => (
        <SpaceNode key={s.id} space={s} level={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </List>
  )
}
