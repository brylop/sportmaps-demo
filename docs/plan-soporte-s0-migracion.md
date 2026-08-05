# Plan de migración — Soporte S0 (tablas + RLS)

**Estado:** plan, pendiente de aprobación. **No hay SQL escrito.**
**Spec:** [`specs/soporte-in-app-chat-y-bot.md`](./specs/soporte-in-app-chat-y-bot.md) §4, §4.1, §6
**Prerrequisito:** F0 de la consola — ✅ ya en `develop`

S0 entrega **un canal de soporte real sin una línea de LLM**: el usuario escribe desde la app, le
llega al super_admin, y el super_admin responde en el mismo hilo. El bot (S1) es una optimización
encima, no el producto.

---

## 1. Alcance de esta migración

Una sola migración creada con `npm run migrations:new -- support_tickets_s0`.

| Objeto | Tipo |
|---|---|
| `support_tickets` | tabla |
| `support_messages` | tabla |
| `is_support_agent()` | función `SECURITY DEFINER` (helper de RLS) |
| `owns_support_ticket(uuid)` | función `SECURITY DEFINER` (helper de RLS) |
| `support_open_ticket(...)` | RPC — abre o reusa el hilo del solicitante |
| `support_post_message(...)` | RPC — escribe un mensaje y mueve el estado |
| policies sobre ambas tablas | RLS |

Sin datos semilla. Sin `CREATE TYPE` (todos los estados son `text + CHECK`, por la historia de
`payments.status`).

---

## 2. Esquema

```sql
CREATE TABLE public.support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- QUIÉN atiende. En v1 solo se produce 'sportmaps'; 'school' queda como gancho
  -- para delegar al school_admin agregando policies, no migrando datos.
  audience      text NOT NULL DEFAULT 'sportmaps'
                CHECK (audience IN ('sportmaps', 'school')),
  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,

  -- Canal de ORIGEN, no partición del hilo.
  channel       text NOT NULL DEFAULT 'in_app'
                CHECK (channel IN ('in_app', 'whatsapp', 'email')),
  whatsapp_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,

  subject       text,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','bot_handled','waiting_human','waiting_user','resolved','closed')),
  category      text CHECK (category IN ('acceso','cobros','inscripcion','datos','otro')),
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),

  assignee_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  first_response_at timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- audience='school' sin escuela es un ticket que nadie puede atender.
  CONSTRAINT support_tickets_school_required
    CHECK (audience <> 'school' OR school_id IS NOT NULL)
);

-- Un solo hilo ABIERTO por persona y destinatario (§4.1).
CREATE UNIQUE INDEX support_tickets_one_open_thread
  ON public.support_tickets (
    requester_id, audience,
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status NOT IN ('resolved', 'closed');

-- La bandeja del super_admin: sin asignar primero, luego lo más viejo.
CREATE INDEX support_tickets_inbox
  ON public.support_tickets (audience, status, created_at)
  WHERE status NOT IN ('resolved', 'closed');
```

```sql
CREATE TABLE public.support_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type   text NOT NULL CHECK (author_type IN ('user','bot','agent')),
  author_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- NULL si bot
  body          text NOT NULL CHECK (length(btrim(body)) > 0),
  attachments   jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_note boolean NOT NULL DEFAULT false,   -- el solicitante NO lo ve
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Un mensaje del usuario nunca puede ser nota interna, y un mensaje de usuario
  -- o agente siempre tiene autor. Sin esto, un bug de la UI filtra notas al padre.
  CONSTRAINT support_messages_user_never_internal
    CHECK (author_type <> 'user' OR internal_note = false),
  CONSTRAINT support_messages_author_required
    CHECK (author_type = 'bot' OR author_id IS NOT NULL)
);

CREATE INDEX support_messages_thread ON public.support_messages (ticket_id, created_at);
```

---

## 3. Helpers de RLS

**`is_super_admin()` existente NO sirve aquí.** Devuelve `true` para `role IN ('admin','super_admin')`
y hay cuentas `admin` en la base (`spiritfontibon@…`, `demo.admin@…`) que según §6 **no** reciben
tickets. Es el mismo escape hatch que ya obligó a escribir `requireSuperAdminStrict` en el BFF de F0.
No se toca `is_super_admin()` — hay policies vivas que dependen de ella.

```sql
CREATE OR REPLACE FUNCTION public.is_support_agent()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'   -- por ROL, nunca por UUID (§6)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_support_agent() TO authenticated;
```

```sql
-- La policy sobre support_messages NO puede hacer SELECT FROM support_messages
-- en su USING. Resuelve la pertenencia mirando support_tickets, desde una
-- SECURITY DEFINER, que es la regla del repo contra self-recursion.
CREATE OR REPLACE FUNCTION public.owns_support_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = p_ticket_id AND requester_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.owns_support_ticket(uuid) TO authenticated;
```

---

## 4. RLS

`ALTER TABLE … ENABLE ROW LEVEL SECURITY` en ambas. Sin `FORCE` (el BFF entra con service role).

### `support_tickets`

