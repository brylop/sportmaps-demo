# Ecosistema: entrenadores y profesionales de bienestar

**Fecha:** 2026-10-14 · **Estado:** investigación estratégica. No incluye código ni decisiones cerradas.
**Roles:** `coach` (entrenador de escuela), `personal_trainer` (entrenador independiente) y `wellness_professional` (fisioterapia, nutrición, psicología deportiva).
**Regla de honestidad:** nada de lo que aquí se propone vender puede anunciarse antes de que exista y funcione de punta a punta.

---

## A. Inventario: qué existe hoy en el repo

Leyenda: **VIVO** = pantalla con backend real · **PARCIAL** = existe pero tiene huecos o depende de algo sin terminar · **SOLO SPEC** = solo hay documento, sin código.

### A.1 `coach` (entrenador de escuela)

Menú en `frontend/src/config/navigation.ts:390`. El coach no paga: su acceso cuelga del plan de la escuela.

| Función | Estado | Dónde |
|---|---|---|
| Sesiones de entrenamiento + periodización (mesociclo / microciclo / carga) | VIVO. El frontend va directo a Supabase, sin BFF | `pages/TrainingPlansPage.tsx`, migración `20260831160936`, RPC `create_mesocycle_with_weeks` |
| Pizarra táctica 2D (F1) | VIVO solo para fútbol: `isFootballTeam` la bloquea en los demás deportes | `TacticalBoard.tsx` (en main desde 09-25) |
| Pizarra multideporte + 3D + IA | PARCIAL: está en ramas `pizarra-tp/*`, nada en develop | `docs/specs/pizarra-multideporte-3d-ia.md` |
| Asistencia (supervisión + escaneo de QR) | VIVO | `/coach-attendance`, `CoachCheckInScanPage.tsx`, `bff/src/routes/attendance.ts` |
| Asistencia sin señal (offline) | SOLO SPEC (ola 2 del rediseño V2) | `docs/ROADMAP.md:60` |
| Reportes del coach + reporte post-entreno del equipo | VIVO | `CoachReportsPage.tsx`, `CoachTeamPostTrainingReportPage.tsx` |
| Autoevaluación post-entreno del atleta | VIVO, pero solo el 4 % la usa | `docs/specs/evaluacion-post-entrenamiento.md` |
| Informe mensual (el coach escribe y la escuela publica) | VIVO con fricción: en Besser quedaron 32 borradores sin nota del coach | `/informe-mensual`, `docs/specs/athlete-reports-module.md` |
| Partidos y evaluación por jugador | PARCIAL: F1 (base de datos) aplicada; F2 (BFF) pendiente | `docs/specs/partidos-registro-y-evaluacion-por-jugador.md` |
| Rutinas, dotación, resultados, encuestas, calendario | VIVO | `/school/routines`, `/coach/dotacion`, `/results`, `/dashboard/polls` |
| "Mis Planes": disponibilidad del coach para que le reserven | VIVO; la escuela lo puede apagar por módulo | `CoachPlansPage.tsx`, `session-bookings.ts` |
| Disponibilidad médica (semáforo de lesionados) | VIVO, lectura por RPC con consentimiento | `/disponibilidad-medica` → `SchoolAvailabilityPage.tsx` |
| Mensajes / Anuncios | ROTO según la auditoría del 08-31 (`project_dead_modules_roles_audit`) | `/messages`, `/announcements` |
| Matriz de permisos | El único control real está en el BFF. `routePermissions.ts` y `requirePermission` son código muerto | `docs/coach-athlete-scoping.md` |

**Registro:** `RegisterPage` / `OnboardingRolePage` → `/onboarding/coach` (`CoachOnboarding.tsx`, 57 líneas). Es un asistente de perfil y certificaciones (`coach_profiles`) y nada más. **Si el coach se registra sin invitación de una escuela, llega a un dashboard vacío.**

### A.2 `personal_trainer` (entrenador independiente)

