# 🔌 API Specifications - SportMaps Backend

**Base URL:** `https://api.sportmaps.com/v1`
**Environment Variables Required:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EPAYCO_PUBLIC_KEY`
- `EPAYCO_PRIVATE_KEY`
- `EPAYCO_P_CUST_ID_CLIENTE`
- `EPAYCO_P_KEY`

**Autenticación:** Bearer token de Supabase en header `Authorization`

---

## 📑 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Escuelas (Schools)](#escuelas-schools)
3. [Estudiantes (Students)](#estudiantes-students)
4. [Programas (Programs)](#programas-programs)
5. [Clases (Classes)](#clases-classes)
6. [Inscripciones (Enrollments)](#inscripciones-enrollments)
7. [Pagos (Payments)](#pagos-payments)
8. [Asistencia (Attendance)](#asistencia-attendance)
9. [Comunicaciones (Communications)](#comunicaciones-communications)
10. [Marketplace](#marketplace)
11. [Dashboard & Analytics](#dashboard--analytics)

---

## 🔐 Autenticación

### POST `/auth/register`
Registrar nuevo usuario (escuela o padre).

**Request Body:**
```json
{
  "email": "admin@escuela.com",
  "password": "SecurePassword123!",
  "full_name": "Juan Pérez",
  "role": "school_admin",
  "school_name": "Academia Elite FC",
  "phone": "+57 300 1234567"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@escuela.com",
    "role": "school_admin"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  },
  "message": "Verification email sent"
}
```

**Errores:**
- `400`: Email ya existe
- `422`: Validación fallida

---

### POST `/auth/login`
Iniciar sesión.

**Request Body:**
```json
{
  "email": "admin@escuela.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@escuela.com",
    "role": "school_admin",
    "full_name": "Juan Pérez",
    "school_id": "uuid"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

---

### POST `/auth/reset-password`
Solicitar reseteo de contraseña.

**Request Body:**
```json
{
  "email": "admin@escuela.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset email sent"
}
```

---

### POST `/auth/demo-login`
Iniciar sesión en modo demo.

**Request Body:**
```json
{
  "demo_type": "school"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "demo_uuid",
    "email": "demo@sportmaps.com",
    "role": "school_admin",
    "is_demo": true
  },
  "session": {
    "access_token": "demo_jwt_token"
  }
}
```

---

## 🏫 Escuelas (Schools)

### POST `/schools`
Crear perfil de escuela (solo school_admin).

**Request Body:**
```json
{
  "name": "Academia Elite FC",
  "slug": "academia-elite-fc",
  "description": "Escuela de fútbol para niños...",
  "email": "contacto@academiaelite.com",
  "phone": "+57 300 1234567",
  "address": "Calle 123 #45-67",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "sports_offered": ["football", "basketball"],
  "operating_hours": {
    "monday": {"open": "08:00", "close": "20:00"},
    "tuesday": {"open": "08:00", "close": "20:00"}
  },
  "bank_name": "Banco Colombia",
  "bank_account_number": "1234567890",
  "nit": "900123456-7"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Academia Elite FC",
  "slug": "academia-elite-fc",
  "profile_completion_percentage": 60,
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### GET `/schools/:id`
Obtener detalles de una escuela.

**Query Params:**
- `include`: `programs,coaches,reviews` (opcional)

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Academia Elite FC",
  "slug": "academia-elite-fc",
  "description": "...",
  "logo_url": "https://...",
  "email": "contacto@...",
  "phone": "+57 300...",
  "address": "Calle 123...",
  "city": "Bogotá",
  "sports_offered": ["football"],
  "average_rating": 4.5,
  "total_reviews": 23,
  "total_students": 87,
  "programs": [...],
  "coaches": [...],
  "recent_reviews": [...]
}
```

---

### PUT `/schools/:id`
Actualizar perfil de escuela.

**Request Body:** (Campos opcionales)
```json
{
  "description": "Nueva descripción",
  "logo_url": "https://...",
  "phone": "+57 300 7654321",
  "is_public": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "updated_fields": ["description", "phone"],
  "profile_completion_percentage": 85
}
```

---

### PUT `/schools/:id/location`
Actualizar ubicación geográfica de escuela.

**Request Body:**
```json
{
  "latitude": 4.7110,
  "longitude": -74.0721
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "location": {
    "lat": 4.7110,
    "lng": -74.0721
  }
}
```

---

## 👥 Estudiantes (Students)

### GET `/schools/:school_id/students`
Listar estudiantes de una escuela.

**Query Params:**
- `page`: Número de página (default: 1)
- `per_page`: Resultados por página (default: 20, max: 100)
- `search`: Búsqueda por nombre o email de padre
- `status`: Filtrar por estado (`active`, `inactive`, `graduated`)
- `program_id`: Filtrar por programa inscrito
- `sort_by`: Campo para ordenar (`name`, `enrollment_date`, `age`)
- `sort_order`: `asc` o `desc`

**Response (200):**
```json
{
  "students": [
    {
      "id": "uuid",
      "first_name": "Santiago",
      "last_name": "García",
      "age": 10,
      "photo_url": "https://...",
      "parent_name": "María García",
      "parent_email": "maria@...",
      "status": "active",
      "enrollment_date": "2024-02-15",
      "active_programs": [
        {
          "id": "uuid",
          "name": "Fútbol Juvenil",
          "payment_status": "paid"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 87,
    "total_pages": 5
  }
}
```

---

### POST `/schools/:school_id/students`
Crear nuevo estudiante.

**Request Body:**
```json
{
  "first_name": "Santiago",
  "last_name": "García",
  "date_of_birth": "2014-05-20",
  "gender": "male",
  "parent_name": "María García",
  "parent_email": "maria.garcia@email.com",
  "parent_phone": "+57 301 2345678",
  "emergency_contact_name": "Pedro García",
  "emergency_contact_phone": "+57 302 3456789",
  "emergency_contact_relationship": "Padre",
  "medical_notes": "Alergia al maní",
  "photo_url": "https://..."
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "first_name": "Santiago",
  "last_name": "García",
  "age": 10,
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Errores:**
- `400`: Email de padre duplicado en la escuela
- `422`: Validación fallida

---

### GET `/students/:id`
Obtener detalles completos de un estudiante.

**Query Params:**
- `include`: `enrollments,payments,attendance` (opcional)

**Response (200):**
```json
{
  "id": "uuid",
  "first_name": "Santiago",
  "last_name": "García",
  "date_of_birth": "2014-05-20",
  "age": 10,
  "gender": "male",
  "photo_url": "https://...",
  "parent_name": "María García",
  "parent_email": "maria@...",
  "parent_phone": "+57 301...",
  "status": "active",
  "enrollments": [
    {
      "id": "uuid",
      "program_name": "Fútbol Juvenil",
      "enrollment_status": "confirmed",
      "payment_status": "paid",
      "monthly_amount": 220000,
      "start_date": "2024-02-15"
    }
  ],
  "attendance_summary": {
    "total_classes": 48,
    "present": 45,
    "absent": 3,
    "attendance_rate": 93.75
  },
  "payment_summary": {
    "total_paid": 2640000,
    "pending": 0,
    "next_payment_date": "2025-02-01"
  }
}
```

---

### PUT `/students/:id`
Actualizar información de estudiante.

**Request Body:** (Campos opcionales)
```json
{
  "parent_phone": "+57 301 9876543",
  "medical_notes": "Alergia al maní y al látex",
  "photo_url": "https://..."
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

### PATCH `/students/:id/status`
Cambiar estado de estudiante.

**Request Body:**
```json
{
  "status": "inactive",
  "reason": "Familia se mudó de ciudad"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "inactive",
  "status_changed_at": "2025-01-15T11:00:00Z"
}
```

---

### DELETE `/students/:id`
Eliminar estudiante (soft delete).

**Response (204):**
Sin contenido.

---

### POST `/schools/:school_id/students/bulk-import`
Importación masiva de estudiantes vía CSV.

**Request:**
```
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: archivo CSV

**Response (202):**
```json
{
  "job_id": "uuid",
  "status": "processing",
  "message": "Import started. You will be notified when complete."
}
```

---

### GET `/schools/:school_id/students/import-jobs/:job_id`
Verificar estado de importación.

**Response (200):**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "total_rows": 50,
  "successful": 48,
  "failed": 2,
  "errors": [
    {
      "row": 12,
      "error": "Email duplicado: juan@email.com"
    },
    {
      "row": 35,
      "error": "Fecha de nacimiento inválida"
    }
  ],
  "completed_at": "2025-01-15T11:05:00Z"
}
```

---

## 🎓 Programas (Programs)

### GET `/schools/:school_id/programs`
Listar programas de una escuela.

**Query Params:**
- `is_active`: `true` o `false`
- `sport_type`: Filtrar por deporte

**Response (200):**
```json
{
  "programs": [
    {
      "id": "uuid",
      "name": "Fútbol Juvenil (8-12 años)",
      "sport_type": "football",
      "skill_level": "intermediate",
      "min_age": 8,
      "max_age": 12,
      "monthly_fee": 220000,
      "current_enrollment": 34,
      "max_capacity": 40,
      "is_active": true
    }
  ]
}
```

---

### POST `/schools/:school_id/programs`
Crear nuevo programa.

**Request Body:**
```json
{
  "name": "Fútbol Juvenil (8-12 años)",
  "sport_type": "football",
  "skill_level": "intermediate",
  "min_age": 8,
  "max_age": 12,
  "description": "Programa enfocado en desarrollo técnico...",
  "monthly_fee": 220000,
  "enrollment_fee": 50000,
  "max_capacity": 40
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Fútbol Juvenil (8-12 años)",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### PUT `/programs/:id`
Actualizar programa.

**Request Body:** (Campos opcionales)
```json
{
  "monthly_fee": 240000,
  "max_capacity": 45,
  "is_active": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

### DELETE `/programs/:id`
Eliminar programa (solo si no tiene inscripciones activas).

**Response (204):**
Sin contenido.

**Errores:**
- `409`: Programa tiene inscripciones activas

---

## 📅 Clases (Classes)

### GET `/programs/:program_id/classes`
Listar horarios de clase de un programa.

**Response (200):**
```json
{
  "classes": [
    {
      "id": "uuid",
      "name": "Fútbol Juvenil - Grupo A",
      "day_of_week": "monday",
      "start_time": "16:00",
      "end_time": "17:30",
      "location": "Cancha 1",
      "coach": {
        "id": "uuid",
        "name": "Carlos Rodríguez"
      },
      "current_enrollment": 18,
      "max_capacity": 20
    }
  ]
}
```

---

### POST `/programs/:program_id/classes`
Crear nuevo horario de clase.

**Request Body:**
```json
{
  "name": "Fútbol Juvenil - Grupo A",
  "day_of_week": "monday",
  "start_time": "16:00",
  "end_time": "17:30",
  "location": "Cancha 1",
  "coach_id": "uuid",
  "max_capacity": 20
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Errores:**
- `409`: Conflicto de horario con entrenador

---

### PUT `/classes/:id`
Actualizar horario de clase.

**Request Body:** (Campos opcionales)
```json
{
  "coach_id": "uuid",
  "start_time": "17:00",
  "location": "Cancha 2"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

### DELETE `/classes/:id`
Eliminar clase.

**Response (204):**
Sin contenido.

---

## 📝 Inscripciones (Enrollments)

### POST `/students/:student_id/enrollments`
Inscribir estudiante en un programa.

**Request Body:**
```json
{
  "program_id": "uuid",
  "class_ids": ["uuid1", "uuid2"],
  "start_date": "2025-02-01",
  "payment_type": "automatic",
  "payment_method": "credit_card"
}
```

**Response (201):**
```json
{
  "enrollment_id": "uuid",
  "student_id": "uuid",
  "program_id": "uuid",
  "enrollment_status": "pending",
  "payment_status": "pending",
  "monthly_amount": 220000,
  "next_step": "payment",
  "payment_url": "https://checkout.epayco.co/..."
}
```

---

### GET `/enrollments/:id`
Obtener detalles de inscripción.

**Response (200):**
```json
{
  "id": "uuid",
  "student": {
    "id": "uuid",
    "name": "Santiago García"
  },
  "program": {
    "id": "uuid",
    "name": "Fútbol Juvenil"
  },
  "classes": [
    {
      "id": "uuid",
      "day": "monday",
      "time": "16:00-17:30"
    }
  ],
  "enrollment_status": "confirmed",
  "payment_status": "paid",
  "payment_type": "automatic",
  "monthly_amount": 220000,
  "next_payment_date": "2025-02-01",
  "start_date": "2025-01-15"
}
```

---

### PATCH `/enrollments/:id/cancel`
Cancelar inscripción.

**Request Body:**
```json
{
  "reason": "Cambio de horario familiar",
  "effective_date": "2025-02-01"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "enrollment_status": "cancelled",
  "cancelled_at": "2025-01-15T11:00:00Z"
}
```

---

## 💳 Pagos (Payments)

### POST `/payments/epayco/create`
Crear checkout de pago con ePayco.

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "amount": 220000,
  "description": "Inscripción Fútbol Juvenil - Santiago García",
  "parent_email": "maria@email.com",
  "parent_name": "María García",
  "tokenize_card": true
}
```

**Response (200):**
```json
{
  "checkout_url": "https://checkout.epayco.co/...",
  "transaction_id": "uuid",
  "reference": "SPORT-2025-001234"
}
```

---

### POST `/payments/epayco/webhook`
Webhook para recibir confirmación de ePayco.

**Request Body:** (Enviado por ePayco)
```json
{
  "x_ref_payco": "123456",
  "x_transaction_id": "78910",
  "x_amount": "220000",
  "x_currency_code": "COP",
  "x_transaction_state": "Aceptada",
  "x_signature": "hash..."
}
```

**Response (200):**
```json
{
  "status": "processed"
}
```

**Proceso interno:**
1. Verificar firma
2. Actualizar transaction a `paid`
3. Actualizar enrollment_status a `confirmed`
4. Generar recibo PDF
5. Enviar email con recibo
6. Crear notificación

---

### POST `/payments/manual/register`
Registrar pago manual (transferencia).

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "amount": 220000,
  "payment_method": "nequi",
  "proof_of_payment_url": "https://cloudinary.com/...",
  "notes": "Transferencia realizada el 15/01/2025"
}
```

**Response (201):**
```json
{
  "manual_payment_id": "uuid",
  "transaction_id": "uuid",
  "status": "pending_approval",
  "message": "Payment submitted for review. You will be notified within 24 hours."
}
```

---

### GET `/schools/:school_id/payments/pending`
Listar pagos manuales pendientes de aprobación.

**Response (200):**
```json
{
  "pending_payments": [
    {
      "id": "uuid",
      "student_name": "Santiago García",
      "parent_name": "María García",
      "parent_email": "maria@...",
      "amount": 220000,
      "payment_method": "nequi",
      "proof_of_payment_url": "https://...",
      "submitted_at": "2025-01-15T09:00:00Z",
      "notes": "Transferencia realizada..."
    }
  ]
}
```

---

### POST `/payments/manual/:payment_id/approve`
Aprobar pago manual.

**Request Body:**
```json
{
  "review_notes": "Comprobante verificado. Pago confirmado."
}
```

**Response (200):**
```json
{
  "payment_id": "uuid",
  "status": "approved",
  "enrollment_status": "confirmed",
  "message": "Payment approved. Parent and student notified."
}
```

**Proceso interno:**
1. Actualizar manual_payment a `paid`
2. Actualizar transaction a `paid`
3. Actualizar enrollment a `confirmed`
4. Generar recibo oficial PDF
5. Enviar email a padre
6. Crear notificación

---

### POST `/payments/manual/:payment_id/reject`
Rechazar pago manual.

**Request Body:**
```json
{
  "rejection_reason": "El número de cuenta no coincide con nuestros registros."
}
```

**Response (200):**
```json
{
  "payment_id": "uuid",
  "status": "rejected",
  "message": "Payment rejected. Parent notified."
}
```

**Proceso interno:**
1. Actualizar manual_payment a `rejected`
2. Actualizar enrollment a `payment_rejected`
3. Liberar cupo en programa
4. Enviar email a padre con razón
5. Crear notificación

---

### GET `/payments/transactions/:transaction_id/receipt`
Descargar recibo de pago en PDF.

**Response (200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="recibo-2025-001234.pdf"

[PDF Binary]
```

---

### POST `/payments/recurring/process`
Procesar facturación mensual recurrente (Cron job).

**Request Headers:**
```
X-Cron-Secret: secret_token
```

**Response (200):**
```json
{
  "job_id": "uuid",
  "total_enrollments": 250,
  "processed": 240,
  "successful": 235,
  "failed": 5,
  "failed_enrollments": [
    {
      "enrollment_id": "uuid",
      "student_name": "Juan López",
      "error": "Tarjeta expirada"
    }
  ],
  "total_collected": 52800000
}
```

---

### GET `/students/:student_id/payment-history`
Obtener historial de pagos de un estudiante.

**Query Params:**
- `start_date`: Fecha inicio (YYYY-MM-DD)
- `end_date`: Fecha fin
- `status`: Filtrar por estado

**Response (200):**
```json
{
  "payments": [
    {
      "id": "uuid",
      "date": "2025-01-01",
      "amount": 220000,
      "payment_method": "credit_card",
      "status": "paid",
      "description": "Mensualidad Enero 2025",
      "receipt_url": "/api/payments/transactions/uuid/receipt"
    }
  ],
  "summary": {
    "total_paid": 2640000,
    "total_pending": 0,
    "average_payment": 220000
  }
}
```

---

## ✅ Asistencia (Attendance)

### GET `/classes/:class_id/attendance`
Obtener lista de asistencia para una clase en una fecha específica.

**Query Params:**
- `date`: Fecha (YYYY-MM-DD, default: hoy)

**Response (200):**
```json
{
  "class": {
    "id": "uuid",
    "name": "Fútbol Juvenil - Grupo A",
    "date": "2025-01-15",
    "day_of_week": "monday",
    "time": "16:00-17:30"
  },
  "students": [
    {
      "student_id": "uuid",
      "name": "Santiago García",
      "photo_url": "https://...",
      "attendance_status": "present",
      "check_in_time": "15:55",
      "notes": null
    },
    {
      "student_id": "uuid2",
      "name": "Ana Martínez",
      "photo_url": "https://...",
      "attendance_status": "absent",
      "notes": "Enfermo"
    }
  ],
  "summary": {
    "total": 18,
    "present": 16,
    "absent": 2,
    "late": 0
  }
}
```

---

### POST `/classes/:class_id/attendance`
Marcar asistencia para múltiples estudiantes.

**Request Body:**
```json
{
  "date": "2025-01-15",
  "attendance_records": [
    {
      "student_id": "uuid1",
      "status": "present",
      "check_in_time": "15:55"
    },
    {
      "student_id": "uuid2",
      "status": "absent",
      "notes": "Enfermo"
    },
    {
      "student_id": "uuid3",
      "status": "late",
      "check_in_time": "16:15"
    }
  ]
}
```

**Response (201):**
```json
{
  "class_id": "uuid",
  "date": "2025-01-15",
  "records_created": 18,
  "marked_by": {
    "id": "uuid",
    "name": "Carlos Rodríguez"
  },
  "marked_at": "2025-01-15T16:00:00Z"
}
```

---

### PATCH `/attendance/:record_id`
Actualizar registro de asistencia individual.

**Request Body:**
```json
{
  "status": "excused",
  "notes": "Justificado por cita médica"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "excused",
  "updated_at": "2025-01-15T17:00:00Z"
}
```

---

### GET `/students/:student_id/attendance-history`
Obtener historial de asistencia de un estudiante.

**Query Params:**
- `start_date`: Fecha inicio
- `end_date`: Fecha fin
- `program_id`: Filtrar por programa

**Response (200):**
```json
{
  "student": {
    "id": "uuid",
    "name": "Santiago García"
  },
  "period": {
    "start": "2024-08-01",
    "end": "2025-01-15"
  },
  "summary": {
    "total_classes": 68,
    "present": 64,
    "absent": 3,
    "late": 1,
    "attendance_rate": 94.12
  },
  "records": [
    {
      "date": "2025-01-15",
      "class_name": "Fútbol Juvenil",
      "status": "present",
      "check_in_time": "15:55"
    }
  ]
}
```

---

### POST `/classes/:class_id/generate-qr`
Generar código QR para check-in de clase.

**Request Body:**
```json
{
  "date": "2025-01-15",
  "expiration_minutes": 120
}
```

**Response (200):**
```json
{
  "qr_code_url": "https://...",
  "qr_code_data": "SPORTMAPS-CLASS-uuid-20250115-hash",
  "expires_at": "2025-01-15T18:00:00Z",
  "session_id": "uuid"
}
```

---

### POST `/attendance/qr-checkin`
Registrar asistencia vía escaneo de QR.

**Request Body:**
```json
{
  "qr_code_data": "SPORTMAPS-CLASS-uuid-20250115-hash",
  "student_id": "uuid"
}
```

**Response (200):**
```json
{
  "attendance_record_id": "uuid",
  "status": "present",
  "check_in_time": "15:55",
  "message": "Asistencia registrada exitosamente"
}
```

**Errores:**
- `410`: QR code expirado
- `409`: Ya registró asistencia para esta clase
- `404`: Sesión QR no válida

---

## 💬 Comunicaciones (Communications)

### POST `/notifications`
Crear notificación para un usuario.

**Request Body:**
```json
{
  "user_id": "uuid",
  "type": "payment_confirmation",
  "title": "Pago confirmado",
  "body": "Tu pago de $220,000 fue procesado exitosamente",
  "data": {
    "transaction_id": "uuid",
    "amount": 220000
  },
  "deep_link": "/payments/uuid",
  "send_push": true
}
```

**Response (201):**
```json
{
  "notification_id": "uuid",
  "sent_at": "2025-01-15T16:00:00Z",
  "delivery_status": "sent"
}
```

---

### GET `/users/:user_id/notifications`
Listar notificaciones de un usuario.

**Query Params:**
- `unread_only`: `true` o `false`
- `page`: Número de página
- `per_page`: Resultados por página

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "payment_confirmation",
      "title": "Pago confirmado",
      "body": "Tu pago fue procesado...",
      "is_read": false,
      "created_at": "2025-01-15T16:00:00Z",
      "deep_link": "/payments/uuid"
    }
  ],
  "unread_count": 3,
  "pagination": {
    "page": 1,
    "total": 25
  }
}
```

---

### PATCH `/notifications/:id/mark-read`
Marcar notificación como leída.

**Response (200):**
```json
{
  "id": "uuid",
  "is_read": true,
  "read_at": "2025-01-15T16:05:00Z"
}
```

---

### POST `/schools/:school_id/announcements`
Crear anuncio para la escuela.

**Request Body:**
```json
{
  "title": "Vacaciones de Semana Santa",
  "body": "Les informamos que la escuela estará cerrada del 10 al 14 de abril.",
  "image_url": "https://...",
  "audience": "all_parents",
  "is_pinned": true,
  "publish_at": "2025-03-01T08:00:00Z",
  "expires_at": "2025-04-15T00:00:00Z"
}
```

**Response (201):**
```json
{
  "announcement_id": "uuid",
  "created_at": "2025-01-15T16:00:00Z",
  "recipients_count": 87
}
```

---

### GET `/schools/:school_id/announcements`
Listar anuncios de la escuela.

**Query Params:**
- `active_only`: `true` (solo no expirados)

**Response (200):**
```json
{
  "announcements": [
    {
      "id": "uuid",
      "title": "Vacaciones de Semana Santa",
      "body": "...",
      "is_pinned": true,
      "published_at": "2025-03-01T08:00:00Z",
      "expires_at": "2025-04-15T00:00:00Z"
    }
  ]
}
```

---

### POST `/messages`
Enviar mensaje directo.

**Request Body:**
```json
{
  "recipient_id": "uuid",
  "school_id": "uuid",
  "subject": "Consulta sobre horarios",
  "body": "Hola, quisiera saber si es posible cambiar...",
  "attachments": ["https://..."]
}
```

**Response (201):**
```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "sent_at": "2025-01-15T16:00:00Z"
}
```

---

### GET `/conversations/:conversation_id`
Obtener hilo de conversación.

**Response (200):**
```json
{
  "conversation_id": "uuid",
  "participants": [
    {
      "id": "uuid",
      "name": "María García",
      "role": "parent"
    },
    {
      "id": "uuid",
      "name": "Carlos Rodríguez",
      "role": "coach"
    }
  ],
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "body": "Hola, quisiera...",
      "is_read": true,
      "sent_at": "2025-01-15T16:00:00Z"
    }
  ]
}
```

---

## 🔍 Marketplace

### GET `/marketplace/schools`
Buscar escuelas en el marketplace.

**Query Params:**
- `search`: Búsqueda por nombre o ubicación
- `city`: Filtrar por ciudad
- `sport_type`: Filtrar por deporte (array)
- `min_age`: Edad mínima del hijo
- `max_age`: Edad máxima
- `min_price`: Precio mínimo
- `max_price`: Precio máximo
- `min_rating`: Rating mínimo
- `lat`: Latitud (para búsqueda por distancia)
- `lng`: Longitud
- `radius_km`: Radio en kilómetros
- `sort_by`: `distance`, `rating`, `price`, `recent`
- `page`: Número de página

**Response (200):**
```json
{
  "schools": [
    {
      "id": "uuid",
      "name": "Academia Elite FC",
      "slug": "academia-elite-fc",
      "logo_url": "https://...",
      "city": "Bogotá",
      "sports_offered": ["football"],
      "price_range": {
        "min": 180000,
        "max": 280000
      },
      "average_rating": 4.5,
      "total_reviews": 23,
      "distance_km": 2.5,
      "location": {
        "lat": 4.7110,
        "lng": -74.0721
      }
    }
  ],
  "filters_applied": {
    "city": "Bogotá",
    "sport_type": ["football"],
    "radius_km": 5
  },
  "pagination": {
    "page": 1,
    "total": 45
  }
}
```

---

### GET `/marketplace/schools/:slug`
Obtener perfil público de escuela por slug.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Academia Elite FC",
  "slug": "academia-elite-fc",
  "description": "...",
  "logo_url": "https://...",
  "cover_image_url": "https://...",
  "photos": ["https://...", "https://..."],
  "contact": {
    "email": "contacto@...",
    "phone": "+57 300...",
    "address": "Calle 123...",
    "city": "Bogotá"
  },
  "location": {
    "lat": 4.7110,
    "lng": -74.0721
  },
  "sports_offered": ["football"],
  "programs": [
    {
      "name": "Fútbol Infantil",
      "age_range": "4-7 años",
      "monthly_fee": 180000,
      "available_spots": 5
    }
  ],
  "facilities": ["Cancha de césped", "Vestuarios"],
  "coaches": [
    {
      "name": "Carlos Rodríguez",
      "experience_years": 10,
      "specialties": ["Porteros"]
    }
  ],
  "rating": {
    "average": 4.5,
    "total_reviews": 23,
    "breakdown": {
      "5_stars": 15,
      "4_stars": 6,
      "3_stars": 2,
      "2_stars": 0,
      "1_star": 0
    }
  },
  "recent_reviews": [...]
}
```

---

### POST `/marketplace/schools/:school_id/reviews`
Crear reseña de una escuela (solo padres con hijos inscritos).

**Request Body:**
```json
{
  "overall_rating": 5,
  "coaches_rating": 5,
  "facilities_rating": 4,
  "communication_rating": 5,
  "title": "Excelente escuela",
  "body": "Mi hijo ha mejorado muchísimo desde que entramos a la academia..."
}
```

**Response (201):**
```json
{
  "review_id": "uuid",
  "created_at": "2025-01-15T16:00:00Z",
  "is_verified": true
}
```

**Errores:**
- `403`: Usuario no es padre o no tiene hijos inscritos en esta escuela
- `409`: Ya existe reseña de este padre para esta escuela

---

### POST `/marketplace/leads`
Capturar lead de prospecto interesado.

**Request Body:**
```json
{
  "school_id": "uuid",
  "parent_name": "Laura Ramírez",
  "email": "laura@email.com",
  "phone": "+57 301 5555555",
  "child_age": 6,
  "message": "Quisiera más información sobre el programa de fútbol infantil",
  "source": "marketplace",
  "utm_source": "google",
  "utm_campaign": "fútbol_bogotá"
}
```

**Response (201):**
```json
{
  "lead_id": "uuid",
  "message": "Thank you! The school will contact you within 24 hours."
}
```

---

## 📊 Dashboard & Analytics

### GET `/schools/:school_id/dashboard`
Obtener métricas del dashboard de escuela.

**Query Params:**
- `period`: `today`, `week`, `month`, `year` (default: `month`)

**Response (200):**
```json
{
  "school": {
    "id": "uuid",
    "name": "Academia Elite FC"
  },
  "stats": {
    "active_students": 87,
    "active_programs": 4,
    "active_enrollments": 102,
    "monthly_revenue": 17800000,
    "pending_revenue": 440000,
    "attendance_rate": 94.5,
    "collection_rate": 98.5
  },
  "revenue_trend": [
    {
      "month": "2024-08",
      "revenue": 15200000
    },
    {
      "month": "2024-09",
      "revenue": 16400000
    }
  ],
  "recent_activity": [
    {
      "type": "new_enrollment",
      "message": "Santiago García inscrito en Fútbol Juvenil",
      "timestamp": "2025-01-15T15:30:00Z"
    },
    {
      "type": "payment_received",
      "message": "Pago recibido: $220,000 - María García",
      "timestamp": "2025-01-15T14:00:00Z"
    }
  ],
  "upcoming_classes": [
    {
      "class_name": "Fútbol Juvenil - Grupo A",
      "time": "16:00",
      "students_count": 18,
      "coach": "Carlos Rodríguez"
    }
  ]
}
```

---

### GET `/parents/:parent_id/dashboard`
Obtener dashboard para padres.

**Response (200):**
```json
{
  "parent": {
    "id": "uuid",
    "name": "María García"
  },
  "children": [
    {
      "id": "uuid",
      "name": "Santiago García",
      "age": 10,
      "photo_url": "https://...",
      "enrollments": [
        {
          "program_name": "Fútbol Juvenil",
          "next_class": {
            "day": "monday",
            "time": "16:00",
            "location": "Cancha 1"
          },
          "attendance_rate": 94.5,
          "payment_status": "paid",
          "next_payment_date": "2025-02-01",
          "next_payment_amount": 220000
        }
      ]
    }
  ],
  "recent_notifications": [
    {
      "title": "Pago confirmado",
      "body": "...",
      "created_at": "2025-01-15T16:00:00Z"
    }
  ],
  "upcoming_payments": [
    {
      "student_name": "Santiago García",
      "amount": 220000,
      "due_date": "2025-02-01"
    }
  ]
}
```

---

### GET `/schools/:school_id/reports/financial`
Generar reporte financiero.

**Query Params:**
- `start_date`: Fecha inicio (YYYY-MM-DD)
- `end_date`: Fecha fin
- `program_id`: Filtrar por programa (opcional)
- `format`: `json` o `pdf`

**Response (200 - JSON):**
```json
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "summary": {
    "total_revenue": 180000000,
    "total_transactions": 1024,
    "average_transaction": 175781,
    "collection_rate": 97.8
  },
  "by_program": [
    {
      "program_id": "uuid",
      "program_name": "Fútbol Juvenil",
      "revenue": 90000000,
      "students": 34,
      "average_per_student": 2647058
    }
  ],
  "by_payment_method": {
    "credit_card": 120000000,
    "nequi": 40000000,
    "bank_transfer": 20000000
  },
  "outstanding_balance": 4000000,
  "overdue_payments": [
    {
      "student_name": "...",
      "amount": 220000,
      "days_overdue": 15
    }
  ]
}
```

**Response (200 - PDF):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="reporte-financiero-2024.pdf"

[PDF Binary]
```

---

### GET `/schools/:school_id/reports/enrollment-analytics`
Analítica de inscripciones y retención.

**Query Params:**
- `period`: `month`, `quarter`, `year`

**Response (200):**
```json
{
  "enrollment_trend": [
    {
      "month": "2024-01",
      "new_enrollments": 12,
      "cancellations": 2,
      "net_growth": 10
    }
  ],
  "retention": {
    "rate": 92.5,
    "avg_duration_months": 9.5
  },
  "churn_analysis": {
    "total_churned": 8,
    "churn_rate": 7.5,
    "reasons": [
      {"reason": "Mudanza", "count": 3},
      {"reason": "Problemas económicos", "count": 2},
      {"reason": "Cambio de horario", "count": 2},
      {"reason": "Otro", "count": 1}
    ]
  },
  "at_risk_students": [
    {
      "student_id": "uuid",
      "name": "Juan López",
      "risk_factors": ["low_attendance", "late_payments"],
      "risk_score": 75
    }
  ]
}
```

---

## 🛡️ Manejo de Errores

Todos los endpoints retornan errores en el siguiente formato:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Student with ID 'abc123' not found",
    "status": 404,
    "timestamp": "2025-01-15T16:00:00Z",
    "path": "/api/students/abc123"
  }
}
```

### Códigos de Error Comunes:

| Status | Code | Descripción |
|:---:|:---|:---|
| 400 | VALIDATION_ERROR | Error de validación en los datos enviados |
| 401 | UNAUTHORIZED | Token de autenticación inválido o ausente |
| 403 | FORBIDDEN | Usuario no tiene permisos para esta acción |
| 404 | RESOURCE_NOT_FOUND | Recurso solicitado no existe |
| 409 | CONFLICT | Conflicto (ej. duplicado, capacidad llena) |
| 422 | UNPROCESSABLE_ENTITY | Datos válidos pero lógicamente incorrectos |
| 429 | TOO_MANY_REQUESTS | Rate limit excedido |
| 500 | INTERNAL_SERVER_ERROR | Error interno del servidor |
| 503 | SERVICE_UNAVAILABLE | Servicio temporalmente no disponible |

---

## 🔒 Rate Limiting

- **Rate Limits:**
  - Endpoints públicos: 100 requests/minuto
  - Endpoints autenticados: 300 requests/minuto
  - Webhooks: Sin límite

- **Headers de respuesta:**
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 285
X-RateLimit-Reset: 1642253400
```

