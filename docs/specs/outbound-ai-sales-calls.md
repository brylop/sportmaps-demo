# Spec — Llamadas salientes con agente de IA para vender SportMaps a escuelas

**Estado:** propuesta, sin código — piloto sin infraestructura nueva
**Origen:** evaluación de Dapti (2026-08-21) para llamar escuelas en frío y vender el software
**Relacionado:** [[project_landing_pricing_v3]] (precios), [[project_sales_whatsapp_number]] (canal de seguimiento), [[project_whatsapp_wa1_wa2_built]] (LLM ya montado)

---

## 1. Decisión de proveedor — por qué Vapi y no Dapti ni construcción propia

| Opción | Costo aprox. | Por qué se descarta / elige |
|---|---|---|
| **Dapti** | $99–$1.499/mes fijo + créditos | Vende plataforma completa (CRM, forms, integraciones) que no se necesita para un guion angosto de 2 pasos. El costo por llamada (~$1/llamada de 2 min) **no baja con el volumen** — Pro, Scale Up y Prime dan el mismo costo/llamada. |
| **Construcción propia** (Twilio + STT + TTS + LLM) | ~$0,08–0,10/min variable, sin fijo | Más barato en el margen, pero exige armar un servidor de audio en tiempo real (Twilio Media Streams → STT → LLM → TTS, manejo de interrupciones/latencia) — semanas de desarrollo para validar algo que todavía no se sabe si convierte. |
| **Vapi (o Retell/Bland) — elegido** | ~$10/mes por línea + uso al costo | Punto medio: pagás por uso real sin markup de plataforma grande, y no hay que construir el pipeline de audio — se define el asistente (prompt, voz, LLM) vía su API/dashboard. |

**Decisión:** arrancar con **Vapi, tier "Build" (usage-based)**. Sin contrato anual, sin plataforma fija — encaja con que el caso de uso es angosto (llamada promocional + confirmación de demo) y todavía sin volumen probado.

---

## 2. LLM del agente — reusar Groq, no Gemini ni el de Vapi por defecto

Ya existen ambas keys configuradas para el módulo de comprobantes (`ocr.service.ts`, `extractReceiptWith(provider,...)`): **Groq** y **Gemini**. No hace falta dar de alta nada nuevo.

**Decisión:** usar **Groq** como LLM del asistente de Vapi, no Gemini. En una llamada de voz la latencia de respuesta es lo que hace sonar natural o robótico a un agente; Groq (hardware LPU) responde bastante más rápido que la API de Gemini, que para el OCR es aceptable (ahí 1-2 s extra no importan) pero en una conversación se siente como silencio incómodo. Modelo sugerido: uno de los Llama pequeños/rápidos servidos por Groq — no hace falta un modelo grande para seguir un guion de 3 ramas.

---

## 3. Guion del agente ("Alex")

### 3.1 Descripción del negocio (system prompt, base)

SportMaps es una plataforma de gestión deportiva para escuelas de fútbol, natación, artes marciales y otros deportes en Latinoamérica. Reemplaza el Excel, el cuaderno y los grupos de WhatsApp del entrenador con un sistema que centraliza inscripciones, cobro de mensualidades (Wompi/MercadoPago), asistencia, comunicación con padres, informes de rendimiento por alumno y un asistente de IA por WhatsApp que responde a los padres automáticamente.

### 3.2 A quién se llama (ICP)

Dueños o administradores de escuelas deportivas con 20–300+ alumnos que hoy cobran la mensualidad a mano (transferencia + pantallazo) y coordinan todo por el WhatsApp personal del entrenador. Punto de entrada: escuelas de fútbol formativo (mayor volumen en la región).

### 3.3 Los 3 dolores que abre la llamada

1. *"¿Sabe hoy, sin buscar, quién le debe este mes?"* — normalmente no: cobro manual = mora invisible hasta que ya es tarde.
2. *"¿Cuántos mensajes de padres responde el entrenador por WhatsApp cada semana?"* — siempre las mismas preguntas (horarios, si hay entrenamiento, cómo pagar).
3. *"¿Qué le muestra al padre cuando pregunta si vale la pena seguir pagando?"* — normalmente nada. Sin informe de progreso la mensualidad se siente gasto, no inversión. Es la pregunta que más engancha porque toca retención, no solo operación.

### 3.4 Estructura de la llamada

