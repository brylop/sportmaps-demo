# 🧪 SportMaps — Guía de QA y Validación

> **Para:** Dev QA / Segundo desarrollador  
> **Rama a usar:** `develop`  
> **Última arquitectura:** Sprint 2 — RLS + Code Splitting + Schema unificado  
> **Fecha:** 2026-02-18

---

## Setup inicial antes de empezar

```bash
git checkout develop
git pull origin develop
cd frontend
npm install
cp .env.example .env.local
# Pedir credenciales al líder del proyecto
npm run dev
```

Confirmar que el servidor corre en `http://localhost:5173` sin errores en consola.

---

## 🔴 CRÍTICO — Bloque 1: Autenticación y Roles

Estos son los flujos más importantes. Si fallan aquí, nada más funciona.

### TC-01: Login con usuario Owner (Administrador de escuela)

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/login` | Formulario de login visible |
| 2 | Ingresar credenciales del owner de "Spirit All Stars" | Login exitoso |
| 3 | Verificar redirección | Debe ir a `/school/dashboard` o equivalente |
| 4 | Ver barra lateral | Debe mostrar opciones de administrador (estudiantes, pagos, programa) |
| 5 | Abrir DevTools → Network | NO deben aparecer errores 401 o 403 en ninguna petición |

**❌ Bug si:** Redirige a `/` o muestra pantalla en blanco.

---

### TC-02: Onboarding por rol

Probar cada rol con un usuario nuevo:

| Rol | Flujo esperado |
|-----|---------------|
| `school` (owner) | → Onboarding de escuela → Configurar nombre, sport, branch → Dashboard |
| `coach` | → Onboarding de coach → Asignar a escuela → Dashboard |
| `parent` | → Onboarding de padre → Agregar hijo → Dashboard |
| `athlete` | → Onboarding de atleta → Seleccionar programa → Dashboard |

**Verificar en cada caso:**
- [ ] La URL cambia correctamente
- [ ] Al completar el onboarding, NO vuelve a aparecer en el próximo login
- [ ] El campo `onboarding_completed` en la tabla `profiles` queda en `true`

```sql
-- Verificar en Supabase SQL Editor
SELECT id, full_name, role, onboarding_completed 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔴 CRÍTICO — Bloque 2: Row Level Security (RLS)

> **Contexto:** Activamos RLS en 15 tablas. Un usuario de una escuela NO puede ver datos de otra escuela.

### TC-03: Aislamiento de datos entre escuelas

**Setup necesario:** Dos cuentas de tipo `owner` de escuelas diferentes.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Login con Owner A | Ve solo los datos de su escuela |
| 2 | Anotar IDs de sus estudiantes | IDs del Owner A |
| 3 | Cerrar sesión | Logout limpio |
| 4 | Login con Owner B (otra escuela) | Ve solo datos de su escuela |
| 5 | Verificar que NO ve estudiantes del Owner A | Lista de estudiantes diferente |
| 6 | Intentar acceso directo por URL (ej. `/students/[id-del-owner-a]`) | Debe mostrar 404 o "no encontrado" |

**❌ Bug crítico de seguridad si:** Owner B puede ver datos de Owner A.

---

### TC-04: Verificar RLS desde Supabase

En el SQL Editor con el rol `authenticated`:

```sql
-- PRUEBA 1: Como usuario owner, debe ver SOLO sus escuelas
SELECT * FROM schools;
-- Debe retornar solo la escuela del usuario logueado

-- PRUEBA 2: Como usuario, sus children
SELECT * FROM children;
-- Si es parent: solo sus hijos
-- Si es staff/owner: hijos de su escuela

-- PRUEBA 3: Pagos visibles
SELECT * FROM payments;
-- Owner/admin: todos los pagos de su escuela
-- Parent: solo sus pagos
```

---

## 🟡 IMPORTANTE — Bloque 3: Módulo de Pagos (Manual)

> Los pagos son manuales en este MVP. Wompi está preparado pero inactivo.

### TC-05: Crear pago manual

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Login como owner/admin | Dashboard visible |
| 2 | Ir a sección Pagos | Lista de pagos carga correctamente |
| 3 | Crear nuevo pago | Formulario con campos: concepto, monto, fecha vencimiento, estudiante |
| 4 | Guardar pago | Pago aparece en lista con status `pending` |
| 5 | Verificar en BD | Registro en tabla `payments` con `school_id` correcto |

```sql
-- Verificar último pago creado
SELECT id, concept, amount, status, school_id, child_id, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 5;
```

### TC-06: Marcar pago como pagado

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Seleccionar un pago `pending` | Modal o panel de detalle |
| 2 | Cambiar status a `paid` | Status actualizado |
| 3 | Verificar `payment_date` | Debe tener la fecha actual |
| 4 | Verificar que el padre ve el cambio | Si hay vista de padre, reflejar |

**Verificar estados válidos:** `pending` → `paid` / `overdue` / `failed` / `cancelled`

---

## 🟡 IMPORTANTE — Bloque 4: Gestión de Estudiantes

### TC-07: Agregar estudiante

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a Estudiantes como admin | Lista visible |
| 2 | Crear nuevo estudiante | Formulario con nombre, fecha nac., documento |
| 3 | Asignar a programa | Dropdown con programas de la escuela |
| 4 | Guardar | Estudiante aparece en lista |
| 5 | Verificar en BD | `children.school_id` = ID de la escuela del admin |

