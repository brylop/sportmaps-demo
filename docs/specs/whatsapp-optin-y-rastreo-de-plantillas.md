# Spec — WhatsApp: consentimiento real y rastreo de plantillas

**Fase 1 del plan v2 del canal de WhatsApp.** Bloquea a las fases 2 a 5: sin esto,
las plantillas de cobranza se registran pero no se le pueden mandar a nadie de
forma legítima.

Estado del plan al escribir esto: fase 0 (token permanente de System User)
**cerrada y verificada** el 2026-09-09.

> **v2 del spec (2026-09-09).** La v1 daba por opt-in cualquier mensaje entrante.
> Es incorrecto y está corregido en §1.1: abrir la ventana de 24h **no es**
> consentimiento. Este cambio recorre todo el documento.

---

## 0. Alcance

**Entra:**

1. Tabla `whatsapp_optins` — consentimiento **explícito**, por número y por integración.
2. Pregunta de consentimiento en el bot: primer contacto sin opt-in → se pide, y solo
   la confirmación lo estampa.
3. Baja por palabra clave (STOP) — requisito de Meta, no opcional.
4. Función `wa_can_send_template()` — la pregunta que todo envío debe hacerse antes.
5. Columnas `meta_*` en `payment_message_templates`.

**No entra** (queda definido, se construye después):

- La casilla explícita en inscripción/invitación — necesita frontend, va con la fase 4.
- La importación de consentimientos previos de Dynasty — depende de que exista ese registro.
- El chequeo de la ventana de 24h en el envío — es fase 4, aunque §4.4 deja la función lista.
- Cualquier envío real de plantillas — fase 3.

**Ya no entra** (estaba en la v1): el backfill de contactos existentes. Ver §5.

---

## 1. Estado verificado (2026-09-09, base viva)

Todo lo de abajo se comprobó contra la base, no contra el repo.

| Hecho | Evidencia |
|---|---|
| **No existe tabla `parents`** | Ni `parents`, ni `guardians`, ni `acudientes`. Los 828 padres son `profiles` con `role='parent'`. |
| No existe registro de consentimiento | Ninguna columna `*opted_in*` / `*opted_out*` en todo el esquema `public`. |
| `payment_message_templates` no rastrea Meta | 13 columnas, ninguna `meta_*`. `school_id` **nullable** (NULL = plantilla global) y 5 `template_type`: `overdue`, `partial_received`, `payment_confirmed`, `reminder_before`, `reminder_due`. 18 filas, todas `channel='whatsapp'`. |
| `whatsapp_identifications` ya está llaveada por número | `UNIQUE (integration_id, contact_wa_id)` — el opt-in usa la misma llave. |
| La ventana de 24h ya está en la base | `whatsapp_conversations.last_inbound_at`, que mantiene `wa_ingest_inbound_message`. |

### 1.1 Ventana abierta ≠ consentimiento

**La corrección de fondo de esta versión.** Verificado contra la política vigente de
Meta (`whatsappbusiness.com/policy`, consultada el 2026-09-09), textual:

> *"You may only contact people on WhatsApp if: (a) they have given you their mobile
> phone number; and (b) you have received **opt-in permission** from the recipient
> confirming that they wish to receive subsequent messages or calls from you."*

Que el usuario escriba primero habilita **responder sin plantilla durante 24 horas**.
No habilita mandarle plantillas después. Son dos permisos distintos:

| | Qué habilita | De dónde sale |
|---|---|---|
| **Ventana de 24h** | responder texto libre | `whatsapp_conversations.last_inbound_at` — ya existe |
| **Opt-in** | plantillas fuera de ventana (toda la cobranza) | `whatsapp_optins`, esta fase |

Un padre que escribe *"¿a qué hora es el entreno?"* abrió una ventana. **No aceptó
recibir cobranza.** Tratarlo como opt-in deja `source_ref` apuntando a un mensaje que
no dice nada de consentimiento — inservible si Meta audita, y es exactamente el
riesgo R14 del bloque (que una escuela nos tumbe el Tech Provider).

Por eso `whatsapp_optins` guarda **solo consentimiento explícito**. La ventana no
necesita fila propia: ya está en `last_inbound_at`, y duplicar ese estado sería
inventar una segunda fuente de verdad para lo mismo.

> **Habeas Data (Ley 1581/2012).** El responsable del tratamiento es la escuela, no
> SportMaps. `source` + `source_ref` + fecha es también lo que le sirve a la escuela
> para demostrar la autorización — sirve para los dos marcos con el mismo registro.