1. **Apertura (10–15 s):** identificarse, decir en una frase qué es SportMaps, disparar la pregunta de dolor #1 para que hable el prospecto, no el agente.
2. **Escucha activa:** dejar que cuente cómo cobra/organiza hoy. No pitchear todavía.
3. **Conectar dolor → solución:** mencionar solo la 1–2 features que resuelven lo que él mismo dijo. No recitar el feature list completo.
4. **Oferta de entrada:** siempre ofrecer primero el plan gratuito (Free Start, 20 alumnos, sin tarjeta). Precios de pago solo si pregunta o si por tamaño claramente no entra en el free.
5. **Cierre:** pedir un sí chico — activar el free ahí mismo (deriva a WhatsApp) o agendar demo de 15 min. Nunca colgar sin una acción concreta agendada.

### 3.5 Planes para escuelas (COP/mes; anual entre paréntesis) — vigentes en `sportmaps.co`

| Plan | Precio | Alumnos | Para quién |
|---|---|---|---|
| Free Start | $0 | 20 | Cualquiera que dude — cero riesgo |
| Escuela Start | $69.000 ($59.000) | 50 | Escuela chica que ya cobra por Wompi |
| Escuela Pro | $159.000 ($139.000) | 300 | **El más elegido** — 500 conv. IA/mes, portal de padres |
| Escuela Elite | $349.000 ($299.000) | 800 | Multi-sede, 4000 conv. IA/mes, API |
| Custom | desde $750.000 | 800+ | Holdings, ligas, federaciones |

**Fuente de verdad de precios:** `RolePricingConfigs` en el repo de la landing, NO `saas-plans.ts` del demo (desactualizado). Si cambian los precios de la landing, este guion queda obsoleto — revisar [[project_landing_pricing_v3]] antes de reactivar campañas.

### 3.6 Objeciones frecuentes

- **"Ya uso Excel/WhatsApp y me funciona."** → "Totalmente válido para empezar. La pregunta es cuánto tiempo le toma cada fin de mes armar quién pagó y quién no — eso es justo lo que se automatiza, y puede probarlo gratis con 20 alumnos sin tarjeta."
- **"¿Cuánto cuesta?"** → dar el plan free primero, y recién después el rango de pago según el número de alumnos que mencione.
- **"No tengo tiempo para configurar un sistema nuevo."** → "El onboarding es guiado, no requiere nada técnico de su parte."
- **"¿Y si mis padres no usan la app?"** → "Los padres reciben todo por WhatsApp, no necesitan bajar nada — el asistente de IA les contesta ahí mismo."
- **"Ya conozco Controla.Club / otro sistema."** → no atacar al competidor; diferenciar por el asistente de IA por WhatsApp y por el informe de rendimiento como argumento de retención de padres.
- **"Mándeme información y yo lo reviso."** → un cierre más antes de aceptar ("¿le parece si mejor le activo el plan gratuito ahora y lo prueba usted mismo esta semana?"); si insiste, tomar el WhatsApp y ofrecer enviarlo ahí mismo, no "después".

### 3.7 Cierre y canal de seguimiento

- WhatsApp comercial oficial: **+57 320 268 3539** — único válido, no usar ningún otro (ver [[project_sales_whatsapp_number]], hubo 3 números viejos circulando por el repo).
- CTA por orden de preferencia: (1) activar Free Start en la llamada, (2) agendar demo de 15 min, (3) enviar info por WhatsApp con compromiso de llamada de vuelta en 48 h.
- Nunca terminar sin una fecha/acción concreta agendada.

---

## 4. Arquitectura técnica

```
Lista de leads (nombre escuela + teléfono)
        │
        ▼
   Vapi (assistant: prompt §3 + LLM=Groq + voz TTS)
        │  número saliente (Twilio vía Vapi, +57 dedicado — ver §7 decisión abierta)
        ▼
   Escuela (llamada)
        │
        ├─ interesado → agenda demo → Google Calendar (ver abajo)
        ├─ activa free → deriva a WhatsApp +57 320 268 3539
        └─ no interesado / no contesta → marca outcome
        │
        ▼
   Webhook de fin de llamada (Vapi → endpoint) → registra resultado
```

- **Agendamiento de demo:** la única integración externa real que hay que construir. Vapi soporta function-calling durante la llamada — se define una tool `agendar_demo(fecha, hora)` que consulta disponibilidad y crea el evento en Google Calendar (Calendar API, cuenta de ventas). Sin esto, el agente promete una demo que nadie agenda de verdad.
- **Webhook de resultado de llamada:** Vapi dispara un evento `end-of-call-report` (transcript, duración, outcome) a una URL propia. En Fase 0 (§8) no hace falta — se revisa desde el dashboard de Vapi. En Fase 1 conviene un endpoint mínimo en el BFF que lo persista (ver §5).

---

## 5. Modelo de datos (solo si se pasa a Fase 1 — no crear en el piloto)

