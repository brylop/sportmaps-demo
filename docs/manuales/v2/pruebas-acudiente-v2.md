# Pruebas del Acudiente V2 — 2026-10-26

Prueba real de todas las funciones del acudiente (padres y familias) en **https://dev.sportmaps.co** (frontend de `develop` en `origin/develop` = `7aeb8c7c`; BFF `sportmaps-bff-dev.onrender.com`). La base es **una sola**, compartida con producción: todo se hizo en el tenant demo **Club Campestre Demo** (`25a123f0-…`, `is_demo = true`).

- **Cómo:** Playwright con Chromium en celular 390×844 @3x, sesión de supabase-js plantada en `localStorage` (login programático). Script reproducible: `docs/manuales/_src/manual-acudiente-v2/capture.mjs` (resultados en `shots/resultados.json`; las capturas en `shots/`).
- **Cuentas:** acudiente `mherrera@demo.sportmaps.co` (Mauricio Herrera; Sofía en Natación — Infantil, Tomás en Fútbol — Sub-15 y Tenis); owner `gerencia@demo.sportmaps.co`; cuentas nuevas sin escuela (abajo).
- **No se pagó nada.** El pago en línea se probó hasta el botón que abre la pasarela.
- **Resultado:** 41 funciones probadas: **38 PASA** (8 con observaciones), **3 FALLA** y 1 NO PROBADO. 13 hallazgos con archivo:línea abajo.

## 1. Resultado por función