### 1.2 Por qué el consentimiento NO va en `profiles`

1. **Es por número, no por persona.** El padre puede escribir desde un número que no
   es el de su perfil, y muchos contactos escriben **sin estar identificados** (el OTP
   es posterior y opcional). Una columna en `profiles` no tiene dónde guardar el
   consentimiento de un número todavía anónimo.
2. **Es por negocio.** En modelo Tech Provider cada escuela es un negocio distinto ante
   Meta. El consentimiento dado a Dynasty **no vale** para otra escuela, aunque sea la
   misma persona y el mismo número.
3. **Es un evento con historia**, no un atributo: se da, se revoca, se vuelve a dar, y
   hay que poder decir de dónde salió.

---

## 2. Modelo de datos

### 2.1 `whatsapp_optins`

```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_optins (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id   uuid NOT NULL,
    -- Desnormalizado a propósito: la policy de RLS lo necesita sin hacer join
    -- (mismo criterio que whatsapp_conversations). La FK compuesta de abajo
    -- garantiza que coincida con la escuela real de la integración.
    school_id        uuid NOT NULL,
    contact_wa_id    text NOT NULL,

    -- Se llena si/cuando el contacto se identifica por OTP. Puede quedar NULL
    -- para siempre: el consentimiento vale igual, es del número.
    parent_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- NULL = nunca consintió (pidió la baja sin haber dado opt-in nunca).
    opted_in_at      timestamptz,
    opted_out_at     timestamptz,

    -- text + CHECK, no CREATE TYPE (convención del repo).
    -- TODAS son fuentes explícitas: no hay valor para "abrió la ventana".
    source           text NOT NULL CHECK (source IN (
                         'user_confirmed',    -- respondió que sí en WhatsApp
                         'form_inscripcion',  -- casilla explícita (fase 4)
                         'invitacion',
                         'import',            -- autorización previa de la escuela
                         'admin_manual',
                         'baja_directa'       -- pidió la baja sin haber consentido nunca
                     )),
    -- Prueba del consentimiento: wa_message_id del SÍ, id de inscripción, lote…
    source_ref       text NOT NULL,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_optin UNIQUE (integration_id, contact_wa_id),

    -- Una fila tiene que afirmar algo: o consintió, o pidió la baja.
    CONSTRAINT chk_wa_optin_dice_algo
        CHECK (opted_in_at IS NOT NULL OR opted_out_at IS NOT NULL),

    -- Integridad del school_id desnormalizado, declarativa y sin trigger.
    CONSTRAINT fk_wa_optin_integration
        FOREIGN KEY (integration_id, school_id)
        REFERENCES public.school_whatsapp_integrations(id, school_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_optin_school_activo
    ON public.whatsapp_optins(school_id)
    WHERE opted_in_at IS NOT NULL AND opted_out_at IS NULL;
```

`source_ref` es **NOT NULL**: no se puede registrar nada sin apuntar a la prueba.
`opted_in_at` es nullable, pero el CHECK obliga a que la fila afirme algo — o
consintió, o pidió la baja. **Una baja de alguien que nunca consintió deja
`opted_in_at` en NULL y `source='baja_directa'`**: escribir ahí un consentimiento
con el propio mensaje de STOP como prueba sería fabricar exactamente lo que este
spec existe para impedir.

La FK compuesta necesita que el destino sea único, así que la migración agrega antes:

```sql
ALTER TABLE public.school_whatsapp_integrations
    ADD CONSTRAINT uq_wa_integration_id_school UNIQUE (id, school_id);
```

Redundante con la PK pero necesario para que Postgres acepte la referencia; es un
índice chico y resuelve la nota del revisor sin trigger ni CHECK entre tablas (que
además no podría mirar otra tabla).

**Una fila por número por integración.** La baja no borra la fila: estampa
`opted_out_at`. Un opt-in posterior lo limpia y actualiza `source`/`source_ref`.

### 2.2 Columnas nuevas en `payment_message_templates`

```sql
ALTER TABLE public.payment_message_templates
    ADD COLUMN IF NOT EXISTS meta_template_name     text,
    ADD COLUMN IF NOT EXISTS meta_template_status   text
        CHECK (meta_template_status IS NULL OR meta_template_status IN
              ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED')),
    ADD COLUMN IF NOT EXISTS meta_template_language text DEFAULT 'es',
    ADD COLUMN IF NOT EXISTS meta_synced_at         timestamptz;
```