Nace **fuera** del esquema multi-tenant de escuelas: son prospectos, no clientes, no hay `school_id` ni RLS de escuela que aplicar. Acceso solo admin/ventas (equivalente a `is_super_admin()`), nunca expuesto a `anon` ni a roles de escuela.

```
sales_leads
  id, school_name, phone, source text          -- de dónde salió el contacto (ver §7 decisión abierta)
  status text CHECK ('pendiente','llamado','interesado','demo_agendada','descartado','convertido')
  created_at

sales_call_attempts
  id, lead_id → sales_leads(id)
  vapi_call_id text, called_at, duration_seconds
  outcome text CHECK ('no_contesta','no_interesado','interesado','free_activado','demo_agendada')
  transcript_url, notes
  created_at
```

Sigue las convenciones del repo: estados como `TEXT + CHECK`, no `CREATE TYPE`; cualquier RPC nueva con `SET search_path = pg_catalog, public, pg_temp`; migración inmutable con `npm run migrations:new`. **No escribir esta migración hasta cerrar Fase 0** — construir esto antes de validar el guion sería infra para algo que todavía no se sabe si convierte.

---

## 6. Costos y presupuesto

| Concepto | Costo |
|---|---|
| Línea Vapi (Build, usage-based) | ~$10/mes (1 línea concurrente alcanza para el piloto) |
| Minutos de llamada (telefonía + STT + TTS, al costo) | ~$0,08–0,10/min |
| LLM (Groq) | Marginal, ya pagado — key existente |
| Número saliente dedicado (Twilio, si no viene con Vapi) | Variable, a confirmar al provisionar |
| **Total piloto** (100 llamadas × ~2 min) | **~$26–30** de uso + $10 de línea ≈ **$36–40/mes** |

Comparado con Dapti Pro ($99/mes por 100 llamadas de 2 min), el piloto en Vapi sale entre 2.5x y 3x más barato para el mismo volumen de validación.

---

## 7. Decisiones abiertas (⚪ — resolver antes de Fase 0)

- ⚪ **Fuente de la lista de leads.** ¿Directorio propio de SportMaps (mapa geolocalizado — la tesis del producto), scraping de redes sociales de escuelas, o una base comprada/armada a mano? Sin esto no hay a quién llamar.
- ⚪ **Número saliente.** Recomendado: **no reusar** el +57 320 268 3539 (WhatsApp comercial) como caller ID de llamadas en frío — quemar la reputación de ese número afecta también al canal de soporte/postventa que ya funciona. Provisionar un número +57 dedicado a ventas salientes.
- ⚪ **Objetivo declarado de la llamada.** ¿Vender el Free Start directo en la llamada (self-activation) o priorizar agendar demo humana? Cambia el guion de cierre (§3.4 paso 5) y qué se mide como éxito (§9).
- ⚪ **Disclosure de grabación.** Colombia permite grabar con consentimiento de al menos una parte (la que llama), pero conviene que el agente anuncie al inicio *"esta llamada puede quedar grabada para calidad"* — buena práctica legal y de confianza, no solo checkbox.
- ⚪ **Ritmo de marcado.** Evitar ráfagas de muchas llamadas en poco tiempo desde un número nuevo — riesgo de que operadoras lo marquen como spam antes de generar historial de llamadas legítimas contestadas.

---

## 8. Fases de rollout

| Fase | Alcance | Duración | Gate de salida |
|---|---|---|---|
| **Fase 0 — Piloto** | Asistente Vapi + guion §3 + Groq + número dedicado. Lista de 50–100 escuelas (fuente §7). Sin Calendar, sin BD — agendamiento manual por WhatsApp, resultados en planilla. | 1–2 sem | ≥1 demo agendada real y tasa de conexión medible |
| **Fase 1 — Instrumentar** | Tool `agendar_demo` → Google Calendar. Tabla `sales_leads`/`sales_call_attempts` (§5) si el piloto valida. Afinar guion con objeciones reales recolectadas. | 1 sem | Pipeline de leads → demo → conversión visible sin hoja de cálculo |
| **Fase 2 — Escalar** | Subir volumen de llamadas; evaluar Scale Up de Vapi solo si el costo/demo agendada lo justifica (no antes). | según resultado F1 | CAC por cliente pagador dentro de rango aceptable |

---

## 9. Métricas a trackear desde el día 1

- Llamadas intentadas / contestadas (tasa de conexión)
- Duración promedio de llamada
- Motivo de objeción más frecuente (para afinar §3.6)
- Demos agendadas / demos realizadas (drop-off)
- Demos → Free Start activado → plan pagado (funnel completo)
- Costo por demo agendada y costo por cliente pagador (CAC), comparado contra el LTV del plan Escuela Pro
