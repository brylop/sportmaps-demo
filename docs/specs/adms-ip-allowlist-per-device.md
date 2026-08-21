# Allowlist de IP para ADMS/ZKTeco — de env var global a control por dispositivo

Estado: **F0 (BFF listo, datos sin auditar, UI pendiente)**. Migración `20260821112428` aplicada solo al esquema (columna nueva, sin efecto en runtime). Nada de esto está activado en producción — cada escuela sigue igual que antes hasta que alguien la pase de `off` a `warn`/`enforce` a mano.

## 1. Por qué existe esto

Incidente real, 2026-08-21: `ACCESS_DEVICE_IP_ALLOWLIST` (env var global en Render, ver [[project_zkteco_adms_access]]) se activó con una IP vieja/mal (`181.63.24.103`) y bloqueó con 403 los dos lectores reales de GYM RM (IP pública real: `186.113.249.203`) durante ~25 minutos. No dejó a nadie afuera físicamente (el F22 abre local contra su propia base de huellas/PIN — el BFF nunca decide el acceso físico), pero se perdió logging de asistencia, notificación de pago vencido, y los comandos pendientes (`getrequest` también caía en el 403).

El problema de fondo: es **una sola lista, compartida por TODAS las escuelas, en un solo lugar (Render) que solo alguien con acceso a esa consola puede editar**. Con 2 lectores de un gym ya causó un apagón. No escala a "llegan varios torniquetes" sin este mismo riesgo repetido cada vez.

## 2. Qué ya existe y no hay que reconstruir

`turnstile_devices.ip_address` **ya existe** en el schema (`supabase/migrations/20260627000001_access_control_versioned_schema.sql`) y **ya es editable por escuela** desde el panel Access Control (`frontend/src/pages/school/AccessControlPage.tsx:788-793`, campo "IP pública"). Nunca se conectó a la validación real del protocolo `/iclock` — solo se usaba como gate de "¿está configurada?" para habilitar `manual-open` (`bff/src/routes/access-api.ts` línea ~186).

## 3. Estado real de los datos (auditado en la BD viva, 2026-08-21)

```sql
select school_id, serial_number, device_name, ip_address, ip_check_mode
from turnstile_devices order by school_id;
```

| Escuela | Device | ip_address actual | Problema |
|---|---|---|---|
| GYM RM (`2137182d-…`) | Lector Salida (898) | `181.63.24.103` | **Desactualizada.** La IP real confirmada hoy es `186.113.249.203`. |
| GYM RM (`2137182d-…`) | Lector Entrada (899) | `181.63.24.103` | Idem — mismo dato viejo. |
| Dreamers Gymnastics (`57ba9352-…`) | LECTOR SALIDA | `192.168.1.201` | **Es una IP de LAN, no pública.** Nunca va a matchear la IP real que ve Render desde internet. |
| Dreamers Gymnastics (`57ba9352-…`) | LECTOR ENTRADA | `192.168.1.203` | Idem. |
| Club Campestre Demo (`25a123f0-…`) | Portería × 2 | `null` | Sin dato — inofensivo, cae al fallback. |

**Esto es el hallazgo más importante de todo este documento:** si alguien activa el chequeo por-device usando los datos que YA HAY en la tabla sin corregirlos primero, bloquea a Dreamers Gymnastics de inmediato (IP de LAN nunca matchea) y deja a GYM RM con el mismo dato viejo que ya causó el incidente de hoy. **No activar `enforce` (ni `warn`, para no generar ruido falso) en ningún device hasta corregir esta tabla.**

## 4. Diseño

Columna nueva `turnstile_devices.ip_check_mode` (migración `20260821112428_adms_device_ip_check_mode.sql`, ya committeada):

```sql
ALTER TABLE public.turnstile_devices
  ADD COLUMN ip_check_mode text NOT NULL DEFAULT 'off'
    CHECK (ip_check_mode IN ('off', 'warn', 'enforce'));
```