**Ojo con las filas globales.** `school_id IS NULL` son las plantillas por defecto
compartidas; una plantilla de Meta vive en el WABA de **una** escuela concreta, así
que estas columnas solo tienen sentido con `school_id NOT NULL`. El registro de la
fase 3 debe **clonar** la plantilla global a una fila de la escuela y estampar ahí.
No hay CHECK que lo fuerce (rompería las filas globales existentes): es regla del
código y se verifica en el checklist.

---

## 3. RLS y grants

```sql
ALTER TABLE public.whatsapp_optins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_optin_owner_select" ON public.whatsapp_optins;
CREATE POLICY "wa_optin_owner_select" ON public.whatsapp_optins
    FOR SELECT TO authenticated
    USING (school_id IN (SELECT id FROM public.schools WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "wa_optin_no_direct_write" ON public.whatsapp_optins;
CREATE POLICY "wa_optin_no_direct_write" ON public.whatsapp_optins
    FOR INSERT TO authenticated WITH CHECK (false);
```

- **Escritura solo por RPC `SECURITY DEFINER` / service_role.** El consentimiento no se
  edita desde el cliente. El INSERT con `WITH CHECK (false)` es explícito en vez de
  ausente, y sin `FOR ALL` (que validaría los INSERT con el `USING` — invariante I3).
- **Lectura acotada al dueño**, igual que `whatsapp_conversations`.

> ⚠️ **Deuda heredada, va al plan maestro.** Las policies de WA1 usan
> `schools.owner_id = auth.uid()`, no `user_admin_school_ids()`. Un administrador que
> **no** sea el dueño no ve conversaciones, mensajes ni opt-ins — **el inbox de la
> fase 4 no le va a funcionar a nadie salvo al dueño**. Replico el patrón por
> consistencia y lo dejo anotado: corregirlo es tocar las cinco policies de WA1 de una
> vez, con su propia medición de radio. **No se cierra la fase 4 sin resolver esto.**

---

## 4. Funciones

### 4.1 `wa_register_optin` — registra o revoca

```sql
CREATE OR REPLACE FUNCTION public.wa_register_optin(
    p_integration_id uuid,
    p_school_id      uuid,
    p_contact_wa_id  text,
    p_source         text,
    p_source_ref     text,
    p_parent_id      uuid DEFAULT NULL,
    p_opt_out        boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ … $$;

REVOKE ALL ON FUNCTION public.wa_register_optin(uuid, uuid, text, text, text, uuid, boolean)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_register_optin(uuid, uuid, text, text, text, uuid, boolean)
    TO service_role;
```

Upsert por `(integration_id, contact_wa_id)`. Con `p_opt_out=false` estampa
`opted_in_at = now()` y limpia `opted_out_at`. Con `p_opt_out=true` estampa
`opted_out_at` sin tocar `opted_in_at` (queda el historial de que alguna vez lo dio).

Un opt-out sobre un número que **nunca** dio opt-in inserta la fila igual, pero con
`opted_in_at = NULL` y `source='baja_directa'` (ignorando `p_source`): registra que pidió
no ser contactado, sin afirmar un consentimiento que no existió. En el `DO UPDATE` no se
tocan `source` ni `source_ref`: si sí había consentimiento previo, su prueba original se
conserva.

### 4.2 `wa_can_send_template` — la pregunta obligatoria antes de todo envío

```sql
CREATE OR REPLACE FUNCTION public.wa_can_send_template(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.whatsapp_optins o
         WHERE o.integration_id = p_integration_id
           AND o.contact_wa_id  = p_contact_wa_id
           AND o.opted_in_at   IS NOT NULL   -- las filas 'baja_directa' no consintieron
           AND o.opted_out_at  IS NULL
    )
    AND NOT public.wa_is_blocked(p_integration_id, p_contact_wa_id);
$$;
```

Junta consentimiento y kill-switch en una sola pregunta, para que ningún camino de
envío consulte uno y olvide el otro.

**Verificar el tipo de retorno real de `wa_is_blocked`** antes de escribirla (está en
WA1; si no devuelve `boolean` limpio, se ajusta).

### 4.3 `wa_ingest_inbound_message` — se reemplaza

Un solo agregado, dentro de la **misma transacción** que ya hace el upsert de la
conversación y el insert del mensaje: **detección de baja**. Si el texto normalizado
coincide con una palabra de baja, se registra el opt-out.

