-- =============================================================================
-- Dynasty Volley Club — comprobantes de WhatsApp «sin resolver» (02 al 06-oct-2026)
-- PROPUESTA. NO se ha corrido. Evidencia caso por caso:
--   docs/analisis/comprobantes-sin-resolver-dynasty-2026-10-06.md
--
-- Qué hace: pega cada comprobante a su cobro y lo deja en 'awaiting_approval'
-- (igual que lo hace el bot cuando acierta), con veredicto 'amarillo' y el
-- motivo REVISION_MANUAL. Milena lo aprueba desde la app («Por aprobar»): así
-- corren los triggers normales (extender vigencia, gasto de comisión, acceso) y
-- approved_by queda con quien de verdad aprobó. Aquí NO se marca nada 'paid'.
--
-- Idempotente: cada UPDATE lleva un WHERE con el estado esperado
-- (status IN ('pending','overdue') y el monto actual). Si se corre dos veces, o
-- si el bot / el script wa-ponerse-al-dia ya aplicó ese comprobante, toca 0 filas.
-- La fila de la cola solo se cierra si sigue en ignored/failed/waiting_user.
--
-- Ids de comprobante (receipt_image_sha256) calculados sobre el archivo del
-- bucket payment-receipts; ninguno está en otro pago (verificado 06-oct).
-- payments.status es TEXT: literales planos, sin castear a pay_status.
--
-- Sección A = comprobante claro, cobro claro.        (5 cobros, $880.000)
-- Sección B = propuesta con decisión de por medio.   (B1-B3, B5, B6 activos; B4 y B7 comentados)
-- Sección C = cerrar filas ya resueltas a mano.
-- Sección D = verificación.
--
-- Milena (owner Dynasty) = 73adf4ca-51f5-4f4a-a6ca-1973c84e8151
-- Planes: PRO c9348cd7… $150.000 · ELITE 622df953… $180.000 · DYNASTY 02876fa4… $210.000
-- =============================================================================

BEGIN;

