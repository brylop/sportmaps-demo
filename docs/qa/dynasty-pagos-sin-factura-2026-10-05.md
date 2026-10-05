# Dynasty Volley Club: pagos cobrados sin factura electrónica (2026-10-05)

**Escuela:** DYNASTY VOLLEY CLUB (`2d509571-3238-4c04-ac3f-6dfe20539226`)
**Facturador:** `factus_v2`, producción, `enabled = true`, rango DYTY.
**Alcance:** pagos `status = 'paid'` con `payment_date >= 2026-09-01` (el usuario decidió facturar solo desde septiembre; julio y agosto quedan fuera aunque el panel los cuente) y **sin factura viva** (`electronic_invoices.status IN ('accepted','sent')`).
**Cómo se obtuvo:** solo `SELECT` contra la base viva. No se emitió nada ni se escribió nada.

## Resumen

| Grupo | Pagos | Monto | Motivo del motor | Cómo se resuelve |
|---|---:|---:|---|---|
| Sin pagador vinculado | 39 | $6.010.000 | `payment_without_payer` | Vincular acudiente a la ficha, o que la familia pida factura (preferencia por celular) |
| Pagador sin documento | 51 (40 pagadores) | $8.220.000 | `customer_missing_fiscal_data` | Completar documento y dirección en *Datos fiscales faltantes* |
| Listos, fuera de la ventana de 3 días | 2 | $240.000 | (ninguno: el cron ya no los mira) | Emitir uno a uno (propuesta abajo) |
| **Total** | **92** | **$14.470.000** | | |

Correo del pagador: los 53 pagos con pagador tienen un correo válido, así que la regla nueva de correo (`customer_missing_email`) **no suma** a ninguno de estos grupos.

Los datos de contacto (teléfono y correo) **no se copian aquí** a propósito: este archivo va al repo. La escuela los ve en Facturación electrónica → *Datos fiscales faltantes*, con el botón *Completar datos* por pagador.

## 1. Pagador sin documento (51 pagos, 40 pagadores)

Acción para la escuela: en *Datos fiscales faltantes*, *Completar datos* (tipo y número de documento + dirección + municipio). Ninguno tiene dirección, así que hay que pedir las dos cosas. Al guardar, los pagos quedan habilitados pero **no se emiten solos** (fuera de la ventana): aparecen en la lista nueva *Listos para emitir* o se emiten por rango.