El registro de la baja va **aislado en su propio bloque de excepción**: si fallara, no
puede tumbar la transacción y hacer que se pierda el mensaje entrante. El mensaje ya
está guardado; la baja es un efecto secundario y se degrada sola con un `WARNING`.

**Lo que ya NO hace** (era el error de la v1): estampar opt-in por el hecho de recibir
un mensaje. La ventana de 24h la sigue llevando `last_inbound_at`, como siempre.

Se hace con `CREATE OR REPLACE FUNCTION` en la migración **nueva** — el archivo de WA1
no se toca (migraciones inmutables). Hay que repetir el `REVOKE`/`GRANT`.

#### Palabras de baja — coincidencia exacta, nunca subcadena

```
stop · baja · cancelar suscripcion · desuscribir · no molestar · salir
```

Se compara sobre el texto **completo**, en minúsculas, sin tildes y sin puntuación.

> **Esto no es un detalle de implementación.** Con coincidencia por subcadena, un padre
> que escribe *"quiero cancelar la clase del sábado"* queda dado de baja de toda la
> cobranza y nadie se entera hasta que deje de pagar. Por eso `cancelar` a secas **no**
> está en la lista, y la comparación es contra el mensaje entero.

### 4.4 `wa_window_is_open` — queda lista, se usa en la fase 4

```sql
CREATE OR REPLACE FUNCTION public.wa_window_is_open(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT c.last_inbound_at > now() - interval '24 hours'
           FROM public.whatsapp_conversations c
          WHERE c.integration_id = p_integration_id
            AND c.contact_wa_id  = p_contact_wa_id),
        false);
$$;
```

Cuesta cinco líneas y deja el par completo desde el día uno: texto libre pregunta por
la ventana, plantilla pregunta por el opt-in. El cableado en el envío es fase 4.

---

## 5. Captura del consentimiento (lo que reemplaza al backfill)

**No hay backfill.** Los contactos que ya escribieron abrieron ventana, no consintieron
(§1.1). Insertarlos sería fabricar consentimiento — y con `source_ref NOT NULL` la tabla
directamente no lo permite: no hay ningún mensaje que apuntar como prueba.

En su lugar, **el bot pide el consentimiento una vez**. Al recibir un mensaje de un
número sin opt-in vigente, antes de cualquier otra cosa:

1. Responde una vez, dentro de la ventana ya abierta, con la pregunta: quién es la
   escuela, qué se le va a mandar, y cómo se da de baja.
2. Solo una confirmación afirmativa estampa el opt-in, con `source='user_confirmed'` y
   `source_ref` = `wa_message_id` **del mensaje de la confirmación** — no del primero.
3. Si no confirma, el bot sigue atendiendo normal dentro de la ventana. No se insiste
   en cada mensaje: una vez por conversación.

Es un paso conversacional en `whatsapp-bot.service.ts`, no en la base.

> **Dónde engancharlo.** El bot ya tiene un flujo que le pregunta cosas al padre: la
> identificación por OTP (`wa_start_identification` / `wa_verify_otp`). La pregunta de
> consentimiento va **junto a ese flujo**, no como un segundo interrogatorio paralelo —
> dos "responde SÍ" seguidos por motivos distintos es una experiencia mala y una fuente
> de respuestas ambiguas ("sí" ¿a cuál de las dos?). El detalle de la redacción se
> resuelve al implementar, con el texto a la vista.

---

## 6. Medir el radio antes de aplicar

```sql
-- 1. ¿Cuántos contactos quedan SIN poder recibir plantillas al aplicar esto?
--    (todos: la tabla arranca vacía a propósito)
select count(distinct (c.integration_id, c.contact_wa_id))
  from whatsapp_conversations c;

-- 2. ¿Cuántas plantillas son globales y no pueden llevar estado de Meta?
select school_id is null as es_global, count(*)
  from payment_message_templates group by 1;

-- 3. ¿La FK compuesta puede crearse? (no debe haber integraciones duplicadas)
select id, school_id, count(*) from school_whatsapp_integrations
 group by 1,2 having count(*) > 1;   -- debe dar 0 filas

-- 4. Después de aplicar:
select public.wa_can_send_template('838ccd56-4350-46a2-9249-aa1472801191', '<numero>');
--    debe dar FALSE para todos hasta que alguien confirme
```

