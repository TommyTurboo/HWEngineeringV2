import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Typography, Button, IconButton, List, ListItem,
  ListItemText, ListItemSecondaryAction, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Select,
  MenuItem, FormControl, InputLabel, Tooltip, CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import type { CanvasNodeData, Space, CabinetType } from '../api/types'
import { CABINET_TYPES } from '../api/types'
import { componentsApi, testsApi, cabinetsApi, fieldComponentsApi } from '../api/client'

const TEST_TYPES = ['isolatiemeting', 'continuïteit', 'functioneel', 'beveiliging', 'spanning']

const statusIcon = (s: string) => {
  if (s === 'pass') return <CheckCircleIcon fontSize="small" color="success" />
  if (s === 'fail') return <CancelIcon fontSize="small" color="error" />
  return <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
}

interface Props {
  nodeId: string
  nodeType: 'cabinet' | 'fieldComponent'
  data: CanvasNodeData
  projectId: string
  spaceList: Space[]
  onClose: () => void
  onNodeUpdated: (nodeId: string, updates: Partial<CanvasNodeData>) => void
}

export default function NodeDetailPanel({ nodeId, nodeType, data, spaceList, onClose, onNodeUpdated }: Props) {
  const qc = useQueryClient()
  if (nodeType === 'cabinet') {
    return <CabinetPanel cabinetId={nodeId} data={data} spaceList={spaceList} qc={qc} onClose={onClose} onNodeUpdated={onNodeUpdated} />
  }
  return <FieldComponentPanel fcId={nodeId} data={data} spaceList={spaceList} qc={qc} onClose={onClose} onNodeUpdated={onNodeUpdated} />
}

interface BasePanelProps {
  data: CanvasNodeData
  spaceList: Space[]
  qc: ReturnType<typeof useQueryClient>
  onClose: () => void
  onNodeUpdated: (nodeId: string, updates: Partial<CanvasNodeData>) => void
}

