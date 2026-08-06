# Triage — los 26 «sin cobro de agosto»

**Escuela:** DYNASTY VOLLEY CLUB (`2d509571-3238-4c04-ac3f-6dfe20539226`) · **Corrido:** 2026-08-06 (hora Colombia) · **Período:** 2026-08
**Modo:** SOLO LECTURA — este script no escribió una sola fila.

Universo cargado: 484 children · 5 no registrados · 2 atletas adultos · 729 inscripciones · 610 cobros · 434 invitaciones.
Corte día 10 · gracia 5 días. **Vencimiento que pondría `open_month`: 2026-08-10** (la gracia no aplica acá: solo la usa el alta por QR).

## Ventana de la carga masiva (detectada, no asumida)

- **Identidades:** 2026-07-06T14:26:27.796-05:00 → 2026-07-06T14:51:46.397-05:00 · 415 filas en 5 minutos.
- **Invitaciones:** 2026-07-06T14:26:30.191803-05:00 → 2026-07-06T14:51:48.551482-05:00 · 384 filas en 5 minutos.

Queda documentada para los triages futuros: todo lo creado dentro de esa ventana es `carga_masiva`; lo de después, no.

## Resumen

| Bucket | Qué es | n |
|---|---|---|
| A | Duplicado — NO EMITIR | 7 |
| B | Sin cuota asignable / no emitible | 2 |
| C | Acudiente roto | 4 |
| D | **Emitir con confirmación** | 13 |
| E | No resuelto | 0 |
| | **total** | **26** |

## BUCKET A — DUPLICADO, NO EMITIR (n=7)

### ANAISABEL MONDRAGON MEJIA
- **Por qué:** su cobro de 2026-8 ya fue anulado POR DUPLICADO el 2026-08-05 (SportMaps), con aprobación explícita del owner
- **Entrada real:** 2026-07-06T14:48:50 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · `a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3` [child] "ANAISABEL MONDRAGON MEJIA" doc=1122651373
    - origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
    - inscripciones 2 (activas 1) · plan PLAN DYNASTY  · equipo INFANTIL FEMENINO · cuota $210.000 (enrollments.monthly_fee)
    - cobros 2: vivos 0, pagados 0 ($0), anulados 2 · de 2026-8: cancelled/$210.000, cancelled/$210.000
- · `134bb246-df68-4ec1-aa91-1228ec3db94d` [child] "Anaisabel Mondragón Mejía" doc=1122651393
    - origen `invitacion` — hay invitación previa (2026-07-06, pending) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id
    - inscripciones 1 (activas 1) · plan PLAN DYNASTY  · equipo INFANTIL FEMENINO · cuota $210.000 (enrollments.monthly_fee)
    - cobros 1: vivos 1, pagados 1 ($210.000), anulados 0 · de 2026-8: paid/$210.000
- **Acción:** NO EMITIR — la decisión ya se tomó y quedó registrada. Reabrirla es revertir la limpieza del 5-ago, no completarla.
- ⚠ cobro(s) de 2026-8 ANULADO(s): $210.000 el 2026-08-05T09:44:03 por SportMaps — **anulado POR DUPLICADO** ("ANAISABEL MONDRAGON MEJIA"): Cobro duplicado: la misma persona existe dos veces en la escuela. Anulado tras auditoria de duplicados 2026-08-05 con aprobacion explicita del owner. · $210.000 el 2026-08-05T09:44:02 por sistema/cron (anulación genérica, sin motivo registrado) · $210.000 el 2026-07-29T21:33:52 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ 🚩 la anulación fue EXPLÍCITAMENTE por duplicado, con aprobación del owner → volver a emitir aquí recrea exactamente lo que se limpió el 5-ago

### Jerónimo Balaguera Barrera
- **Por qué:** la persona existe 2 veces en la escuela y 1 de esas identidades YA tiene cobro de 2026-8
- **Entrada real:** 2026-08-03T16:27:40 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · muerta `b29a8335-84a1-43e4-9ad9-6e0bad856718` [child] "Jerónimo Balaguera Barrera" doc=1096073403
    - origen `invitacion` — hay invitación previa (2026-08-03, accepted) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id
    - inscripciones 1 (activas 1) · plan PLAN PRO · equipo — · cuota $150.000 (enrollments.monthly_fee)
    - cobros 0: vivos 0, pagados 0 ($0), anulados 0
