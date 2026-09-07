# Recordatorios de Cobro + Plantillas de Mensaje

**SportMaps — Guía para Escuelas**

---

## PARTE 1: Configurar las Plantillas (una sola vez)

**Menú:** Finanzas → Plantillas

### Paso 1 — Revisar las plantillas disponibles

La página muestra las plantillas organizadas por tipo:

| Tipo | Cuándo se usa |
|---|---|
| **Recordatorio Previo** | Días antes de que venza el pago |
| **Día de Vencimiento** | El mismo día que vence |
| **Mora / Vencido** | Cuando ya pasó la fecha de pago |
| **Pago Confirmado** | Cuando recibes un pago |
| **Abono Recibido** | Cuando recibes un pago parcial |

Cada tipo tiene varias variantes (amigable, corto, formal). Todas vienen preconfiguradas.

### Paso 2 — Activar o desactivar plantillas

Cada plantilla tiene un **switch** a la derecha. Solo las plantillas activas aparecerán como opción en Recordatorios.

### Paso 3 — Personalizar un mensaje (opcional)

1. Haz clic en **"Editar"** en cualquier plantilla
2. Modifica el texto. Puedes usar **variables** que se reemplazan automáticamente con datos reales:

| Variable | Se reemplaza por |
|---|---|
| `{{nombre_padre}}` | Nombre del acudiente |
| `{{nombre_atleta}}` | Nombre del deportista |
| `{{monto}}` | Valor del pago (ej: $150.000) |
| `{{fecha_vencimiento}}` | Fecha límite de pago |
| `{{dias_mora}}` | Días vencidos |
| `{{nombre_escuela}}` | Nombre de tu academia |
| `{{link_pago}}` | Link para pagar online |
| `{{equipo}}` | Equipo o programa |
| `{{plan}}` | Plan contratado |
| `{{banco}}` | Datos bancarios de la escuela |
| `{{nequi}}` | Número de Nequi de la escuela |

3. Haz clic en **"Vista Previa"** para ver cómo queda con datos de ejemplo
4. Haz clic en **"Guardar"**

> Si quieres volver al mensaje original, haz clic en **"Restaurar"**.

---

## PARTE 2: Enviar Recordatorios

**Menú:** Finanzas → Recordatorios

### Paso 1 — Ver los pagos pendientes

La página carga automáticamente todos los pagos pendientes y vencidos de tus alumnos. Verás:

- **Tarjetas resumen:** total de contactos, pendientes, vencidos y monto total
- **Tabla:** cada pago con nombre del padre, estudiante, plan, monto, vencimiento y estado

### Paso 2 — Filtrar (opcional)

Usa los filtros en la barra superior:

- **Por estado:** Todos / Pendientes / Vencidos
- **Por plan:** filtra por un plan específico

Los números de las tarjetas se actualizan según el filtro activo.

### Paso 3 — Elegir la plantilla a usar

En la barra de filtros, a la derecha, está el selector de plantilla:

- **"Plantilla automática"** (por defecto) — el sistema elige la plantilla según el estado del pago:
  - Pago por vencer → usa "Recordatorio Previo"
  - Vence hoy → usa "Día de Vencimiento"
  - Vencido → usa "Mora / Vencido"
- **Plantilla específica** — abre el dropdown y selecciona la plantilla exacta que quieres usar (ej: "Recordatorio amigable", "Mora - tono suave", etc.)

### Paso 4 — Enviar por WhatsApp (individual)

1. Haz clic en el ícono de **WhatsApp** (burbuja verde) al lado de cualquier pago
2. Se abre WhatsApp Web con el mensaje ya escrito usando la plantilla seleccionada y los datos reales del padre/alumno
3. Solo dale **Enviar** en WhatsApp

### Paso 5 — Enviar por Email (selección)

1. Selecciona los pagos con los **checkboxes** de la izquierda (o selecciona todos con el checkbox del encabezado)
2. Haz clic en **"Enviar (X)"** — envía email a todos los seleccionados que tengan email registrado
3. Verás un resumen de cuántos se enviaron y cuántos no tenían email

### Paso 6 — Enviar todos por email (automático)

Haz clic en **"Enviar todos por email"** — envía recordatorio a TODOS los padres con pagos pendientes de una sola vez.

---

## Resumen del flujo completo

```
PLANTILLAS (configurar una vez)
  ├── Activar las plantillas que quieras usar
  └── Personalizar el texto si lo deseas

RECORDATORIOS (usar cada vez que cobres)
  ├── Filtrar por estado o plan
  ├── Elegir la plantilla
  └── Enviar:
      ├── WhatsApp → individual, un clic
      ├── Email selección → checkbox + botón Enviar
      └── Email masivo → botón "Enviar todos por email"
```

---

*SportMaps © 2026*
