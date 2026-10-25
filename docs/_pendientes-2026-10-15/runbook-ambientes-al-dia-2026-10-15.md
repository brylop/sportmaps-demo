# Dejar develop, staging y main al día — corte 2026-10-15

Todo lo de abajo sale de comparar las ramas reales y la base viva el 2026-10-15.
**La base de datos es UNA sola** para los tres ambientes: lo que cambia entre
develop, staging y main es solo el código. Las migraciones se aplican una vez.

Paquete SQL de lo pendiente: `docs/migraciones-pendientes-2026-10-15.sql`.

## 1. Dónde está cada ambiente

| Rama | Commit | Le falta (de lo ya construido) |
|---|---|---|
| develop | `76fff28b` | nada |
| staging | `884af595` | `00aed622` (torneos), `76fff28b` (mensajes de pago) |
| main | `3a8afbc9` | `b8c9d8ec` (recargo por link; existe como `fade13bc` local sin subir en `wt-promote-main`), `00aed622`, `76fff28b` |

Entre los tres ya no hay otra diferencia: todo lo anterior al 15/10 está en las tres.

## 2. Bloques que NO están en ningún ambiente

| Bloque | Rama | Commits | Archivos | Conflictos al integrar con develop | Migraciones |
|---|---|---|---|---|---|
| Facturación SaaS Monster | `wt-facturacion` (`613aaa40`) | 1 | 7 | solo el ledger | 2 **sin aplicar** |
| Mora | `wt-mora-integracion` (`2cf1f902`) | 16 | 51 | `whatsapp-enlaces-de-pago.service.ts` y el ledger | 3, **aplicadas a mano** (sin registro) |
| Pizarra (M1–M6) | `pizarra-tp/integracion` (`83e3e99a`) | 48 | 254 (+42.984 líneas) | `AuthContext.tsx`, 2 docs de specs y el ledger | 8 **sin aplicar** + 1 ya aplicada (`pizarra_rls…`) |

**Atención con mora:** las 3 migraciones de mora ya están aplicadas, así que la base
ya corre la lógica nueva (la mora no cancela, el enlace cobra el saldo, el estado de
pagos incluye la mora), pero el código de BFF y frontend que la acompaña **no está
desplegado en ningún ambiente**. Cerrar esto primero reduce el desfase.

La integración de la pizarra parte de la base `841f4b4d`, anterior a los commits de
hoy: hay que traerle `origin/develop` antes de mezclarla.

## 3. Orden recomendado

Regla de la base: **una sola sesión aplica migraciones**, nunca agentes en paralelo
(cada DDL recarga el esquema de PostgREST), `types.ts` se regenera **una vez** al final.

### Paso 1 — Promover lo que ya está listo (staging y main)

```
git -C /c/tmp/wt-promote-staging fetch origin
git -C /c/tmp/wt-promote-staging cherry-pick 00aed622 76fff28b
git -C /c/tmp/wt-promote-staging push origin HEAD:staging

git -C /c/tmp/wt-promote-main fetch origin
git -C /c/tmp/wt-promote-main cherry-pick 00aed622 76fff28b
git -C /c/tmp/wt-promote-main push origin HEAD:main
```

`wt-promote-main` ya trae `fade13bc` (el mismo arreglo de `b8c9d8ec`), por eso solo
se cherry-pickean los otros dos. La migración de torneos ya está aplicada.

### Paso 2 — Mora a develop (la base ya está lista)

```
git worktree add -b integra-mora /c/tmp/wt-integra-mora origin/develop
cd /c/tmp/wt-integra-mora
git merge --no-ff wt-mora-integracion
```

Conflictos:
- `bff/src/services/whatsapp-enlaces-de-pago.service.ts`: **conservar los dos lados**
  (la lógica de mora y los textos «sin recargo» de `76fff28b`).
- `supabase/migrations_ledger.json`: `git checkout --ours supabase/migrations_ledger.json`
  y rehacerlo con el paso de renumeración de abajo.

**Renumerar las 3 migraciones de mora.** El gate rechaza una migración con versión
anterior al head del ledger («no es posterior al head»). Como no están commiteadas en
develop, se pueden renumerar: `npm run migrations:next` imprime la próxima versión
libre; `git mv` el archivo a esa versión, y la siguiente es esa +1 (se verificó el
procedimiento el 15/10 con las de facturación).

```
npm run migrations:next                     # anota la versión libre (v1)
git mv supabase/migrations/20261014130128_mora_no_cancela_reactiva_y_detector_autocierra.sql supabase/migrations/<v1>_mora_no_cancela_reactiva_y_detector_autocierra.sql
git mv supabase/migrations/20261014133326_mora_vence_enlaces_y_autopay_cobra_vencidos.sql   supabase/migrations/<v1+1>_mora_vence_enlaces_y_autopay_cobra_vencidos.sql
git mv supabase/migrations/20261014152633_wa_estado_pagos_con_mora.sql                      supabase/migrations/<v1+2>_wa_estado_pagos_con_mora.sql
npm run migrations:sync && npm run migrations:check
cd bff && npx tsc --noEmit && npx vitest run src/services/whatsapp src/jobs/whatsapp && cd ..
git push origin HEAD:develop
```

Como ya están aplicadas, **no se vuelven a correr**.

### Paso 3 — Facturación SaaS (Monster)