- **⭐ VIVA** `d810819d-6814-4d92-bf9b-08e679c531e6` [child] "JERONIMO BALAGUERA" doc=—
    - origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
    - inscripciones 1 (activas 1) · plan PLAN START  · equipo MINIVOLLEY BENJAMINES · cuota $90.000 (enrollments.monthly_fee)
    - cobros 2: vivos 1, pagados 0 ($0), anulados 1 · de 2026-8: pending/$90.000
- **Acción:** NO EMITIR — el gemelo ya tiene el cobro de 2026-8. Esperar la fusión F3.

### Josue Cortes Saenz
- **Por qué:** otro registro con el MISMO nombre ya tiene cobro de 2026-8, pero con documento distinto: este triage no los agrupa y podrían ser dos personas
- **Entrada real:** 2026-08-04T14:53:17 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · muerta `632b0f58-b409-4be9-8633-ce41ec4c38a9` [child] "Josue Cortes Saenz" doc=1029152402
    - origen `invitacion` — hay invitación previa (2026-07-06, pending) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id
    - inscripciones 1 (activas 1) · plan SENIORS 8 Clases · equipo — · cuota $130.000 (enrollments.monthly_fee)
    - cobros 0: vivos 0, pagados 0 ($0), anulados 0
- **Acción:** NO EMITIR sin que Dynasty confirme si son la misma persona. Si lo son, el cobro ya existe en `cbf0b90e` y esto es un duplicado; si no lo son, falta emitir $130.000 acá.
- ⚠ cobro(s) de 2026-8 ANULADO(s): $150.000 el 2026-07-29T22:45:44 por sistema/cron (anulación genérica, sin motivo registrado) · $150.000 el 2026-07-30T21:08:16 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ `cbf0b90e` "JOSUE CORTES SAENZ" doc=1011216456 origen `carga_masiva` · de 2026-8: cancelled/$150.000, pending/$150.000 — coincide el nombre y NADA más → puede ser homónimo, no agrupa | fechas de nacimiento distintas (2012-01-04 vs 2012-01-31) | documentos distintos (1029152402 vs 1011216456)
- ⚠ este registro: doc=1029152402 origen `invitacion` · sin cobro de 2026-8

### Julieta Mayorga Veloza
- **Por qué:** su cobro de 2026-8 ya fue anulado POR DUPLICADO el 2026-08-05 (SportMaps), con aprobación explícita del owner
- **Entrada real:** 2026-08-01T11:29:26 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · `73d23aea-d9b3-4067-aebb-d1af4307515d` [child] "Julieta Mayorga Veloza" doc=1011210629
    - origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
    - inscripciones 2 (activas 1) · plan PLAN PRO · equipo — · cuota $150.000 (offering_plans.price)
    - cobros 2: vivos 0, pagados 0 ($0), anulados 2 · de 2026-8: cancelled/$150.000
- **Acción:** NO EMITIR — la decisión ya se tomó y quedó registrada. Reabrirla es revertir la limpieza del 5-ago, no completarla.
- ⚠ cobro(s) de 2026-8 ANULADO(s): $150.000 el 2026-08-05T09:44:05 por SportMaps — **anulado POR DUPLICADO** ("Julieta Mayorga Veloza (mamá)"): Cobro duplicado: la misma persona existe dos veces en la escuela. Anulado tras auditoria de duplicados 2026-08-05 con aprobacion explicita del owner. · $150.000 el 2026-08-05T09:44:05 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ 🚩 la anulación fue EXPLÍCITAMENTE por duplicado, con aprobación del owner → volver a emitir aquí recrea exactamente lo que se limpió el 5-ago

