#!/bin/bash

# Vercel Ignore Build Script
# This script determines whether a Vercel build should proceed based on the Git branch.
# Exits with 1 (proceeds with build) for allowed branches.
# Exits with 0 (cancels build) for all other branches.

case "$VERCEL_GIT_COMMIT_REF" in
  demo|develop|staging|production)
    echo "✅ Rama permitida ($VERCEL_GIT_COMMIT_REF). Procediendo con el build."
    exit 1
    ;;
  *)
    echo "🚫 Rama no permitida para despliegue automático ($VERCEL_GIT_COMMIT_REF). Build cancelado."
    exit 0
    ;;
esac
