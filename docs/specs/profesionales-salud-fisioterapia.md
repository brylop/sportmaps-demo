# Spec — Profesionales de salud (foco: fisioterapia) de punta a punta en la app

**Estado:** F0–F3 construidas y **aplicadas** el 2026-10-06 (`20261006094145`, `…094147`, `…094149`); `npm run seguridad:rls-clinicas` 53/53 contra la base viva; cero I3 del módulo. Pendiente aplicar `20261006111003_profesionales_gates_i7` (copia `8_` en `docs/migraciones-para-aplicar-2026-10-06/`). F4 (cobro) y F5 (marketplace) pendientes.
**Roles:** `wellness_professional` (fisio, nutrición, psicología, medicina deportiva), atleta adulto, acudiente, coach, admin de escuela, super admin.
**Relacionado:** `profesionales-independientes-agentes-ia.md` (agentes de IA; este spec es su base operativa y lo antecede), `nutricion-atletas-independientes.md`, `tienda-v2-contrato-checkout.md` (cobro con cuentas conectadas), `docs/auditoria-seguridad-2026-08-14.md`.

**Meta:** que un fisioterapeuta (independiente o contratado por una escuela) pueda llevar **todo** su proceso dentro de SportMaps —pacientes, agenda, historia clínica legal, lesiones, ejercicios, cobro— y que, cuando el marketplace esté completo, el mismo módulo se abra al público sin rehacer nada.

---

## 1. Estado real (auditoría 2026-10-06, verificado contra la base viva)

**Conclusión: el módulo es una cáscara. Ningún tramo funciona de punta a punta.**

Datos vivos: 6 perfiles `wellness_professional` (3 sin `vendor_profiles`), 0 `health_records`, 0 `wellness_evaluations`, 1 `wellness_appointments` (demo), 2 `service_listings`, 0 `service_availability`, 0 `vendor_reviews`, `store_enabled() = false`.

### 1.1 Seguridad (base viva)

| # | Sev | Hallazgo |
|---|---|---|
| S1 | ALTA | `health_records`, `wellness_evaluations`, `wellness_appointments`: `FOR ALL` sin `WITH CHECK` (invariante **I3**, confirmado por `invariantes_seguridad()`). Un atleta puede fabricar una ficha clínica o una cita **confirmada** a nombre de cualquier profesional; un profesional puede escribir en la ficha de cualquier atleta sin relación alguna. |
| S2 | ALTA | El atleta tiene `UPDATE`/`DELETE` sobre su propia historia clínica. La Res. 1995/1999 exige anotaciones inmutables. |
| S3 | ALTA | `validate_appointment_no_overlap` es `SECURITY INVOKER`: corre con el RLS del que reserva, que solo ve sus propias citas → **no detecta choques con otros pacientes**. Sin lock: dos reservas simultáneas pasan. |
| S4 | MEDIA | `service_availability` y `service_variations`: `FOR ALL` sin `WITH CHECK` (I3, riesgo bajo: el USING es del dueño). |
| S5 | MEDIA | `POST /vendor/profile` (service role) aceptaba `vendor_type` del body sobre un perfil existente: el vendor cambiaba su propio tipo saltándose `fn_guard_vendor_profiles`. **Arreglado en esta rama.** |
| S6 | BAJA | Aviso de "documento de verificación subido" iba a `profiles.role in (admin, owner, super_admin)` (autoasignable) en vez de `platform_admins`. **Arreglado en esta rama.** |
| S7 | BAJA | `get_available_slots`: `search_path=public` sin `pg_catalog`/`pg_temp`. `/marketplace/services/:id` y `/slots` con service role no filtran por profesional verificado. |

### 1.2 Roturas funcionales