| # | Función | Resultado | Evidencia (`_src/manual-acudiente-v2/shots/`) | Nota |
|---|---|---|---|---|
| 1 | Inicio: frase de saldo, botón Pagar, próximo entreno, tarjeta de cada hijo con la frase del profe, torneos abiertos | PASA (obs.) | `01-inicio.png`, `01-inicio-completo.png` | La frase termina en «p. m..» (bug B10) |
| 2 | Inicio → «Ver cómo va» abre la ficha del hijo | PASA | — | `/children?hijo=…` |
| 3 | Inicio → «Pagar $…» lleva a Pagos | PASA | — | |
| 4 | Inicio: pregunta pendiente «¿Cuál es su EPS?» | PASA | `38d-inicio-con-escuela.png` | Vista en la cuenta nueva (Mateo sin EPS) |
| 5 | Calendario › Próximos: entrenos y partido de los hijos con nota | PASA | `02-cal-proximos.png`, `02b-cal-partido.png` | |
| 6 | Calendario: tocar un evento abre su detalle | FALLA (menor) | `02c-cal-tocar-evento.png` | La tarjeta no abre nada; ya trae hora/lugar/nota. Sin mapa ni «agregar a mi calendario» |
| 7 | Calendario › Torneos: inscritos y abiertos, «Inscribir a …» | PASA | `03-cal-torneos.png` | No se inscribió a nadie |
| 8 | Calendario › Mes: cuadrícula + detalle del día, sin «Nuevo evento» | PASA | `04-cal-mes.png`, `04b-cal-mes-dia.png` | Regla «el acudiente no crea eventos» se cumple |
| 9 | Hijos: selector de hijo | PASA | `05-hijos-progreso.png` | |
| 10 | Hijos › Progreso + gráficas | PASA | `05-hijos-progreso*.png` | Lee `performance_entries` (ya no `academic_progress`) |
| 11 | Hijos › Asistencia + historial completo | PASA | `06-hijos-asistencia.png`, `06b-asistencia-historial.png` | |
| 12 | Hijos › Informes | PASA | `07-hijos-informes.png` | Carga lenta (> 3,5 s con el skeleton) |
| 13 | Informe mensual: detalle + «Descargar PDF» | PASA | `10-informe-mensual*.png` | Descargó el PDF |
| 14 | Informe del entreno (grupal) | PASA (vacío) | `11-post-entreno-informe.png` | Sin informe publicado en el demo; BFF 404 «aún no publicado» es el caso esperado. **NO PROBADO con datos** |
| 15 | Autoevaluación post-entreno desde la notificación | PASA | `11b-autoevaluacion.png` | Abre «¿Cómo te fue en el entreno, Tomás?»; no se respondió |
| 16 | Partidos: reporte del profe + respuesta de la familia | PASA | `12-partidos*.png` | Solo después de encender `share_match_reports` por SQL (B4) |
| 17 | Evaluación del partido publicada, visible para la familia | PASA (obs.) | `13-progreso-con-partido.png` | Sale en Progreso; «Comentario del coach» aparece como «Comentario 0» (B6) |
| 18 | **Convocatoria: responder «Va / No va»** | **FALLA** | `15-notif-convocatoria.png`, `15b-convocatoria-destino.png` | No existe en la V2 del acudiente (B1) |
| 19 | Ficha y salud: datos, 10 documentos, «Mostrar carnet», «Corregir un dato» | PASA | `08-hijos-ficha*.png`, `08c-corregir-dato.png` | |
| 20 | Documentos: subir uno de prueba y verlo | PASA (obs.) | `09-documento-subido.png` | La familia lo ve; **la escuela no** (B2) |
| 21 | Hijos › «Agregar hijo» | PASA | `08d-agregar-hijo.png` | Solo se abrió el formulario |
| 22 | Carnet: lista, en grande, reverso, descargar | PASA | `14-carnets.png`, `14b-carnet-grande.png`, `14c-carnet-reverso.png` | |
| 23 | Pagos › Por pagar: total, cobros marcados | PASA (obs.) | `16-pagos-por-pagar.png` | Cobros de Tenis de Tomás rotulados «Tú (como atleta)» (B8) |
| 24 | Pagos: desmarcar recalcula | PASA | — | 8 cobros $1.948.000 → 7 cobros $1.668.000 |
| 25 | Pagar en línea hasta antes de la pasarela | PASA | `17-pagar-online.png` | No se abrió la pasarela |
| 26 | «Ya transferí»: subir comprobante de prueba | PASA (obs.) | `18-transferencia*.png`, `18b-comprobante-cargado.png`, `19-comprobante-enviado.png` | Abre con «Pagar online» preseleccionado (B7) |
| 27 | Cobro con comprobante queda «En revisión» | PASA | `19b-en-revision.png` | |
| 28 | Pagos › Pagados + Recibo | PASA | `20-pagados.png`, `20b-recibo.png` | |
| 29 | Estado de cuenta por hijo, mes a mes, imprimir | PASA | `21b-estado-cuenta.png`, `21c-estado-completo.png` | |
| 30 | Más: lista completa (ningún módulo perdido) | PASA (obs.) | `22-mas*.png` | Explorar aparece en dev (`VITE_SHOW_EXPLORE=true`) |
| 31 | Más › Inscripciones y planes | PASA | `27-inscripciones.png` | |
| 32 | Más › Mis eventos y torneos | PASA (obs.) | — | Dice «Volver a Calendario» aunque se abrió desde Más |
| 33 | Más › Constancias / Mis compras / Salud / Mis citas | PASA | `28b…28e-*.png` | Tienda del club cerrada en el demo |
| 34 | Más › Mensajes (→ WhatsApp) y «Escribirle al club» | PASA | `29-mensajes.png` | `wa.me/…` |
| 35 | Más › Centro de ayuda | PASA (obs.) | `25-ayuda.png` | «Todas» muestra artículos de escuela al acudiente |
| 36 | Más › Notificaciones | PASA | `24-notificaciones.png` | |
| 37 | Mi cuenta: Perfil, Notificaciones, Privacidad, Seguridad | PASA (obs.) | `23-*.png` | Seguridad: BFF 500 en `data-deletion-request` (B12) |
| 38 | Mapi responde una pregunta | PASA (obs.) | `26-mapi.png`, `26b-mapi-respuesta.png` | Responde con el menú V1 (B3) |
| 39 | «Volver a <pestaña>» en pantallas internas | PASA | — | |
| 40 | Rutas de staff por URL (`/announcements`, `/dashboard/polls`) | FALLA (menor) | `zz-announcements.png`, `zz-polls.png` | El acudiente ve «Nuevo Anuncio» y «Crea la encuesta» (B9) |
| 41 | **Código de escuela** (aviso, `/unirse` sin sesión, registro, onboarding, 4 pasos, «Por asignar», asignación) | PASA (obs.) | `30…38*.png` | Detalle en §3; cobro con `parent_id` NULL (B5) |

Anuncios y Encuestas no están en el «Más» del acudiente: el spec §8 los quita (no es un módulo perdido; en producción no tenían uso).

## 2. Hallazgos (archivo:línea en `origin/develop`; no se arregló nada)

