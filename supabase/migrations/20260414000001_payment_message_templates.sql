-- ============================================================================
-- MIGRACION: Sistema de plantillas de mensajes de cobro
-- Fecha: 2026-04-14
-- Descripcion: Crea las tablas payment_message_templates y template_variables
--              con plantillas default y politicas RLS.
-- ============================================================================

-- ── 1. Tabla de plantillas ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_message_templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    template_type text NOT NULL CHECK (template_type IN (
        'reminder_before', 'reminder_due', 'overdue',
        'payment_confirmed', 'partial_received', 'custom'
    )),
    channel     text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),
    name        text NOT NULL,
    subject     text,  -- solo relevante para email
    body        text NOT NULL,
    days_offset integer,  -- dias antes/despues del vencimiento
    is_active   boolean NOT NULL DEFAULT true,
    is_default  boolean NOT NULL DEFAULT false,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_message_templates IS
    'Plantillas de mensajes para cobros. school_id=NULL son defaults globales.';

CREATE INDEX IF NOT EXISTS idx_pmt_school_type
    ON public.payment_message_templates (school_id, template_type, channel);

-- ── 2. Tabla de variables disponibles ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.template_variables (
    key         text PRIMARY KEY,  -- ej: {{nombre_padre}}
    label       text NOT NULL,
    description text NOT NULL,
    applies_to  text[] NOT NULL DEFAULT '{}'::text[]
);

COMMENT ON TABLE public.template_variables IS
    'Catálogo de variables que se pueden usar en las plantillas de mensajes.';

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_variables ENABLE ROW LEVEL SECURITY;

-- Plantillas: todos los autenticados pueden leer las globales (school_id IS NULL)
-- y las de su escuela
CREATE POLICY pmt_select ON public.payment_message_templates
    FOR SELECT TO authenticated
    USING (
        school_id IS NULL
        OR school_id IN (
            SELECT school_id FROM public.school_members
            WHERE profile_id = auth.uid() AND status = 'active'
        )
    );

-- Solo admins de la escuela pueden insertar/actualizar/borrar sus plantillas
CREATE POLICY pmt_insert ON public.payment_message_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        school_id IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM public.school_members
            WHERE profile_id = auth.uid()
              AND status = 'active'
              AND role IN ('owner', 'admin', 'school_admin')
        )
    );

CREATE POLICY pmt_update ON public.payment_message_templates
    FOR UPDATE TO authenticated
    USING (
        school_id IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM public.school_members
            WHERE profile_id = auth.uid()
              AND status = 'active'
              AND role IN ('owner', 'admin', 'school_admin')
        )
    );

CREATE POLICY pmt_delete ON public.payment_message_templates
    FOR DELETE TO authenticated
    USING (
        school_id IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM public.school_members
            WHERE profile_id = auth.uid()
              AND status = 'active'
              AND role IN ('owner', 'admin', 'school_admin')
        )
    );

-- Variables: lectura publica para autenticados (es un catalogo)
CREATE POLICY tv_select ON public.template_variables
    FOR SELECT TO authenticated
    USING (true);

-- ── 4. Trigger updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pmt_updated_at ON public.payment_message_templates;
CREATE TRIGGER trg_pmt_updated_at
    BEFORE UPDATE ON public.payment_message_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Seed: variables disponibles ──────────────────────────────────────────

INSERT INTO public.template_variables (key, label, description, applies_to) VALUES
('{{nombre_padre}}',      'Nombre del padre',       'Nombre completo del acudiente/padre',              ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{nombre_atleta}}',     'Nombre del atleta',      'Nombre completo del deportista',                   ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{nombre_escuela}}',    'Nombre de la escuela',   'Nombre de la academia deportiva',                  ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{monto}}',             'Monto total',            'Valor total del pago formateado en moneda local',  ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{monto_pendiente}}',   'Monto pendiente',        'Saldo restante por pagar',                         ARRAY['overdue','partial_received','custom']),
('{{fecha_vencimiento}}', 'Fecha de vencimiento',   'Fecha límite de pago',                             ARRAY['reminder_before','reminder_due','overdue','custom']),
('{{dias_vencimiento}}',  'Días para vencer',       'Cantidad de días hasta el vencimiento',            ARRAY['reminder_before','custom']),
('{{dias_mora}}',         'Días en mora',           'Cantidad de días desde el vencimiento',            ARRAY['overdue','custom']),
('{{equipo}}',            'Equipo / programa',      'Nombre del equipo o programa deportivo',           ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{plan}}',              'Plan contratado',        'Nombre del plan de pago',                          ARRAY['reminder_before','reminder_due','overdue','payment_confirmed','partial_received','custom']),
('{{banco}}',             'Datos bancarios',        'Información de la cuenta bancaria de la escuela',  ARRAY['reminder_before','reminder_due','overdue','custom']),
('{{nequi}}',             'Nequi',                  'Número de Nequi de la escuela',                    ARRAY['reminder_before','reminder_due','overdue','custom']),
('{{link_pago}}',         'Link de pago',           'URL para realizar el pago en línea',               ARRAY['reminder_before','reminder_due','overdue','custom'])
ON CONFLICT (key) DO NOTHING;

