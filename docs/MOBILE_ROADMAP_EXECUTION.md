# Mobile — Plan de ejecución (Fases 6.3, 7, 8)

Documento operacional para arrancar la app móvil. Algunos pasos requieren **decisiones de negocio + compras** que el equipo debe tomar antes de codear.

## Estado actual

✅ Lo que ya está listo (Fase 6.1 + 6.2):
- Tabla `user_devices` + RPCs `register_user_device` / `revoke_user_device`.
- Endpoint `/api/v1/devices/register` + DELETE + GET en BFF.
- Hook `useDeviceContext()` montado en `AuthLayout` (registra cada device al loguearse).
- Archivos `apple-app-site-association` y `assetlinks.json` en `frontend/public/.well-known/` (con placeholders para Team ID y SHA256).
- Doc de deep links en [`MOBILE_DEEP_LINKS.md`](./MOBILE_DEEP_LINKS.md).

## Fase 6.3 — Decisiones pendientes

### Decisión 1: 1 app unificada vs varias por rol

**Recomendación: 1 app unificada** (`co.sportmaps.app`).

Argumentos:
- 90% del UI ya vive en una sola SPA — Capacitor reusa todo.
- Mantener 4 apps separadas (athlete, parent, coach, school_admin) duplica trabajo de submission + assets + soporte.
- El primer login resuelve el rol y muestra el dashboard correcto.

Cuándo justificaría separar: si una escuela Enterprise pide su propia app en su brand (Fase 8).

### Decisión 2: Push provider

**Recomendación: Firebase Cloud Messaging (FCM) unificado para iOS + Android.**

Argumentos:
- Gratis (ilimitado por proyecto Firebase).
- iOS via FCM: Firebase actúa como proxy → APNS por debajo, sin tener que firmar certs APNS aparte.
- Capacitor tiene plugin oficial `@capacitor-firebase/messaging`.

Alternativa rechazada: OneSignal ($9/mes a partir de 10k subscribers, lock-in, otro dashboard que gestionar).

### Decisión 3: Versión mínima soportada

**Recomendación:**
- iOS 14+ (cubre ~99% de dispositivos en LATAM).
- Android API 23 (Marshmallow 6.0) — Capacitor 6 lo requiere mínimo.

### Decisión 4: Política de actualización forzada

**Recomendación: NO forzar updates aún.**

Cuando salga una versión con breaking change crítico (ej. cambio en signature de un endpoint payment), agregar un campo `min_app_version` en una RPC `get_app_config()` que el frontend chequea al arrancar. Si la app es menor, mostrar pantalla bloqueante "Actualizá la app".

No construir esto en N1 — sumarlo en N2 cuando ya haya app en stores.

### Decisión 5: Sentry / error tracking

**Recomendación: Sentry desde día 1.**
- Free tier: 5k errores/mes. Suficiente para los primeros 6 meses.
- SDK Capacitor: `@sentry/capacitor` + `@sentry/react`.
- Capturar crashes nativos + errores JS + breadcrumbs de navegación.

### Decisión 6: Localización inicial

**Recomendación: solo `es-CO` para N1.** Agregar `es-MX` y `pt-BR` cuando aparezca primera escuela en esos mercados.

### Decisión 7: Build infra

**Recomendación: Codemagic plan Pay-as-you-go.**
- $0.085/min macOS, sin minimum mensual.
- Una build iOS ~10min → ~$0.85 por build.
- 30 builds/mes ≈ $25/mes (mucho menos que $99 del plan fijo).

Alternativa: GitHub Actions con `macos-latest` runner ($0.08/min). Más barato si ya usás GitHub heavy. Más setup.

NO recomendado: self-host Mac mini ($800+ inicial + mantenimiento).

## Compras hard (antes de empezar Fase 7)

| Item | Costo | Cuándo |
|---|---|---|
| Apple Developer Program | $99 USD/año | Antes de generar primer .ipa |
| Google Play Console | $25 USD único | Antes de subir a Internal Testing |
| Codemagic credits | ~$25/mes según uso | Después de Apple Dev (necesita certificados configurados) |
| Sentry plan Developer | $0 (free hasta 5k) | Cuando se libere primera build |
| Firebase project | $0 | Configurar antes de instalar plugin FCM |

