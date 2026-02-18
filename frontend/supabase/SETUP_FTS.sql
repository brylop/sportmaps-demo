-- ==============================================================================
-- SEARCH ENHANCEMENT SCRIPT: FULL-TEXT SEARCH (FTS)
-- Fecha: 2026-02-17
-- Autor: Antigravity AI Agent
-- Descripción: Implementa búsqueda inteligente (insensible a acentos) en Escuelas.
--              Mejora crítica de UX para usuarios en LatAm.
-- ==============================================================================

BEGIN;

-- 1. Activar extensión para ignorar acentos (ej. "fútbol" == "futbol")
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Agregar columna de búsqueda calculada a la tabla 'schools'
--    Combina nombre y descripción, normaliza texto y lo almacena vectorizado.
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS fts tsvector 
GENERATED ALWAYS AS (
  to_tsvector('spanish', unaccent(name) || ' ' || unaccent(coalesce(description, '')))
) STORED;

-- 3. Crear índice GIN para búsquedas instantáneas
CREATE INDEX IF NOT EXISTS idx_schools_fts ON public.schools USING GIN (fts);

COMMIT;
