// Barra de busqueda reutilizable con debounce
import React, { useState, useEffect, useRef } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

export default function SearchBar({
  placeholder = 'Buscar...', onBuscar, retrasoMs = 400, autoFocus = false,
}) {
  const [valor, setValor] = useState('');
  const timeoutRef = useRef(null);
  const onBuscarRef = useRef(onBuscar);
  onBuscarRef.current = onBuscar;

  useEffect(() => {
    timeoutRef.current = setTimeout(() => onBuscarRef.current(valor.trim()), retrasoMs);
    return () => clearTimeout(timeoutRef.current);
  }, [valor, retrasoMs]);

  return (
    <TextField
      fullWidth
      size="small"
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start"><SearchIcon /></InputAdornment>
        ),
        endAdornment: valor && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setValor('')}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