---

## 📡 Webhooks

### Configurar Webhook de Escuela

```
POST /schools/:school_id/webhooks
```

**Request Body:**
```json
{
  "url": "https://mi-sistema.com/webhook",
  "events": ["enrollment.created", "payment.received"],
  "secret": "webhook_secret_key"
}
```

### Eventos Disponibles:

- `enrollment.created`
- `enrollment.confirmed`
- `enrollment.cancelled`
- `payment.received`
- `payment.failed`
- `attendance.marked`
- `student.created`

### Formato de Payload:

```json
{
  "event": "payment.received",
  "timestamp": "2025-01-15T16:00:00Z",
  "data": {
    "transaction_id": "uuid",
    "amount": 220000,
    "student_id": "uuid"
  },
  "signature": "hmac_sha256_signature"
}
```

---

## 🧪 Ambiente de Testing

**Base URL Sandbox:** `https://api-sandbox.sportmaps.com/v1`

- Usa tarjetas de prueba de ePayco
- Datos demo disponibles
- No se envían emails reales (logged)
- No se procesan pagos reales

---

## 📚 SDKs Disponibles

- **JavaScript/TypeScript:** `@sportmaps/sdk-js`
- **Python:** `sportmaps-sdk`
- **React Hooks:** `@sportmaps/react`

---

## 🆘 Soporte

- **Documentación:** https://docs.sportmaps.com
- **Email:** developers@sportmaps.com
- **Status Page:** https://status.sportmaps.com

---

**Versión:** 1.0.0
**Última Actualización:** Enero 2025