Funciona como una **micro-escuela propia** (`school_type='personal_trainer'`): el entrenador queda como `owner` y reutiliza los cobros de escuela. Rutas en `App.tsx:1062-1074`; BFF en `bff/src/routes/trainer/*` (unos 70 endpoints).

| Función | Estado | Dónde |
|---|---|---|
| Onboarding por pasos (perfil, deporte, tarifa, modalidad) | VIVO | `TrainerOnboarding.tsx` + `trainer/onboarding.ts` |
| Clientes: ficha, metas, estadísticas, medidas corporales, progreso, invitaciones | VIVO | `TrainerClients.tsx`, `TrainerClientProfile.tsx` + `tabs/`, `trainer/clients.ts` |
| Rutinas y planes de sesión, con catálogo de ejercicios (wger) | VIVO | `TrainerRoutines.tsx`, `TrainerRoutineDetail.tsx`, `BlockBuilder.tsx`, `trainer/wger.ts` |
| El atleta ejecuta la sesión y registra sus resultados | VIVO | `components/athlete/SessionExecution.tsx`, `/session-exercise-results` |
| Disponibilidad y sesiones (asistencia, no-show) | VIVO | `TrainerAvailability.tsx`, `trainer/availability.ts` |
| Planes y Pagos | VIVO por reutilización: son envoltorios de 21 líneas sobre `OfferingsPage` y `PaymentsAutomationPage`; la UI está pensada para escuela | `TrainerPlans.tsx`, `TrainerPayments.tsx` |
| Perfil público `/entrenador/:userId` | VIVO | `TrainerPublicProfile.tsx`, `TrainerProfileEditor.tsx` |
| Biomecánica (capturas, anotaciones, líneas base) | PARCIAL: el BFF existe (`trainer/biomech.ts`) y no encontré la pantalla del entrenador que lo use | — |
| Facturación del plan propio | **INCOHERENTE:** `/mi-plan` muestra los planes de academia (`ACADEMY_TIERS`: Start, Crecimiento…) y no "Coach Pro" | `MiPlanPage.tsx:131,210` |
| WhatsApp IA para el entrenador | Sin evidencia. El canal está atado a la escuela y a un número conectado en Meta; hoy ningún club está conectado | `project_whatsapp_ai_channel` |
| CRM + 4 agentes de IA | SOLO SPEC | `docs/specs/profesionales-independientes-agentes-ia.md` |

**Riesgo conocido:** `profile.role = personal_trainer` se impone sobre la membresía de escuela (`AppSidebar.tsx`, alrededor de la línea 60). Un entrenador que también es coach de un club ve solo un menú.

### A.3 `wellness_professional` (fisioterapia, nutrición, psicología)

La auditoría del 06-10 lo encontró como "una cáscara". **F0 a F3 se aplicaron el 2026-10-06** (`20261006094145/47/49` + `…111003_gates_i7`; `rls-clinicas` 53/53). El custodio de la historia clínica es el profesional, no una escuela.

| Función | Estado | Dónde |
|---|---|---|
| Onboarding + verificación por el administrador de plataforma | VIVO | `WellnessOnboarding.tsx`, `marketplace-admin.routes.ts` |
| Pacientes: atleta de escuela, hijo invitado por el acudiente o paciente externo | VIVO (F1) | `/pacientes` → `pages/clinical/PatientsPage.tsx`, `lib/clinical/api.ts` |
| Consentimientos versionados (Ley 1581; el acudiente firma por el menor) | VIVO (F1) | `ClinicalInviteAcceptPage.tsx` |
| Agenda, disponibilidad y excepciones; recordatorio de 24 h | VIVO (F1) | `/schedule`, `/disponibilidad` |
| Historia clínica: episodios, notas SOAP inmutables, CIE-10, adjuntos, PDF | VIVO (F2) | `PatientDetailPage.tsx`, `PatientRecordPrintPage.tsx` |
| Lesiones, vuelta al juego, ejercicios en casa, vista del acudiente | VIVO (F3) | `/historias`, `/salud` (`MyHealthPage.tsx`) |
| Reportes del profesional | VIVO | `ProfessionalReportsPage.tsx` |
| **Cobro dentro de la app (F4)** | **NO EXISTE.** Hay que rediseñarlo sin `school_id` | spec §4 F4 |
| **Reserva y pago desde el marketplace (F5)** | **NO EXISTE.** `store_enabled=false`; el checkout de servicios no existe | spec §4 F5 |
| Nutrición | SOLO SPEC. `NutritionPage.tsx` es una maqueta | `docs/specs/nutricion-atletas-independientes.md` |
| Psicología con formularios propios | No existe. Hoy se usa la misma historia clínica genérica | — |
| Videoconsulta | No existe | — |
| Plan del profesional (Wellness Pro) | No existe el cobro. Con `canManagePlan` en falso, `/mi-plan` no le aplica | `MiPlanPage.tsx:188` |