### Miguel Ángel Runza Ramírez
- **Por qué:** la persona existe 2 veces en la escuela y NINGUNA tiene cobro de 2026-8
- **Entrada real:** 2026-08-04T19:55:13 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- **⭐ VIVA** `10ace736-987a-48fe-b5da-39a7b4567257` [adult] "Miguel Ángel Runza Ramírez" doc=—
    - origen `invitacion` — hay invitación previa (2026-08-04, accepted) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id
    - inscripciones 1 (activas 1) · plan PLAN PRO · equipo JUVENIL MAYORES MASCULINO · cuota $150.000 (enrollments.monthly_fee)
    - cobros 1: vivos 1, pagados 0 ($0), anulados 0
- · muerta `4da08915-b1fe-4ffa-9290-4b42e4946280` [unregistered] "MIGUEL ANGEL RUNZA RAMIREZ" doc=1014669246
    - origen `invitacion` — unregistered_athletes.invitation_id apunta a una invitación (cruce fuerte)
    - inscripciones 0 (activas 0) · plan — · equipo — · cuota $0 ((ninguna: cuota 0))
    - cobros 0: vivos 0, pagados 0 ($0), anulados 0
- **Acción:** FUSIONAR PRIMERO (F3), después emitir UNA sola vez a la identidad que sobreviva: $150.000. Hoy ninguna de las 2 tiene cobro de 2026-8, así que el mes sí falta — pero emitirlo antes de fusionar elige mal la identidad.
- ⚠ ojo: 1 identidad(es) tiene(n) cobro vivo pero de OTRO período (2026-09) → no cubre 2026-8; es el desfase mes+1 del alta
- ⚠ agrupada con 4da08915: mismo nombre + misma fecha de nacimiento

### SERGIO HERRERA TORRES
- **Por qué:** su cobro de 2026-8 ya fue anulado POR DUPLICADO el 2026-08-05 (SportMaps), con aprobación explícita del owner
- **Entrada real:** 2026-07-06T14:49:07 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · `8d072d3c-1c8d-43bc-8c8f-378e755cc440` [child] "SERGIO HERRERA TORRES" doc=122205756
    - origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
    - inscripciones 2 (activas 1) · plan PLAN DYNASTY  · equipo INFANTIL MASCULINO · cuota $210.000 (enrollments.monthly_fee)
    - cobros 2: vivos 0, pagados 0 ($0), anulados 2 · de 2026-8: cancelled/$210.000, cancelled/$210.000
- · `aa79ac36-9ad7-4552-9ee5-32ded0524d22` [child] "Sergio Herrera" doc=1222205756
    - origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
    - inscripciones 1 (activas 1) · plan PLAN DYNASTY  · equipo INFANTIL MASCULINO · cuota $210.000 (enrollments.monthly_fee)
    - cobros 1: vivos 1, pagados 1 ($210.000), anulados 0 · de 2026-8: paid/$210.000
- **Acción:** NO EMITIR — la decisión ya se tomó y quedó registrada. Reabrirla es revertir la limpieza del 5-ago, no completarla.
- ⚠ cobro(s) de 2026-8 ANULADO(s): $210.000 el 2026-07-29T22:45:44 por sistema/cron (anulación genérica, sin motivo registrado) · $210.000 el 2026-08-05T09:44:03 por SportMaps — **anulado POR DUPLICADO** ("SERGIO HERRERA TORRES"): Cobro duplicado: la misma persona existe dos veces en la escuela. Anulado tras auditoria de duplicados 2026-08-05 con aprobacion explicita del owner. · $210.000 el 2026-08-05T09:44:03 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ 🚩 la anulación fue EXPLÍCITAMENTE por duplicado, con aprobación del owner → volver a emitir aquí recrea exactamente lo que se limpió el 5-ago

### Sofia Anaya
- **Por qué:** su cobro de 2026-8 ya fue anulado POR DUPLICADO el 2026-08-05 (SportMaps), con aprobación explícita del owner
- **Entrada real:** 2026-07-06T14:26:27 _(la del primer registro del grupo; `start_date` no sirve, los merges del 3-4 ago lo reescribieron)_
- · `e754209b-4ce2-4509-91f4-8297dd20ddda` [child] "Sofia Anaya" doc=1015694294
    - origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
    - inscripciones 1 (activas 1) · plan PLAN PRO · equipo MINIVOLLEY BENJAMINES · cuota $150.000 (offering_plans.price)
    - cobros 1: vivos 0, pagados 0 ($0), anulados 1 · de 2026-8: cancelled/$150.000
