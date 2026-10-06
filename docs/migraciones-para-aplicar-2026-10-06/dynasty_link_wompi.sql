-- =============================================================================
-- Dynasty Volley Club: link de pago de Wompi en sus medios de pago (2026-10-06)
-- school_id 2d509571-3238-4c04-ac3f-6dfe20539226
--
-- Link: https://checkout.wompi.co/l/Hj5s7R — "MENSUALIDAD DYNASTY VOLLEY CLUB",
-- activo, monto lo define el cliente, reutilizable, comercio de producción.
--
-- ORDEN: correr DESPUÉS de desplegar a main (BFF en Render + frontend en
-- Vercel) el commit que agrega el tipo `payment_link`. Con el código viejo:
--   · el BFF (parseCuentasDePago) trataría la URL como una cuenta más: el bot
--     la dictaría como "número" y el verificador la compararía como destino;
--   · el frontend viejo (parsePaymentAccounts) descarta tipos desconocidos, y si
--     Milena guarda el panel de pagos, el link se BORRA de la lista.
--
-- Es un DATO, no un cambio de esquema: no va en supabase/migrations. Idempotente:
-- si ya hay una entrada con ese value, no hace nada (se puede correr dos veces).
-- No toca las columnas sueltas (nequi_number, breb_key...): el link no se espeja.
-- =============================================================================

BEGIN;

UPDATE public.school_settings ss
   SET payment_accounts = COALESCE(ss.payment_accounts, '[]'::jsonb)
       || jsonb_build_array(jsonb_build_object(
            'id',     gen_random_uuid()::text,
            'type',   'payment_link',
            'label',  'Pagar con tarjeta, PSE o Nequi (Wompi)',
            'value',  'https://checkout.wompi.co/l/Hj5s7R',
            'active', true
          ))
 WHERE ss.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(
                  CASE WHEN jsonb_typeof(ss.payment_accounts) = 'array'
                       THEN ss.payment_accounts ELSE '[]'::jsonb END) a
          WHERE btrim(a ->> 'value') = 'https://checkout.wompi.co/l/Hj5s7R'
       );

-- Verificación: debe salir exactamente 1 fila con type = payment_link.
SELECT a ->> 'id' AS id, a ->> 'type' AS type, a ->> 'label' AS label, a ->> 'value' AS value, a ->> 'active' AS active
  FROM public.school_settings ss, jsonb_array_elements(ss.payment_accounts) a
 WHERE ss.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';

COMMIT;