1. Aplicar `20261015124518_acuerdos_comerciales_saas` (esquema; reescribe
   `generate_school_subscription_invoice`). Está en el paquete SQL, parte 2.
2. **No aplicar** `acuerdo_monster_volley` (datos) hasta confirmar sus supuestos: el
   plan no cambia, el certificado se renueva a 12 meses al mismo valor, los montos van
   sin IVA y quién emite la factura DIAN. Sigue pendiente con el contador.
3. Integrar el código: cherry-pick de `613aaa40` en develop. Mismo procedimiento de
   renumeración (las dos de facturación tienen versión `20261015124…`, anterior al head).

### Paso 4 — Pizarra

1. **Aplicar las 8 migraciones** del paquete SQL (parte 1), en orden y de una en una.
2. En la rama de integración, traerle develop:
   ```
   cd /c/Users/Usuario/Documents/demo/wt-pizarra-integracion
   git merge origin/develop
   ```
   Conflictos: `frontend/src/contexts/AuthContext.tsx` (cambio de rol de hoy: conservar
   ambos), `docs/specs/pizarra-m6-paridad-tacticalpad.md`, `docs/specs/pizarra-multideporte-3d-ia.md`
   y el ledger.
3. Renumerar sus migraciones por encima del head (igual que mora). La ya aplicada
   `20261013200604_pizarra_rls_biblioteca_y_rpc_ejercicio` también cae por debajo del head:
   renumerarla en el repo no cambia la base, que ya la tiene.
4. Probar antes de mezclar: `npx vitest run` en bff y frontend, `npx tsc --noEmit`, y el
   e2e de la pizarra. Es el bloque más grande (254 archivos): conviene una pasada de revisión.
5. Mezclar a develop y subir.

### Paso 5 — Promover develop a staging y a main

Con develop completo, alinear como ya se hizo el 15/10 («merge: alinear main con develop»):

```
git -C /c/tmp/wt-promote-staging fetch origin && git -C /c/tmp/wt-promote-staging merge --no-ff origin/develop -m "merge: alinear staging con develop (2026-10-15)"
git -C /c/tmp/wt-promote-staging push origin HEAD:staging
git -C /c/tmp/wt-promote-main fetch origin && git -C /c/tmp/wt-promote-main merge --no-ff origin/develop -m "merge: alinear main con develop (2026-10-15)"
git -C /c/tmp/wt-promote-main push origin HEAD:main
```

### Paso 6 — Cierre

1. Regenerar `types.ts` **una sola vez** (después de la última migración).
2. `npm run seguridad:invariantes` (sin violaciones críticas) y `npm run migrations:check`.
3. Humo en los tres ambientes: login, un pago por link, el botón «Ir a pagar» de WhatsApp,
   inscripción a un torneo y la pizarra.

## 4. Migraciones de los días 13–15: estado en la base

Verificado el 2026-10-15: de 41 migraciones de esos días, **28 están registradas**
y 13 no tienen registro: **3 son de mora y están aplicadas a mano** (sus objetos ya
existen) y **10 no están aplicadas** (las del paquete SQL).

| Bloque | Migración | Estado |
|---|---|---|
| Pizarra | `20261013194057_plantillas_ejercicios_otros_deportes` | **pendiente** (carga datos; no se pudo verificar por objeto) |
| Pizarra | `20261014111442_pizarra_ia_cupo_y_cache` | **pendiente** |
| Pizarra | `20261014121142_pizarra_paquetes_biblioteca` | **pendiente** |
| Pizarra | `20261014125632_pizarra_eventos_ia_3d_paquetes` | **pendiente** |
| Pizarra | `20261014155445_pizarra_ia_cupo_por_entrenador_tokens` | **pendiente** |
| Pizarra | `20261014163705_pizarra_notas_y_videos` | **pendiente** |
| Pizarra | `20261015142003_pizarra_equipos_rivales` | **pendiente** (renumerada en la integración; antes `20261014162158`) |
| Pizarra | `20261015145434_pizarra_videos_subidos` | **pendiente** (renumerada; antes `20261015125439`) |
| Facturación | `20261015124518_acuerdos_comerciales_saas` | **pendiente** |
| Facturación | `20261015124611_acuerdo_monster_volley` | **pendiente, solo datos y con supuestos sin confirmar** |
| Mora | `20261014130128`, `20261014133326`, `20261014152633` | aplicadas a mano, sin registro |
| Torneos | `20261015153059_torneos_escuela_inscribe_y_gratis` | aplicada |
| Roles y sedes | 3 (`contextos_familia…`, `sede_del_atleta…`, `staff_no_se_reactiva…`) | aplicadas |

## 5. Lo que este documento NO garantiza

- Las 10 migraciones pendientes **no se ejecutaron** al armar el paquete: ni siquiera en
  una transacción con rollback. Las de facturación se probaron con rollback antes
  (según tu memoria del 15/10); las de pizarra no tengo evidencia de prueba en la base viva.
- Los conflictos de integración se midieron con `git merge-tree`, no resolviendo.
- No revisé las ramas y árboles de trabajo anteriores al 14/10 (`fix/auditoria-bot…`,
  `cobros/*`, `ios/*`, `sentry`, etc.).
- El reproceso de comprobantes de Dynasty sigue pendiente (lo corres tú):
  `cd bff && npx tsx scripts/wa-recuperar-comprobantes.ts --escuela 2d509571-3238-4c04-ac3f-6dfe20539226 --reprocesar --aplicar`.