| # | Gravedad | Hallazgo | Dónde | Propuesta |
|---|---|---|---|---|
| B1 | Alta | El acudiente **no puede responder «Va / No va»**. El aviso de `save_match_roster` dice «Cuéntanos si va» y enlaza a `/calendar`; el profe ve «4 sin responder». `my_callups` con el token de Mauricio sí devuelve la convocatoria de Tomás (`lineup 537b7aaa…`, `response: null`). | `frontend/src/lib/api/v2Contratos.ts:160-172` (`responderConvocatoria`, `misConvocatorias`) solo los usan `components/athlete/v2/AthleteHomeV2.tsx` y `AthleteTrainingV2.tsx` | Tarjeta «¿Va Tomás?» con Va / No va en Inicio (como el deportista) y en la fila del partido en Calendario › Próximos, con `sujeto {tipo:'child', id}` |
| B2 | Alta | **La escuela no ve los documentos que sube la familia.** La V2 sube a `identity-documents/children/<uid acudiente>/<child>/docs/`; la ficha de la escuela lista `children/<child>/docs`. Con el token del owner: ruta vieja `[]`, ruta nueva trae el archivo (la RLS deja leer). | `frontend/src/components/parent/v2/hijos/useHijosData.ts:86` vs `frontend/src/pages/SchoolStudentsManagementPage.tsx:548` | Registrar cada subida en `athlete_documents` (la escuela ya lista esa tabla para fichas sin cuenta) o listar también la carpeta del acudiente |
| B3 | Media | **Mapi responde con el menú V1**: «Abre Pagos en el menú lateral (sección Seguimiento) → PAGAR…». | `bff/src/data/app-map.ts:405-460` (rol `parent`) | Reescribir con las 5 pestañas; pegar los artículos de `sportbot/manual-acudiente-v2.help-articles.ts` |
| B4 | Media | El **reporte de partido no llega a las familias** salvo que `school_settings.share_match_reports = true`, y **no hay pantalla** para encenderlo (solo Besser, por migración). El diálogo del reporte lo advierte. | migración `20261022110209_reporte_partido_entrenador_admin_familia.sql:24,287`; `frontend/src/components/coach/MatchReportDialog.tsx:142-146`; RPC `list_child_match_reports` | Interruptor junto al de evaluaciones en la pantalla del partido (`PartidoFlujo.tsx` ~l.840) o encenderlo por defecto |
| B5 | Media | El alta por código crea el primer cobro **con `parent_id` NULL** y **vence el mismo día** («Suscripción — Mensualidad completa, vence día 26 — Mateo Pardo Demo»). La familia lo ve por `child_id`, pero el bot de WhatsApp busca por `parent_id` (spec §4.1). | `bff/src/routes/students-create-one.route.ts:1018-1062` (rama `child_existing`, no pasa el acudiente a `buildAltaPayments`) | Pasar `parent_id` del `children.parent_id`; revisar el vencimiento del primer cobro (ver gotcha «El primer cobro de un alta nacía vencido») |
| B6 | Media | «Comentario del coach» (métrica de texto) se guarda con `value = 0` y el texto en `notes`; la familia ve «Comentario 0» y nunca el comentario. | `frontend/src/components/parent/v2/hijos/hijosUtils.ts:233` (`isSkillMetric` no excluye `scale = 'text'`) y `skillRows` (l.271) | Excluir métricas de texto de las habilidades y mostrar `notes` como «Lo que dijo el profe» |
| B7 | Baja | «Ya transferí: subir el comprobante» abre el checkout con **«Pagar online» preseleccionado**. | `frontend/src/pages/MyPaymentsPage.tsx:531-541` (`startUploadingProof` → `openCheckoutFor` sin método) | Abrir con método `transfer` |
| B8 | Baja | Cobros sin `child_id` del acudiente se rotulan **«Tú (como atleta)»** aunque el acudiente no sea atleta (Tenis de Tomás). | `frontend/src/pages/MyPaymentsPage.tsx:303` | «Tú» solo si tiene inscripción propia; si no, «Sin deportista asignado» |
| B9 | Baja | `/announcements` y `/dashboard/polls` sin control de rol: el acudiente ve «Nuevo Anuncio» y «Crea la encuesta del día» (BFF 403). | `frontend/src/App.tsx:648` y `:651` | Envolver en `ProtectedRoute` de staff |
| B10 | Baja | Copy/maquetación a 390 px: «entrena mañana a las 4:00 p. m..»; la pestaña «Ficha y salud» se corta; el pie del onboarding con código («Anterior · Más tarde · Unirme a mi escuela») se sale de la pantalla. | `ParentHomeV2.tsx:171-172`; `components/parent/v2/hijos/HijosV2.tsx:100-106`; `pages/onboarding/ParentOnboarding.tsx` (rama `isJoinCodeShape`, ~l.101-110) | No agregar «.» si ya termina en punto; etiqueta corta «Ficha» o scroll; apilar los botones |
| B11 | Baja | Recordatorio «Todavía no respondes el entreno de hoy» **duplicado** (dos filas idénticas a las 20:00:00 del 15-sep para Mauricio). | job de recordatorio post-entreno (¿corre en más de un BFF?) | Revisar idempotencia del job |
| B12 | Media | Mi cuenta › Seguridad: `GET /api/v1/me/data-deletion-request` responde **500**: la tabla `account_deletion_requests` no existe en la base viva. Eliminar la cuenta (Ley 1581) no puede funcionar. | `bff/src/routes/me.routes.ts:229-241`; migración `20260522141000_security_hardening_p1.sql` (esa parte sin aplicar) | Aplicar esa parte de la migración (en una migración nueva) |
| B13 | Baja | La burbuja de Mapi tapa botones a 390 px (Enviar del reporte de partido, Subir de documentos). | botón flotante de soporte | Margen inferior en esas pantallas o burbuja más pequeña |