**Total inicial: ~$130 USD primer mes. Recurrente: ~$50/mes.**

---

# Fase 7 — Capacitor base (3-4 semanas de dev)

Una vez tomadas las decisiones y hechas las compras:

## Semana 1 — Setup base

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init "SportMaps" "co.sportmaps.app" --web-dir=dist
npm install @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

Configurar `capacitor.config.ts`:
```ts
const config: CapacitorConfig = {
  appId: 'co.sportmaps.app',
  appName: 'SportMaps',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'app.sportmaps.co',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000 },
  },
};
```

## Semana 2 — Plugins nativos

```bash
npm install @capacitor/push-notifications @capacitor-firebase/messaging
npm install @capacitor/device
npm install @capacitor-community/native-biometric
npm install @capacitor-community/barcode-scanner   # QR scan
npm install @capacitor/camera                       # foto comprobante pago
npm install @capacitor/preferences                  # storage seguro
npm install @sentry/capacitor @sentry/react
```

Configurar cada uno con su permission flow (iOS Info.plist + Android Manifest).

## Semana 3 — Adaptaciones de UI

- Actualizar `useDeviceContext()` para incluir push token real:
  ```ts
  import { FirebaseMessaging } from '@capacitor-firebase/messaging';
  // Pedir permiso + obtener token:
  const { token } = await FirebaseMessaging.getToken();
  // Pasar a register_user_device como push_token + push_provider='fcm'
  ```
- Reemplazar links de pricing/billing por `Browser.open()` (split de cobros — ver memoria `project_mobile_strategy`).
- Login biométrico opcional tras primer login.

## Semana 4 — Build + TestFlight + Play Internal Testing

```bash
npm run build
npx cap sync
# iOS:
npx cap open ios   # abre Xcode → Archive → Distribute → TestFlight
# Android:
npx cap open android   # abre Android Studio → Build → Generate Signed Bundle
```

Subir a:
- TestFlight (iOS) → Apple review interno 1-3 días.
- Play Console > Internal Testing (Android) → revisión casi instantánea.

# Fase 8 — Pipeline flavors (NO construir aún)

Solo cuando **2-3 escuelas Pro+Addon o Elite** soliciten white-label app activamente.

Tools:
- Codemagic Workflows + Capacitor flavors, o
- EAS Build profiles (si se migra a Expo, no recomendado por costo de refactor).

Estructura propuesta:
```
frontend/
  tenants/
    sportmaps/   # default
      app-icon.png
      splash.png
      config.json   { "appId": "co.sportmaps.app", "appName": "SportMaps", ... }
    acruxgym/
      app-icon.png
      splash.png
      config.json   { "appId": "co.sportmaps.app.acruxgym", "appName": "Acrux Gym", ... }
```

CI: script lee TENANT_ID env var, copia assets de `tenants/$TENANT_ID/` a `frontend/`, ajusta `capacitor.config.ts` antes de `cap sync`, builds .ipa y .apk.

**Costo operacional por escuela nueva:** ~$300-500 setup (assets + screenshots + descripción store) + $0.50-2 por build CI. Apple Dev Account permanece único (cuenta SportMaps), no requiere uno por escuela.

---

## Calendario realista (asumiendo decisiones tomadas y compras hechas)

| Semana | Entregable |
|---|---|
| 1 | Capacitor init + iOS + Android proyectos creados |
| 2 | Plugins instalados + permission flows + reemplazar Team ID en aasa |
| 3 | Push notifications working en TestFlight + biométrico |
| 4 | QR scanner + cámara + primera build privada |
| 5 | Submit a App Store + Play Console (Internal Testing) |
| 6 | Bug fixes + privacy policy + screenshots store |
| 7 | Approved + ready for public release |

**Total realista: 6-7 semanas desde día 1 a app en TestFlight.**
