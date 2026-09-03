#!/bin/bash

# Vercel Ignore Build Script
#
# Vercel lo corre ANTES de construir, y la convención va al revés de lo que parece:
#   exit 0  → CANCELA el build
#   exit 1  → deja pasar el build
#
# Tres filtros, en orden:
#
#   1. La rama. Solo las que tienen ambiente desplegado.
#
#   2. Que sea LA rama de ESTE proyecto. Los 4 proyectos (sportmaps-dev/stg/prod/demo)
#      comparten el mismo repo y este mismo vercel.json, así que sin este filtro un
#      solo push a `develop` disparaba build en los 4 (3 de más). Detectado 2026-09-03:
#      3 pushes en poco tiempo → ~30 despliegues en vez de ~9, cola de 8-10 min por
#      proyecto para ver un cambio que debería tardar ~2 min. Se filtra por
#      VERCEL_PROJECT_BRANCH, una env var que se configura DISTINTA en cada proyecto
#      (Settings → Environment Variables, en Production+Preview+Development):
#        sportmaps-dev   → develop
#        sportmaps-stg   → staging
#        sportmaps-prod  → main
#        sportmaps-demo  → demo
#      Sin la variable puesta (todavía no migrado) este filtro no hace nada —
#      fail-open, para no romper despliegues mientras se configura.
#
#   3. Lo que cambió. Antes no existía, y por eso un commit que solo tocaba `docs/`,
#      `supabase/`, `bff/` o `scripts/` gastaba un despliegue de los ~100 del día sin
#      cambiar un byte de lo que Vercel sirve. El build es `cd frontend && npm run
#      build`, así que lo único que puede alterar el resultado es `frontend/`, la
#      config de despliegue (`vercel.json`) y este mismo script.
#
# Se invoca desde `ignoreCommand` en `vercel.json` — no desde la config del dashboard.
# Estando en el repo, la regla se revisa en un diff y viaja con la rama.

set -u

case "${VERCEL_GIT_COMMIT_REF:-}" in
  main|staging|production|develop)
    ;;
  *)
    echo "🚫 Rama sin despliegue automático (${VERCEL_GIT_COMMIT_REF:-desconocida}). Build cancelado."
    exit 0
    ;;
esac

if [ -n "${VERCEL_PROJECT_BRANCH:-}" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" != "${VERCEL_PROJECT_BRANCH}" ]; then
  echo "🚫 Esta rama (${VERCEL_GIT_COMMIT_REF:-desconocida}) no es la de este proyecto (${VERCEL_PROJECT_BRANCH}). Build cancelado."
  exit 0
fi

# Rutas desde la raíz del repo (`:/…`), NO relativas al directorio actual: Vercel corre
# esto dentro del Root Directory del proyecto, y con rutas relativas un cambio de esa
# opción haría que el filtro no encuentre nunca nada y cancele TODOS los builds.
PATHS=(":/frontend" ":/vercel.json" ":/vercel-ignore-build.sh")

# Sin padre alcanzable (clon superficial, primer commit de la rama) no hay con qué
# comparar. Se construye: lo caro es NO desplegar un cambio real, no un build de más.
if ! git rev-parse --verify --quiet "HEAD^" >/dev/null 2>&1; then
  echo "⚠️  Sin commit padre alcanzable para comparar. Se construye por precaución."
  exit 1
fi

# En un merge, HEAD^ es el primer padre — el commit que la rama tenía antes —, así que
# el diff cubre todo lo que trajo la promoción, no solo la punta.
if git diff --quiet "HEAD^" HEAD -- "${PATHS[@]}"; then
  echo "🚫 Este commit no toca frontend/ ni la config de despliegue. Build cancelado."
  exit 0
fi

echo "✅ Hay cambios que afectan lo desplegado (${VERCEL_GIT_COMMIT_REF}). Procediendo con el build."
exit 1