Otros vistos al paso: `POST /api/v1/devices/register` → 403 y `GET /events/my-open-tournaments` → 403 en cuentas sin escuela; las pestañas del Centro de ayuda muestran al acudiente artículos de escuela; dos campanas de avisos en Inicio; el entrenador ve «Toca una jugadora» en un equipo masculino (pantalla del partido).

## 3. Código de escuela, de punta a punta

1. `/unirse?codigo=CAM-ABUP` **sin sesión** → «Tienes el código CAM-ABUP. Primero entra o crea tu cuenta» y guarda el código en `localStorage` (`30-unirse-sin-sesion.png`).
2. **Registro normal** de la app (`/register`, rol Acudiente) con `familia.sincodigo@demo.sportmaps.co` / `Demo2026!` (`30b-registro.png`). Supabase confirma el correo solo (`mailer_autoconfirm`).
3. **Onboarding** paso 2 con el campo «¿Ya tienes escuela?» **precargado** con `CAM-ABUP` → «Unirme a mi escuela» (`31-onboarding-codigo.png`).
4. `/unirse`: «¿Es Club Campestre Demo?» → «Para mi hijo(a)», Mateo Pardo Demo, 10-05-2014, «Fútbol Sub-12» → «Solicitud enviada» (`32`–`34`). Inicio y Hijos muestran la solicitud con «Cancelar solicitud» (`35`, `35b`).
5. Owner demo → Deportistas → **«Por asignar (5)»** → Asignar → equipo **Fútbol — Sub-12**, sede «Unidad Deportiva — Fútbol», sin plan (`37`, `37b`). No hay ningún equipo con cuota 0 en el demo (el único es la sonda inactiva), así que se usó el de $180.000.
6. **Resultado:** solicitud `assigned`; ficha `children` creada con `parent_id` = la cuenta; inscripción activa con cuota $180.000; avisos «¡Bienvenido(a) a Club Campestre Demo! Mateo ya quedó en Fútbol — Sub-12» y «Nuevo cobro pendiente $180,000»; el Inicio pasa a la escuela y pregunta la EPS (`38*.png`).
7. **Cobro generado:** 1 cobro `a02da539-2dc0-4724-9ce2-27542fa9ef1a`, $180.000, «Suscripción — Mensualidad completa, vence día 26 — Mateo Pardo Demo», periodo 2026-10, vence 2026-10-26 (el mismo día), `parent_id` NULL (B5).

Además se creó una segunda cuenta, `familia.sincodigo2@demo.sportmaps.co` (Andrea Ruiz Demo), registrada por la app y **sin** código, solo para capturar el aviso «¿Ya tienes escuela?» de una cuenta sin escuela (`36-banner-sin-escuela.png`). Sigue sin escuela.

## 4. Datos creados (todo en Club Campestre Demo; se pueden quedar, el usuario decide)