- **Acción:** NO EMITIR — la decisión ya se tomó y quedó registrada. Reabrirla es revertir la limpieza del 5-ago, no completarla.
- ⚠ cobro(s) de 2026-8 ANULADO(s): $150.000 el 2026-08-05T09:44:06 por SportMaps — **anulado POR DUPLICADO** ("Sofia Anaya (2ª fila del import)"): Cobro duplicado: la misma persona existe dos veces en la escuela. Anulado tras auditoria de duplicados 2026-08-05 con aprobacion explicita del owner. · $150.000 el 2026-08-05T09:44:06 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ 🚩 la anulación fue EXPLÍCITAMENTE por duplicado, con aprobación del owner → volver a emitir aquí recrea exactamente lo que se limpió el 5-ago

## BUCKET B — SIN CUOTA ASIGNABLE / NO EMITIBLE (n=2)

### Dilan Yadiel Gaona Martin
- `98ed6f98-a221-4ece-b9ce-7c6def63c8de` [child] · enrollment `a1e6c48a-1d18-43c1-9358-70e85a6db8d6` · origen `invitacion`
- **Falta:** cuota efectiva 0 por la cadena canónica (plan=—, equipo=JUVENIL MAYORES MASCULINO)
- plan — · equipo JUVENIL MAYORES MASCULINO · cuota calculada $0
- **Acción:** Dynasty asigna precio — con monto 0 la emisión falla por el constraint amount > 0

### MARIA PAULA CALDERON MONTENEGRO
- `99ff6441-2f8c-46eb-8984-cc93d070b454` [child] · enrollment `04529c59-9669-4802-9ef3-02de32d7de54` · origen `carga_masiva`
- **Falta:** la identidad está INACTIVA en la escuela pero conserva 1 inscripción(es) activa(s) → inconsistencia: la baja debió cancelarlas
- plan — · equipo INTERMEDIO · cuota calculada $0
- **Acción:** no emitir; Dynasty confirma si es baja real (y se cierra la inscripción) o si la inactivación fue un error

## BUCKET C — ACUDIENTE ROTO (n=4)

### HADE SOFIA PRADA ACERO
- `68dbf9cf-823e-4979-9501-6c85b99e2d2c` [child] · origen `carga_masiva` · cuota que tendría $180.000
- **Roto:** el acudiente es la propia atleta ("HADE SOFÍA PRADA ACERO") → nadie distinto puede pagar
- acudiente: HADE SOFÍA PRADA ACERO · walex25_@hotmail.com · 3127932069
- **Acción:** Dynasty consigue un acudiente con correo; hoy el cobro nace sin pagador y sin destinatario
- ⚠ cobro(s) de 2026-8 ANULADO(s): $150.000 el 2026-08-05T18:30:10 por sistema/cron (anulación genérica, sin motivo registrado)

### SALOME PAMPLONA MARIN
- `59aa5b76-2a51-4ac4-816c-b714f3655b61` [child] · origen `qr_autoregistro` · cuota que tendría $150.000
- **Roto:** acudiente solo como TEXTO: parent_id NULL y sandramarcelamaringiraldo@gmail.com no tiene cuenta todavía → el cobro nace sin pagador (403)
- acudiente: SANDRA MARCELA MARIN GIRALDO · sandramarcelamaringiraldo@gmail.com · 573132252618
- **Acción:** invitar a sandramarcelamaringiraldo@gmail.com para que cree la cuenta; al aceptar queda como pagador y ahí se emite

### VALENTINA CASTELLANOS CUETO
- `7d558d29-95c4-402e-aec3-50dd87d9b600` [unregistered] · origen `alta_manual` · cuota que tendría $150.000
- **Roto:** atleta no registrado sin perfil vinculado → el cobro nace sin pagador (parent_id NULL) · sin correo de contacto → no hay a dónde mandar el cobro
- acudiente: — · sin correo · 573022064871
- **Acción:** Dynasty consigue un acudiente con correo; hoy el cobro nace sin pagador y sin destinatario

