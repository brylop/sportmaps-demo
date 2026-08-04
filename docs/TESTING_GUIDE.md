# Plan de pruebas — Sprints 1-4 + Super-admin

Guía paso a paso para validar todo lo construido el 2026-04-24.

> **BD:** Supabase staging (`luebjarufsiadojhvxgi`)
> **Frontend:** `http://localhost:3001`
> **BFF:** `http://localhost:3000`

---

## ✅ Pre-requisitos (5 min)

- [ ] Migraciones aplicadas en staging (verificar con):
  ```sql
  SELECT proname FROM pg_proc WHERE proname IN (
    'is_super_admin','admin_global_counts','admin_activity_summary',
    'verify_athlete_id_card_public','issue_athlete_id_card',
    'request_athlete_certificate','verify_athlete_certificate_public',
    'get_join_qr_public','submit_qr_signup',
    'list_school_athletes_for_card_issue','list_athlete_id_cards',
    'list_athlete_certificates','list_school_join_qrs',
    'admin_list_users','admin_list_schools_global'
  ) ORDER BY proname;
  ```
  → debe devolver **15 filas**

- [ ] Frontend corriendo: abrir `http://localhost:3001` en navegador
- [ ] BFF corriendo (necesario para PDFs):
  ```bash
  cd bff && npm run dev   # http://localhost:3000
  ```
- [ ] DevTools del navegador abierto (`F12` → tab Console + Network)

### Cuentas demo de staging

| Rol | Email | Para qué Sprint |
|---|---|---|
| super-admin | `spoortmaps+admin@gmail.com` | Sprint 1, 6 |
| school | `spoortmaps+school@gmail.com` | Sprint 2, 3, 4 (admin) |
| parent | `spoortmaps@gmail.com` | Sprint 3, 4 (cliente) |
| athlete | `spoortmaps+athlete@gmail.com` | Sprint 2 (ver carnet) |
| coach | `spoortmaps+coach@gmail.com` | Validar bloqueos RLS |

> Si no recuerdas la pass, usa el SQL del paso anterior para resetearla, o el dashboard Auth → Users → Reset password.

---

## 🧪 Test 1 — Super-admin: panel + nav + logs (10 min)

### 1.1 Login y verificar nav

- [ ] Login con `spoortmaps+admin@gmail.com`
- [ ] **Esperado:** redirección automática a `/admin`
- [ ] **Esperado en sidebar:**
  - Avatar con badge **"Super Admin"**
  - 3 secciones: **Plataforma** / **Gestión Global** / **Sistema**
  - Items: Dashboard · Logs y actividad · Analítica · Escuelas · Usuarios · Reportes · Configuración · Notificaciones · Mensajes
- [ ] **NO debe aparecer:** Equipos, Calendario, Asistencias, Pagos de escuela

### 1.2 AdminPanelPage

- [ ] En `/admin` los 4 cards muestran números ≠ 0:
  - Total Usuarios
  - Sedes Activas
  - Actividad Hoy (= pagos pagados últimos 30d)
  - Sistema: Online
- [ ] Tabla de usuarios muestra **emails reales** (no `user@sportmaps.com`)
- [ ] Tabla de escuelas con owner_email
- [ ] Console: sin errores 404 ni "row_to_jsonb does not exist"

### 1.3 Logs globales (Sprint 1)

- [ ] Click "Logs y actividad global" o navegar a `/admin/activity-logs`
- [ ] **Esperado:**
  - 8 cards de KPIs en la parte superior (pagos aprobados, pendientes, monto, eventos billing, etc)
  - Filtros: rango fechas + escuela
  - 5 tabs: **Pagos** · **Billing** · **Auditoría** · **Analítica** · **Eventos**
- [ ] Tab **Auditoría** → escribe `payments` en filtro tabla → debe listar cambios reales
- [ ] Tab **Pagos** → cambia estado a "Pagado" → lista pagos reales con escuela + payer + monto
- [ ] Cambia rango de fechas a 30 días y verifica que los KPIs cambian

### 1.4 Verificación de seguridad

- [ ] Abre incognito → `http://localhost:3001/admin/activity-logs` sin login → redirige a `/login` ✓
- [ ] Login con `spoortmaps+school@gmail.com` (school owner) → ir a `/admin/activity-logs` → debe mostrar **"Unauthorized"** o error 403 ✓ (porque `strictRoleCheck` exige `admin`/`super_admin` exacto)

---

## 🪪 Test 2 — Sprint 2: Carnets digitales (15 min)

### 2.1 Setup como school admin

