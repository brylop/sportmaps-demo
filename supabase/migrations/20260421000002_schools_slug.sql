-- =========================================================================
-- Schools: slug publico para micrositios multi-tenant (/s/:slug)
-- =========================================================================
-- 1. Agrega schools.slug (text, UNIQUE, nullable)
-- 2. Trigger genera slug desde name si viene vacio (maneja colisiones)
-- 3. Backfill de slug para escuelas existentes
-- 4. NOT NULL + indice
-- =========================================================================

-- 1. Columna (nullable de inicio para permitir backfill)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS slug text;


-- 2. Funcion + trigger
CREATE OR REPLACE FUNCTION public.generate_school_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_slug text;
    v_slug      text;
    v_counter   integer := 0;
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        -- lowercase + remover acentos + dejar solo a-z0-9 y espacios/guiones
        v_base_slug := lower(
            regexp_replace(
                translate(
                    COALESCE(NEW.name, ''),
                    'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇáéíóúàèìòùäëïöüâêîôûñç',
                    'AEIOUAEIOUAEIOUAEIOUNCaeiouaeiouaeiouaeioucn'
                ),
                '[^a-zA-Z0-9\s-]', '', 'g'
            )
        );
        v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
        v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
        v_base_slug := trim(both '-' from v_base_slug);

        IF v_base_slug = '' THEN
            v_base_slug := 'escuela';
        END IF;

        v_slug := v_base_slug;

        WHILE EXISTS (
            SELECT 1 FROM public.schools
             WHERE slug = v_slug AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) LOOP
            v_counter := v_counter + 1;
            v_slug := v_base_slug || '-' || v_counter;
        END LOOP;

        NEW.slug := v_slug;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_school_slug ON public.schools;
CREATE TRIGGER trg_generate_school_slug
    BEFORE INSERT OR UPDATE OF name, slug ON public.schools
    FOR EACH ROW EXECUTE FUNCTION public.generate_school_slug();


-- 3. Backfill: forzar generacion de slug via trigger en filas sin slug
UPDATE public.schools
   SET slug = NULL
 WHERE slug IS NULL OR slug = '';

-- El UPDATE anterior dispara el trigger y asigna slug unico a cada fila.
-- Para filas sin name (edge case) el trigger asigna 'escuela' + contador.


-- 4. Constraints + indice
-- DEFAULT '' + trigger => INSERTs existentes que no pasen slug siguen funcionando
ALTER TABLE public.schools
  ALTER COLUMN slug SET DEFAULT '';

ALTER TABLE public.schools
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug_unique
  ON public.schools(slug);


COMMENT ON COLUMN public.schools.slug IS
  'Slug publico unico para URL del micrositio (/s/:slug). Generado automaticamente desde name.';