### TC-08: Vista `students` (nueva vista SQL)

```sql
-- Debe retornar estudiantes enriquecidos con datos del padre y programa
SELECT 
  full_name,
  parent_name,
  parent_email,
  program_name,
  enrollment_status
FROM students
LIMIT 10;
```

Verificar que los JOINs retornan datos correctos (no NULLs inesperados).

---

## 🟡 IMPORTANTE — Bloque 5: Performance y Code Splitting

> Implementamos lazy loading en 78 páginas. El bundle inicial bajó de 2.3MB a ~150KB.

### TC-09: Validar code splitting en producción

1. Abrir DevTools → pestaña **Network** → filtrar por **JS**
2. Cargar `http://localhost:5173`
3. Verificar:
   - [ ] El archivo `index-[hash].js` (bundle principal) pesa **menos de 300KB**
   - [ ] Al navegar a una nueva página aparecen nuevos chunks en Network
   - [ ] Nunca hay un chunk mayor a 500KB

### TC-10: Tiempo de carga inicial

Herramienta: DevTools → **Lighthouse** → modo Mobile

| Métrica | Objetivo |
|---------|----------|
| FCP (First Contentful Paint) | < 2s |
| LCP (Largest Contentful Paint) | < 4s |
| TTI (Time to Interactive) | < 5s |
| Bundle inicial | < 300KB |

### TC-11: PageLoader visible

1. Simular conexión lenta: DevTools → Network → **Slow 3G**
2. Navegar entre páginas
3. Verificar: aparece un spinner/loader mientras carga el chunk lazy
4. Verificar: NO hay pantalla en blanco durante la carga

---

## 🟢 NORMAL — Bloque 6: Manejo de Errores

### TC-12: Variables de entorno faltantes

1. Renombrar temporalmente `.env.local` a `.env.local.bak`
2. Reiniciar el servidor
3. **Resultado esperado:** Mensaje claro en consola: _"Missing required environment variable: VITE_SUPABASE_URL"_
4. NO debe mostrar pantalla en blanco silenciosa
5. Restaurar: renombrar de vuelta a `.env.local`

### TC-13: Manejo de sesión expirada

1. Login normal
2. En Supabase Dashboard → Authentication → invalidar el JWT del usuario
3. Volver al navegador e intentar hacer cualquier acción
4. **Resultado esperado:** Redirección a `/login` con mensaje "Sesión expirada"
5. **❌ Bug si:** Muestra datos vacíos sin mensaje o crash

### TC-14: Acceso a rutas protegidas sin login

| Ruta | Resultado esperado |
|------|-------------------|
| `/school/dashboard` | Redirect a `/login` |
| `/parent/children` | Redirect a `/login` |
| `/admin` | Redirect a `/login` |

### TC-15: Acceso a rutas de rol incorrecto

Un `parent` intenta acceder a rutas de `owner`:

| Ruta | Resultado esperado |
|------|-------------------|
| `/school/settings` | Redirect a su dashboard o error 403 |
| `/school/staff` | Redirect a su dashboard o error 403 |

---

## 🟢 NORMAL — Bloque 7: Regresión general

Recorrer el flujo completo como usuario real:

### TC-16: Golden Path — Owner

```
Login → Ver dashboard → Ver lista estudiantes → 
Crear estudiante → Asignar a programa → 
Crear pago manual → Marcar como pagado → 
Ver reportes → Logout
```

### TC-17: Golden Path — Parent (Padre)

```
Login → Ver dashboard → Ver mis hijos → 
Ver estado de pagos → Ver próximas clases → 
Logout
```

---

## 📋 Plantilla de reporte de bugs

Al encontrar un bug, documentarlo así:

```
## Bug: [Título corto]

**Severidad:** 🔴 Crítico / 🟡 Importante / 🟢 Menor
**TC:** TC-XX
**Componente:** [Nombre del componente o página]
**Rama:** develop @ bd880e2

### Pasos para reproducir
1. ...
2. ...
3. ...

### Resultado actual
[Qué pasó]

### Resultado esperado
[Qué debería pasar]

### Evidencia
[Screenshot o error de consola]

### Query SQL relacionado (si aplica)
```sql
...
```
```

---

## 📊 Semáforo de resultado esperado

| Color | Criterio | Acción |
|-------|----------|--------|
| 🟢 **Verde** | TC-01 al TC-06 pasan sin bugs | Se puede continuar desarrollo |
| 🟡 **Amarillo** | TC-07 al TC-11 tienen bugs menores | Documentar y continuar |
| 🔴 **Rojo** | TC-01, TC-03 o TC-12 fallan | Detener y escalar al líder |

---

## Comandos útiles de apoyo

```bash
# Ver errores de TypeScript
cd frontend && npx tsc --noEmit

# Ver errores de ESLint en archivos específicos
npx eslint src/pages/SchoolDashboard.tsx

# Build de producción para validar bundle
npm run build
# Revisar dist/ para ver tamaño de chunks

# Activar source maps para debugging
# En vite.config.ts: build.sourcemap = true
```

---

*Guía creada: 2026-02-18 | Arquitectura: Sprint 2 — commit bd880e2*
