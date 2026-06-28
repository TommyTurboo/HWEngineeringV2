import { useState, useCallback } from 'react'
import { Autocomplete, TextField, CircularProgress, Typography, Box } from '@mui/material'
import axios from 'axios'

export interface EtimClass {
  id: string
  desc: string
  group: string | null
}

interface Props {
  value: EtimClass | null
  onChange: (val: EtimClass | null) => void
  label?: string
}

export default function EtimSearchField({ value, onChange, label = 'ETIM-klasse' }: Props) {
  const [options, setOptions] = useState<EtimClass[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setOptions([]); return }
    setLoading(true)
    try {
      const res = await axios.get<EtimClass[]>(`/api/v1/etim/search?q=${encodeURIComponent(q)}&limit=30`)
      setOptions(res.data)
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <Autocomplete
      value={value}
      inputValue={inputValue}
      options={options}
      loading={loading}
      getOptionLabel={o => `${o.id} — ${o.desc}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={x => x}
      onInputChange={(_, val) => {
        setInputValue(val)
        search(val)
      }}
      onChange={(_, val) => onChange(val)}
      noOptionsText={inputValue.length < 2 ? 'Typ minstens 2 tekens…' : 'Geen resultaten'}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box>
            <Typography variant="body2" fontWeight={600}>{option.id}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.desc}{option.group ? ` · ${option.group}` : ''}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  )
}
