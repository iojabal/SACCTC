// Validaciones client-side (el servidor SIEMPRE re-valida)

export function validarCI(valor) {
  if (!valor || !valor.trim()) return 'El CI es requerido';
  const limpio = valor.replace(/[-\s]/g, '');
  if (!/^[a-zA-Z0-9]{4,15}$/.test(limpio)) return 'CI invalido (4-15 caracteres alfanumericos)';
  return null;
}

export function validarRequerido(valor, nombre) {
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return `${nombre} es requerido`;
  }
  return null;
}

export function validarFecha(valor, nombre, obligatorio = false) {
  if (!valor) return obligatorio ? `${nombre} es requerida` : null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return `${nombre} invalida`;
  return null;
}

export function validarEnteroPositivo(valor, nombre, obligatorio = false) {
  if (valor === null || valor === undefined || valor === '') {
    return obligatorio ? `${nombre} es requerido` : null;
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) return `${nombre} debe ser un entero >= 0`;
  return null;
}

export function validarDecimalPositivo(valor, nombre, obligatorio = false, max = null) {
  if (valor === null || valor === undefined || valor === '') {
    return obligatorio ? `${nombre} es requerido` : null;
  }
  const n = Number(valor);
  if (Number.isNaN(n) || n < 0) return `${nombre} debe ser un numero >= 0`;
  if (max !== null && n > max) return `${nombre} debe ser <= ${max}`;
  return null;
}

/** Ejecuta una lista de validadores; devuelve array de errores (vacio = OK) */
export function validarTodo(...resultados) {
  return resultados.filter(Boolean);
}