- [ ] Cierra sesión, login con `spoortmaps+school@gmail.com`
- [ ] **Esperado en sidebar:** menú normal de escuela (Estudiantes, Equipos, Calendario, Pagos…)
- [ ] Navega manualmente a `http://localhost:3001/cards`
- [ ] **Esperado:** página "Carnets digitales" carga **sin** el error rojo "row_to_jsonb"

### 2.2 Listar atletas

- [ ] Tab **"Emitir nuevo"** activo por default
- [ ] Lista de atletas (children) de la escuela aparece
- [ ] Cada fila tiene badge "Sin carnet" o "Con carnet activo"
- [ ] Buscador por nombre/documento funciona

### 2.3 Emitir carnet

- [ ] Click **"Emitir"** en cualquier atleta
- [ ] Modal "Emitir carnet" abre
- [ ] Cambia "Vence el" a fecha futura
- [ ] Click **"Emitir"**
- [ ] Toast: "Carnet emitido"
- [ ] **Vista previa abre automática** mostrando:
  - Carnet 340×540 con branding de la escuela (logo, colores)
  - Foto del atleta (avatar)
  - Nombre, doc, equipo, sede
  - QR escaneable
  - Semáforo de cuota (verde/amarillo/rojo según pagos)
  - Fecha de vencimiento

### 2.4 Verificar carnet en tab "Carnets emitidos"

- [ ] Tab **"Carnets emitidos"** muestra el carnet recién creado
- [ ] Estado: badge verde "active"
- [ ] Click **"Ver"** → vista previa idéntica
- [ ] Click **"PDF"** → descarga PNG
- [ ] Click **"Revocar"** con razón → estado pasa a "revoked"

### 2.5 Carnet público (sin auth)

- [ ] Copia el `qr_token` del carnet (visible en URL después de "Ver", o en console)
- [ ] Abre incognito → `http://localhost:3001/c/{qr_token}`
- [ ] **Esperado:**
  - Carnet con branding de la escuela
  - Datos básicos (nombre, foto, equipo)
  - **NO** debe mostrar doc, sangre, EPS, contacto si template no los habilita (ver fix de seguridad)
  - Botón "Descargar PNG"
- [ ] Carnet revocado → mensaje "Carnet revocado"

### 2.6 Cross-tenant security

- [ ] En SQL Editor:
  ```sql
  SELECT id, full_name, school_id FROM children WHERE school_id != (
    SELECT school_id FROM school_members WHERE profile_id = auth.uid() LIMIT 1
  ) LIMIT 1;
  ```
  Copia un `child_id` de OTRA escuela.
- [ ] Intenta emitir carnet manualmente en console:
  ```js
  await window.supabase.rpc('issue_athlete_id_card', {
    p_school_id: 'tu-school-id',
    p_child_id: 'child-id-de-otra-escuela',
    p_valid_until: '2027-12-31'
  });
  ```
  → debe devolver error: **"Athlete does not belong to this school"** ✓

---

## 📜 Test 3 — Sprint 3: Constancias (15 min)

### 3.1 Crear plantilla (school admin)

- [ ] Como `spoortmaps+school@gmail.com`, ir a `/cards/templates/certificates`
- [ ] Click **"Nueva plantilla"**
- [ ] Llena:
  - Nombre: "Constancia de estudio"
  - Tipo: Estudio
  - Título: "CONSTANCIA"
  - Cuerpo: deja el default (con `{{atleta.nombre}}` etc.)
  - Firma: tu nombre
  - **Cobra esta constancia: OFF** (gratis)
  - Activa: ON
- [ ] Click **"Guardar"** → toast "Plantilla creada"
- [ ] Card de la plantilla aparece en la lista

### 3.2 Padre solicita constancia

- [ ] Cierra sesión, login con `spoortmaps@gmail.com` (parent)
- [ ] Navega a `http://localhost:3001/my-certificates`
- [ ] Click **"Solicitar constancia"**
- [ ] Selecciona el atleta (uno de tus hijos)
- [ ] Selecciona la plantilla "Constancia de estudio (gratis)"
- [ ] Click **"Solicitar"** → toast "Solicitud enviada"
- [ ] La constancia aparece con estado "Por aprobar"

### 3.3 School admin emite + genera PDF

