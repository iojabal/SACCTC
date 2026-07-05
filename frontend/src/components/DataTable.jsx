// Tabla reutilizable con paginacion server-side
import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, CircularProgress, Box, Typography,
} from '@mui/material';

/**
 * columnas: [{ id, etiqueta, render?: (fila) => nodo, align? }]
 * datos:    array de filas
 * total/page/perPage/onPageChange/onPerPageChange: paginacion server-side
 */
export default function DataTable({
  columnas, datos, cargando = false, total = 0, page = 1, perPage = 25,
  onPageChange, onPerPageChange, onRowClick, vacio = 'Sin registros',
}) {
  return (
    <Paper variant="outlined">
      <TableContainer sx={{ maxHeight: 560 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columnas.map((col) => (
                <TableCell key={col.id} align={col.align || 'left'}
                  sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                  {col.etiqueta}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={columnas.length} align="center">
                  <Box py={4}><CircularProgress size={32} /></Box>
                </TableCell>
              </TableRow>
            )}
            {!cargando && datos.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnas.length} align="center">
                  <Typography color="text.secondary" py={3}>{vacio}</Typography>
                </TableCell>
              </TableRow>
            )}
            {!cargando && datos.map((fila, i) => (
              <TableRow
                hover
                key={fila.id ?? fila.id_trf ?? fila.id_cont ?? fila.id_renov ?? fila.id_afi ?? i}
                onClick={onRowClick ? () => onRowClick(fila) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columnas.map((col) => (
                  <TableCell key={col.id} align={col.align || 'left'}>
                    {col.render ? col.render(fila) : fila[col.id] ?? '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {onPageChange && (
        <TablePagination
          component="div"
          count={total}
          page={page - 1}
          rowsPerPage={perPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_e, nueva) => onPageChange(nueva + 1)}
          onRowsPerPageChange={(e) => onPerPageChange?.(parseInt(e.target.value, 10))}
          labelRowsPerPage="Filas:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      )}
    </Paper>
  );
}