| Qué | Id | Cómo |
|---|---|---|
| Partido próximo «vs Halcones FC» (Fútbol — Sub-15, 31-oct 10:00, Amistoso, local) | `match_results 09674a04-aefd-478a-9625-eb6300d24389` | Owner por la app (`/partidos/nuevo`) |
| Su evento de calendario | `calendar_events 5569a4a2-c50a-45b3-8b83-30d8c3e91b4f` | Lo crea `create_match` |
| Su convocatoria (4 deportistas) | `match_lineups 537b7aaa-fd1d-46ff-9e63-e29ac608d715` | Owner, «Convocar a 4» (avisó a las familias) |
| Partido jugado «vs Deportivo Arrayanes» 2-1 (24-oct) | `match_results 03f916e1-5950-4da2-a5b5-c368ddb94407` | Owner por la app, con convocatoria, 2 goles de Tomás Herrera y 1 asistencia de Tomás D. (BFF football events) |
| Evaluación de Tomás en ese partido (7 criterios) y su publicación | `performance_entries` con `context_id = 03f916e1…` | Owner, «Guardar evaluación» + «Publicar a las familias» |
| Criterios de partido sugeridos de la escuela | `seed_school_match_criteria` | Owner, «Usar los criterios sugeridos» |
| Reporte del partido publicado | `match_reports` (`match_id = 03f916e1…`) | Owner, diálogo del reporte |
| Respuesta de la familia al reporte | `match_report_replies` (Mauricio, `03f916e1…`) | Acudiente por la app |
| Ajustes de escuela | `school_settings.share_match_evaluations = true` (desde la app) y `share_match_reports = true` (**por SQL**, no hay pantalla) | Demo únicamente |
| Documento «Otro documento» de prueba de Sofía | `identity-documents/children/40b71d2f…/fcf4d2d1…/docs/other-2026-10-27T01-48-21-616Z-documento-prueba.png` | Acudiente por la app |
| Comprobante de prueba (imagen «Transferencia exitosa $280.000 – PRUEBA DEMO») para «Mensualidad Julio 2026 — Tenis (Tomás)» | cobro de Mauricio, ahora «En revisión» | Acudiente por la app |
| Cuenta sin escuela 1 | `familia.sincodigo@demo.sportmaps.co` / `Demo2026!` — perfil `41da3149-8008-4f82-85cb-f71c0ab339d6` (`is_demo = true` por SQL) | Registro por la app |
| Solicitud por código | `school_join_requests a4e92e21-d39c-484b-914a-548d621d1ee0` (assigned) | `/unirse` |
| Hijo Mateo Pardo Demo | `children 09c2b810-a317-4cbb-8d3a-c6368fb4d07b` (Fútbol — Sub-12) | Al asignar |
| Inscripción | `enrollments 2f1645ad-4e75-4f40-827d-bde018d231d7` (activa, $180.000, desde 2026-10-26) | BFF `create-one` |
| Cobro | `payments a02da539-2dc0-4724-9ce2-27542fa9ef1a` ($180.000, pendiente) | BFF `create-one` |
| Cuenta sin escuela 2 | `familia.sincodigo2@demo.sportmaps.co` / `Demo2026!` — perfil `d7965db4-deed-47c1-879f-8c088a496b8c` (`is_demo = true` por SQL) | Registro por la app |

Ojo: otra sesión (manual del entrenador) creó en paralelo un partido «vs Atlético Sabana» (26-oct, Sub-15) con evaluación y convocatoria; por eso Mauricio tiene dos convocatorias y dos reportes. No son de esta prueba.

## 5. Checklist para que pruebes con una cuenta real de acudiente, en tu celular

Usa una familia de una escuela que ya use la V2. No pagues de verdad salvo que sea tu propia mensualidad.

