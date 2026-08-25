# Carga de Monster's Volley Club — Sede Suba

Origen: `Datos Plataforma Sede Suba.xlsx` (export de Google Forms, 13 hojas = 13
categorías, ≈378 personas) + carpeta de Google Drive con 7 documentos por persona
(foto con camiseta, certificado EPS, cédula del acudiente, cédula del atleta, firma
del acudiente, firma del atleta, paz y salvo).

Piloto actual: **1 equipo ("U9 Y U11 MIXTO") + 1 atleta** (Alan Gabriel Cordoba
Castillo, doc. 1031847289). Ver el plan de la sesión que originó esto para el
contexto completo de decisiones (sin cuenta de usuario, paquete completo de
documentos, escuela real ya existente `eb3ebc77-4ea4-4992-96c8-3c8ec574578c`).

Migración asociada: `supabase/migrations/20260825125806_monster_volley_athlete_intake.sql`
(columnas nuevas en `unregistered_athletes` + tabla `athlete_documents` + policy de
Storage sobre `identity-documents`).

## Pasos

1. **`01_extraer.mjs`** — lee el `.xlsx` con `exceljs` (vive en
   `frontend/node_modules`, por eso hay que correr este paso con `cwd=frontend`).
   Corrige dos bugs del export real: 7 de las 13 hojas perdieron su fila de
   encabezado (la fila 1 ya es un atleta, no las preguntas), y los links de
   documento son hipervínculos incrustados (`cell.hyperlink`), no texto plano
   (`cell.value` a veces da `[object Object]`). Vuelca cada hoja a
   `data/<slug>.json` — **no toca la base**.

   ```
   cd frontend && node ../scripts/monster-volley-suba-import/01_extraer.mjs
   ```

2. **`02_cargar.mjs`** — dry-run por defecto. Para escribir hace falta
   `--confirmar` explícito. Lee un JSON de `data/`, crea el `team` si no existe,
   inserta `unregistered_athletes` + `enrollments`, descarga cada documento de
   Drive (usa las credenciales de Drive ya conectadas en esta sesión — ⚠️ este
   paso hoy es semi-manual, ver nota en el script) y lo sube a
   `identity-documents` + una fila en `athlete_documents` por archivo.

   ```
   node scripts/monster-volley-suba-import/02_cargar.mjs --hoja u9-y-u11-mixto --solo-doc 1031847289          # dry-run
   node scripts/monster-volley-suba-import/02_cargar.mjs --hoja u9-y-u11-mixto --solo-doc 1031847289 --confirmar
   ```

3. **`03_rollback.sql`** — por si hay que deshacer el piloto: borra en orden
   inverso (`athlete_documents` → `enrollments` → `unregistered_athletes` → el
   `team` si quedó sin nadie más).

## Qué NO hace este script

- No crea `offering_plan_id` ni `payments` — no se decidió facturación para
  Monster Volley en la conversación que originó esto. Es solo roster +
  documentos.
- No envía invitación ni crea cuenta de acudiente — el atleta queda como
  `unregistered_athletes`. Cuando el acudiente se registre solo, hoy no hay
  RPC que adopte este registro automáticamente (gap conocido, `DIN-13`).
