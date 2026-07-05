"""Tipos de columna compartidos.

BIGINT_PK: BIGINT en PostgreSQL (BIGSERIAL al ser PK autoincremental),
INTEGER en SQLite para que el autoincremento funcione en tests.
"""
from sqlalchemy import BigInteger, Integer

BIGINT_PK = BigInteger().with_variant(Integer(), 'sqlite')