### VICTORIA OSORIO MARTINEZ
- `13363f41-a247-432b-bfb7-4ce862281612` [child] · origen `qr_autoregistro` · cuota que tendría $180.000
- **Roto:** acudiente solo como TEXTO: parent_id NULL y sandypmm@hotmail.com no tiene cuenta todavía → el cobro nace sin pagador (403)
- acudiente: SANDRA MARTINEZ · sandypmm@hotmail.com · 573157690725
- **Acción:** invitar a sandypmm@hotmail.com para que cree la cuenta; al aceptar queda como pagador y ahí se emite

## BUCKET D — EMITIR CON CONFIRMACIÓN (n=13)

### CRISTIAN DAVID CASTILLO TAPIAS — $150.000
- `1252e927-d02b-4c20-bc63-5682a125031c` [child] · enrollment `5cecae81-7098-4bf6-8cf3-1086de5d9ab4`
- equipo — · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T14:24:26 · acudiente GIOVAN CLAVIJO TORRES (giovanclavijo@gmail.com)

### DAYANY ECHAVARRIA VARON — $150.000
- `7cbff75a-842e-4240-93a8-10be90ddd2cc` [child] · enrollment `46c925fa-e5df-4e84-bc77-e93374ffa9a6`
- equipo MENORES FEMENINO · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `invitacion` — hay invitación previa (2026-08-04, accepted) cruzada por nombre/correo — señal DÉBIL, invitations no tiene child_id
- entrada real 2026-08-04T17:07:35 · acudiente Mary Baron (mary.baron.mb@gmail.com)

### JUAN JOSE PEÑA — $210.000
- `27d826e5-ce9a-4cbb-b253-bb3c09af9287` [child] · enrollment `2e146c24-abe2-44c7-a297-e8dab1ec7aeb`
- equipo MENORES MASCULINO · plan PLAN DYNASTY  · monto $210.000 vía `enrollments.monthly_fee`
- origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
- entrada real 2026-07-06T14:51:02 · acudiente Nelly Johanna Gomez Barahona (nellgomb12@yahoo.es)
- ⚠ cobro(s) de 2026-8 ANULADO(s): $180.000 el 2026-08-05T17:37:34 por sistema/cron (anulación genérica, sin motivo registrado) · $180.000 el 2026-07-29T22:45:44 por sistema/cron (anulación genérica, sin motivo registrado) · $180.000 el 2026-07-30T12:51:12 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ hubo cobro de 2026-8 y quedó en: cancelled/$180.000, cancelled/$180.000
- ⚠ el cobro anulado de 2026-8 decía $180.000 y la cadena canónica hoy da $210.000 → alguien cambió el plan; confirmar con Dynasty cuál monto se le comunicó a la familia

### JUAN SEBASTIAN ROMERO AGUDELO — $150.000
- `ce6d1f20-c945-4985-9689-c350c059bf31` [child] · enrollment `88307715-261a-4984-94a0-b89fd71c99d9`
- equipo MENORES MASCULINO · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T17:43:05 · acudiente Roberto Romero Rodrguez (romeroroberto723@gmail.com)

### Lauren soffia Garcia bohorquez — $90.000
- `2c8031e9-03a0-4a34-b825-a7fe35ebca6a` [child] · enrollment `007015f9-fa20-4847-87fd-15b59cd123b1`
- equipo MENORES FEMENINO · plan PLAN START  · monto $90.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T17:06:46 · acudiente Andrés Mauricio Montenegro Rubio (ammauromon@gmail.com)

### María Natalia Lemus Díaz — $150.000
- `e8023bac-806a-42dc-a9fd-0f1ebe971c20` [child] · enrollment `a25c09b7-11af-4bbe-a7a5-d415a4d3037f`
- equipo INFANTIL FEMENINO · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T13:42:31 · acudiente HUMBERTO LEMUS GARCIA (humberto_lemus@hotmail.com)