| Policy | Rol | Regla |
|---|---|---|
| `tickets_select_own` | `authenticated` | `SELECT` si `requester_id = auth.uid()` |
| `tickets_select_agent` | `authenticated` | `SELECT` si `is_support_agent()` |
| `tickets_update_agent` | `authenticated` | `UPDATE` si `is_support_agent()` (tomar, cerrar, categorizar) |

**Sin policy de INSERT.** Los tickets nacen por el RPC `support_open_ticket()`, no por insert
directo: si el cliente pudiera insertar, podría poner `audience`, `assignee_id` o `requester_id`
a mano.

**Sin policy de UPDATE para el solicitante.** Cerrar el propio ticket es un `UPDATE` acotado que,
si hace falta, va por RPC.

### `support_messages`

| Policy | Rol | Regla |
|---|---|---|
| `messages_select_own` | `authenticated` | `SELECT` si `owns_support_ticket(ticket_id) AND internal_note = false` |
| `messages_select_agent` | `authenticated` | `SELECT` si `is_support_agent()` |

**Sin INSERT ni UPDATE ni DELETE por policy.** Todo mensaje entra por `support_post_message()`.
Un hilo de soporte editable a posteriori no es un registro de nada.

### Fuga entre escuelas

En v1 el riesgo de §8 no aplica porque **no hay tickets con `audience='school'`** y ningún
`school_admin` tiene policy sobre estas tablas. Cuando se delegue, la policy nueva es
`audience='school' AND school_id = ANY(...)` — y ahí hay que revisarla contra el patrón ya
documentado de *miembro ≠ staff*: `user_school_ids()` no mira el rol y trataría a un padre como
personal de la escuela.

---

## 5. RPCs

Ambos `SECURITY DEFINER`, con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE …
TO authenticated` explícito (el `SECURITY DEFINER` no exime al caller de tener `EXECUTE`).

### `support_open_ticket(p_subject text, p_category text DEFAULT NULL) → uuid`

Devuelve el hilo abierto del solicitante o crea uno. Idempotente por diseño: es lo que hace que
"se abre y está la historia completa" (§5.1) en vez de un chat en blanco.

- `requester_id := auth.uid()`; falla si es NULL.
- `audience := 'sportmaps'`, `channel := 'in_app'` — fijos en v1, no vienen del cliente.
- Resuelve `school_id` informativo desde `school_members` (para que el agente sepa de qué club
  viene), **sin** que eso cambie el `audience`.
- `INSERT … ON CONFLICT` contra `support_tickets_one_open_thread` → `DO UPDATE SET updated_at = now()
  RETURNING id`. Esto es lo que cierra la carrera de doble-click: dos peticiones simultáneas
  devuelven el mismo ticket, no dos.

### `support_post_message(p_ticket_id uuid, p_body text, p_internal boolean DEFAULT false) → uuid`

- Autoriza: `owns_support_ticket(p_ticket_id)` **o** `is_support_agent()`. Si no, `RAISE EXCEPTION`.
- `author_type` lo decide el servidor (`'agent'` si `is_support_agent()`, si no `'user'`), nunca
  el cliente. `p_internal` se ignora si el autor no es agente.
- Reabre el hilo si estaba `resolved`/`closed`… **no**: ver §7, decisión pendiente menor.
- Mueve estado: mensaje de usuario → `waiting_human`; mensaje de agente → `waiting_user`.
- Sella `first_response_at` en la primera respuesta de agente (alimenta las métricas de S5).
- Las notas internas **no** mueven el estado ni sellan `first_response_at`: son para el equipo.

**Tests de concurrencia** (fase backend, exigidos por `CLAUDE.md`): dos `support_open_ticket()`
simultáneos del mismo usuario devuelven un único ticket; dos `support_post_message()` simultáneos
no pisan `first_response_at`.

---

## 6. Lo que NO entra en S0

- Bot, tools, LLM. Eso es S1.
- Notificación push al super_admin — es S2. En S0 la bandeja se consulta a mano.
- Adjuntos reales. La columna `attachments` nace pero la UI no sube nada todavía.
- Tabla de auditoría propia: leer un ticket no se audita; las **acciones** de F1/F2 sí, en
  `security_audit_log` vía el `auditLog()` que ya existe en el BFF.

---

## 7. Puntos a confirmar antes de escribir el SQL

1. **¿Un mensaje nuevo sobre un ticket `resolved` lo reabre, o abre uno nuevo?** Reabrir conserva
   el hilo (que es todo el punto de §5.1) pero ensucia las métricas de resolución de S5. Abrir uno
   nuevo mantiene las métricas limpias pero parte la historia. Propuesta: **abrir uno nuevo** y que
   la UI muestre los anteriores debajo — el índice parcial ya lo permite sin tocar nada.
2. **`ON DELETE CASCADE` en `requester_id`.** Si se borra el perfil, se van sus tickets. Dado que
   las eliminaciones aquí son manuales y deliberadas, y que un ticket sin solicitante no sirve de
   nada, parece correcto — pero se pierde el rastro de la queja. Alternativa: `ON DELETE SET NULL`
   + `requester_id` nullable.
