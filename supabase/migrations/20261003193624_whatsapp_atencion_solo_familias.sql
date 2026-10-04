-- =============================================================================
-- 20261003193624_whatsapp_atencion_solo_familias.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261002130001
-- Objetivo: que el buzón de WhatsApp separe a las FAMILIAS del resto y que el
--           asistente solo atienda familias (Fase A).
-- =============================================================================
-- Por qué (medido en la base el 2026-10-03, Dynasty, primer día con el número
-- conectado por Coexistence — que es también el WhatsApp personal de la dueña):
--
--   · 55 conversaciones, TODAS en status 'open': el buzón no distinguía qué
--     esperaba respuesta. (Además, el BFF escribía status='active', que el
--     CHECK de la tabla no admite — open|snoozed|closed —, así que ni responder
--     cerraba nada. Eso se arregla en el BFF, no acá.)
--   · De las 55: 23 familia con cuenta, 7 familia sin cuenta, 21 desconocidos,
--     4 staff (178 de los 375 mensajes eran del propio equipo).
--   · 316 borradores 'pending' sin aprobar; 238 eran a contactos personales.
--
-- Qué agrega:
--
--   1. whatsapp_conversations.contact_kind — quién es el contacto. Lo escribe
--      `clasificarContacto` (bff/src/services/whatsapp-atencion.service.ts) en
--      cada mensaje entrante; 'personal' lo marca la escuela a mano desde el
--      buzón y manda sobre todo lo demás. NULL = todavía sin clasificar (todas
--      las filas existentes hasta que corra bff/scripts/wa-fase-a-limpieza.ts).
--      text + CHECK, no CREATE TYPE (convención del repo).
--   2. Índice (school_id, contact_kind): el buzón filtra por esa pareja en
--      cada carga de la lista.
--   3. whatsapp_settings.responder_desconocidos — si el asistente también le
--      contesta a números que no son familia ni staff (prospectos). Default
--      false: decisión de producto, el asistente solo atiende familias.
--
-- RLS / grants: NO se tocan. Verificado en la base viva el 2026-10-03:
--   · whatsapp_conversations: wa_conv_admin_select (SELECT, is_school_admin) y
--     wa_conv_no_direct_write (INSERT WITH CHECK false). Toda escritura entra
--     por el BFF con service_role.
--   · whatsapp_settings: wa_settings_admin_select (SELECT) y
--     wa_settings_no_direct_write (INSERT WITH CHECK false). Igual.
--   Columnas nuevas en tablas existentes heredan las policies y los GRANT de
--   tabla; no hay funciones nuevas, así que no aplica search_path ni EXECUTE.
--
-- Idempotente (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) por si alguien la
-- corre dos veces desde el SQL editor.
-- =============================================================================

BEGIN;

-- 1. Tipo de contacto ---------------------------------------------------------
ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS contact_kind text NULL;

ALTER TABLE public.whatsapp_conversations
    DROP CONSTRAINT IF EXISTS whatsapp_conversations_contact_kind_check;

ALTER TABLE public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_contact_kind_check
    CHECK (contact_kind IS NULL OR contact_kind IN (
        'familia',             -- acudiente con cuenta de un atleta activo
        'familia_sin_cuenta',  -- el número está en la ficha de un atleta activo, sin cuenta
        'ambiguo',             -- el número está en dos cuentas: lo resuelve un humano
        'staff',               -- administra la escuela (owner/admin)
        'desconocido',         -- amigos, proveedores, prospectos
        'personal'             -- marcado a mano por la escuela; manda sobre todo
    ));

COMMENT ON COLUMN public.whatsapp_conversations.contact_kind IS
    'Quién es el contacto (familia|familia_sin_cuenta|ambiguo|staff|desconocido|personal). '
    'Lo escribe whatsapp-atencion.service en cada entrante; personal = marca manual. NULL = sin clasificar.';

-- 2. Índice para las pestañas del buzón ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_wa_conversations_school_kind
    ON public.whatsapp_conversations (school_id, contact_kind);

-- 3. ¿Contestarle a desconocidos? ---------------------------------------------
ALTER TABLE public.whatsapp_settings
    ADD COLUMN IF NOT EXISTS responder_desconocidos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_settings.responder_desconocidos IS
    'Si el asistente también atiende números que no son familia ni staff. Default false: '
    'con Coexistence el número es también el WhatsApp personal de quien dirige la escuela.';

COMMIT;