### MARIA PAULA ESCOBAR BENITEZ — $210.000
- `4dd5ac0a-3270-4d28-9900-cf35227e3473` [child] · enrollment `ac365674-0953-400a-8b99-1be51d0bf0f2`
- equipo NUEVA ERA · plan PLAN DYNASTY  · monto $210.000 vía `enrollments.monthly_fee`
- origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
- entrada real 2026-07-06T14:51:25 · acudiente MARCELA BENITEZ (marcelabeniteztorres@gmail.com)
- ⚠ cobro(s) de 2026-8 ANULADO(s): $180.000 el 2026-08-05T11:06:17 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ hubo cobro de 2026-8 y quedó en: cancelled/$180.000
- ⚠ el cobro anulado de 2026-8 decía $180.000 y la cadena canónica hoy da $210.000 → alguien cambió el plan; confirmar con Dynasty cuál monto se le comunicó a la familia

### SALOME MONTENEGRO PIEDRAHITA — $90.000
- `6ae6d9c0-b3f9-4f80-9dd4-845521381a26` [child] · enrollment `8e67f7e0-3f16-4080-8ed8-0246fea17cc4`
- equipo MINIVOLLEY BENJAMINES · plan PLAN START  · monto $90.000 vía `enrollments.monthly_fee`
- origen `carga_masiva` — creada dentro de la ráfaga del onboarding (2026-07-06T14:26 → 2026-07-06T14:51)
- entrada real 2026-07-06T14:26:27 · acudiente EYDE YAMILE PIEDRAHITA BUITRAGO (eydeyamile@hotmail.com)
- 🔶 **deuda anterior:** 1 cobro(s), $90.000
- ⚠ cobro(s) de 2026-8 ANULADO(s): $150.000 el 2026-08-06T13:29:24 por sistema/cron (anulación genérica, sin motivo registrado)
- ⚠ arrastra 1 cobro(s) anterior(es) sin pagar por $90.000 — NO bloquea agosto, pero cobrar solo agosto no salda la cuenta
- ⚠ hubo cobro de 2026-8 y quedó en: cancelled/$150.000
- ⚠ el cobro anulado de 2026-8 decía $150.000 y la cadena canónica hoy da $90.000 → alguien cambió el plan; confirmar con Dynasty cuál monto se le comunicó a la familia

### Samuel Puentes Barrera — $150.000
- `599284c9-0b90-40c1-83da-f555256b7f86` [child] · enrollment `1e4c6f1d-f03b-4cab-a0a7-318b2aba7f1b`
- equipo — · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-05T20:41:25 · acudiente Javier Puentes Rodríguez (javier.puentes161@casur.gov.co)

### Sara Camila Bejarano — $90.000
- `89e029ee-75c4-46f9-aa7c-65f5084e47fc` [child] · enrollment `0c38cf10-b719-491d-aeca-c9ae0844e2be`
- equipo — · plan PLAN START  · monto $90.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T13:16:50 · acudiente Camila Arambulo  (forumja25@gmail.com)

### Sergio Soler Suárez — $150.000
- `83e864de-bad9-4c0e-9f02-ef2afdac304d` [child] · enrollment `62005f93-2711-4cb8-bf7b-69c783dbb5ca`
- equipo — · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T13:25:04 · acudiente Luis Eduardo Soler López (eduardosoler2018@gmail.com)

### SHARITH ENCISO BARON — $150.000
- `b01f4874-2921-4707-a950-386fa5f1ff9d` [child] · enrollment `2c05e25c-a913-4d22-9aeb-5bf24da4e4f4`
- equipo — · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-04T17:02:19 · acudiente Mary Baron (mary.baron.mb@gmail.com)

### Sofia Valentina Barón Chacón — $150.000
- `1b434127-06b8-4163-a23d-594969c04951` [child] · enrollment `b4851def-73da-419a-9ca9-014aecabba72`
- equipo MENORES FEMENINO · plan PLAN PRO · monto $150.000 vía `enrollments.monthly_fee`
- origen `qr_autoregistro` — creada fuera de la ráfaga, sin invitación previa y con acudiente propio → firma del auto-registro
- entrada real 2026-08-05T05:22:36 · acudiente Johana Chacón (johanitalva@hotmail.com)

**TOTAL BUCKET D: $1.890.000 en 13 cobros.**

## BUCKET E — NO RESUELTO (n=0)

_vacío._

## Agregados de control

### 1. Bucket D contra el estimado previo

