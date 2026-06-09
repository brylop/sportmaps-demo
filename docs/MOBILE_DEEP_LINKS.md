# Deep Links — Setup operacional (Fase 6.2)

Habilita Universal Links (iOS) y App Links (Android) para que ciertas URLs de SportMaps abran la app nativa en vez del navegador.

## Archivos requeridos

Hosteados en el frontend Vercel, accesibles públicamente:

- `https://app.sportmaps.co/.well-known/apple-app-site-association` (iOS Universal Links)
- `https://app.sportmaps.co/.well-known/assetlinks.json` (Android App Links)

Ambos archivos están en `frontend/public/.well-known/` y Vercel los sirve estáticamente.

## Configuración Vercel para servir estos archivos

Vercel automaticamente sirve archivos de `public/.well-known/` con MIME `application/json` y headers correctos. **Verificar después de deploy:**

```bash
curl -I https://app.sportmaps.co/.well-known/apple-app-site-association
# Esperado: Content-Type: application/json (NO octet-stream)
# Status: 200

curl -I https://app.sportmaps.co/.well-known/assetlinks.json
# Esperado: Content-Type: application/json
```

Si Vercel sirve con MIME incorrecto, agregar a `frontend/vercel.json`:

```json
{
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [
        { "key": "Content-Type", "value": "application/json" }
      ]
    }
  ]
}
```

## Pasos restantes (cuando se instale Capacitor — Fase 7)

### 1. Reemplazar `TEAMID` en `apple-app-site-association`

Una vez creada la app en App Store Connect:
- Team ID está en https://developer.apple.com/account → Membership.
- Bundle ID será `co.sportmaps.app`.
- Reemplazar `TEAMID.co.sportmaps.app` por el real (ej. `ABC123XYZ.co.sportmaps.app`).

### 2. Reemplazar `sha256_cert_fingerprints` en `assetlinks.json`

Generar el fingerprint del keystore de release:

```bash
# Para keystore Capacitor por default
keytool -list -v -keystore ~/.android/sportmaps-release.keystore \
  -alias sportmaps -storepass <password> | grep SHA256
```

Copiar el fingerprint (formato `AB:CD:EF:...`) y reemplazar en `assetlinks.json`.

### 3. Configurar Capacitor para usar los deep links

En `capacitor.config.ts`:

```ts
const config: CapacitorConfig = {
  appId: 'co.sportmaps.app',
  appName: 'SportMaps',
  webDir: '../frontend/dist',
  server: {
    androidScheme: 'https',
    hostname: 'app.sportmaps.co',  // dominio para Universal Links
  },
};
```

### 4. Configurar iOS Associated Domains

En Xcode > Project > Signing & Capabilities:
- Add "Associated Domains".
- Add domain: `applinks:app.sportmaps.co`.
- Add domain: `webcredentials:app.sportmaps.co` (auto-fill de passwords).

Apple cachea el `apple-app-site-association` por 24h. Si cambias el archivo, los tests fallan hasta refrescar. Para forzar refresh durante desarrollo:
- iOS: borrar app + reinstalar.
- En dispositivo: Settings > Developer > Universal Links > Diagnostics.

### 5. Configurar Android intent filters

En `android/app/src/main/AndroidManifest.xml`, dentro de `<activity>`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https"
        android:host="app.sportmaps.co" />
</intent-filter>
```

## Tests de deep links

### iOS
- Mandate un correo de invitación al device con un link `https://app.sportmaps.co/invitations/abc123`.
- Abrirlo desde Mail → debe abrir la app SportMaps directamente.
- Si abre Safari → mal configurado (revisar apple-app-site-association).

### Android
- Compilar `adb shell pm verify-app-links --re-verify co.sportmaps.app`.
- `adb shell am start -a android.intent.action.VIEW -d "https://app.sportmaps.co/invitations/abc123"` → debe abrir la app.

## Rutas críticas que DEBEN funcionar como deep link

| Ruta | Uso |
|---|---|
| `/login` | Login compartido por email |
| `/reset-password` | Reset password desde mail (CRÍTICO — sin deep link el flujo es muy frágil) |
| `/payment-result` | Callback de Wompi después de pagar |
| `/pagos/confirmacion` | Confirmación de pago manual |
| `/invitations/*` | Invitación de escuela a padre |
| `/c/:qrToken` | Carnet público de atleta (compartido por QR) |
| `/cert/:folio` | Verificación de certificado |
| `/join-team/:teamId`, `/join-plan/:planId`, `/join/:slug` | Invitaciones públicas para inscribirse |

Si alguna ruta queda fuera, hay que agregarla al array `paths` en `apple-app-site-association` y al intent filter de Android.