- [ ] Logout → login `spoortmaps+school@gmail.com`
- [ ] Ir a `/certificates`
- [ ] Filtro estado: "Por aprobar" → ves la solicitud
- [ ] Click **"Emitir"** → BFF genera PDF (puede tardar 2-3s)
- [ ] Toast: "Constancia emitida · Folio XXX-2026-00001 · PDF generado"
- [ ] Estado pasa a "Emitida"
- [ ] Click **"PDF"** → abre en pestaña nueva el PDF con:
  - Header con branding de la escuela (color + nombre)
  - Folio único arriba a la derecha
  - Cuerpo con variables resueltas (nombre del atleta, fecha actual)
  - QR de verificación abajo izquierda
  - Firma + footer

### 3.4 Verificación pública del folio

- [ ] Copia el folio (ej `SPIRITAL-2026-00001`)
- [ ] Incognito → `http://localhost:3001/cert/{folio}`
- [ ] **Esperado:**
  - Card verde "Constancia válida"
  - Folio + tipo + atleta (nombre) + escuela + fecha emisión
- [ ] **NO** muestra contenido completo del cuerpo (eso requiere PDF con ACL)

### 3.5 Padre descarga su PDF

- [ ] Logout → login parent
- [ ] `/my-certificates` → estado "Emitida" en la solicitud
- [ ] Click **"PDF"** → descarga vía URL firmada (10min de vigencia)

### 3.6 Probar plantilla con costo

- [ ] Como school admin: nueva plantilla con "Cobra esta constancia: ON" + precio 5000 COP
- [ ] Como padre: solicitar esa plantilla → estado "Pendiente pago"
- [ ] **Esperado:** la solicitud queda en `pending_payment` hasta que se asocie un payment pagado (flujo aún sin implementar UI completa)

---

## 📲 Test 4 — Sprint 4: QR de inscripción (20 min)

### 4.1 School admin crea QR

- [ ] Como `spoortmaps+school@gmail.com`, ir a `http://localhost:3001/qr-signup`
- [ ] Click **"Nuevo QR"**
- [ ] Llena:
  - Nombre: "Flyer Plaza Mayor"
  - Tipo: "Abierto (cualquier equipo)"
  - Texto introductorio: "Bienvenido a nuestra escuela. Inscríbete y recibe el primer mes con descuento."
  - Texto del botón: "Quiero unirme"
  - **Exigir primer pago al inscribirse: ON**
  - **Aceptar pagos online: ON**
- [ ] Click **"Crear"** → toast "QR creado"
- [ ] Card del QR aparece con métricas en cero

### 4.2 Ver QR + descargar poster

- [ ] Click **"Ver QR"** en el card
- [ ] Modal muestra QR escaneable + URL pública (`http://localhost:3001/join/{slug}`)
- [ ] Click **"Poster PDF"** → descarga PDF A4 con:
  - Banda superior con color y nombre de la escuela
  - Logo (si existe)
  - QR grande centrado (320×320)
  - URL textual abajo
  - Footer "Powered by SportMaps"

### 4.3 Persona NUEVA escanea el QR

- [ ] Cierra sesión (importante: probar como visitante anónimo)
- [ ] Abre nuevo tab en incognito
- [ ] Pega la URL pública del QR (`http://localhost:3001/join/{slug}`)
- [ ] **Esperado:**
  - Header branded (color + logo + nombre escuela)
  - Texto introductorio que escribiste
  - Si target=open: dropdown para elegir equipo
  - Botón "Quiero unirme"
- [ ] Click el botón → pasa a paso "Auth"
- [ ] **Esperado:** 2 tabs: "Soy nuevo" / "Tengo cuenta"

### 4.4 Registro nuevo

- [ ] Tab "Soy nuevo":
  - Nombre: "Test Padre Demo"
  - Teléfono: "3001234567"
  - Email: `test+qr-{timestamp}@sportmaps.test` (único)
  - Password: "Test123456"
- [ ] Click **"Crear cuenta y continuar"**
- [ ] Toast "Cuenta creada"
- [ ] Pasa al paso "Datos del atleta"
- [ ] Llena:
  - Nombre: "Test Hijo Demo"
  - Fecha nacimiento: cualquier 2015-2018
  - Tipo doc: TI
  - Doc: 1234567890
  - Cuota mensual: 100000 (porque toggle estaba ON)
- [ ] Click **"Inscribirme y continuar al pago"**
- [ ] **Esperado:** redirección a `/parent-checkout?payment_id=...`
- [ ] **NO** debe haber crash ni 500

### 4.5 Verificar métricas

- [ ] Vuelve a la sesión de school admin (tab original)
- [ ] Refresca `/qr-signup`
- [ ] El card del QR ahora muestra:
  - **Scans: 1** (la persona escaneó/cargó la landing)
  - **Inscritos: 1** (completó signup)
  - **Pagaron: 0** (aún no pagó)