- [ ] **Entrar:** abre la app y entra con el correo del acudiente. ¿Ves la barra de abajo con Inicio · Calendario · Hijos · Pagos · Más?
- [ ] **Inicio:** ¿la frase de arriba coincide con lo que debes? ¿el próximo entreno es el correcto (día, hora y lugar)? ¿la frase del profe es la del último informe?
- [ ] **Inicio → Ver cómo va:** ¿abre la ficha del hijo correcto?
- [ ] **Calendario › Próximos:** ¿están los entrenos y partidos de todos tus hijos, con su nombre? ¿hay algo que no debería estar?
- [ ] **Calendario › Torneos y › Mes:** ¿aparecen los torneos? ¿al tocar un día ves sus eventos? ¿no aparece ningún botón para crear eventos?
- [ ] **Hijos:** cambia de hijo arriba. En cada uno revisa Progreso, Asistencia (¿coincide con lo que sabes?), Informes (abre el informe del mes y descarga el PDF) y Ficha y salud.
- [ ] **Documentos:** sube una foto cualquiera en «Otro documento». ¿Queda «Cargado» con «Ver»? Luego, desde el panel de la escuela, abre la ficha de ese deportista: **¿aparece el documento?** (esperado hoy: no, B2).
- [ ] **Carnet:** Más → Carnets → toca uno. ¿Se ve en grande con el QR? ¿descarga?
- [ ] **Partidos:** si el equipo jugó y el profe publicó el reporte, Hijos → Informes → Informes de partidos. ¿Ves el reporte? Escribe una respuesta corta y envíala.
- [ ] **Convocatoria:** si el profe convoca a tu hijo, ¿te llega el aviso? ¿encuentras dónde decir «Va / No va»? (esperado hoy: no existe, B1).
- [ ] **Pagos › Por pagar:** ¿el total y cada cobro son correctos? Desmarca uno: ¿cambia el total?
- [ ] **Pagar en línea:** toca «Pagar…», elige «Pagar online» y llega hasta el resumen. Cierra sin pagar (o paga solo si es real).
- [ ] **Comprobante:** «Ya transferí: subir el comprobante». ¿Qué método viene elegido? (esperado: Pagar online, B7). Si tienes una transferencia real, súbela y verifica que quede «En revisión».
- [ ] **Pagados y estado de cuenta:** ¿están tus pagos? ¿el estado de cuenta de cada hijo cuadra mes a mes?
- [ ] **Más:** abre cada opción (Inscripciones, Mis eventos, Constancias, Mis compras, Salud, Mis citas, Mensajes, Centro de ayuda, Notificaciones, Mi cuenta). ¿Alguna falla o está vacía sin explicación? ¿Aparece «Explorar»? (en prod no debería).
- [ ] **Mi cuenta › Seguridad:** ¿carga sin error? (esperado hoy: error al consultar «eliminar cuenta», B12).
- [ ] **Mapi:** pregúntale «¿Cómo subo el comprobante de una transferencia?». ¿Te habla de «menú lateral» o de la pestaña Pagos? (esperado hoy: menú lateral, B3).
- [ ] **Código de escuela:** con una cuenta nueva sin escuela, ¿ves «¿Ya tienes escuela?» en Inicio? Ingresa el código de tu escuela de prueba (nunca el de una escuela real con datos de clientes) y completa los 4 pasos. Desde la escuela, asígnalo en Deportistas → «Por asignar». ¿Te llega la bienvenida? ¿Qué cobro aparece y cuándo vence?
- [ ] **En el celular:** ¿algún botón queda tapado por la burbuja de Mapi? ¿algún texto se corta?

## 6. Manuales anteriores para familias

| Manual (`docs/manuales/{academias,interno}/`) | Estado |
|---|---|
| `pagos-de-padres.pdf` (2026-09-08) | **Obsoleto**: describe «Mis Pagos → Nuevo Pago» de la V1. Lo reemplaza el capítulo 6. Se rescató el «descuento por pronto pago» (pregunta frecuente). |
| `calendario-equipos-familias.pdf` (2026-09-23) | **Capítulo 4 obsoleto** («Calendario Familiar» de la V1); los capítulos del coach y del owner siguen vigentes. Lo de la familia está en el capítulo 3. |
| `dreamers-familias.pdf` (2026-10-14) | **Parcialmente obsoleto**: las reglas de Dreamers siguen, las pantallas (Mis Hijos, Nuevo Pago, menú lateral) son de la V1. |
| `carnets-digitales.pdf` | El capítulo «qué ve la familia» usa la navegación anterior; el resto (escuela) sigue. |
| `whatsapp-familias-{dynasty,besser,monster}.pdf` | Vigentes (canal WhatsApp, no la app). Su captura de «Mis Pagos» es de la V1. |
| `besser-inscripcion-qr.pdf`, `manual-tienda.pdf` (parte B) | Vigentes; no se cruzan con este manual (inscripción por QR y tienda). |
| `video/evaluacion-post-entrenamiento-padre.mp4` | Revisar: grabado con pantallas anteriores. |
| `mensajes-cobro-whatsapp.pdf` | No es un manual de la app (propuesta de mensajes para Dynasty). |
