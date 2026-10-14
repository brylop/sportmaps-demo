-- =============================================================================
-- 20261013164839_whatsapp_tipos_de_contacto.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013124655
-- Objetivo: que los números que no son familias (contactos personales de la
-- dueña, proveedores/negocios, otros clubes, el número de SportMaps) se marquen
-- UNA vez y dejen de llenar la bandeja «Comprobantes sin resolver».
--
-- Medido en Dynasty el 2026-10-13: de 87 filas «para revisar», 37 eran de un
-- proveedor mayorista (una ráfaga), 14 del círculo personal de la dueña y 5 de
-- negocios/otro club/SportMaps. Hasta hoy la única marca era `personal`.
--
-- Qué hace:
--   1. Amplía el CHECK de `whatsapp_conversations.contact_kind` con tres marcas
--      manuales nuevas: `negocio`, `otro_club`, `plataforma`. Las cuatro marcas
--      manuales (personal|negocio|otro_club|plataforma) significan lo mismo
--      para el bot: no es familia, no se le habla, no se guarda contenido y sus
--      adjuntos no se procesan. Sigue siendo text + CHECK (no ENUM).
--   2. Columna `tambien_familia boolean NOT NULL DEFAULT false`: la persona
--      marcada (p. ej. el esposo de la dueña) TAMBIÉN es acudiente. Con la
--      bandera sus comprobantes se aplican en silencio a los cobros de su
--      hijo; sus fotos personales no llegan a «revisar».
--
-- Sin funciones nuevas ni cambios de RLS. Verificado contra la base el
-- 2026-10-13: ninguna función de `public` lee `contact_kind` (lo filtra el BFF),
-- así que no hay RPC que actualizar.
--
-- Idempotente (DROP CONSTRAINT IF EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

BEGIN;

-- 1. Marcas manuales nuevas ---------------------------------------------------
ALTER TABLE public.whatsapp_conversations
    DROP CONSTRAINT IF EXISTS whatsapp_conversations_contact_kind_check;

ALTER TABLE public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_contact_kind_check
    CHECK (contact_kind IS NULL OR contact_kind IN (
        'familia',             -- acudiente con cuenta de un atleta activo
        'familia_sin_cuenta',  -- el número está en la ficha de un atleta activo, sin cuenta
        'ambiguo',             -- el número está en dos cuentas: lo resuelve un humano
        'staff',               -- administra la escuela (owner/admin)
        'desconocido',         -- nada de lo anterior (clasificación automática)
        -- Marcas MANUALES (las pone la escuela; mandan sobre la clasificación):
        'personal',            -- familia o amigos de quien dirige la escuela
        'negocio',             -- proveedor, mayorista, gastrobar, agencia…
        'otro_club',           -- otro club o escuela deportiva
        'plataforma'           -- el número de SportMaps u otra plataforma
    ));

COMMENT ON COLUMN public.whatsapp_conversations.contact_kind IS
    'Quién es el contacto. Automático (whatsapp-atencion.service): familia|familia_sin_cuenta|ambiguo|staff|desconocido. '
    'Marca manual de la escuela, manda sobre lo automático: personal|negocio|otro_club|plataforma '
    '(no es familia: el bot no le habla, no se guarda contenido, sus filas no cuentan en la bandeja). NULL = sin clasificar.';

-- 2. «También es familia» -----------------------------------------------------
ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS tambien_familia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_conversations.tambien_familia IS
    'Con una marca manual (personal|negocio|otro_club|plataforma): la persona TAMBIÉN es acudiente. '
    'Sus comprobantes se aplican en silencio a los cobros de sus hijos; lo demás no llega a la bandeja. '
    'Sin marca manual no tiene efecto.';

COMMIT;