Datos de la auditoría del 06-10: había 6 perfiles `wellness_professional` y ningún uso clínico real. Hoy no hay datos de adopción posteriores a F3.

---

## B. Landing: lo que promete frente a lo que la app entrega

Fuente: `Landing_page/.../frontend/src/components/common/cards/RolePricingSection.tsx:252-363`, `pages/Entrenadores.tsx`, `pages/Bienestar.tsx` y `components/modules/BienestarModule.tsx`. El archivo `config/saas-plans.ts` cubre solo academias.

### B.1 Precios publicados (COP/mes, mensual / anual)

| Rol | Gratis | Pro | Superior |
|---|---|---|---|
| Entrenadores | Free Coach: perfil verificado, mensajes, 5 clientes, directorio | **Coach Pro $99.000 / $79.000:** 50 clientes, agenda online y pagos integrados, rutinas, WhatsApp IA, cartera | Coach Elite $199.000 / $169.000: ilimitados, web personal + "marketing ads", analítica avanzada, soporte prioritario |
| Bienestar | Free Wellness: perfil, mapa, solicitudes, 5 pacientes/mes | **Wellness Pro $149.000 / $119.000:** agenda, historia clínica, WhatsApp IA, **pagos integrados** ("Reemplaza Doctoralia + agenda + cobranza") | Clínica $379.000 / $319.000: multiprofesional, multisede, roles por especialidad, consentimiento del acudiente |

### B.2 Promesas que hoy no se cumplen

| Promesa | Gravedad | Realidad |
|---|---|---|
| Bienestar: "200+ profesionales certificados", "1.500+ consultas mensuales", "98 % de satisfacción", "10K+ consultas", "99,9 % de confianza" | **CRÍTICA** | Cifras inventadas. A 06-10 había 6 perfiles y ningún uso clínico real. |
| Bienestar: "Nuestro equipo de profesionales" (Dr. Carlos Rodríguez, Dra. Ana Martínez, Lic. Miguel Santos, con ratings y número de consultas) | **CRÍTICA** | Personas ficticias presentadas como reales: es testimonio fabricado. |
| Consulta virtual con "videollamada HD" y monitoreo con wearables | ALTA | No existen. |
| "Cumplimiento normativo internacional", "encriptación avanzada" | MEDIA | Lo verificable es la Res. 1995 y la Ley 1581 (Colombia). No hay certificación internacional. |
| Wellness Pro: "pagos integrados" | ALTA | F4 y F5 no existen; el pago se acuerda por fuera. |
| Wellness y Coach: "WhatsApp IA: confirmaciones y citas / agendamiento" | ALTA | No hay agente de WhatsApp para profesionales ni para entrenadores independientes (solo spec). |
| Clínica: multiprofesional, multisede, roles por especialidad | ALTA | Por la decisión D1 el custodio es individual. No existe el equipo clínico compartido. |
| Coach Elite: "web personal + marketing ads", "analítica avanzada" | MEDIA | Hay perfil público. No hay web propia, ni anuncios, ni analítica avanzada. |
| Entrenadores: "biblioteca con videos demostrativos" | MEDIA | Hay catálogo wger, sin biblioteca de video propia. |
| "Soporte técnico 24/7" | MEDIA | No hay operación 24/7. |
| Coach Pro $99.000 / Wellness Pro $149.000 | ALTA | La app no puede cobrar esos planes: el entrenador ve tiers de academia y el profesional no ve ninguno. |
| Coach Pro: "agenda online y pagos integrados", "rutinas", "cartera" | OK | Existen en la micro-escuela, aunque con UI de escuela. |
| Bienestar: agenda + historia clínica + consentimiento del acudiente | OK | Existen desde F1 a F3. Es lo más defendible del rol. |

