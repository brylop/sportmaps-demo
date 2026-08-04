#!/usr/bin/env bash
# ============================================================
# Registro de las 8 plantillas de cobranza en Meta (WhatsApp Cloud API).
# S0 del plan de Cobranza por WhatsApp.
#
# Uso:
#   export WABA_ID="TU_WABA_ID"
#   export SYSTEM_USER_TOKEN="TU_TOKEN_PERMANENTE"   # System User, NO temporal
#   ./register-templates.sh
#
# Cada respuesta trae { "id": "...", "status": "PENDING" }.
# Guardar id/status en payment_message_templates.meta_template_name /
# meta_template_status. La aprobación final llega por el webhook
# message_template_status_update (minutos a 48h).
# ============================================================
set -euo pipefail

: "${WABA_ID:?Falta WABA_ID}"
: "${SYSTEM_USER_TOKEN:?Falta SYSTEM_USER_TOKEN}"

GRAPH_VERSION="${GRAPH_VERSION:-v23.0}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$DIR/registro_resultado.log"

: > "$LOG"   # limpiar log previo

for f in "$DIR"/*.json; do
  name="$(basename "$f" .json)"
  echo "→ Registrando $name ..."
  {
    echo "=== $name ==="
    curl -s -X POST "https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates" \
      -H "Authorization: Bearer ${SYSTEM_USER_TOKEN}" \
      -H "Content-Type: application/json" \
      -d @"$f"
    echo ""
  } | tee -a "$LOG"
  echo ""
done

echo "Listo. Resultados en $LOG"