-- Motivo estándar del veredicto (se repite en cada UPDATE).
--   [{"code":"REVISION_MANUAL","check":0,"level":"amarillo",
--     "message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]

-- -----------------------------------------------------------------------------
-- A1. JOSÉ RODRÍGUEZ PÉREZ — octubre $130.000
--     Nequi 03-oct 11:03, $130.000, ref M07245237, llave 0089455111 (Dynasty).
--     Leyenda: «pago OCTUBRE - José Ignacio». El Nequi de origen (···9523)
--     es el teléfono de la ficha; el WhatsApp desde el que escribió no lo es.
--     Septiembre ($130.000) sigue vencido: este pago NO es de septiembre.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/8bb39c9a-2e4b-4760-acd0-7c379301548b.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '5134c07f6b12e0fae7d4ad425dfc4ff3d4672e63e9a0cc8f208f71a802fdcbb2',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 130000, ocr_date = '2026-10-03', ocr_bank = 'Nequi',
       ocr_reference = 'M07245237', ocr_destination = '0089455111', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = 'e8fa818f-6322-45f2-81e1-5041f78fc21c'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 130000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = 'e8fa818f-6322-45f2-81e1-5041f78fc21c',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de José Rodríguez Pérez',
       processed_at = now()
 WHERE id = '8bb39c9a-2e4b-4760-acd0-7c379301548b' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- A2. SARA SOFÍA LÓPEZ MACHADO — octubre $210.000
--     Bancolombia 03-oct 09:05, $210.000, comprobante 0000097500, a 806-000035-78.
--     La mamá (Heidy Machado) respondió «Ninguno de esos. Es la mensualidad de
--     Sara Sofía octubre»: el bot solo le ofreció cobros del hermano Juan Pablo.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/f3bdec1d-5c6b-4427-9e0a-2a442eed2f41.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '67fc150d6cb0d06b173a27410a628ba3c7975c7d62176f9bbcdab19fd1376483',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 210000, ocr_date = '2026-10-03', ocr_bank = 'Bancolombia',
       ocr_reference = '0000097500', ocr_destination = '806 - 000035 - 78', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '8c95812c-f300-4ef9-8e12-0bb46f9c599c'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 210000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '8c95812c-f300-4ef9-8e12-0bb46f9c599c',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de Sara Sofía López Machado',
       processed_at = now()
 WHERE id = 'f3bdec1d-5c6b-4427-9e0a-2a442eed2f41' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- A3. ANA MARÍA MARTÍNEZ JIMÉNEZ — octubre $180.000 (plan ELITE desde 05-oct)
--     Nequi 03-oct 11:52, $180.000, ref M08990043, llave 0089455111.
--     Lo reenvió otro contacto («Jorge»), pero el Nequi de origen ···3614
--     es el de su mamá, María Cenaida Jiménez Galindo (perfil y ficha).
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/462c4ba3-dcb9-4de0-8845-0013d5a333f9.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '8ba6390d07e9bc1913ef28deaed5bc71136464d74efe179d9bf1445f3c7b06bd',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 180000, ocr_date = '2026-10-03', ocr_bank = 'Nequi',
       ocr_reference = 'M08990043', ocr_destination = '0089455111', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = 'fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 180000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = 'fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de Ana María Martínez Jiménez',
       processed_at = now()
 WHERE id = '462c4ba3-dcb9-4de0-8845-0013d5a333f9' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- A4. SALOMÉ ZAMBRANO CASTAÑEDA — octubre $150.000
--     Davivienda 03-oct 10:50, $150.000, comprobante e098a228-…-191b4f30f1f0,
--     llave 0089455111. Leyenda: «Salomé Zambrano Castañeda — octubre».
--     Escribe la mamá, Andrea Castañeda (número sin ficha → sin_familia).
--     Septiembre ($150.000) sigue vencido.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/5f52b8c2-0902-4f0a-bc29-2b169c577b2a.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = 'eb9167edc8ca8e48bcc2f22d69fa35de3774ba631fa8682e5abe2b99fb5af50c',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 150000, ocr_date = '2026-10-03', ocr_bank = 'Davivienda',
       ocr_reference = 'e098a228-e775-4b1b-b5d5-191b4f30f1f0', ocr_destination = '0089455111', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = 'bc2ea1bb-9945-4549-bacf-95026437c241'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 150000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = 'bc2ea1bb-9945-4549-bacf-95026437c241',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de Salomé Zambrano Castañeda',
       processed_at = now()
 WHERE id = '5f52b8c2-0902-4f0a-bc29-2b169c577b2a' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- A5. JUAN JOSÉ PEÑA — SEPTIEMBRE $210.000
--     DaviPlata 11-sep 10:20, $210.000, a Club Deportivo Dynasty Dc.
--     La mamá (Johanna Gómez): «Ese pago lo realicé el 10 de septiembre para ese
--     mismo mes». Va a septiembre; octubre ($210.000) queda pendiente.
--     ocr_reference queda en NULL: el número de aprobación (35 dígitos) no se
--     lee con certeza y es la llave del índice anti-duplicado.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/b65cd282-3cdf-481f-ab76-ce480bdd10df.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '3a2ef06353accde623006e0dfad4331bfca94ab30900f50df78806b5e10b0397',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 210000, ocr_date = '2026-09-11', ocr_bank = 'DaviPlata',
       ocr_destination = 'Club Deportivo Dynasty Dc', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '85d6be69-23ef-4c6c-abe2-63436327d04d'          -- sep-2026
   AND status IN ('pending','overdue') AND amount = 210000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '85d6be69-23ef-4c6c-abe2-63436327d04d',
       error_message = 'aplicado a mano (auditoría 2026-10-06): septiembre de Juan José Peña (pago del 11-sep)',
       processed_at = now()
 WHERE id = 'b65cd282-3cdf-481f-ab76-ce480bdd10df' AND status IN ('ignored','failed');

-- =============================================================================
-- B. CON DECISIÓN DE POR MEDIO — revisar antes de correr cada bloque
-- =============================================================================

-- -----------------------------------------------------------------------------
-- B1. SOFÍA ALEXANDRA RAMOS CHOCONTÁ — al más antiguo: SEPTIEMBRE $180.000
--     Nequi 05-oct 18:42, $180.000, ref M22778048, llave 0089455111.
--     Sin mensaje que diga el mes. Sep (vence 14-sep) vencido + oct pendiente.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/a0129863-4ea5-4f77-afd4-369b7456a6b0.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '6a5a71abd6b5c64fd545e9e76480990164fd7faa1b89a08b9874d1260412fc21',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 180000, ocr_date = '2026-10-05', ocr_bank = 'Nequi',
       ocr_reference = 'M22778048', ocr_destination = '0089455111', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06 al cobro más antiguo; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '510ac8c3-8f65-4b66-9c7f-0fe1f560efd7'          -- sep-2026
   AND status IN ('pending','overdue') AND amount = 180000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '510ac8c3-8f65-4b66-9c7f-0fe1f560efd7',
       error_message = 'aplicado a mano (auditoría 2026-10-06): septiembre (más antiguo) de Sofía Ramos Chocontá',
       processed_at = now()
 WHERE id = 'a0129863-4ea5-4f77-afd4-369b7456a6b0' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B2. ISABELLA ROJAS GUTIÉRREZ — al más antiguo: SEPTIEMBRE $150.000
--     Davivienda 04-oct 10:02, $150.000, comprobante f49d69d5-…-11db1bc4774a.
--     La mamá (Mónica) solo se presentó; no dijo el mes.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/ac8e65e3-91a2-435a-baf0-f1bd46271c7e.pdf',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '5560bf69457ffceaaaa1fc3648854233b3564a9055e53312caee1fcf0391bf60',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 150000, ocr_date = '2026-10-04', ocr_bank = 'Davivienda',
       ocr_reference = 'f49d69d5-e15d-4872-914d-11db1bc4774a', ocr_destination = '0089455111', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de WhatsApp aplicado a mano en la auditoría del 2026-10-06 al cobro más antiguo; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = 'f2c6f25f-74de-4a4e-81dc-dd0d314b0b28'          -- sep-2026
   AND status IN ('pending','overdue') AND amount = 150000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = 'f2c6f25f-74de-4a4e-81dc-dd0d314b0b28',
       error_message = 'aplicado a mano (auditoría 2026-10-06): septiembre (más antiguo) de Isabella Rojas Gutiérrez',
       processed_at = now()
 WHERE id = 'ac8e65e3-91a2-435a-baf0-f1bd46271c7e' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B3. KAMILA STEPHANNY ORTIZ TOVAR — $360.000 = AGOSTO + SEPTIEMBRE
--     Nequi 04-oct 13:53, $360.000, ref M10465936, llave 0090399230.
--     Tres cobros de $180.000 abiertos (ago, sep, oct). $360.000 = dos meses:
--     van a los dos más antiguos; octubre queda pendiente.
--     El hash y la referencia solo pueden ir en UN pago (índices únicos), así
--     que van en agosto; septiembre lleva el mismo archivo sin hash.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/68de14b8-e225-4b0e-8627-ef54a48460b2.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '1b35c14567e633d9af1f97b6f6af2a6ed055270dfe9b15af3c796b513289f247',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 360000, ocr_date = '2026-10-04', ocr_bank = 'Nequi',
       ocr_reference = 'M10465936', ocr_destination = '0090399230', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de $360.000 repartido a mano (auditoría 2026-10-06) entre agosto y septiembre; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '1dc84ed1-3fbc-4705-9648-8f6ba13982f6'          -- ago-2026
   AND status IN ('pending','overdue') AND amount = 180000;

UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/68de14b8-e225-4b0e-8627-ef54a48460b2.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       ocr_amount = 360000, ocr_date = '2026-10-04', ocr_bank = 'Nequi',
       ocr_destination = '0090399230', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Comprobante de $360.000 (ref M10465936, en el cobro de agosto) repartido a mano entre agosto y septiembre; revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '27a456ce-f94e-4456-9898-a9e673a0157d'          -- sep-2026
   AND status IN ('pending','overdue') AND amount = 180000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '1dc84ed1-3fbc-4705-9648-8f6ba13982f6',
       error_message = 'aplicado a mano (auditoría 2026-10-06): $360.000 = agosto (1dc84ed1) + septiembre (27a456ce) de Kamila Ortiz Tovar',
       processed_at = now()
 WHERE id = '68de14b8-e225-4b0e-8627-ef54a48460b2' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B4. SARA JULIANA LAMUS SANCLEMENTE — COMENTADO: el monto no cuadra
--     Bre-B 03-oct 09:32, $180.000, comprobante TRUUSfWKLjEC, a 0089455111.
--     Cobros abiertos: sep $150.000 (vencido) y oct $150.000. Sobran $30.000.
--     Preguntar a la familia. Si confirman septiembre, descomentar.
-- -----------------------------------------------------------------------------
-- UPDATE public.payments
--    SET status = 'awaiting_approval',
--        receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/0d27a587-0716-4a42-a9ef-5bcb8dfd09f2.jpeg',
--        receipt_storage_bucket = 'payment-receipts',
--        receipt_image_sha256 = 'da5200adee8a2c48457eaa66273f9a7d1df8e85dd0563b16ca6b821700d6c0cd',
--        receipt_image_sha256_source = 'server_verified',
--        ocr_amount = 180000, ocr_date = '2026-10-03', ocr_bank = 'Bre-B',
--        ocr_reference = 'TRUUSfWKLjEC', ocr_destination = '0089455111', ocr_provider = 'manual',
--        receipt_verdict = 'amarillo',
--        receipt_verdict_reasons = '[{"code":"MONTO_DIFIERE","check":5,"level":"amarillo","detail":{"expected":150000,"extracted":180000},"message":"El monto del comprobante no coincide con el valor esperado del cobro."}]'::jsonb,
--        receipt_verdict_at = now()
--  WHERE id = '8a190d49-ad34-4703-a61d-7067cc6372e0'        -- sep-2026
--    AND status IN ('pending','overdue') AND amount = 150000;
-- UPDATE public.whatsapp_inbound_queue
--    SET status = 'done', result_type = 'payment_receipt',
--        result_ref_id = '8a190d49-ad34-4703-a61d-7067cc6372e0',
--        error_message = 'aplicado a mano (auditoría 2026-10-06): septiembre de Sara Juliana Lamus ($180.000 leído)',
--        processed_at = now()
--  WHERE id = '0d27a587-0716-4a42-a9ef-5bcb8dfd09f2' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B5. ANA MARÍA CARDONA LÓPEZ — octubre ($130.000) con comprobante de $150.000
--     03-oct 11:36, $150.000, autorización 46629132, a cuenta *****3578 (Dynasty),
--     descripción «Pago octubre Ana María Cardona López».
--     La mamá (Janeth) el 05-oct: «tengo un saldo a favor, voy a enviarte 5000
--     para una clase extra» → los $20.000 de más + $5.000 = la clase extra.
--     Al aprobar en la app, poner monto recibido $150.000 (como en las tandas
--     de planilla cuando pagaron de más) o $130.000 si Milena prefiere llevar
--     la clase extra aparte.
-- -----------------------------------------------------------------------------
UPDATE public.payments
   SET status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/2c40bc61-7020-4635-a21e-ac31c227217c.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '49c1cd1f2a44f4a4d278844a9392fdcc0acdc1b096bfc8b7d6a609f2d511b45a',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 150000, ocr_date = '2026-10-03',
       ocr_reference = '46629132', ocr_destination = '*****3578', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"MONTO_DIFIERE","check":5,"level":"amarillo","detail":{"expected":130000,"extracted":150000},"message":"Pagó $20.000 de más: según la mamá es saldo a favor para la clase extra (auditoría 2026-10-06)."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '2ead1492-186c-469e-b358-bb44825c817e'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 130000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '2ead1492-186c-469e-b358-bb44825c817e',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de Ana María Cardona ($150.000; $20.000 = clase extra)',
       processed_at = now()
 WHERE id = '2c40bc61-7020-4635-a21e-ac31c227217c' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B6. ISABELLA MATEUS LEÓN — cambio de plan PRO $150.000 → DYNASTY $210.000
--     DaviPlata 05-oct 17:16, $210.000, a Club Deportivo Dynasty Dc.
--     La mamá (Yuli León): «comprobante de mes de isabella mateus leon de 4
--     días a la semana». 4 días = PLAN DYNASTY. Mismo patrón que la tanda A del
--     2026-10-05 (enrollments + cobro de octubre). CONFIRMAR CON MILENA antes.
--     Nota: hay otra ficha inactiva «ISABELLA MATEUS LEON» (duplicada).
-- -----------------------------------------------------------------------------
UPDATE public.enrollments
   SET offering_plan_id = '02876fa4-6c2c-47d0-81b7-b806560be59d',
       monthly_fee      = 210000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio a PLAN DYNASTY (4 días/semana) según comprobante WhatsApp 05-oct (auditoría 2026-10-06)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = 'b521b3ef-a879-4c5b-89df-c54f48e58f37'
   AND status = 'active'
   AND offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
   AND monthly_fee = 150000;

UPDATE public.payments
   SET amount = 210000,
       offering_plan_id = '02876fa4-6c2c-47d0-81b7-b806560be59d',
       status = 'awaiting_approval',
       receipt_url = '2d509571-3238-4c04-ac3f-6dfe20539226/whatsapp/7336cd09-8aa3-47cf-8eb7-67a2898a5342.jpeg',
       receipt_storage_bucket = 'payment-receipts',
       receipt_image_sha256 = '8de741d47416ab0087359436dbe06a3d6001582b1ea2126706f388ebc3b4e525',
       receipt_image_sha256_source = 'server_verified',
       ocr_amount = 210000, ocr_date = '2026-10-05', ocr_bank = 'DaviPlata',
       ocr_destination = 'Club Deportivo Dynasty Dc', ocr_provider = 'manual',
       receipt_verdict = 'amarillo',
       receipt_verdict_reasons = '[{"code":"REVISION_MANUAL","check":0,"level":"amarillo","message":"Cambio a PLAN DYNASTY y comprobante aplicado a mano (auditoría 2026-10-06); revisar antes de aprobar."}]'::jsonb,
       receipt_verdict_at = now()
 WHERE id = '64e9e5e5-e0b1-4837-b492-0061c8952a4a'          -- oct-2026
   AND status IN ('pending','overdue') AND amount = 150000;

UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'payment_receipt',
       result_ref_id = '64e9e5e5-e0b1-4837-b492-0061c8952a4a',
       error_message = 'aplicado a mano (auditoría 2026-10-06): octubre de Isabella Mateus con cambio a PLAN DYNASTY',
       processed_at = now()
 WHERE id = '7336cd09-8aa3-47cf-8eb7-67a2898a5342' AND status IN ('ignored','failed');

-- -----------------------------------------------------------------------------
-- B7. SANTIAGO VÁSQUEZ SALDAÑA — COMENTADO: septiembre pagado de más en la app
--     Septiembre quedó 'paid' por $180.000 el 06-oct, pero el comprobante
--     (Nequi 17-sep, $90.000, M21970947) y la planilla de papel dicen $90.000
--     («los días que Santiago asistió en septiembre»). Si Milena NO cobró los
--     otros $90.000, corregir lo recibido:
-- -----------------------------------------------------------------------------
-- UPDATE public.payments
--    SET amount_paid = 90000
--  WHERE id = 'e500e184-1e45-41df-ba29-7568e7bb8696'        -- sep-2026
--    AND status = 'paid' AND amount_paid = 180000;

-- =============================================================================
-- C. CERRAR FILAS YA RESUELTAS A MANO
-- =============================================================================

-- C1. Isabella Colmenares: $300.000 «sep y oct» (Bre-B 03-oct). Milena registró
--     los dos meses como efectivo el 06-oct 10:08. La fila sigue en waiting_user
--     esperando que la familia elija: cerrarla para que el bot no vuelva a preguntar.
UPDATE public.whatsapp_inbound_queue
   SET status = 'done', result_type = 'none',
       result_ref_id = '133f73ca-3050-4fc8-9d66-c392c9b8a9bd',
       error_message = 'ya registrado a mano: sep (133f73ca) + oct (7e8b1303) pagados el 06-oct (auditoría 2026-10-06)',
       processed_at = now()
 WHERE id = 'f8cdc027-e631-4d68-963f-d2fdb78126b8' AND status = 'waiting_user';

-- =============================================================================
-- D. VERIFICACIÓN (antes del COMMIT): cada cobro debe quedar awaiting_approval
--    con su comprobante; enrollments de Isabella Mateus en DYNASTY.
-- =============================================================================
SELECT p.id, coalesce(ch.full_name, p.concept) AS atleta, p.period_month AS mes,
       p.amount, p.status, p.ocr_amount, p.ocr_reference, p.receipt_verdict,
       right(p.receipt_url, 45) AS archivo
  FROM public.payments p
  LEFT JOIN public.children ch ON ch.id = p.child_id
 WHERE p.id IN ('e8fa818f-6322-45f2-81e1-5041f78fc21c','8c95812c-f300-4ef9-8e12-0bb46f9c599c',
                'fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd','bc2ea1bb-9945-4549-bacf-95026437c241',
                '85d6be69-23ef-4c6c-abe2-63436327d04d','510ac8c3-8f65-4b66-9c7f-0fe1f560efd7',
                'f2c6f25f-74de-4a4e-81dc-dd0d314b0b28','1dc84ed1-3fbc-4705-9648-8f6ba13982f6',
                '27a456ce-f94e-4456-9898-a9e673a0157d','2ead1492-186c-469e-b358-bb44825c817e',
                '64e9e5e5-e0b1-4837-b492-0061c8952a4a')
 ORDER BY atleta, mes;

SELECT id, status, offering_plan_id, monthly_fee
  FROM public.enrollments WHERE id = 'b521b3ef-a879-4c5b-89df-c54f48e58f37';

SELECT left(id::text, 8) AS fila, status, result_type, left(result_ref_id::text, 8) AS pago, error_message
  FROM public.whatsapp_inbound_queue
 WHERE id IN ('8bb39c9a-2e4b-4760-acd0-7c379301548b','f3bdec1d-5c6b-4427-9e0a-2a442eed2f41',
              '462c4ba3-dcb9-4de0-8845-0013d5a333f9','5f52b8c2-0902-4f0a-bc29-2b169c577b2a',
              'b65cd282-3cdf-481f-ab76-ce480bdd10df','a0129863-4ea5-4f77-afd4-369b7456a6b0',
              'ac8e65e3-91a2-435a-baf0-f1bd46271c7e','68de14b8-e225-4b0e-8627-ef54a48460b2',
              '2c40bc61-7020-4635-a21e-ac31c227217c','7336cd09-8aa3-47cf-8eb7-67a2898a5342',
              'f8cdc027-e631-4d68-963f-d2fdb78126b8');

-- Si todo cuadra: COMMIT;   Si no: ROLLBACK;