El radio es chico (una integración). El riesgo no es romper algo vivo: es dejar mal el
modelo justo antes de que entre tráfico real.

---

## 7. Decisiones

1. **Tabla propia, no columnas en `profiles`.** §1.2.
2. **Ventana ≠ opt-in.** La tabla guarda solo consentimiento explícito; la ventana vive
   en `last_inbound_at` y no se duplica. §1.1.
3. **El consentimiento es del número, no de la persona.** `parent_id` es opcional.
4. **`source_ref` es NOT NULL y la baja sin consentimiento previo NO estampa
   `opted_in_at`.** Hace imposible por diseño fabricar un opt-in sin evidencia — ni
   siquiera por el camino del STOP.
5. **La baja nunca borra la fila.** Estampa `opted_out_at`.
6. **Palabras de baja por coincidencia exacta.** §4.3.
7. **Consentimiento y kill-switch se preguntan juntos** (`wa_can_send_template`).
8. **La pregunta de consentimiento va junto al flujo de OTP**, no en paralelo. §5.
9. **`meta_*` solo en filas con `school_id`**; el registro clona la global.
10. **Integridad del `school_id` por FK compuesta**, no por trigger.
11. Se replica el patrón `owner_id` de WA1 y **se corrige en bloque antes de cerrar la
    fase 4**.

## 8. Riesgos

| | Riesgo | Mitigación |
|---|---|---|
| R-A | Baja por falso positivo (*"cancelar la clase"*) | Coincidencia exacta sobre el mensaje completo; `cancelar` solo no está en la lista |
| R-B | Se manda una plantilla sin consultar el opt-in | `wa_can_send_template()` como único punto de decisión |
| R-C | Meta audita el consentimiento | `source` + `source_ref` + fecha, NOT NULL, apuntando al mensaje de la confirmación |
| R-D | El admin que no es dueño no ve nada | Deuda explícita, bloquea el cierre de la fase 4 (§3) |
| R-E | Registrar `meta_template_status` en una fila global | Verificado en el checklist; el código clona antes de estampar |
| R-F | **La fase 3 arranca con cero opt-ins** | Es lo correcto, no un defecto — pero significa que la cobranza de Dynasty no puede salir el día 1. La captura (§5) tiene que correr antes, y hay que decirlo al planear la fase 3 |

## 9. Checklist de cierre

- [ ] Migración creada con `npm run migrations:new -- whatsapp_optin_y_rastreo_de_plantillas`
- [ ] `npm run migrations:check` en verde
- [ ] Aplicada por vía que deja rastro (`apply_migration`, no el SQL editor)
- [ ] `npm run seguridad:invariantes` sin críticos (I3 e I4 son los que toca)
- [ ] `select policyname, roles, qual, with_check from pg_policies where tablename='whatsapp_optins'` — dos policies, ninguna `FOR ALL`
- [ ] `select proconfig, proacl from pg_proc where proname like 'wa\_%'` — `search_path` fijo y sin `EXECUTE` para `anon`/`authenticated` en las cuatro funciones
- [ ] Prueba viva: mensaje nuevo → el bot pide consentimiento y **no** se crea fila
- [ ] Prueba viva: confirmar → fila con `source='user_confirmed'` y `source_ref` = id del mensaje de la confirmación
- [ ] Prueba viva: `STOP` → `opted_out_at` estampado y `wa_can_send_template()` en `false`
- [ ] Prueba de falso positivo: *"quiero cancelar la clase del sábado"* → **sigue** con opt-in
- [ ] Prueba de la FK compuesta: insertar un opt-in con `school_id` de otra escuela → debe fallar
- [ ] Prueba de baja sin opt-in previo: `STOP` desde un número desconocido → fila con `opted_in_at IS NULL` y `source='baja_directa'`, y `wa_can_send_template()` en `false`

## 10. Fuentes

- Política de mensajería de WhatsApp Business — `https://whatsappbusiness.com/policy`, consultada el 2026-09-09 (§1.1, cita textual del requisito de opt-in).
- Plan v2 del canal de WhatsApp (fase 1) + review de ejecución que corrigió la v1 de este spec.
- `supabase/migrations/20260618100000_whatsapp_ai_channel_wa1.sql` — tablas, policies y `wa_ingest_inbound_message` que se reemplaza.
- `docs/whatsapp_wa1_setup.md` — runbook de WA1.
- Base viva `luebjarufsiadojhvxgi`, consultada el 2026-09-09.
