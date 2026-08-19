// ============================================================================
// Catálogo — Club Campestre Demo (club social multideporte)
//
// Este tenant ya existía y está sembrado desde 2026-08-03. El catálogo real
// sigue viviendo en scripts/demo-club-campestre/catalog.mjs; acá solo se
// re-exporta para que el motor unificado (scripts/demo/seed.mjs) lo pueda
// correr igual que a los demás, sin duplicar 428 líneas que ya funcionan.
//
// El seed viejo (scripts/demo-club-campestre/seed.mjs) sigue existiendo y
// dando el mismo resultado: los IDs se derivan del namespace del tenant, que
// para este es el mismo string 'club-campestre'.
// ============================================================================
export * from '../../demo-club-campestre/catalog.mjs';