- `off` (default, las 6 filas actuales quedan así) → sin chequeo por-device, cae al fallback global `ACCESS_DEVICE_IP_ALLOWLIST` (comportamiento IDÉNTICO al actual).
- `warn` → si la IP del request no matchea `ip_address`, se loguea (`console.warn`) y se registra en `adms_device_log` (`event_type: 'ip_mismatch'`) pero **no bloquea**. Para validar que la IP configurada es la correcta antes de exigir.
- `enforce` → igual que `warn`, pero si no matchea responde 403. Solo activar después de confirmar `warn` limpio por unos días.

Por qué es texto+CHECK y no un tipo enum: convención del repo (`payments.status` es TEXT por el dolor histórico de castear a un enum — ver CLAUDE.md).

### Código (`bff/src/routes/access-adms.ts`, ya aplicado)

El middleware de `/iclock` ahora:
1. Resuelve el device por `SN` (query string, antes de parsear el body).
2. Si `ip_check_mode !== 'off'` y hay `ip_address`, compara contra la IP real del request (`clientIp(req)`).
3. Si no matchea: `warn` → loguea y sigue; `enforce` → 403.
4. Si el device está en `off` (o no se encontró el device), cae al fallback global de siempre.

`getDeviceBySerial` ahora trae `ip_address` e `ip_check_mode` (cache de 5 min sin cambios). `DeviceInfo` tiene los campos nuevos.

### API admin (`bff/src/routes/access-api.ts`, ya aplicado)

- `GET /api/v1/access/devices` devuelve `ip_check_mode`.
- `POST /api/v1/access/devices` acepta `ip_check_mode` opcional (default `'off'`), valida que sea uno de los 3 valores.
- `PATCH /api/v1/access/devices/:id` acepta `ip_check_mode`, con un guardarraíl: **no permite pasar a `enforce` si no va a quedar `ip_address`** (evita bloquear un device sin nada contra qué comparar).

No hicieron falta cambios de RLS — las policies de `turnstile_devices` (INSERT/UPDATE por `owner|admin|school_admin` de la escuela, ver sección 6) ya cubren estos endpoints porque son las mismas columnas de la misma tabla.

## 5. Lo que falta (para "el otro dev")

1. **Corregir los datos de la tabla 3** antes de tocar ningún `ip_check_mode`:
   - GYM RM: actualizar `ip_address` a `186.113.249.203` en ambos devices (hoy sigue en `181.63.24.103` en la BD, aunque el env var de Render ya se corrigió por separado).
   - Dreamers Gymnastics: pedirle a la escuela su IP pública real (`curl https://api.ipify.org` desde esa red, o revisar logs de Render como se hizo hoy con GYM RM) — las que hay hoy (`192.168.1.x`) son de LAN y no sirven para esto.
2. **UI en `AccessControlPage.tsx`**: agregar un selector `ip_check_mode` (off/warn/enforce) al lado del campo "IP pública" existente. El campo ya está ahí (línea 788-793); falta el selector y el copy explicando qué hace cada modo.
3. **Regenerar tipos de Supabase** (`frontend/src/integrations/supabase/types.ts`) para que el frontend tenga `ip_check_mode` tipado.
4. **Rollout por escuela**, una vez el dato esté correcto:
   - Poner `warn` → observar `adms_device_log` (o los logs de Render) unos días.
   - Si no hay mismatches inesperados → pasar a `enforce`.
5. **Deprecar (opcional, a futuro)** el env var global `ACCESS_DEVICE_IP_ALLOWLIST` una vez todas las escuelas activas estén en `enforce` por-device — hoy sigue siendo necesario como fallback para cualquier device en `off`.
6. **IPs dinámicas**: si una escuela no tiene IP pública fija (común con ISPs residenciales/pymes en Colombia), `enforce` va a romperse solo cuando el ISP reasigne IP. Para esos casos, dejarlos en `warn` permanentemente en vez de `enforce`, o evaluar a futuro una alternativa que no dependa de IP (ver sección 7).

