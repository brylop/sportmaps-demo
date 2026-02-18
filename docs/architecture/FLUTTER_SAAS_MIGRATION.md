# Guía de Migración Flutter: De Supabase-First a Arquitectura SaaS Enterprise

Esta guía detalla los cambios necesarios en la aplicación móvil SportMaps (Flutter) para soportar la arquitectura **Schema-per-Tenant** propuesta (NestJS + Keycloak).

## 1. Capa de Red (Networking)
**Estado Actual:** `supabase_flutter`. El SDK maneja todo (Auth, DB, Realtime).
**Target:** API REST/GraphQL centralizada (NestJS).

### Cambios Requeridos:
- **Tenant Context Header:** Cada petición HTTP debe incluir el header `x-tenant-id` para que el Backend sepa a qué esquema de base de datos conectarse.
  ```dart
  // Interceptor en Dio
  class TenantInterceptor extends Interceptor {
    @override
    void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
      final tenant = TenantService.currentTenant; // Ej: 'tigres-fc'
      options.headers['x-tenant-id'] = tenant;
      super.onRequest(options, handler);
    }
  }
  ```
- **Cliente API Tipado:** Generar el cliente Dart automáticamente desde el Swagger/OpenAPI de NestJS para evitar errores manuales.
  - Herramienta: `openapi_generator`.

## 2. Autenticación (Auth)
**Estado Actual:** `Supabase Auth` (Magic Links, Social).
**Target:** `Keycloak` (OIDC/OAuth2).

### Cambios Requeridos:
- **Librería OIDC:** Reemplazar `supabase_flutter` auth por `flutter_appauth`.
- **Flujo de Login:** 
  1. App abre navegador web (In-App Browser).
  2. Usuario se loguea en Keycloak (página centralizada sportmaps.auth).
  3. Keycloak redirige a la app (`sportmaps://callback`) con el `access_token` y `refresh_token`.
- **Token Management:** Implementar lógica manual para refrescar el token cuando expire (Refresh Token Rotation).

## 3. Manejo de Datos Offline (Offline-First)
**Estado Actual:** Supabase tiene capacidades limitadas de caché, pero funcionales.
**Target:** Sincronización Manual Robusta.

### Cambios Requeridos:
- **Base de Datos Local:** Implementar **Isar** o **Drift (SQLite)**.
- **Patrón de Sincronización:**
  - *Bajada:* Al abrir la app, descargar diffs del servidor (NestJS) y guardar en Isar.
  - *Subida:* Cola de peticiones (Queue) para acciones realizadas offline. Al recuperar internet, enviar a NestJS una por una.
  - *Conflict Resolution:* Lógica "Last Write Wins" o manual en el servidor.

## 4. Gestión de Archivos (Multimedia)
**Estado Actual:** Supabase Storage (SDK directo).
**Target:** Amazon S3 (API Presigned URLs).

### Cambios Requeridos:
- La app ya no sube archivos directamente.
- **Flujo Nuevo:**
  1. App pide permiso al Backend: `GET /api/upload-url?filename=foto.jpg`.
  2. Backend valida permisos y retorna URL firmada de S3 (`https://s3.aws...Signature=...`).
  3. App sube el archivo a esa URL con `PUT`.

## 5. Notificaciones Real-time
**Estado Actual:** Supabase Realtime (Websockets sobre Postgres).
**Target:** Socket.io / Firebase Cloud Messaging (FCM).

### Cambios Requeridos:
- Implementar cliente `socket_io_client` para eventos en tiempo real (chat, ubicación).
- O mantener FCM para notificaciones Push (lo estándar).

## Resumen del Esfuerzo Estimado
| Módulo | Complejidad | Tiempo Estimado (1 Dev Senior) |
| :--- | :--- | :--- |
| **Networking & API Gen** | Media | 1 semana |
| **Auth (Keycloak)** | Alta | 2 semanas |
| **Offline Sync (Isar)** | Muy Alta | 3-4 semanas |
| **Migración UI** | Baja | 1 semana |
| **Testing** | Media | 1 semana |
| **TOTAL** | | **~2 Meses** |

---
**Recomendación:** Para el MVP, mantener Supabase simplifica la capa móvil drásticamente (ahorra el trabajo de Offline y Auth custom). Migrar a esta arquitectura solo cuando la escala lo justifique.