### 4.6 Login con cuenta existente

- [ ] Otro tab incognito → `http://localhost:3001/join/{slug}`
- [ ] Click el botón → tab "Tengo cuenta"
- [ ] Email: `spoortmaps@gmail.com` + su password
- [ ] Click **"Iniciar sesión y continuar"**
- [ ] **Esperado:** pasa directo a "Datos del atleta" (no pide signup de nuevo)

### 4.7 Usuario YA logueado

- [ ] En el tab donde estás logueado como parent, navega a `/join/{slug}`
- [ ] **Esperado:**
  - Banner verde "Sesión activa: María García Hernández"
  - Botón "Continuar" (no "Inscribirme")
  - Click → salta directo a "Datos del atleta"

---

## 🛡️ Test 5 — Validación de seguridad cross-rol (10 min)

### 5.1 Coach NO puede emitir carnets

- [ ] Login con `spoortmaps+coach@gmail.com`
- [ ] Navega manualmente a `http://localhost:3001/cards`
- [ ] **Esperado:**
  - O bien `/unauthorized` (si frontend bloquea)
  - O bien la página carga pero el botón "Emitir" da error 403 al hacer click
- [ ] En console intenta:
  ```js
  await window.supabase.rpc('issue_athlete_id_card', {
    p_school_id: 'cualquier-id',
    p_child_id: 'cualquier-id',
    p_valid_until: '2027-12-31'
  });
  ```
  → error **"Forbidden: school admin only"** ✓

### 5.2 Parent NO puede ver carnets de otros niños

- [ ] Login con `spoortmaps@gmail.com` (parent)
- [ ] En console:
  ```js
  await window.supabase
    .from('athlete_id_cards')
    .select('*');
  ```
  → solo devuelve carnets cuyos `child.parent_id = auth.uid()` ✓ (RLS filtra)

### 5.3 Anon NO puede listar plantillas

- [ ] Logout
- [ ] En console:
  ```js
  await window.supabase
    .from('school_certificate_templates')
    .select('*');
  ```
  → arreglo vacío `[]` ✓ (RLS bloquea anon)

### 5.4 Verificación pública de carnet revocado

- [ ] Como school admin, revoca un carnet
- [ ] Incognito → `/c/{qr_token}` del revocado
- [ ] **Esperado:** overlay rojo "Carnet revocado" + razón

---

## 📊 Test 6 — Validar logs aparecen en `/admin/activity-logs`

Después de hacer todos los tests:

- [ ] Login super-admin → `/admin/activity-logs`
- [ ] Tab **Pagos** → ves los nuevos pagos creados por inscripciones QR
- [ ] Tab **Auditoría**:
  - Filtro tabla: `athlete_id_cards` → ves INSERTs/UPDATEs de carnets emitidos/revocados
  - Filtro tabla: `athlete_certificates` → ves la constancia creada
  - Filtro tabla: `school_join_qr_codes` → ves el QR creado
- [ ] Filtros de escuela funcionan

---

## 🐛 Errores conocidos & qué hacer

| Síntoma | Causa | Fix |
|---|---|---|
| `404 /admin` | Ruta base no agregada | Verifica que aplicaste el último cambio en App.tsx |
| `function row_to_jsonb does not exist` | Patch no aplicado en staging | Ejecuta `docs/_apply_to_staging_PATCH_row_to_jsonb.sql` |
| PDFs de constancias no descargan | BFF caído o sin SUPABASE_SERVICE_ROLE_KEY | `cd bff && npm run dev` + verifica `.env` |
| Sidebar muestra "Admin Sede" en vez de "Super Admin" | Cache | `Ctrl+Shift+R` (hard reload) |
| `/dashboard` no redirige a `/admin` | profile.role no es 'admin'/'super_admin' | `SELECT role FROM profiles WHERE id = auth.uid();` |
| Carnet público filtra datos sensibles | Template tiene flags activos | Revisa `template.show_fields` en plantilla |

---

## ✅ Checklist final

- [ ] Sprint 1 ok (logs globales)
- [ ] Sprint 2 ok (carnets emitidos + descargados + verificación pública)
- [ ] Sprint 3 ok (constancias solicitadas + emitidas + PDF + verificación folio)
- [ ] Sprint 4 ok (QR creado + escaneado + signup + métricas)
- [ ] Super-admin nav diferenciado
- [ ] RLS validada (coach bloqueado, parent acotado, anon negado)
- [ ] Audit logs muestran toda la actividad

Si algo falla durante el test, captura screenshot + texto de la consola y comparte.