- Estimado que traía el plan: **$2.130.000** (960.000 + 1.170.000).
- Bucket D real: **$1.890.000** en 13 personas.
- Diferencia: **$-240.000**.

La diferencia no es un error de suma: el estimado contaba a los 26 como si todos fueran emitibles. Este triage saca 13 de la cola (7 duplicados, 2 sin cuota, 4 con acudiente roto, 0 sin resolver), y para los que quedan usa la cadena canónica de `open_month` en vez de la cuota que muestra el listado.

### 2. El grifo: auto-registro conviviendo con carga masiva

- **1** de los 26 tienen una identidad `qr_autoregistro` conviviendo con una `carga_masiva` de la misma persona.
  - SERGIO HERRERA TORRES: carga_masiva(2026-07-06) + qr_autoregistro(2026-08-02)

Esa es la firma exacta del duplicado: la escuela precargó la ficha en el onboarding y después el acudiente se auto-registró por QR sin que el sistema adoptara el registro existente. Mientras el grifo siga abierto, cada mes reaparecen casos nuevos.

### 3. Las 5 anulaciones explícitas por duplicado del 5-ago

Vienen de `audit_logs.action = 'cancel_duplicate_charge'` — el registro que dejó la limpieza, con motivo y aprobación del owner. Es la evidencia que manda sobre cualquier coincidencia de nombres.

- **Sofia Anaya (2ª fila del import)** → bucket A (como "Sofia Anaya")
- **ANAISABEL MONDRAGON MEJIA** → bucket A (como "ANAISABEL MONDRAGON MEJIA")
- **SERGIO HERRERA TORRES** → bucket A (como "SERGIO HERRERA TORRES")
- **JUANITA MARIA CAMILA RAMIREZ MEDINA** → **no está entre los 26** — fuera del alcance de este triage
- **Julieta Mayorga Veloza (mamá)** → bucket A (como "Julieta Mayorga Veloza")

### 4. Origen de las 30 identidades de los 26

- `qr_autoregistro`: 14
- `carga_masiva`: 8
- `invitacion`: 7
- `alta_manual`: 1

## ¿Se puede simplemente correr `open_month`?

**No.** Replicando la cláusula `elegibles` de la RPC viva sobre toda la escuela, `open_month(2026, 8)` generaría **24 cobros por $3.700.000** — bastante más que los 13 del bucket D.

De esos, **11 son personas que este triage marcó como NO emitibles**, por $1.810.000:

| Persona | Bucket | Monto | Qué pasaría si se corre |
|---|---|---|---|
| ANAISABEL MONDRAGON MEJIA | A | $210.000 | recrea el cobro que el owner anuló por duplicado |
| HADE SOFIA PRADA ACERO | C | $180.000 | crea un cobro que nadie puede pagar |
| Jerónimo Balaguera Barrera | A | $150.000 | cobra a la identidad duplicada |
| Josue Cortes Saenz | A | $130.000 | cobra a la identidad duplicada |
| Julieta Mayorga Veloza | A | $150.000 | recrea el cobro que el owner anuló por duplicado |
| Miguel Ángel Runza Ramírez | A | $150.000 | cobra a la identidad duplicada |
| SALOME PAMPLONA MARIN | C | $150.000 | crea un cobro que nadie puede pagar |
| SERGIO HERRERA TORRES | A | $210.000 | recrea el cobro que el owner anuló por duplicado |
| Sofia Anaya | A | $150.000 | recrea el cobro que el owner anuló por duplicado |
| VALENTINA CASTELLANOS CUETO | C | $150.000 | crea un cobro que nadie puede pagar |
| VICTORIA OSORIO MARTINEZ | C | $180.000 | crea un cobro que nadie puede pagar |

Los 13 del bucket D **sí** están entre los elegibles y con el mismo monto — el total coincide al peso con $1.890.000. Es decir: la cadena del triage y la de la RPC dan lo mismo; lo que la RPC no sabe es a quién NO cobrarle.

**Conclusión operativa:** la emisión tiene que ser dirigida (por `enrollment_id`/atleta, los 13 del bucket D), no un `open_month` de toda la escuela. Y hasta que la fusión F3 limpie los duplicados, correr el botón de generar mes sobre Dynasty vuelve a romper lo que se arregló el 5-ago.

