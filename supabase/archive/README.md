# supabase/archive

Scripts SQL sueltos archivados. **NO son fuente de verdad y NO se aplican** con
el CLI de Supabase (no están en `supabase/migrations/`).

La fuente de verdad del esquema y triggers es **`supabase/migrations/`**.

## Por qué se archivaron

`fix_trigger_robust.sql` y `fix_trigger_v4_emergency.sql` eran hotfixes manuales
del trigger `handle_new_user` con un **modelo de roles divergente** (usaban
`school_admin` y `onboarding_completed`) del que quedó vigente en migraciones.
Si se ejecutaban a mano contra la base, **pisaban la versión vigente y borraban
`needs_role_selection`** (login con Google). Se archivan para evitar confusión.

La definición vigente y resiliente de `handle_new_user` vive en
`supabase/migrations/20260617000002_handle_new_user_resilient.sql`.

> Para verificar qué está realmente instalado en la base:
> `SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';`