| Pagador | Relación | Pagos | Monto | Fecha(s) de pago | Atleta(s) |
|---|---|---:|---:|---|---|
| Alex Montenegro | acudiente | 3 | $540.000 | 2026-09-07 | Isabella Montenegro Castellanos, Valentina Montenegro Casdtellanos |
| Alexander castillo | acudiente | 4 | $480.000 | 2026-09-07 | ALEXANDER CASTILLO, LAURA SOFIA CASTILLO CABRA |
| Juan Sebastian Castro hernandez | acudiente | 2 | $420.000 | 2026-09-17 | JULIANA CASTRO GRIJALBA |
| Karen Yubely Ramirez Posada | acudiente | 2 | $360.000 | 2026-09-21 | JULIAN DAVID NIÑO RAMIREZ |
| Sofía Ariza Sanchez | acudiente | 2 | $360.000 | 2026-09-10 | MARIANA ARIZA SANCHEZ, SOFIA ARIZA SANCHEZ |
| Camilo Mora | acudiente | 2 | $330.000 | 2026-09-15 | ANDRES ESTEBAN MORA DUARTE, JOSE GABRIEL MORA DUARTE |
| María Camila Valencia Bohórquez | acudiente | 2 | $300.000 | 2026-09-02 | MARIA CAMILA VALENCIA BOHORQUEZ |
| Darwin Hernandez | acudiente | 2 | $260.000 | 2026-09-06 y 2026-10-05 | DARWIN HERNANDEZ |
| Haydybe Beltran Diaz | acudiente | 1 | $210.000 | 2026-09-10 | MIA ORTIZ BELTRAN |
| Alejandro Cifuentes | acudiente | 1 | $180.000 | 2026-09-17 | LUCIANA CIFUENTES VILLA |
| Angie reinoso | acudiente | 1 | $180.000 | 2026-09-13 | SARA SOFIA BERMUDEZ RAMIREZ |
| C R | acudiente | 1 | $180.000 | 2026-09-05 | GABRIELA RODRIGUEZ LOPEZ |
| carlos arturo mahecha pinto | atleta adulto | 1 | $180.000 | 2026-09-04 | (él mismo) |
| Carlos Javier Cuervo | acudiente | 1 | $180.000 | 2026-09-07 | LUNA ISABELLA CUERVO BELTRAN |
| Derly Rodriguez | acudiente | 1 | $180.000 | 2026-09-22 | LUCIA CACERES RODRIGUEZ |
| Gisela Chinchilla | acudiente | 1 | $180.000 | 2026-09-07 | LUCIANA ZAMORA CHINCHILLA |
| LUZ ANGELA BARON SABOGAL | acudiente | 1 | $180.000 | 2026-09-11 | STEPHANIA RODRIGUEZ BARON |
| Maria Camila Velandia Builes | acudiente | 1 | $180.000 | 2026-09-08 | MARIA JOSE CEBALLOS VELANDIA |
| Nathaly Garcia Sanchez | acudiente | 1 | $180.000 | 2026-09-11 | HANNA CAMILA MORENO GARCIA |
| NIDIA CLEMENCIA HERNANDEZ BAQUERO | acudiente | 1 | $180.000 | 2026-09-08 | SARA ISABELLA HERNANDEZ BAQUERO |
| Paola andrea gaitan | acudiente | 1 | $180.000 | 2026-09-07 | MARIA PAULA GOMEZ GAITAN |
| Paola Echeverria L. | acudiente | 1 | $180.000 | 2026-09-17 | MATIAS ILLERA ECHEVERRIA |
| Cecilia García | acudiente | 1 | $150.000 | 2026-09-22 | MARA ALEJANDRA RINCON LOPEZ |
| Elviz Carreño | acudiente | 1 | $150.000 | 2026-09-02 | Isabella Carreño Rodriguez |
| GIOVAN CLAVIJO TORRES | acudiente | 1 | $150.000 | 2026-09-07 | CRISTIAN DAVID CASTILLO TAPIAS |
| Hollman Andrés Peláez | acudiente | 1 | $150.000 | 2026-10-01 | HOLLMAN ANDRES PELAEZ CHAPARRO |
| Javier Puentes Rodríguez | acudiente | 1 | $150.000 | 2026-09-08 | Samuel Puentes Barrera |
| Karen Valencia | acudiente | 1 | $150.000 | 2026-09-05 | ANTONELA ROJAS VALENCIA |
| Laura Valentina Tovar falla | atleta adulto | 1 | $150.000 | 2026-09-21 | (ella misma) |
| Luisa Mahecha | acudiente | 1 | $150.000 | 2026-09-10 | LUCIANA RODRIGUEZ MAHECHA |
| Nancy Liliana Rincón Salazar | acudiente | 1 | $150.000 | 2026-09-13 | ARTURO RAMIREZ RINCON |
| Oscar andres Mora | acudiente | 1 | $150.000 | 2026-09-07 | MARIA JOSE MORA RIGUEROS |
| Sandra Cardona | acudiente | 1 | $150.000 | 2026-09-16 | LOPEZ CARDONA SOFIA |
| Sandra Magdalena Bulla Novoa | acudiente | 1 | $150.000 | 2026-09-08 | MARIA JOSE LARA BULLA |
| Wendy Arenas tamayo | acudiente | 1 | $150.000 | 2026-09-09 | SILVANA CASTELBLANCO ARENAS |
| Wilber Anderson Elisalde Jaimes | acudiente | 1 | $150.000 | 2026-09-21 | LAYLA SOFHIA ELIZALDE GALINDO |
| yeins Paola Méndez Prado | acudiente | 1 | $150.000 | 2026-09-02 | Silvana Guerrero Méndez. |
| Yuri Raquira pineda | acudiente | 1 | $150.000 | 2026-09-30 | LUCIANA NIEVES RAQUIRA |
| Otto Ortiz Castro | atleta adulto | 1 | $130.000 | 2026-09-08 | (él mismo) |
| Nancy Peña | acudiente | 1 | $90.000 | 2026-09-16 | NATHALIA CASTILLO PEÑA |
| **40 pagadores** | | **51** | **$8.220.000** | | |

## 2. Cobro sin pagador vinculado (39 pagos)

El cobro tiene atleta pero ni `parent_id` ni `user_id`: no hay a quién facturarle. **El formulario de datos fiscales no lo arregla.** Todos tienen celular del acudiente en la ficha, así que hay dos salidas:

- **Vincular un acudiente con cuenta** a la ficha del atleta (o marcarlo atleta adulto con cuenta). Después aparece en el grupo 1 si le falta el documento.
- **Preferencia de factura por celular** (spec `factura-electronica-preferencia-y-datos-del-pagador`, migración `20261005133534`, *sin aplicar*): la familia deja sus datos desde `/p/<token>` o WhatsApp y el motor emite con esa fila aunque no haya cuenta. Cuando esa migración esté aplicada, este grupo se puede resolver sin crear cuentas.

