import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Typography, Button, Card, CardContent, CardActionArea,
  CardActions, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { projectsApi } from '../api/client'
import type { ProjectCreate } from '../api/types'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ProjectCreate>({ name: '', description: '' })

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setDialogOpen(false)
      setForm({ name: '', description: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <AccountTreeIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>HW Engineering</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Nieuw project
        </Button>
      </Box>

      {isLoading && <CircularProgress />}
      {isError && <Alert severity="error">Kon projecten niet laden. Is de backend actief?</Alert>}

      <Box display="flex" flexWrap="wrap" gap={2}>
        {projects?.map(project => (
          <Card key={project.id} sx={{ width: 280, display: 'flex', flexDirection: 'column' }}>
            <CardActionArea onClick={() => navigate(`/projects/${project.id}`)} sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>{project.name}</Typography>
                {project.description && (
                  <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                )}
                <Typography variant="caption" color="text.disabled" display="block" mt={1}>
                  {new Date(project.created_at).toLocaleDateString('nl-BE')}
                </Typography>
              </CardContent>
            </CardActionArea>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              <Tooltip title="Verwijder project">
                <IconButton
                  size="small"
                  color="error"
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`Project "${project.name}" verwijderen?`)) {
                      deleteMutation.mutate(project.id)
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        ))}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nieuw project</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Naam"
            fullWidth
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="Omschrijving (optioneel)"
            fullWidth
            multiline
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuleren</Button>
          <Button
            variant="contained"
            disabled={!form.name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ name: form.name.trim(), description: form.description || undefined })}
          >
            Aanmaken
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