## Cobros con período anterior a su mes de creación (no es un bug)

Hay **5** cobros vivos cuyo período es anterior al mes en que se crearon. **No están mal rotulados.** La plataforma no tiene forma de registrar el pago de un mes anterior, así que cuando una familia salda tarde, el admin crea el cobro a mano desde el panel con el vencimiento del mes que corresponde; `trg_payments_fill_period` lo estampa con ese período aunque se haya creado hoy.

| Atleta | Monto | Período | Creado | Estado | Qué significa |
|---|---|---|---|---|---|
| HADE SOFIA PRADA ACERO | $180.000 | 2026-07 | 2026-08-05 | paid | saldó un mes viejo — **el mes corriente sigue faltando** |
| JUAN JOSE PEÑA | $210.000 | 2026-07 | 2026-08-05 | paid | saldó un mes viejo — **el mes corriente sigue faltando** |
| LAURA SOFIA FAJARDO RINCON | $150.000 | 2026-07 | 2026-08-01 | paid | saldó un mes viejo — **el mes corriente sigue faltando** |
| MARIA PAULA ESCOBAR BENITEZ | $210.000 | 2026-07 | 2026-08-05 | paid | saldó un mes viejo — **el mes corriente sigue faltando** |
| SALOME MONTENEGRO PIEDRAHITA | $90.000 | 2026-07 | 2026-08-06 | pending | deuda anterior real, se cobra aparte del mes corriente |

Por eso ninguno de estos cuenta como cobro de 2026-08, y las personas que aparecen acá **siguen en su bucket**: pagar julio no paga agosto.

## Lo que va a pasar cuando se emita (triggers vivos, verificados en la base)

No es teoría: son los triggers que hoy están activos sobre `payments` y `children`.

- **`trg_notify_on_payment_created`** — `AFTER INSERT ... WHEN (new.status = 'pending')`. Cada cobro emitido dispara una notificación a la familia. Emitir los 13 del bucket D manda 13 avisos de golpe; si se emiten de a uno para confirmar, son 13 avisos igual, pero escalonados.
- **`trg_payments_fill_period`** — `BEFORE INSERT`. Rellena `period_year`/`period_month` desde `due_date`. No hace falta pasarlos a mano, y por eso el veto de «¿ya tiene cobro del período?» es confiable incluso en cobros creados por otras vías.
- **`trg_adopt_orphan_payments_on_child_link`** y **`trg_backfill_payment_payer_on_link`** — `AFTER UPDATE OF parent_id ON children WHEN (old.parent_id IS NULL AND new.parent_id IS NOT NULL)`.

  Esto **cambia la urgencia del bucket C**: un cobro emitido hoy con `parent_id` NULL no queda huérfano para siempre. En cuanto se vincule el acudiente, los dos triggers lo adoptan y le rellenan el pagador. Es decir, el orden no es destructivo — se puede vincular primero y emitir después (recomendado, la familia puede pagar desde el minuto uno), o emitir y vincular después (el cobro se arregla solo, pero mientras tanto el padre ve 403). Lo que **no** se arregla solo es el correo con dominio mal escrito ni el acudiente que es la propia atleta.
- **`trg_cancel_payments_on_enrollment_cancel`** — cancelar la inscripción anula sus cobros. Relevante para el caso inactivo del bucket B: si Dynasty confirma la baja, no hay que anular a mano.

## Sobre el origen: qué es dato y qué es inferencia

Se revisó si existe un rastro versionado del cargue masivo. `external_school_imports` **no sirve**: guarda el scraping del IDRD (`source = idrd_bogota_2026`), no este onboarding. No hay tabla que diga «esta fila entró por el cargue».

Por eso el `origen` de este reporte es **inferencia por ráfaga**, y es sólida para `carga_masiva` (415 filas en 5 minutos no es otra cosa) pero **débil para `invitacion`**: `invitations` no tiene `child_id`, así que el cruce es por nombre normalizado y correo. Donde la distinción entre `invitacion` y `qr_autoregistro` cambie una decisión, hay que confirmarla a mano.

---

**Este script no escribió nada.** La emisión de los D es un paso aparte, con confirmación fila por fila.
