# Cuentas Demo para SportMaps

**Contraseña Universal:** `SportMapsDemo2025!`

## Lista Completa de Cuentas Demo

### 1. Deportista/Atleta
- **Nombre Completo:** Carlos Martínez López
- **Email:** carlos.martinez@demo.sportmaps.com
- **Rol:** Deportista/Atleta (athlete)
- **Descripción:** Estudiante de secundaria apasionado por el fútbol, busca escuelas deportivas para mejorar sus habilidades.

### 2. Padre/Madre
- **Nombre Completo:** María García Hernández
- **Email:** maria.garcia@demo.sportmaps.com
- **Rol:** Padre/Madre (parent)
- **Descripción:** Madre de dos hijos deportistas que busca las mejores opciones de formación deportiva para ellos.

### 3. Entrenador/Coach
- **Nombre Completo:** Luis Fernando Rodríguez
- **Email:** luis.rodriguez@demo.sportmaps.com
- **Rol:** Entrenador/Coach (coach)
- **Descripción:** Entrenador certificado con 10 años de experiencia en formación de jóvenes talentos.

### 4. Escuela/Centro Deportivo
- **Nombre Completo:** Academia Deportiva Elite
- **Email:** academia.elite@demo.sportmaps.com
- **Rol:** Escuela/Centro Deportivo (school)
- **Descripción:** Centro deportivo de alto rendimiento con programas especializados en múltiples disciplinas.

### 5. Profesional de Bienestar
- **Nombre Completo:** Dra. Sofía Rivera
- **Email:** sofia.rivera@demo.sportmaps.com
- **Rol:** Profesional de Bienestar (wellness_professional)
- **Descripción:** Fisioterapeuta deportiva especializada en rehabilitación y mejora del rendimiento atlético.

### 6. Tienda/Vendedor
- **Nombre Completo:** Tienda Equípate Más
- **Email:** info.equipatemas@demo.sportmaps.com
- **Rol:** Tienda/Vendedor (store_owner)
- **Descripción:** Tienda de artículos deportivos que ofrece equipamiento de calidad para todas las disciplinas.

---

## Funcionalidades de Registro Demo

### ✅ Validaciones Implementadas
- Formato de email válido
- Contraseña mínima de 8 caracteres
- Confirmación de contraseña
- Nombre completo obligatorio
- Selección de rol obligatoria

### ✅ Características Configuradas
- **Auto-confirmación de email:** Activada para facilitar pruebas
- **RLS (Row Level Security):** Políticas configuradas para cada rol
- **Perfil automático:** Se crea automáticamente al registrar

### 🔄 Flujo de Registro
1. Usuario completa el formulario con los datos demo
2. Sistema valida los datos en tiempo real
3. Al enviar, se crea la cuenta en Supabase
4. Se crea automáticamente el perfil con el rol seleccionado
5. Usuario es redirigido al dashboard

### 🧪 Cómo Probar
1. Ir a `/register`
2. Completar el formulario con cualquier cuenta demo de arriba
3. Seleccionar el rol correspondiente
4. Hacer clic en "Crear Cuenta"
5. Verificar que se redirige al dashboard
6. Cerrar sesión e iniciar sesión nuevamente con las mismas credenciales

---

## Notas Técnicas

### Roles en la Base de Datos
Los roles están definidos como enum en PostgreSQL:
```sql
CREATE TYPE user_role AS ENUM (
  'athlete',
  'parent', 
  'coach',
  'school',
  'wellness_professional',
  'store_owner',
  'admin'
);
```

### Tabla de Perfiles
Cada usuario tiene un perfil en la tabla `profiles` con:
- `id`: UUID del usuario (referencia a auth.users)
- `full_name`: Nombre completo
- `role`: Rol del usuario (enum user_role)
- `avatar_url`: URL del avatar (opcional)
- `phone`: Teléfono (opcional)
- Otros campos específicos del rol

### Seguridad
- Las contraseñas se almacenan de forma segura (hash) en Supabase Auth
- Cada rol tiene políticas RLS específicas
- Los usuarios solo pueden ver/editar su propio perfil