| Sev | Dónde | Qué pasa |
|---|---|---|
| CRÍTICA | `bff/src/routes/vendor-services.routes.ts:88-108` | Crear servicio falla (500): manda `subcategory, modality, target_audience, includes, requirements`, columnas de `20260520000001` que **no están aplicadas**. Variaciones insertadas sueltas, sin transacción. |
| CRÍTICA | `service_availability` | 0 filas y **ninguna pantalla** llama a `GET/PUT /vendor/availability`. Ningún profesional puede tener horarios → el modal de reserva siempre dice "no hay horarios". |
| CRÍTICA | `components/marketplace/ServiceBookingModal.tsx:147-165` | El insert manda `service_listing_id, price, payment_status, is_courtesy, booking_source`: columnas de `20260417000003`, **nunca aplicada**. Falla el 100 % de las reservas. |
| CRÍTICA | FK `athlete_id → profiles` | Los menores (`children`, 1.125 filas) no tienen `profiles`. **Ningún menor puede tener cita, evaluación ni ficha.** Es el caso principal en escuelas infantiles. |
| CRÍTICA | `marketplace-checkout.routes.ts:83`, `wompi.ts:550` | Checkout de servicios: gate `store_enabled` (503), y `create_service_checkout`, `marketplace_transactions`, `confirm_marketplace_payment` **no existen**. Además cobraría con el comercio de SportMaps, no con la cuenta del profesional. |
| ALTA | `pages/wellness/MyAppointmentsPage.tsx:89-109` | Pide columnas inexistentes y un embed por un FK que apunta a `auth.users`; cancelar escribe `cancelled_at` (no existe). La página siempre falla. |
| ALTA | `WellnessPatientsPage.tsx:39` + `EvaluationFormDialog.tsx:27-94` | "Nueva evaluación" manda `crypto.randomUUID()` como atleta (viola FK) y 7 de 8 tipos violan el `CHECK`. Nunca guarda. |
| ALTA | — | **No existe forma de agregar un paciente.** La lista sale de `health_records` (0 filas) y nada los crea. |
| ALTA | `App.tsx:917` | `/wellness-reports` apunta a `ReportsPage` (de escuela): spinner infinito sin `schoolId`. |
| MEDIA | `App.tsx:897-911` | `/evaluations/new` abre la agenda; `/follow-ups` duplica "Mis atletas". |
| MEDIA | `VendorAppointmentsPage.tsx` | Solo lectura: no hay confirmar, reprogramar, completar, no asistió. Sin datos de contacto. |
| MEDIA | `VendorDashboardPage.tsx:46-48` | "Citas recibidas" cuenta pedidos de productos; ingresos y rating fijos en el código. |
| MEDIA | `WellnessSchedulePage.tsx:23` | "Mañana" calculado en UTC (después de las 19:00 COL apunta a pasado mañana). |
| MEDIA | `MarketplacePage.tsx:144` | Los servicios van a un carrito que no los procesa. |
| MEDIA | `vendor_reviews` | La policy exige un pedido de producto `delivered`: los servicios no se pueden reseñar. |
| BAJA | varios | Botones sin `onClick` (Nuevo paciente, Ver ficha, Nueva cita, Nueva ficha, Exportar, Nutrición completa); nombres de paciente = 8 caracteres del UUID; "25 años" fijo; `lib/athlete/queries.ts:151` ordena por columna inexistente; `routePermissions.ts` no lo importa nadie; `WellnessPage.tsx` sin ruta. |
| — | notificaciones | Nadie recibe aviso de nueva cita, pago, cancelación ni recordatorio. |

### 1.3 Lo que sí funciona
Onboarding del profesional (`WellnessOnboarding.tsx`), verificación por el admin de plataforma (`marketplace-admin.routes.ts` + `AdminMarketplaceModerationPage`), descubrimiento en `/explorar` (solo verificados), `get_available_slots` (si hubiera horarios), trigger de auditoría de acceso en `health_records`.

---

## 2. Requisitos que no son opcionales (Colombia)

- **Res. 1995/1999 (historia clínica)** — anotaciones inmutables con fecha/hora, autor y tarjeta profesional; correcciones como **nota aclaratoria** (`addendum_of` + motivo), nunca `UPDATE`/`DELETE`. Identificación completa del paciente y del acudiente. Anexos forman parte de la historia. Custodia del **prestador**; conservación 15 años desde la última atención (Ley 2015/2020, Res. 839/2017). Registro de cada acceso. Copia al paciente cuando la pida.
- **Ley 1581/2012 + Dec. 1377/2013** — dato de salud = sensible: consentimiento previo, expreso, con finalidad, versionado (texto, fecha, quién, canal), revocable para usos no asistenciales.
- **Menores** — consentimiento del representante legal (acudiente vinculado), distinto del consentimiento informado del tratamiento.
- **Ley 528/1999** — tarjeta profesional / ReTHUS del fisio validada al verificarlo; secreto profesional limita lo que ven coach y escuela.
- **Códigos** — CIE-10 en diagnóstico (principal + relacionados); CUPS por procedimiento (P1); RIPS solo si factura a EPS/aseguradora (P2). Factura electrónica: ya existe Factus.

### 2.1 Quién ve qué

