"""Validadores de entrada para las rutas (server-side, siempre).

Corrige el bug legacy de validar solo en el cliente.
"""
from datetime import date, datetime

from flask import jsonify


class ValidationError(Exception):
    def __init__(self, errores):
        self.errores = errores if isinstance(errores, list) else [errores]
        super().__init__('; '.join(self.errores))

    def respuesta(self):
        return jsonify({'error': 'Validacion fallida', 'detalles': self.errores}), 400


def limpiar(valor):
    """RTRIM(LTRIM(x)) + NULLIF(x, '') como en los procedures legacy."""
    if valor is None:
        return None
    valor = str(valor).strip()
    return valor or None


def requerido(data, campo, errores):
    valor = limpiar(data.get(campo))
    if valor is None:
        errores.append(f'El campo {campo} es requerido')
    return valor


def parsear_fecha(valor, campo, errores, obligatorio=False):
    valor = limpiar(valor)
    if valor is None:
        if obligatorio:
            errores.append(f'La fecha {campo} es requerida')
        return None
    for formato in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(valor, formato).date()
        except ValueError:
            continue
    errores.append(f'Fecha invalida en {campo} (use YYYY-MM-DD): {valor}')
    return None


def parsear_entero(valor, campo, errores, obligatorio=False, minimo=None):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        if obligatorio:
            errores.append(f'El campo {campo} es requerido')
        return None
    try:
        entero = int(valor)
    except (TypeError, ValueError):
        errores.append(f'Valor entero invalido en {campo}: {valor}')
        return None
    if minimo is not None and entero < minimo:
        errores.append(f'{campo} debe ser >= {minimo}')
        return None
    return entero


def parsear_decimal(valor, campo, errores, obligatorio=False, minimo=None, maximo=None):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        if obligatorio:
            errores.append(f'El campo {campo} es requerido')
        return None
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        errores.append(f'Valor numerico invalido en {campo}: {valor}')
        return None
    if minimo is not None and numero < minimo:
        errores.append(f'{campo} debe ser >= {minimo}')
        return None
    if maximo is not None and numero > maximo:
        errores.append(f'{campo} debe ser <= {maximo}')
        return None
    return numero


def validar_en_lista(valor, campo, valores_validos, errores, obligatorio=False):
    valor = limpiar(valor)
    if valor is None:
        if obligatorio:
            errores.append(f'El campo {campo} es requerido')
        return None
    if valor not in valores_validos:
        errores.append(f'{campo} invalido: {valor}. Validos: {", ".join(valores_validos)}')
        return None
    return valor


def validar_ci(valor, campo, errores, obligatorio=True):
    """CI boliviano: digitos, opcionalmente con guion/complemento. 4-15 chars."""
    valor = limpiar(valor)
    if valor is None:
        if obligatorio:
            errores.append(f'El campo {campo} (CI) es requerido')
        return None
    normalizado = valor.replace('-', '').replace(' ', '')
    if not normalizado.isalnum() or not (4 <= len(normalizado) <= 15):
        errores.append(f'CI invalido en {campo}: {valor}')
        return None
    return valor