-- ── 6. Seed: plantillas default (globales, school_id = NULL) ────────────────

-- reminder_before (3 variantes)
INSERT INTO public.payment_message_templates
    (school_id, template_type, channel, name, body, days_offset, is_active, is_default, sort_order)
VALUES
(NULL, 'reminder_before', 'whatsapp', 'Recordatorio amigable',
 E'Hola {{nombre_padre}} \U0001F44B\nTe recordamos que el pago de *{{nombre_atleta}}* por *{{monto}}* vence el *{{fecha_vencimiento}}*.\n\nEquipo: {{equipo}}\n\nPuedes pagar aquí: {{link_pago}}\n\n¡Gracias por tu puntualidad! \U0001F3C6\n— {{nombre_escuela}}',
 -3, true, true, 1),

(NULL, 'reminder_before', 'whatsapp', 'Recordatorio corto',
 E'Hola {{nombre_padre}}, recuerda que el pago de {{nombre_atleta}} ({{monto}}) vence el {{fecha_vencimiento}}. Link: {{link_pago}}',
 -3, true, false, 2),

(NULL, 'reminder_before', 'whatsapp', 'Recordatorio formal',
 E'Estimado/a {{nombre_padre}},\n\nLe informamos que el pago correspondiente a *{{nombre_atleta}}* por valor de *{{monto}}* tiene fecha de vencimiento el *{{fecha_vencimiento}}*.\n\nPrograma: {{equipo}}\nPlan: {{plan}}\n\nPuede realizar su pago en: {{link_pago}}\n\nCordialmente,\n{{nombre_escuela}}',
 -3, true, false, 3),

-- reminder_due (2 variantes)
(NULL, 'reminder_due', 'whatsapp', 'Vence hoy - amigable',
 E'Hola {{nombre_padre}} \U0001F44B\nHoy vence el pago de *{{nombre_atleta}}* por *{{monto}}*.\n\nEvita recargos pagando hoy: {{link_pago}}\n\n¡Gracias! \U0001F64F\n— {{nombre_escuela}}',
 0, true, true, 1),

(NULL, 'reminder_due', 'whatsapp', 'Vence hoy - directo',
 E'{{nombre_padre}}, hoy vence el pago de {{nombre_atleta}} ({{monto}}). Paga aquí: {{link_pago}} — {{nombre_escuela}}',
 0, true, false, 2),

-- overdue (2 variantes)
(NULL, 'overdue', 'whatsapp', 'Mora - tono suave',
 E'Hola {{nombre_padre}},\nEl pago de *{{nombre_atleta}}* por *{{monto}}* venció hace *{{dias_mora}} días*.\n\nSabemos que a veces se pasa, pero necesitamos regularizar la situación para que {{nombre_atleta}} siga disfrutando del programa.\n\nPaga aquí: {{link_pago}}\n\n— {{nombre_escuela}}',
 NULL, true, true, 1),

(NULL, 'overdue', 'whatsapp', 'Mora - tono directo',
 E'{{nombre_padre}}, el pago de {{nombre_atleta}} ({{monto}}) está vencido hace {{dias_mora}} días. Por favor regularice su situación: {{link_pago}} — {{nombre_escuela}}',
 NULL, true, false, 2),

-- payment_confirmed (1)
(NULL, 'payment_confirmed', 'whatsapp', 'Confirmación de pago',
 E'Hola {{nombre_padre}} \u2705\nConfirmamos que recibimos el pago de *{{nombre_atleta}}* por *{{monto}}*.\n\nEquipo: {{equipo}}\n\n¡Gracias por tu compromiso! \U0001F3C6\n— {{nombre_escuela}}',
 NULL, true, true, 1),

-- partial_received (1)
(NULL, 'partial_received', 'whatsapp', 'Abono recibido',
 E'Hola {{nombre_padre}},\nRecibimos un abono de *{{monto}}* para *{{nombre_atleta}}*.\n\nSaldo pendiente: *{{monto_pendiente}}*\nEquipo: {{equipo}}\n\nPuedes completar tu pago aquí: {{link_pago}}\n\n— {{nombre_escuela}}',
 NULL, true, true, 1)

ON CONFLICT DO NOTHING;
