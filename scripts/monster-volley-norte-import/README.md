# Carga de Monster's Volley Club — Sede Norte (2026-10-14)

Origen: `Datos Plataforma Sede Norte.xlsx` — mismo formulario de Google que Suba
(40 columnas, mismo orden), pero **una sola hoja** con 20 filas. Escuela
`eb3ebc77-…`, sede Norte `e2918c8d-b510-4f7f-9b05-e73a5e8edb68`.

## Decisiones (2026-10-14)

- **Categorías propias de Norte**, no las de Suba: Norte agrupa por año de
  nacimiento. 9 `school_categories` con `branch_id` = Norte, `age_rule =
  birth_year`, códigos `N*` (NMINIMIX, NBENJMIX, NINFFEM, NMENFEM, NMENMASC,
  NJUVFEM, NJUVMASC, NMAYFEM, NMAYMASC) y un `team` "(NORTE)" por cada una.
- **Mariana Fernanda Suárez Ramos** (nacida 2012) va en Juvenil femenino, como
  marcó en el formulario, aunque por año le tocaría Infantil.
- **Samantha Acuña Rojas** no se carga: la fila solo trae el nombre.
- Sin plan ni cobros (igual que Suba).

## Pasos

1. `01_extraer.mjs [ruta.xlsx]` → `data/hoja-1.json` (no toca la base).
2. `02_cargar.mjs [--confirmar]` → categorías + equipos + `unregistered_athletes`
   + `enrollments` + `enrollment_categories`. Escribe `data/ids.json`.
   Idempotente por `doc_number`.
3. `03_subir_documento.mjs --json <descarga> --file-id <id>` → por documento
   (manifiesto en `data/documentos.json`, 7 por atleta). La descarga de Drive la
   hace Claude con el conector; reusa `02b`/`02c` de Suba. Salta lo ya cargado.
4. `04_rollback.sql` → deshace todo (los archivos de Storage, a mano).