## 6. RLS — auditado contra la BD viva (no contra el repo)

```sql
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'turnstile_devices';
```

| Policy | Cmd | Qué hace |
|---|---|---|
| `School admins can insert devices` | INSERT | `WITH CHECK`: `school_id` debe estar en los `school_members` activos del usuario con rol `owner/admin/school_admin`. Correcto. |
| `School admins can update their devices` | UPDATE | `USING` igual que arriba, `WITH CHECK` es `NULL` en el catálogo — **no es un bug**: Postgres reusa el `USING` como `WITH CHECK` cuando este último no se especifica, así que un admin no puede reasignar el device a una escuela que no administra. |
| `School members can view their devices` | SELECT | Cualquier miembro **activo** de la escuela, sin filtrar por rol — incluye padres y atletas (ver [[project_rls_member_vs_staff]]). |

No hizo falta ninguna policy nueva para esta feature (mismas columnas, misma tabla). Dos hallazgos que quedan **fuera de este alcance**, documentados para no perderlos:

- **Hallazgo menor (no bloqueante):** el SELECT expone `ip_address` (y seriales) a padres/atletas, no solo a staff. Filtrar la IP pública de un lector a un padre no es catastrófico (spoofear IP de origen real por internet es difícil en la práctica), pero rompe el principio de mínimo privilegio. Si se quiere endurecer: acotar ese SELECT a staff (patrón `user_staff_school_ids()`) o mover columnas sensibles a una vista pública sin `ip_address`.
- **Hallazgo menor (no bloqueante):** `anon` y `authenticated` tienen GRANT crudo de INSERT/SELECT/UPDATE/DELETE sobre `turnstile_devices` a nivel de privilegios de Postgres (probablemente default privileges del esquema, nunca revocados explícitamente — mismo patrón que el trap #3 de CLAUDE.md). Hoy no es explotable: las policies exigen `auth.uid()` con una fila activa en `school_members`, y `anon` no tiene `auth.uid()`. Igual, revocar explícitamente de `anon` sería la higiene correcta (defensa en profundidad) — no se tocó en este cambio para no mezclar alcance.
- No hay policy de DELETE → los deletes están bloqueados por default de RLS (nadie except superuser/service_role puede borrar). Correcto, no se tocó.

## 7. Alternativa a futuro (fuera de alcance de esta iteración)

El allowlist por IP es frágil para gyms sin IP pública fija. El protocolo ADMS del F22 no soporta auth por header, así que hoy la IP es "la barrera práctica" que hay (comentario original en el código). Si en el futuro esto se vuelve un problema recurrente, las opciones son: exigirle IP fija al gym (más simple, cuesta dinero al cliente), o meter un relay/agente local con salida estable (VPN o túnel) — pero eso es una pieza de infraestructura nueva, no un cambio de código menor. No se diseña acá; se deja anotado.

## 8. Archivos tocados

- `supabase/migrations/20260821112428_adms_device_ip_check_mode.sql` (nuevo)
- `bff/src/routes/access-adms.ts` (middleware `/iclock`, `DeviceInfo`, `getDeviceBySerial`)
- `bff/src/routes/access-api.ts` (`GET/POST/PATCH /api/v1/access/devices`)
- Este documento

## 9. Cómo probarlo en dev antes de tocar producción

1. Aplicar la migración en el proyecto Supabase de dev (`supabase db push` o `apply_migration`, NUNCA pegar el SQL a mano en el editor — no deja rastro en `schema_migrations`).
2. Confirmar que las 6 filas existentes quedaron en `ip_check_mode = 'off'`.
3. Crear/editar un device de prueba con `ip_check_mode='warn'` e `ip_address` puesta a una IP que SÍ sepas que no vas a usar (para forzar el mismatch) y confirmar que loguea sin bloquear.
4. Cambiar a `enforce` con la misma IP falsa y confirmar el 403.
5. Volver a `off` antes de dar la tarea por cerrada — no dejar ningún device de prueba en `enforce`.
