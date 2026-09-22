-- =============================================================================
-- 20260922123945_wa_invitacion_para_registro_por_whatsapp.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921211509
-- Objetivo: que el papá que se registra desde WhatsApp quede VINCULADO a su
--           hijo. Hoy entra en un bucle infinito.
-- =============================================================================
-- EL BUG
--
-- El bot le manda `/register?phone=…` a la familia que reconoce por su número
-- pero no tiene cuenta. El papá se registra, se crea su `profiles` con el
-- teléfono… y `children.parent_id` SIGUE VACÍO, porque el registro normal no
-- toca `children`. Solo `accept_invitation_pro` lo hace:
--
--     UPDATE public.children SET parent_id = auth.uid()
--
-- Resultado: vuelve a escribirle al bot, `wa_identify_by_phone` exige ser
-- acudiente de un atleta ACTIVO de esa escuela, no lo es, y el bot le dice otra
-- vez «regístrate». El papá hizo todo bien y el sistema le dice que no hizo
-- nada. Son 156 familias de Dynasty entrando a ese bucle el día que conecte.
--
-- EL ARREGLO
--
-- El enlace deja de ser `?phone=` y pasa a ser `?invite=<id>&email=<correo>`,
-- que es el flujo que SÍ vincula. No hay mecanismo nuevo: es el mismo camino
-- que ya usa la invitación por correo, entregado por otro canal.
--
-- Medido en Dynasty el 2026-09-22: de 157 atletas activos sin acudiente y con
-- celular usable, **148 ya tienen invitación pendiente** (94%). No hay que
-- crear nada para ellos, solo encontrarla.
--
-- POR QUÉ EL CRUCE ES POR NOMBRE
--
-- `invitations` no tiene `child_id` — solo `child_name`. Es frágil y no me
-- gusta, pero es lo que existe; inventar la FK hoy obligaría a re-vincular 496
-- invitaciones a ciegas. Se normaliza (sin tildes, sin mayúsculas, sin dobles
-- espacios) y se exige coincidencia EXACTA de ese nombre normalizado: un
-- «parecido» acá es vincular al papá con el hijo de otro.
--
-- QUÉ NO HACE
--
-- No crea invitaciones. Si la familia no tiene una, devuelve null y el bot cae
-- al camino anterior — que al menos no miente. Crear invitaciones desde el bot
-- es otra decisión (quién queda como `invited_by`, qué rol, qué plan) y no se
-- toma de contrabando dentro de un fix.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_invitacion_pendiente_por_telefono(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school_id uuid;
    v_tel       text;
    v_ids       uuid[];
    v_inv       RECORD;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.school_whatsapp_integrations
    WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Últimos 10 dígitos: en la base conviven '300…', '+57300…' y '57300…'
    -- para el mismo celular. Mismo criterio que wa_identify_by_phone.
    v_tel := right(regexp_replace(coalesce(p_contact_wa_id, ''), '[^0-9]', '', 'g'), 10);
    IF v_tel !~ '^3[0-9]{9}$' THEN
        RETURN NULL;
    END IF;

    -- La invitación pendiente del atleta de ESE teléfono, en ESTA escuela.
    -- `array_agg` y no `min()`: min(uuid) no existe en PostgreSQL y compila
    -- igual, reventando solo al ejecutarse (ya costó una vez, 2026-09-16).
    SELECT array_agg(DISTINCT i.id) INTO v_ids
    FROM public.children c
    JOIN public.invitations i
      ON i.school_id = c.school_id
     AND i.status = 'pending'
     AND btrim(regexp_replace(
            lower(translate(coalesce(i.child_name, ''),
                            'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
            '[^a-z ]', '', 'g'))
       = btrim(regexp_replace(
            lower(translate(coalesce(c.full_name, ''),
                            'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
            '[^a-z ]', '', 'g'))
    WHERE c.school_id = v_school_id
      AND c.is_active
      AND c.parent_id IS NULL
      AND right(regexp_replace(coalesce(c.parent_phone_temp, ''), '[^0-9]', '', 'g'), 10) = v_tel;

    -- Cero o varias: no se elige. Varias significa dos hermanos con invitación
    -- abierta, y mandar la de uno deja al otro sin vincular sin que nadie lo
    -- note. Eso lo resuelve un humano, no una heurística.
    IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
        RETURN NULL;
    END IF;

    SELECT id, email, child_name INTO v_inv
    FROM public.invitations WHERE id = v_ids[1];

    -- El correo viaja para que RegisterPage lo precargue: accept_invitation_pro
    -- exige `LOWER(TRIM(email)) = v_user_email`, así que si el papá se registra
    -- con OTRO correo la aceptación falla — y falla en silencio, después de que
    -- ya llenó todo el formulario.
    RETURN jsonb_build_object(
        'invite_id',  v_inv.id,
        'email',      v_inv.email,
        'child_name', v_inv.child_name
    );
END;
$function$;

-- Solo la llama el BFF. Expuesta a `authenticated` sería un oráculo para saber
-- qué teléfonos pertenecen a qué escuela y con qué invitación abierta.
REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) TO service_role;

COMMENT ON FUNCTION public.wa_invitacion_pendiente_por_telefono(uuid, text) IS
  'Invitacion pendiente del atleta cuyo acudiente usa ese numero de WhatsApp. '
  'Devuelve null si no hay exactamente una: cero no hay que inventarla, varias no se eligen.';

COMMIT;

NOTIFY pgrst, 'reload schema';
