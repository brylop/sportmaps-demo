# Credenciales de Usuarios Demo - SportMaps

Este documento contiene las credenciales de los usuarios demo pre-configurados en la plataforma SportMaps.

## 🔐 Acceso Automático

Los usuarios demo se crean automáticamente la primera vez que se accede a ellos desde la página de login.
Simplemente haz clic en el botón del rol correspondiente en la sección "Explorar Perfiles Demo".

## 👥 Usuarios Disponibles

### 1. Padre/Madre
- **Email:** `padre@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** María González (Demo Padre)
- **Descripción:** Perfil demo de padre/madre con 2 hijos en escuelas deportivas

### 2. Entrenador/Coach
- **Email:** `entrenador@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** Carlos Rodríguez (Demo Entrenador)
- **Descripción:** Perfil demo de entrenador con múltiples clases y alumnos

### 3. Escuela/Centro Deportivo
- **Email:** `escuela@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** Academia Deportiva SportMaps (Demo)
- **Descripción:** Perfil demo de escuela deportiva con gestión completa

### 4. Deportista/Atleta
- **Email:** `deportista@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** Juan Pérez (Demo Deportista)
- **Descripción:** Perfil demo de deportista/atleta con historial deportivo

### 5. Profesional de Bienestar
- **Email:** `bienestar@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** Dra. Ana Martínez (Demo Bienestar)
- **Descripción:** Perfil demo de profesional de bienestar y salud

### 6. Tienda/Vendedor
- **Email:** `tienda@sportmaps-demo.com`
- **Contraseña:** `DemoSportMaps2024!`
- **Nombre:** Deportes Pro (Demo Tienda)
- **Descripción:** Perfil demo de tienda deportiva con catálogo de productos

## 🎯 Cómo Usar

1. Ve a la página de login
2. Busca la sección "Explorar Perfiles Demo"
3. Haz clic en el botón del rol que quieres explorar
4. El sistema automáticamente:
   - Crea el usuario si no existe
   - Inicia sesión automáticamente
   - Te redirige al dashboard con el perfil demo

## 🔒 Seguridad

- Todos los emails demo terminan en `@sportmaps-demo.com`
- Los usuarios demo están marcados con `isDemo: true` en sus metadatos
- Tienen políticas RLS específicas para acceso público de lectura
- **IMPORTANTE:** Estas credenciales son solo para demostración y no deben usarse en producción

## 🛠️ Desarrollo

Para agregar un nuevo usuario demo, edita el archivo `src/lib/demo-credentials.ts` y agrega la configuración correspondiente.

## 📝 Notas

- La contraseña es la misma para todos los usuarios demo por simplicidad
- Los usuarios se crean con auto-confirmación de email habilitada
- Cada usuario tiene su propio dashboard y funcionalidades según su rol
