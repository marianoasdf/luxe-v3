-- Script para asegurar columna created_at en usuarios
--
-- INSTRUCCIONES:
-- 1. Dirígete a la carpeta scripts del backend:
--      cd backend/scripts
-- 2. Ejecuta este script con:
--      psql -U postgres -h localhost -d luxe_db -f fix_created_at_usuarios.sql
--
-- Este script agrega la columna created_at si no existe y la completa para todos los usuarios.

-- Agregar columna si no existe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Completar created_at para usuarios que no la tengan
UPDATE usuarios SET created_at = COALESCE(created_at, NOW());

-- Verificar resultado
SELECT id, nombre, email, created_at FROM usuarios ORDER BY id;

-- Para salir de psql: \q