| Rol | Ve | No ve |
|---|---|---|
| Fisio tratante | Historia completa de **sus** pacientes en **su** práctica | Pacientes de otras prácticas (salvo remisión con consentimiento) |
| Otro profesional de la misma práctica | Lo que la práctica comparta (equipo clínico) | — |
| Coach | Estado de disponibilidad (`disponible / restringido / no_disponible`), restricción operativa en texto ("sin saltos") y fecha estimada de vuelta | Diagnóstico, CIE-10, notas, imágenes |
| Admin de escuela | Disponibilidad + métricas agregadas (lesiones por equipo, días perdidos) + cobros | Contenido clínico, aunque el fisio sea empleado (secreto profesional) |
| Acudiente | Resumen, plan, ejercicios, consentimientos, disponibilidad de su hijo; copia de la historia a pedido | Notas privadas del profesional |
| Atleta adulto | Su historia en solo lectura, ejercicios, disponibilidad | Editar nada |
| Super admin | Nada por defecto; soporte excepcional auditado | — |

Lo que ven coach y escuela sale por **RPC `SECURITY DEFINER` / vista de columnas publicables**, nunca por lectura sobre la tabla clínica (RLS filtra filas, no columnas).

---

## 3. Decisiones (cerradas 2026-10-06)

| # | Decisión | Resuelto así |
|---|---|---|
| D1 | **Custodio de la historia** | **El profesional (usuario)**, por decisión del usuario el 2026-10-06 (se descartó la "práctica = escuela con `school_type='professional'`"). Toda tabla clínica lleva `professional_id → profiles(id) ON DELETE RESTRICT` y el RLS es "solo el profesional". Si el fisio trabaja para una escuela, la historia sigue siendo suya: la escuela solo ve disponibilidad. Consecuencia: cobro dentro de la app (F4) no puede reutilizar `payments` por `school_id`; se diseña aparte. |
| D2 | **Paciente** | `clinical_patients` (una fila por paciente por profesional) con a lo sumo uno de `profile_id`, `child_id`, `unregistered_athlete_id`, o ninguno (externo). El vínculo con una cuenta solo lo ponen RPCs (invitación con vencimiento real, o reserva): el profesional no puede escribir `child_id` a mano (trigger `VINCULO_SOLO_POR_INVITACION`). |
| D3 | **Agenda** | `wellness_appointments` ampliada (`patient_id`, `child_id`, `booked_by`, precio, modalidad, estados con CHECK). Escribe solo el profesional; el cliente reserva (`request_service_appointment`, nace `pending`) y cancela (`cancel_my_appointment`) por RPC. Antisolapes `SECURITY DEFINER` + advisory lock. Disponibilidad en `service_availability` + `service_availability_exceptions`. Avisos in-app/push por trigger y recordatorio 24 h por pg_cron. |
| D4 | **Historia clínica** | `clinical_episodes`, `clinical_notes` (inmutables; corrección = `nota_aclaratoria` con `addendum_of` + motivo; autor y tarjeta profesional congelados al firmar), `clinical_diagnoses` (CIE-10 con formato validado + catálogo frecuente), `clinical_attachments` (bucket privado `clinical-files/<professional_id>/…`, sin borrar), `clinical_access_log`. Sin consentimientos `datos_sensibles` + `tratamiento` vigentes no se escribe nada clínico. `health_records` y `wellness_evaluations` (0 filas) congeladas en solo lectura. |
| D5 | **Consentimiento** | `clinical_consent_texts` versionados + `clinical_consents` (texto congelado, quién, relación, canal app o firma presencial con escaneo). Revocable; nunca se borra. `compartir_disponibilidad` es opcional y es la única puerta a lo que ve la escuela. |
| D6 | **Lesión y disponibilidad** | `athlete_injuries` + `athlete_injury_events` (historial). Coach y escuela leen solo `get_school_athlete_availability()` (estado, etapa, restricción, fecha estimada, zona general), con consentimiento vigente y matrícula activa en esa escuela. |
| D7 | **Ejercicios** | `exercise_library` (catálogo SportMaps + propios), `exercise_assignments`, `exercise_logs` (el atleta/acudiente marca "hecho" por RPC, ventana 7 días). |
| D8 | **Cobro y marketplace** | Sin checkout nuevo hasta F5. La reserva del marketplace crea la solicitud con precio de referencia; el pago se acuerda con el profesional. F5 usará cuentas conectadas del profesional (patrón tienda v2) con flag propio `services_marketplace_enabled`. |
| D9 | **Pruebas de cuentas desechables** | `purge_clinical_test_data()` (solo `service_role`, solo correos `@rls-pruebas-negativas.invalid`) es la única vía de borrado de historia; la usa `npm run seguridad:rls-clinicas`. |

---

## 4. Fases

Cada fase es una rama desde `develop`, con revisión entre fases. Migraciones nuevas por `npm run migrations:new`; nunca se editan `20260417000003` ni `20260520000001` (se re-hace lo necesario en migraciones nuevas e idempotentes).