**Ambigüedad de nombre:** la landing llama "Entrenadores" al `personal_trainer`, pero `Entrenadores.tsx` describe funciones del coach de escuela (periodización, dashboard de grupo). El coach de escuela no paga.

---

## C. Competidores (consulta web del 2026-10-14)

C = CONFIRMADO en la URL citada · NC = NO CONFIRMADO. No hay precios inventados.

### C.1 Entrenador personal

| Competidor | Precio | Gratis | Pagos | WhatsApp | Quejas |
|---|---|---|---|---|---|
| Trainerize ([pricing](https://www.trainerize.com/pricing/)) | C: Grow USD 9 (2 clientes); Pro desde USD 23 (5–200); Studio Plus desde USD 248. El FAQ de la misma página dice 10 y 25 | C: 1 cliente | C: Stripe, adicional de USD 10/mes | No lo menciona | NC: el precio sube por cantidad de clientes; interfaz anticuada |
| TrueCoach ([pricing](https://truecoach.co/pricing/)) | C: USD 26,34 (5) / 57,99 (20) / 136,99 (50) | C: no, prueba de 14 días | C: Stripe, "sin cargos adicionales" | No lo menciona | NC: precio por tramos, app del coach limitada (Capterra 4,8) |
| Harbiz ([ayuda oficial](https://intercom.help/harbiz-help/es/articles/14121350-planes-y-precios-de-harbiz-que-incluye-cada-tarifa)) | C: Basic €19–99; Pro €119–349, sin IVA; sin COP | C: no, prueba de 14 días | NC | C: solo soporte (plan Pro) | NC |
| WodApp ([wodapp.co](https://wodapp.co/)) | C: no publica precios; prueba de 10 días | — | NC | NC | NC |

### C.2 Coaches de academias y clubes

| Competidor | Precio | Pagos | WhatsApp | Quejas |
|---|---|---|---|---|
| TeamSnap ([pricing](https://www.teamsnap.com/pricing)) | C: un equipo desde $0; clubes a medida | NC | No lo menciona | NC: Trustpilot 1/5 (690): cobros anuales sin reembolso, soporte débil, funciones prometidas que no llegaron |
| 360Player ([pricing](https://www.360player.com/pricing)) | C: cotización por número de miembros y módulos | C: comisiones sin publicar | No lo menciona | — |
| Clupik | NC: "desde 35 €" ([capterra.es](https://www.capterra.es/software/215454/clupik)). La landing de SportMaps ya compara contra ≈$275.000 COP | NC | NC | NC |
| Spond ([fees](https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club)) | C: vive de la comisión: 2,5 % + €0,20 o 3,29 % + USD 1 | C: no lista Colombia ni COP | No | NC |

### C.3 Bienestar en Colombia

| Competidor | Precio (COP/mes) | Gratis | WhatsApp | Quejas |
|---|---|---|---|---|
| AgendaPro ([planes](https://agendapro.com/co/planes)) | C: Individual $29.900; Básico $99.000; Premium $150.000 (ficha clínica + consentimiento); Pro $510.000 | C: solo prueba | C: 50 recordatorios gratis al mes y luego desde $10.000 por cada 50 | NC: agenda compleja (Capterra 4,8) |
| Doctoralia ([precios](https://pro.doctoralia.co/precios)) | C: $249.000 / $279.000 / $329.000, facturado anual; Noa Notes +$169.900 | C: "versión gratuita", sin detalle | C: solo en Plus y VIP | NC para Colombia: permanencia de 12 meses, cobros después de la baja, pacientes que no llegan ([OCU](https://www.ocu.org/reclamar/empresas/doctoralia/c171c484f900cca285), [reclamos.cl](https://www.reclamos.cl/reclamo/2024/jun/doctoralia-cobro-abusivo)) |
| Nubimed ([precios](https://www.nubimed.com/precios)) | C: €27,40 / €50,10 + IVA; enfocado en España | C: no | C: mensajes al paciente | No aplica en Colombia |

**Lectura:** ninguna fuente oficial confirma PSE ni Nequi (NC en todas). Las extranjeras cobran con Stripe, en dólares o euros. Cuando aparece WhatsApp es un recordatorio con cupo; nadie cobra por WhatsApp ni conecta al acudiente. Solo AgendaPro y Doctoralia publican precio en COP.

---

## D. Plan

### D.1 Huecos frente a la competencia

1. **Cobro del profesional (F4/F5):** AgendaPro y Doctoralia ya tienen agenda + ficha. Sin cobro, "Wellness Pro" no reemplaza a nadie.
2. **App del cliente del entrenador personal:** Trainerize y TrueCoach giran en torno a la app del cliente (rutina del día, check-in, mensajes). SportMaps tiene `SessionExecution`, pero el flujo no está empaquetado para el cliente adulto independiente.
3. **Biblioteca de ejercicios con video propio** (TrueCoach anuncia más de 3.000 videos).
4. **Coach de escuela en la cancha:** asistencia sin señal y evaluar en una pantalla (lo resuelve V2). TeamSnap y Spond son buenos en celular.
5. **Plan de pago coherente** para `personal_trainer` y `wellness_professional`, que hoy no se puede comprar.
6. **Ventaja propia que nadie tiene:** el puente escuela ↔ profesional (semáforo de disponibilidad del lesionado + consentimiento del acudiente) y el cobro en COP por WhatsApp.

### D.2 Diez mejoras priorizadas

| # | Mejora | Impacto | Esfuerzo | Rol |
|---|---|---|---|---|
| 1 | **Quitar de la landing las cifras y los profesionales inventados** y las promesas falsas de B.2 | Muy alto (confianza y riesgo legal) | Muy bajo | Bienestar, Entrenadores |
| 2 | Planes del rol en `/mi-plan`: Coach Pro y Wellness Pro en lugar de los tiers de academia | Alto (sin esto no hay ingreso) | Bajo–medio | PT, Wellness |
| 3 | F4 de bienestar: paquetes de sesiones + cobro por enlace con la cuenta conectada del profesional, sin comisión al paciente | Alto | Medio–alto | Wellness |
| 4 | Coach que se registra sin escuela: pantalla "pide tu invitación / crea tu escuela gratis" en lugar del dashboard vacío | Medio | Bajo | Coach |
| 5 | Pizarra para todos los deportes (M0–M1 del spec multideporte) | Alto en clubes no futboleros | Medio | Coach |
| 6 | Recordatorio de cita por WhatsApp (plantilla, sin agente) para profesional y entrenador | Alto (paridad con AgendaPro) | Medio | PT, Wellness |
| 7 | Vista "Hoy" del cliente del entrenador personal (rutina, marcar hecho, pagar) | Alto | Medio | PT |
| 8 | Asistencia sin señal + evaluar al equipo en una pantalla (V2-5…V2-8) | Alto (retención del coach) | Medio–alto | Coach |
| 9 | Partidos F2 (BFF): registrar el partido y evaluar por jugador | Medio | Medio | Coach |
| 10 | Separar la pantalla de Planes y Pagos del entrenador de la UI de escuela (vocabulario "clientes", no "deportistas") | Medio | Bajo–medio | PT |

### D.3 Qué vender primero

1. **Coach (gratis, dentro del plan de la escuela):** no se vende aparte. Es el argumento para que la escuela compre: periodización, informe mensual, asistencia, pizarra de fútbol y semáforo médico. Ya está vivo.
2. **Entrenador personal, Coach Pro:** es lo más completo que se puede cobrar hoy (clientes, rutinas, disponibilidad, cobros de micro-escuela, perfil público). Requiere la mejora 2.
3. **Bienestar:** venderlo **primero como "fisio de la escuela"**: historia clínica legal + consentimiento del acudiente + semáforo para el coach. Es algo que nadie ofrece. Anunciar cobro solo cuando exista F4.

### D.4 Precio recomendado (gratis para empezar, sin comisión al cliente final, sin permanencia)

| Plan | Hoy en la landing | Recomendación |
|---|---|---|
| Free Coach / Free Wellness | Gratis, 5 clientes o pacientes | Mantener. En Wellness, "5 pacientes activos" en lugar de "5 al mes" (es más fácil de medir) |
| Coach Pro | $99.000 / $79.000 | **Bajar a $59.000–69.000** mientras no exista WhatsApp IA. TrueCoach Starter cuesta USD 26 (5 clientes); el entrenador colombiano compara contra cero |
| Coach Elite | $199.000 | Retirar hasta que existan la web propia y la analítica |
| Wellness Pro | $149.000 / $119.000 | **Lanzar como "Bienestar Individual" a $49.000–79.000 sin cobro integrado** (AgendaPro Premium cuesta $150.000 con ficha). Subir a ~$119.000 cuando F4 cobre de verdad |
| Clínica | $379.000 | Retirar o dejar "a medida" hasta que exista el equipo clínico compartido |
| Profesional contratado por escuela | No existe | Opción: incluirlo en el plan Pro/Elite de la escuela (refuerza la venta a academias) |

El mensaje de precio se apoya en lo confirmado: COP, mes a mes, sin permanencia (la queja contra Doctoralia y TeamSnap) y sin comisión al paciente (frente al modelo de Spond).

### D.5 Cambios necesarios en la landing

1. Borrar las estadísticas de `Bienestar.tsx:55-58` y `BienestarModule.tsx:66-68`, y el bloque "Nuestro equipo de profesionales" (`Bienestar.tsx:204-232`).
2. Quitar videollamada, wearables, "cumplimiento internacional" y "24/7". Cambiarlos por "Historia clínica según Res. 1995 y consentimiento del acudiente según Ley 1581".
3. En Wellness Pro y Coach Pro, cambiar "WhatsApp IA" por "Próximamente" o quitarlo. Quitar "pagos integrados" de Wellness hasta F4.
4. Partir `Entrenadores.tsx` en dos mensajes: "Entrenador de escuela: gratis con tu academia" y "Entrenador independiente: Coach Pro".
5. Cambiar "Biblioteca con videos demostrativos" por "Catálogo de ejercicios para armar rutinas".
6. Ajustar los precios según D.4 y sincronizarlos con lo que muestra `/mi-plan`.

### D.6 Ideas de contenido (tres por rol, todas sobre funciones que ya existen)

**Coach de escuela**
- Video de 60 s: "Arma el microciclo de la semana en 3 minutos" (periodización real, Club Carmel como caso si da permiso).
- Carrusel: "El informe mensual que los papás sí leen", con un informe real anonimizado.
- Tutorial: "Pizarra táctica de fútbol desde el celular" (ya hay manual y video en `docs/manuales/`).

**Entrenador personal**
- "Tu perfil público en 5 minutos: comparte el enlace por WhatsApp e Instagram".
- "Rutina → el cliente la ejecuta → ves su progreso de carga" (pantalla real de `SessionExecution`).
- Comparativa honesta "Cobrar en pesos sin Stripe ni dólares", solo con datos confirmados de la sección C.

**Profesional de bienestar**
- "Historia clínica de fisio que cumple la Res. 1995: notas que no se pueden borrar ni editar a escondidas".
- "Cómo firma el acudiente el consentimiento de un menor desde el celular".
- "El coach sabe si tu paciente puede entrenar sin ver el diagnóstico" (semáforo de disponibilidad).

---

**Pendiente de confirmar:** precios de WodApp, 360Player y Clupik (cotización directa); PSE y Nequi en todos los competidores; uso real de los módulos clínicos después de F3 (leerlo de la base cuando se autorice la consulta).
