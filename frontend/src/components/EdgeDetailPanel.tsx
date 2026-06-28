import { useState, useEffect } from 'react'
import {
  Box, Typography, IconButton, Divider, TextField,
  MenuItem, Select, FormControl, InputLabel, InputAdornment,
  Tooltip, Button,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import { connectionsApi } from '../api/client'
import type { ConnectionUpdate } from '../api/types'

const CABLE_TYPES = ['NYY', 'NAYY', 'XLPE', 'FXP', 'HFFR', 'VVF', 'NYM', 'SY', 'YY', 'JZ-500']
const CABLE_SECTIONS = [0.75, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240]

interface EdgeData {
  [key: string]: unknown
  id: string
  label: string | null
  cable_ref: string | null
  cable_type: string | null
  cable_section: number | null
  cable_length: number | null
}

interface Props {
  edgeId: string
  data: EdgeData
  onClose: () => void
  onDelete: () => void
  onUpdated: (data: EdgeData) => void
}

export default function EdgeDetailPanel({ edgeId, data, onClose, onDelete, onUpdated }: Props) {
  const [form, setForm] = useState<EdgeData>(data)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(data) }, [data])

  const save = async (patch: Partial<EdgeData>) => {
    const updated = { ...form, ...patch }
    setForm(updated)
    setSaving(true)
    try {
      const body: ConnectionUpdate = {
        label: updated.label || null,
        cable_ref: updated.cable_ref || null,
        cable_type: updated.cable_type || null,
        cable_section: updated.cable_section,
        cable_length: updated.cable_length,
      }
      const result = await connectionsApi.update(edgeId, body)
      onUpdated({
        id: result.id,
        label: result.label,
        cable_ref: result.cable_ref,
        cable_type: result.cable_type,
        cable_section: result.cable_section,
        cable_length: result.cable_length,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          Kabel / Verbinding
        </Typography>
        <Tooltip title="Verwijderen">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
        <TextField
          label="Kabelcode"
          size="small"
          fullWidth
          value={form.cable_ref ?? ''}
          onChange={e => setForm(f => ({ ...f, cable_ref: e.target.value }))}
          onBlur={() => save({ cable_ref: form.cable_ref })}
          helperText="Bijv. W001, K-MOT-01"
          disabled={saving}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Kabeltype</InputLabel>
          <Select
            value={form.cable_type ?? ''}
            label="Kabeltype"
            onChange={e => save({ cable_type: e.target.value || null })}
          >
            <MenuItem value=""><em>Niet opgegeven</em></MenuItem>
            {CABLE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Sectie (mm²)</InputLabel>
          <Select
            value={form.cable_section ?? ''}
            label="Sectie (mm²)"
            onChange={e => {
              const value = e.target.value as number | ''
              save({ cable_section: value === '' ? null : Number(value) })
            }}
          >
            <MenuItem value=""><em>Niet opgegeven</em></MenuItem>
            {CABLE_SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField
          label="Lengte"
          size="small"
          fullWidth
          type="number"
          value={form.cable_length ?? ''}
          onChange={e => setForm(f => ({ ...f, cable_length: e.target.value ? Number(e.target.value) : null }))}
          onBlur={() => save({ cable_length: form.cable_length })}
          InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
          disabled={saving}
        />

        <TextField
          label="Canvas label (optioneel)"
          size="small"
          fullWidth
          value={form.label ?? ''}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          onBlur={() => save({ label: form.label })}
          helperText="Overschrijft kabelcode als canvas-label"
          disabled={saving}
        />
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          size="small"
        >
          Verbinding verwijderen
        </Button>
      </Box>
    </Box>
  )
}