| Atleta | Ficha | Pagos | Monto | Fecha(s) de pago | Canal |
|---|---|---:|---:|---|---|
| SOFIA BERDINAZZI RAMIREZ | children | 2 | $360.000 | 2026-09-14 | efectivo, transferencia |
| SALOME GIRALDO OBANDO | children | 2 | $300.000 | 2026-09-09 | efectivo |
| DANNA SOFIA LOPEZ ROMERO | children | 2 | $240.000 | 2026-09-07 | efectivo, transferencia |
| JUAN DANIEL SILVA SOSA | children | 1 | $210.000 | 2026-10-01 | transferencia |
| SARA SOFIA DAZA QUINTERO | children | 1 | $210.000 | 2026-09-10 | transferencia |
| ISABELLA GARZON CONTRERAS | children | 1 | $180.000 | 2026-09-27 | transferencia |
| JEIMY LORENA NOMESQUE HUERFANO | children | 1 | $180.000 | 2026-09-12 | efectivo |
| LINDA NICOLLE VELANDIA MANRIQUE | children | 1 | $180.000 | 2026-09-18 | transferencia |
| LUNA SOFIA ORTIZ VILLALOBOS | children | 1 | $180.000 | 2026-09-10 | transferencia |
| MARIA ALEJANDRA CELY HERNANDEZ | children | 1 | $180.000 | 2026-09-06 | transferencia |
| MARIA JOSE MORENO SALAS | children | 1 | $180.000 | 2026-09-06 | efectivo |
| Martina Ocampo Contreras | children | 1 | $180.000 | 2026-09-07 | transferencia |
| NATALIA SANCHEZ AVILA | children | 1 | $180.000 | 2026-09-02 | transferencia |
| SAHARA SOPHIA ROZO CORTES | children | 1 | $180.000 | 2026-09-03 | transferencia |
| SALOME BARRANTES AREVALO | children | 1 | $180.000 | 2026-09-04 | transferencia |
| SALOME MARIN LOMBO | children | 1 | $180.000 | 2026-09-05 | efectivo |
| SALOME POSADA VILLAMIL | children | 2 | $180.000 | 2026-09-06 | efectivo |
| SAMUEL PARDO LLANOS | children | 1 | $180.000 | 2026-09-17 | transferencia |
| DANIELA SOFIA ZAMBRANO HENAO | children | 1 | $150.000 | 2026-09-05 | transferencia |
| DANNA LOPEZ BALLEN | children | 1 | $150.000 | 2026-09-11 | transferencia |
| EMILY GABRIELA FUENTES LOPEZ | children | 1 | $150.000 | 2026-09-02 | efectivo |
| ESTEBAN DANIEL HERRERA RODRIGUEZ | children | 1 | $150.000 | 2026-10-02 | efectivo |
| ISABELLA MATEUS LEON | children | 1 | $150.000 | 2026-09-12 | efectivo |
| JUAN JOSE TORRES MENDIETA | children | 1 | $150.000 | 2026-09-06 | efectivo |
| LAURA SOFIA GONZALEZ HERNANDEZ | children | 1 | $150.000 | 2026-09-14 | efectivo |
| MARIANA GALLARDO HUERTAS | children | 1 | $150.000 | 2026-09-06 | transferencia |
| MARIANA VARGAS BENAVIDES | children | 1 | $150.000 | 2026-09-30 | transferencia |
| SARA ISABELLA SANTISTEBAN BAQUERO | children | 1 | $150.000 | 2026-09-13 | transferencia |
| SOFIA PARRA VILLADA | children | 1 | $150.000 | 2026-09-29 | transferencia |
| DANIELA SOLANO | unregistered | 1 | $130.000 | 2026-09-24 | transferencia |
| EDGAR HERNANDO ZERDA | unregistered | 1 | $130.000 | 2026-09-07 | efectivo |
| ERIKA JHOANA CRUZ LOPEZ | children | 1 | $130.000 | 2026-09-14 | transferencia |
| ISABELLA RODRIGUEZ AMORTEGUI | unregistered | 1 | $130.000 | 2026-09-24 | transferencia |
| ANA MARIA SANCHEZ PRIETO | children | 1 | $90.000 | 2026-09-10 | transferencia |
| ANDRES FELIPE RIOS RODRIGUEZ | children | 1 | $90.000 | 2026-09-05 | transferencia |
| **35 atletas** | | **39** | **$6.010.000** | | |

## 3. Listos pero fuera de la ventana (2 pagos), propuesta. NO ejecutado