### F0 — Seguridad y desbloqueo (sin modelo nuevo)
- Reemplazar las tres policies `FOR ALL` por policies por comando con `WITH CHECK`; quitar UPDATE/DELETE del atleta sobre lo clínico; el atleta/acudiente solo **lee** sus citas y cancela por RPC.
- `validate_appointment_no_overlap` → `SECURITY DEFINER` + `pg_advisory_xact_lock(professional_id, fecha)`.
- `service_availability` / `service_variations`: `WITH CHECK` explícito.
- `get_available_slots`: `search_path` fijo; solo profesionales verificados; no fechas pasadas; respeta `max_daily_slots`.
- Columnas faltantes de `service_listings` (las de `20260520000001`) para que crear servicio funcione.
- Front: `/wellness-reports` deja de usar `ReportsPage`; rutas `/evaluations/new` y `/follow-ups` corregidas; "mañana" en hora Colombia; `MyAppointmentsPage` contra el esquema vivo.
- Cierre: `npm run seguridad:invariantes` sin I3 en estas tablas.

### F1 — Pacientes y agenda
- Credenciales del profesional (tarjeta profesional, RETHUS, especialidad) en el onboarding.
- `clinical_patients` + pantalla **Pacientes**: buscar atleta de la escuela / hijo de un acudiente (invitación con consentimiento) / alta de paciente externo.
- Consentimientos versionados (datos sensibles + tratamiento; firma del acudiente si es menor) que **bloquean** abrir historia.
- Editor de disponibilidad semanal + excepciones (vacaciones, bloqueos).
- Agenda semanal real: crear cita para un paciente, confirmar, reprogramar, completar, no asistió, cancelar.
- Notificaciones (push in-app + correo) de cita nueva, cambio, cancelación y recordatorio 24 h.

### F2 — Historia clínica de fisioterapia
- Episodio de atención (motivo → alta).
- Valoración inicial: anamnesis, mecanismo, EVA 0-10, mapa corporal de dolor, goniometría (ROM), fuerza Daniels 0-5, pruebas especiales y funcionales.
- Diagnóstico CIE-10 con buscador; plan de tratamiento (objetivos, nº de sesiones, frecuencia).
- Nota SOAP por sesión enlazada a la cita, con EVA antes/después; addenda en vez de edición.
- Alta con resumen; adjuntos en bucket privado; PDF de la historia y del certificado de aptitud; registro de accesos.

### F3 — Lesiones, vuelta al juego y ejercicios
- Registro de lesiones y estado de disponibilidad con etapas de vuelta al juego.
- Badge "lesionado / restringido" en asistencia, listas de equipo y convocatorias (solo lo publicable).
- Vista del acudiente/atleta: plan, ejercicios, próximas citas.
- Programa de ejercicios en casa (biblioteca con video, series/reps/frecuencia) que el atleta marca como hecho.
- Alertas: atleta lesionado que reporta RPE alto en el post-entreno; proponer pausa de cobro `reason='injury'`.

### F4 — Cobro dentro de la app (pendiente; rediseñar por D1)
- Con custodio = profesional, el cobro no cuelga de una escuela: decidir si va por `marketplace` (cuentas conectadas del profesional) o por un libro propio del profesional. No crear un camino nº 14 de `payments` sin censarlo.
- Paquetes de sesiones (créditos) que se consumen al completar la cita.
- Dashboard de ingresos reales; factura electrónica del profesional.

### F5 — Apertura al público (marketplace)
- `book_service_appointment` + checkout con cuentas conectadas + webhook idempotente + reembolso según `cancellation_policy_hours`.
- Reseñas atadas a cita `completed`.
- Verificación con tarjeta profesional/ReTHUS obligatoria; re-verificación al cambiar datos sensibles.
- Modalidad virtual (enlace de videollamada), términos y política de cancelación visibles, flag `services_marketplace_enabled`.

---

## 5. QA por fase (se ejecuta, no se lista)

- **RLS negativas** (`npm run seguridad:rls-negativas` + casos nuevos): atleta no inserta ficha/cita a nombre de otro; profesional no escribe sobre paciente de otra práctica; coach no lee diagnóstico; nadie hace UPDATE/DELETE de una nota firmada.
- **Concurrencia**: dos reservas al mismo slot → una sola gana.
- **Invariantes**: `npm run seguridad:invariantes` limpio en las tablas tocadas.
- **Front**: `tsc`, build, recorrido por rol (profesional independiente, fisio de escuela, acudiente, atleta adulto, coach).
