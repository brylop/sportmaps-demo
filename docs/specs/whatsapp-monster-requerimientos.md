# Bot de WhatsApp — requerimientos de Monster´s Volley Club

Origen: grupo «Soporte Monsters Volley», 2026-10-29 (lista de 10 puntos + mensajes sueltos).
Escuela: `eb3ebc77-4ea4-4992-96c8-3c8ec574578c`.

**Estado en la base (2026-10-29):** sin número conectado (`school_whatsapp_integrations` = 0), sin ficha
de prospectos (`wa_ficha_prospectos` NULL), sin tono (`wa_estilo_respuesta` NULL), 0 conversaciones,
clase de cortesía sin configurar (0 franjas, 0 ajustes, 0 reservas).

Leyenda: ✅ existe · ⚙️ existe, falta configurar o que Monster entregue el texto · 🟡 parcial · ❌ no existe

| # | Pedido | Estado | Qué hay hoy | Qué falta |
|---|---|---|---|---|
| 1 | Mensaje de bienvenida | ⚙️ | Saludo + menú a familias; saludo con enlace y cortesía a prospectos | Texto de Monster → `wa_ficha_prospectos` / `wa_estilo_respuesta` |
| 2 | Guiones para seguir la conversación | ⚙️ | El prospecto lo responde Haiku desde la ficha (`whatsapp-prospecto-ia.service.ts`) | Monster escribe la ficha: precios, sedes, edades, requisitos, uniformes, convenios |
| 3 | Hasta dónde llega el bot y cuándo entra un asesor | ⚙️ | `escalate_to_human`, botón «Hablar con alguien», buzón, correo de escalamiento | Monster define la lista: qué pasa siempre a humano (becas, quejas, pagos raros, retiros) y quién atiende y en qué horario |
| 4 | El profesor pone su horario semana a semana | 🟡 | La app tiene sesiones por entrenador; el bot lee el horario **fijo** del grupo (`get_school_info`) | Por verificar que el bot lea las sesiones de la semana o sus cambios. Si no, construirlo |
| 5 | Seguimiento «ilimitado» a interesados | 🟡 | Solo el seguimiento de la noche después de la clase (`prospecto-ciclo-clase.service.ts`) | «Ilimitado» no se puede: después de 24 h solo salen **plantillas aprobadas por Meta** (marketing ≈ US$0,0125 cada una), y la Ley 2300 permite 1 contacto al día y 1 canal a la semana. Propuesta: plantillas a las 24 h, 3 días y 7 días (ya está en el plan de la auditoría del 10-28, fase de 2 semanas) |
| 6 | WhatsApp bloquea la cuenta después de unos 80 mensajes | ✅ (se resuelve al conectar) | Hoy envían desde la app WhatsApp Business del celular, que bloquea los envíos masivos como spam. Por Cloud API (Coexistence) los envíos van con plantillas y un tope diario que sube según la calidad (arranca en 250 destinatarios por día) | Conectar el número por Embedded Signup y copiar las plantillas (`wa-copiar-plantillas.ts`) |
| 7 | La clase de prueba queda agendada en la app | ⚙️ | El bot agenda la clase de cortesía y la guarda en `trial_class_bookings`; la escuela la ve en Deportistas | Cargar franjas y ajustes de cortesía de Monster |
| 8 | Mensaje de seguimiento | 🟡 | Igual que el punto 5 | Texto + plantilla |
| 9 | Mensaje al lead | ⚙️ | Lead creado y embudo (`whatsapp-prospecto-lead.service.ts`) | Texto de Monster |
| 10 | Atención a afiliados | ✅ / ⚙️ | Bot de familias: estado de pagos, cómo pagar, horarios y sedes; reconoce al acudiente por su número | Los acudientes tienen que tener el celular cargado; revisar cuántos no lo tienen antes de conectar |

## Mensajes sueltos del mismo hilo

- **Resolución IDRD, RUT, cédula y logo.** Son documentos del alta (verificación del negocio en Meta y marca), no cambian lo que hace el bot.
- **«Se paga durante el mes según las sesiones que queden para ese grupo».** ❌ Hoy `billing_cycle_type='prorated'`
  (`bff/src/utils/prorationUtils.ts`) prorratea por **días** del mes, no por **sesiones que le quedan al grupo**.
  Es un cambio de cobro con dos decisiones pendientes: cómo se calcula el valor por sesión (mensualidad ÷ sesiones del mes
  o un precio fijo) y si cuentan festivos y sesiones canceladas. El bot tiene que dar el mismo número que el cobro, así que
  esto se arregla primero en el cobro y después en la ficha.
- **«¿Cómo hacen la inscripción los acudientes?».** Ya existe: enlace o QR de inscripción, que el bot manda solo cuando
  alguien dice que quiere inscribirse. Alternativa: código de escuela para unirse desde la app.

## Orden sugerido

1. Monster entrega textos (puntos 1, 2, 3, 8, 9) y franjas de cortesía (punto 7) → se cargan sin código.
2. Conectar el número (punto 6) con el bot en modo asistido (`ai_enabled=false`) la primera semana.
3. Decidir el cobro por sesiones restantes → construirlo → reflejarlo en la ficha.
4. Plantillas de seguimiento 24 h / 3 d / 7 d (puntos 5 y 8).
5. Verificar y, si falta, construir que el bot lea el horario de la semana (punto 4).