| Pago | Fecha | Monto | Pagador | Medio | Estado en `electronic_invoices` |
|---|---|---:|---|---|---|
| `4baeb363-0d55-473a-8df5-62d86f853f09` | 2026-09-06 | $150.000 | DIANA MARTINEZ | efectivo | sin fila |
| `77f088cd-0a62-4341-86ac-e181517cba02` | 2026-09-07 | $90.000 | Adriana Manrique Sánchez | transferencia | fila `f9a3b8e8-…` **rejected**, `number = DYTY1`, "Regla: 90, Documento procesado anteriormente" |

Los dos tienen documento, dirección, municipio 11001 y correo válido. El cron no los toma porque se cobraron hace más de 3 días.

### 3a. `4baeb363` (sin fila previa): emitir uno solo

Sin riesgos especiales. Cualquiera de estas dos vías, hecha por un admin de finanzas de Dynasty:

1. **Botón nuevo**: Facturación electrónica → *Datos fiscales faltantes* → *Listos para emitir* → **Emitir** en la fila del 06/09/2026 ($150.000).
2. O `POST /api/v1/invoicing/emit/4baeb363-0d55-473a-8df5-62d86f853f09` con el token del admin.

No uses el rango 2026-09-06…2026-09-07 con tope 2: el segundo pago es el caso 3b y conviene hacerlo aparte.

### 3b. `77f088cd` (el caso DYTY1): verificar antes de reemitir

Es el pago de la colisión con Alegra. El 17-sep Factus **borró** ese documento (`DELETE /v2/bills/destroy/reference/SM-77f088cd-…`, 200 OK) y corrió el consecutivo a DYTY259. La fila local quedó en `rejected` con `number = DYTY1` como registro histórico.

Qué pasaría al emitir: `emitInvoiceForPayment` no lo ve como facturado (solo cuenta `accepted`/`sent`), y `referenciaDelProximoIntento` solo cuenta filas `void`, así que **reusa `SM-77f088cd-…`**. `runEmission` hace upsert sobre esa misma fila (pasa a `queued`) y la actualiza con el resultado: **se pierde el rastro de DYTY1 en esa fila**.

Propuesta, en orden:

1. **Guardar el histórico** antes de tocar nada (solo lectura):
   ```sql
   select id, reference_code, number, status, error_message, dian_response, created_at
   from electronic_invoices where id = 'f9a3b8e8-543e-4af1-a8bd-d9573cfed5e8';
   ```
   Pegar el resultado en `docs/qa/` o en la memoria del proyecto.
2. **Confirmar con Factus que la referencia está libre** (lectura): `GET /v2/bills?filter[reference_code]=SM-77f088cd-0a62-4341-86ac-e181517cba02` con las credenciales de producción de Dynasty (es la misma consulta que hace `factusV2Adapter.fetchByReference`). Tiene que volver vacío.
3. **NO anular la fila con nota crédito.** Tiene `number = DYTY1`, y una nota crédito apuntaría a DYTY1, que es un documento **real de Alegra** de otra persona. Por eso tampoco sirve el truco de "anular para que la referencia avance a `-2`".
4. Si (2) vuelve vacío: emitir desde la fila rechazada con el botón nuevo **Reintentar** (Facturas emitidas → filtro *Rechazadas*) o con `POST /emit/77f088cd-…`. Debería salir DYTY2xx `accepted` y la fila queda con el número nuevo.
5. Si (2) muestra que Factus todavía tiene la referencia: no reintentar. Hace falta una referencia nueva sin pasar por nota crédito (p. ej. una RPC de soporte que marque esa fila como descarte local `void` con `voided_by_invoice_id = NULL` y `number` limpio, solo con aprobación). Eso es código o SQL nuevo y queda fuera de este reporte.

## Consultas usadas (solo lectura)

```sql
-- Clasificación de los 92
with pend as (
  select p.*, coalesce(p.parent_id, p.user_id) payer from payments p
  where p.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
    and p.status = 'paid' and p.payment_date >= '2026-09-01'
    and not exists (select 1 from electronic_invoices e
                    where e.payment_id = p.id and e.status in ('accepted','sent')))
select case when payer is null then 'sin_pagador'
            when coalesce(btrim(pr.document_number),'') = '' then 'sin_documento'
            when coalesce(btrim(pr.billing_address),'') = '' then 'sin_direccion'
            else 'listo' end estado,
       count(*), sum(amount)
from pend left join profiles pr on pr.id = pend.payer
group by 1;
```

Las listas de las secciones 1 y 2 salen de la misma CTE: agrupadas por pagador (con `children` / `unregistered_athletes` para el nombre del atleta) y por ficha del atleta, respectivamente.
