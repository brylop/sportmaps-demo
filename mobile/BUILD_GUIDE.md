# SportMaps Flutter — Build Guide
## iOS · Android · Web

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Flutter SDK | 3.22.0 |
| Dart | 3.3.0 |
| Xcode (iOS) | 15.0 |
| Android Studio / SDK | API 21+ |
| Node.js (Web) | 18+ |
| CocoaPods (iOS) | 1.15+ |

---

## Setup inicial

```bash
# 1. Clonar e instalar dependencias
flutter pub get

# 2. Generar código Riverpod
dart run build_runner build --delete-conflicting-outputs

# 3. Generar splash screens nativos
dart run flutter_native_splash:create

# 4. Generar launcher icons
dart run flutter_launcher_icons
```

---

## 🍎 iOS

### Configuración previa
```bash
cd ios
pod install
cd ..
```

### Cambiar Bundle ID
```
# ios/Runner.xcodeproj → Signing & Capabilities
# Bundle Identifier: com.tuempresa.sportmaps
```

### Run en simulador
```bash
flutter run -d iPhone             # simulador por defecto
flutter run -d "iPhone 15 Pro"    # simulador específico
```

### Build para App Store
```bash
# Debug
flutter build ios --debug

# Release (para TestFlight / App Store)
flutter build ios --release

# IPA para distribución
flutter build ipa --release \
  --export-options-plist=ios/ExportOptions.plist
```

### Permisos configurados en Info.plist
- `NSLocationWhenInUseUsageDescription` — mapa
- `NSCameraUsageDescription` — foto de perfil
- `NSPhotoLibraryUsageDescription` — galería
- `UIBackgroundModes: remote-notification` — push

### Deep Links (Universal Links)
```
# Agregar en Apple Developer Console:
# Associated Domains → applinks:sportmaps.app
# Subir apple-app-site-association a https://sportmaps.app/.well-known/
```

---

## 🤖 Android

### Cambiar Application ID
```
# android/app/build.gradle
applicationId "com.tuempresa.sportmaps"
minSdkVersion 21        # Android 5.0
targetSdkVersion 34     # Android 14
```

### Run en emulador
```bash
flutter run -d android    # primer emulador conectado
flutter devices           # listar dispositivos
flutter run -d DEVICE_ID
```

### Build para Google Play
```bash
# APK universal
flutter build apk --release

# APKs por arquitectura (más pequeños)
flutter build apk --split-per-abi --release

# App Bundle (recomendado para Play Store)
flutter build appbundle --release
# Salida: build/app/outputs/bundle/release/app-release.aab
```

### Firma del APK (keystore)
```bash
# 1. Generar keystore
keytool -genkey -v \
  -keystore ~/sportmaps-key.jks \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -alias sportmaps

# 2. Crear android/key.properties
storePassword=TU_PASSWORD
keyPassword=TU_PASSWORD
keyAlias=sportmaps
storeFile=/ruta/a/sportmaps-key.jks

# 3. android/app/build.gradle ya lo referencia
```

### App Links (Deep Linking Android)
```
# Digital Asset Links → subir a:
# https://sportmaps.app/.well-known/assetlinks.json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.sportmaps.app",
    "sha256_cert_fingerprints": ["TU_FINGERPRINT"]
  }
}]

# Obtener fingerprint:
keytool -list -v -keystore ~/sportmaps-key.jks
```

---

## 🌐 Web

### Run en local
```bash
flutter run -d chrome
flutter run -d chrome --web-renderer canvaskit   # mejor calidad
flutter run -d chrome --web-renderer html         # mejor performance
```

### Build para producción
```bash
# Con CanvasKit (mejor fidelidad visual — más pesado ~2MB)
flutter build web --release --web-renderer canvaskit

# Con HTML renderer (más liviano, mejor para mobile web)
flutter build web --release --web-renderer html

# Auto (Flutter elige según dispositivo)
flutter build web --release --web-renderer auto

# Salida: build/web/
```

### Deploy en Vercel
```bash
# vercel.json en la raíz
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}

# Deploy
vercel --prod
```

### Deploy en Firebase Hosting
```bash
firebase init hosting
# Public directory: build/web
# Single-page app: yes

flutter build web --release
firebase deploy
```

### Deploy en Netlify
```bash
# netlify.toml
[build]
  publish = "build/web"
  command = "flutter build web --release"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Variables de entorno Web
```bash
# --dart-define para inyectar en web
flutter build web --release \
  --dart-define=SUPABASE_URL=https://xxx.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJ...
```

### PWA — Instalar en escritorio
El `web/manifest.json` habilita instalación como PWA en Chrome/Edge.
Cumple los criterios: HTTPS + manifest + service worker (Flutter lo genera).

---

## Configuración de Supabase (todas las plataformas)

```dart
// lib/main.dart
await Supabase.initialize(
  url: const String.fromEnvironment('SUPABASE_URL',
      defaultValue: 'https://TU_PROYECTO.supabase.co'),
  anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY',
      defaultValue: 'eyJ...'),
);
```

```bash
# Pasar en tiempo de compilación:
flutter run \
  --dart-define=SUPABASE_URL=https://xxx.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJ...
```

### Supabase Auth Deep Linking
```dart
// lib/main.dart — agregar después de initialize
Supabase.instance.client.auth.onAuthStateChange.listen((data) {
  if (data.event == AuthChangeEvent.signedIn) {
    // GoRouter maneja la redirección
  }
});
```

```
# En Supabase Dashboard → Auth → URL Configuration:
# Site URL: https://sportmaps.app
# Redirect URLs:
#   sportmaps://auth/callback          (iOS/Android)
#   https://sportmaps.app/auth/callback (Web)
```

---

## Notificaciones Push

```bash
# 1. Configurar Firebase
flutterfire configure

# 2. Esto genera:
#    - google-services.json (Android)
#    - GoogleService-Info.plist (iOS)
#    - lib/firebase_options.dart
```

```dart
// lib/main.dart
await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
FirebaseMessaging.onBackgroundMessage(_handleBackground);
```

---

## CI/CD con GitHub Actions

```yaml
# .github/workflows/build.yml
name: SportMaps Build

on: [push]

jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: '3.22.0' }
      - run: flutter pub get
      - run: flutter build appbundle --release
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
      - run: cd ios && pod install && cd ..
      - run: flutter build ipa --release

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
      - run: flutter build web --release --web-renderer canvaskit
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
```

---

## Resumen: Diferencias por plataforma

| Feature | iOS | Android | Web |
|---|---|---|---|
| Navegación | Cupertino slide | Material | Fade |
| AlertDialog | CupertinoAlertDialog | AlertDialog | Dialog (max-width) |
| DatePicker | CupertinoDatePicker | showDatePicker | showDatePicker |
| Switch | CupertinoSwitch | Switch M3 | Switch M3 |
| Loader | CupertinoActivityIndicator | CircularProgressIndicator | CircularProgressIndicator |
| Scroll | BouncingScrollPhysics | ClampingScrollPhysics | ClampingScrollPhysics |
| Back button | Chevron (Cupertino) | Arrow back | Oculto (breadcrumbs) |
| Hover effects | ❌ | ❌ | ✅ SmHoverCard |
| Layout principal | BottomNav | BottomNav | Sidebar + TopBar |
| Layout tablet | NavigationRail | NavigationRail | NavigationRail |
| Layout desktop | — | — | Sidebar extendido |
| PWA | — | — | ✅ manifest.json |
| Notificaciones | APNs (FCM) | FCM | Web Push |
| Deep links | Universal Links | App Links | URL directa |