function CabinetPanel({ cabinetId, data, spaceList, qc, onClose, onNodeUpdated }: BasePanelProps & { cabinetId: string }) {
  const [form, setForm] = useState({
    name: data.name,
    function_designation: data.function_designation ?? '',
    space_id: data.space_id ?? '',
    description: data.description ?? '',
    cabinet_type: data.cabinet_type ?? '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [compForm, setCompForm] = useState({ name: '', tag: '' })

  useEffect(() => {
    setForm({
      name: data.name,
      function_designation: data.function_designation ?? '',
      space_id: data.space_id ?? '',
      description: data.description ?? '',
      cabinet_type: data.cabinet_type ?? '',
    })
    setDirty(false)
  }, [cabinetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: components, isLoading } = useQuery({
    queryKey: ['components', cabinetId],
    queryFn: () => componentsApi.list(cabinetId),
  })

  const addMutation = useMutation({
    mutationFn: () => componentsApi.create(cabinetId, {
      name: compForm.name.trim(),
      tag: compForm.tag || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components', cabinetId] })
      setAddOpen(false)
      setCompForm({ name: '', tag: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: componentsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components', cabinetId] }),
  })

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await cabinetsApi.update(cabinetId, {
        name: form.name.trim() || undefined,
        cabinet_type: (form.cabinet_type as CabinetType) || undefined,
        function_designation: form.function_designation || null,
        space_id: form.space_id || null,
        description: form.description || null,
      })
      const space = spaceList.find(s => s.id === form.space_id)
      onNodeUpdated(cabinetId, {
        name: form.name.trim() || data.name,
        cabinet_type: form.cabinet_type || null,
        function_designation: form.function_designation || null,
        space_id: form.space_id || null,
        space_designation: space?.designation ?? null,
        description: form.description || null,
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ width: 360, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, bgcolor: '#1565c0', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{data.name}</Typography>
          {data.tag && <Typography variant="caption" sx={{ opacity: 0.85 }}>{data.tag}</Typography>}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>✕</IconButton>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Eigenschappen
        </Typography>

        <FormControl fullWidth size="small">
          <InputLabel>Type</InputLabel>
          <Select value={form.cabinet_type} label="Type" onChange={e => set('cabinet_type', e.target.value)}>
            {CABINET_TYPES.map(ct => <MenuItem key={ct.value} value={ct.value}>{ct.label}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField size="small" label="Naam" value={form.name}
          onChange={e => set('name', e.target.value)} fullWidth />

        <TextField size="small" label="Functie-aanduiding (=)" value={form.function_designation}
          onChange={e => set('function_designation', e.target.value)} fullWidth
          helperText="IEC 81346 — bijv. A1, P01" />

        <FormControl fullWidth size="small">
          <InputLabel>Ruimte (locatie +)</InputLabel>
          <Select value={form.space_id} label="Ruimte (locatie +)" onChange={e => set('space_id', e.target.value)}>
            <MenuItem value=""><em>Geen</em></MenuItem>
            {spaceList.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.designation ? `${s.designation} — ` : ''}{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField size="small" label="Omschrijving" value={form.description}
          onChange={e => set('description', e.target.value)} fullWidth multiline rows={2} />

        {dirty && (
          <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={save}
            disabled={saving || !form.name.trim()}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </Button>
        )}
      </Box>

      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" fontWeight={700}>Componenten ({components?.length ?? 0})</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Toevoegen</Button>
        </Box>
        {isLoading && <CircularProgress size={20} />}
        <List dense disablePadding>
          {components?.map(c => (
            <ListItem key={c.id} disablePadding sx={{ borderBottom: '1px solid #f0f0f0', py: 0.5 }}>
              <ListItemText primary={<Typography variant="body2">{c.tag ? `${c.tag} — ` : ''}{c.name}</Typography>} />
              <ListItemSecondaryAction>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(c.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Component toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Naam" value={compForm.name}
            onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <TextField label="Tag (optioneel)" value={compForm.tag}
            onChange={e => setCompForm(f => ({ ...f, tag: e.target.value }))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuleren</Button>
          <Button variant="contained" disabled={!compForm.name.trim()} onClick={() => addMutation.mutate()}>
            Toevoegen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function FieldComponentPanel({ fcId, data, spaceList, qc, onClose, onNodeUpdated }: BasePanelProps & { fcId: string }) {
  const [form, setForm] = useState({
    name: data.name,
    tag: data.tag ?? '',
    function_designation: data.function_designation ?? '',
    space_id: data.space_id ?? '',
    description: data.description ?? '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [testForm, setTestForm] = useState({ name: '', test_type: TEST_TYPES[0], expected_value: '', unit: '' })

  useEffect(() => {
    setForm({
      name: data.name,
      tag: data.tag ?? '',
      function_designation: data.function_designation ?? '',
      space_id: data.space_id ?? '',
      description: data.description ?? '',
    })
    setDirty(false)
  }, [fcId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: tests, isLoading } = useQuery({
    queryKey: ['tests-fc', fcId],
    queryFn: () => testsApi.listByFieldComponent(fcId),
  })

  const addMutation = useMutation({
    mutationFn: () => testsApi.create({
      name: testForm.name.trim(),
      test_type: testForm.test_type,
      field_component_id: fcId,
      expected_value: testForm.expected_value || undefined,
      unit: testForm.unit || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests-fc', fcId] })
      setAddOpen(false)
      setTestForm({ name: '', test_type: TEST_TYPES[0], expected_value: '', unit: '' })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => testsApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests-fc', fcId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: testsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests-fc', fcId] }),
  })

  const nextStatus = (s: string) => s === 'pending' ? 'pass' : s === 'pass' ? 'fail' : 'pending'

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await fieldComponentsApi.update(fcId, {
        name: form.name.trim() || undefined,
        tag: form.tag || null,
        function_designation: form.function_designation || null,
        space_id: form.space_id || null,
        description: form.description || null,
      })
      const space = spaceList.find(s => s.id === form.space_id)
      onNodeUpdated(fcId, {
        name: form.name.trim() || data.name,
        tag: form.tag || null,
        function_designation: form.function_designation || null,
        space_id: form.space_id || null,
        space_designation: space?.designation ?? null,
        description: form.description || null,
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ width: 360, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, bgcolor: '#2e7d32', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{data.name}</Typography>
          {data.tag && <Typography variant="caption" sx={{ opacity: 0.85 }}>{data.tag}</Typography>}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>✕</IconButton>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Eigenschappen
        </Typography>

        <TextField size="small" label="Naam" value={form.name}
          onChange={e => set('name', e.target.value)} fullWidth />

        <TextField size="small" label="Tag / toestelcode (-)" value={form.tag}
          onChange={e => set('tag', e.target.value)} fullWidth
          helperText="IEC 81346 — bijv. M01, P02" />

        <TextField size="small" label="Functie-aanduiding (=)" value={form.function_designation}
          onChange={e => set('function_designation', e.target.value)} fullWidth
          helperText="IEC 81346 — bijv. A1, P01" />

        <FormControl fullWidth size="small">
          <InputLabel>Ruimte (locatie +)</InputLabel>
          <Select value={form.space_id} label="Ruimte (locatie +)" onChange={e => set('space_id', e.target.value)}>
            <MenuItem value=""><em>Geen</em></MenuItem>
            {spaceList.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.designation ? `${s.designation} — ` : ''}{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField size="small" label="Omschrijving" value={form.description}
          onChange={e => set('description', e.target.value)} fullWidth multiline rows={2} />

        {dirty && (
          <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={save}
            disabled={saving || !form.name.trim()}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </Button>
        )}
      </Box>

      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" fontWeight={700}>Testen ({tests?.length ?? 0})</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Toevoegen</Button>
        </Box>
        {isLoading && <CircularProgress size={20} />}
        <List dense disablePadding>
          {tests?.map(t => (
            <ListItem key={t.id} disablePadding sx={{ borderBottom: '1px solid #f0f0f0', py: 0.5 }}>
              <Tooltip title={`Status: ${t.status} — klik om te wisselen`}>
                <IconButton size="small" onClick={() => updateStatusMutation.mutate({ id: t.id, status: nextStatus(t.status) })}>
                  {statusIcon(t.status)}
                </IconButton>
              </Tooltip>
              <ListItemText
                primary={<Typography variant="body2">{t.name}</Typography>}
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {t.test_type}{t.expected_value ? ` · ${t.expected_value}${t.unit ? ' ' + t.unit : ''}` : ''}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(t.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Test toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Naam" value={testForm.name}
            onChange={e => setTestForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <FormControl fullWidth>
            <InputLabel>Testtype</InputLabel>
            <Select value={testForm.test_type} label="Testtype"
              onChange={e => setTestForm(f => ({ ...f, test_type: e.target.value }))}>
              {TEST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" gap={1}>
            <TextField label="Verwachte waarde" value={testForm.expected_value}
              onChange={e => setTestForm(f => ({ ...f, expected_value: e.target.value }))} fullWidth />
            <TextField label="Eenheid" value={testForm.unit}
              onChange={e => setTestForm(f => ({ ...f, unit: e.target.value }))} sx={{ width: 100 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuleren</Button>
          <Button variant="contained" disabled={!testForm.name.trim()} onClick={() => addMutation.mutate()}>
            Toevoegen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
