# Registro de Pagos Manuales (Efectivo y Transferencia)

**SportMaps — Guia para Escuelas**

---

## Que es el Registro de Pago Manual?

Cuando un padre o atleta te paga directamente — ya sea en **efectivo** en la escuela o por **transferencia bancaria** — puedes registrar ese pago en SportMaps para que:

- El estudiante aparezca como **"Al dia"** en la lista de estudiantes
- Desaparezca de la lista de **Recordatorios de cobro**
- El padre reciba una **notificacion** y un **correo** confirmando el pago
- El pago quede en el **historial financiero** de la escuela

---

## Como registrar un pago

**Menu:** Gestion de Pagos → Cobros

### Paso 1 — Abrir el formulario

Haz clic en el boton **"Registrar pago"** en la parte superior derecha de la pagina de Gestion de Pagos.

### Paso 2 — Seleccionar el metodo de pago

El formulario muestra dos botones:

| Boton | Cuando usarlo |
|---|---|
| **Efectivo** (verde) | El padre pago en persona con dinero en efectivo |
| **Transferencia** (azul) | El padre hizo una transferencia o consignacion bancaria |

Haz clic en el que aplique. Por defecto viene seleccionado "Efectivo".

### Paso 3 — Seleccionar el estudiante

Abre el desplegable **"Estudiante / Atleta"** y selecciona a quien corresponde el pago. Si el estudiante es menor de edad, veras el nombre del acudiente entre parentesis.

### Paso 4 — Completar los datos del pago

| Campo | Que poner |
|---|---|
| **Concepto de pago** | Describe que se esta pagando. Viene con "Mensualidad" por defecto, pero puedes cambiarlo (ej: "Uniforme", "Torneo", "Inscripcion") |
| **Monto ($ COP)** | El valor que recibiste. Escribe solo el numero sin puntos ni signos |
| **Fecha del pago** | La fecha en que recibiste el dinero. Viene con la fecha de hoy, pero puedes cambiarla si el pago fue dias atras |

### Paso 5 — Confirmar

Haz clic en **"Guardar y confirmar"**.

---

## Que pasa cuando confirmas?

El sistema hace todo esto automaticamente:

1. **Salda la deuda completa** — Si el estudiante tenia pagos pendientes o vencidos, TODOS se marcan como pagados de una sola vez
2. **Si no habia deuda** — Se crea un nuevo registro de pago con estado "Pagado"
3. **Notificacion al padre** — Si el padre tiene cuenta en SportMaps, recibe una notificacion en la app
4. **Correo de confirmacion** — Si el padre tiene email registrado, recibe un correo automatico
5. **Historial actualizado** — El pago aparece en la pestaña "Historial" con el metodo (CASH o TRANSFER) y una referencia unica

---

## Donde se reflejan los cambios?

| Seccion | Antes | Despues |
|---|---|---|
| **Estudiantes** | Badge rojo "Vencido" o amarillo "Pendiente" | Badge verde **"Al dia"** |
| **Recordatorios** | Aparece en la lista con dias de mora | **Desaparece** de la lista |
| **Historial de pagos** | Solo mostraba el cobro pendiente | Muestra el pago como **"Pagado"** con metodo y fecha |
| **Estadisticas** | No sumaba en ingresos | Se suma a **"Pagos exitosos"** |

---

## Preguntas frecuentes

### Un padre me pago pero tiene varios cobros pendientes, que hago?

Solo registra UN pago. El sistema automaticamente marca TODOS los cobros pendientes y vencidos de ese estudiante como pagados.

### Me equivoque al registrar un pago, como lo corrijo?

Contacta al administrador para corregir el registro directamente en la base de datos. Proximamente habra opcion de anular pagos desde la app.

### Cual es la diferencia entre "Registrar pago" y el flujo de pago online?

| Registro manual | Pago online (Wompi/link) |
|---|---|
| La escuela registra el pago | El padre paga desde su celular |
| Se marca como pagado al instante | Empieza como "Pendiente" hasta que el gateway confirma |
| Para efectivo y transferencias ya recibidas | Para pagos con tarjeta o PSE |

### Si registro un pago manual, el padre aun puede pagar online?

No. Una vez registrado, los cobros pendientes del estudiante se cierran. Si el padre intenta pagar online un cobro que ya fue registrado como pagado, no encontrara deuda pendiente.

### Puedo registrar un pago de un monto diferente al cobro original?

Si. El sistema registra el monto que tu ingreses. Si el cobro original era $35,000 y el padre te pago $40,000, puedes registrar $40,000. El sistema guarda el monto pagado sin importar el valor original del cobro.

---

## Cobros Pendientes por Generar

**Menu:** Gestion de Pagos → Config (parte inferior)

### Que es?

Es una herramienta que detecta estudiantes inscritos que **no tienen ningun cobro registrado** — ni pendiente, ni pagado. Esto puede pasar cuando:

- Inscribes un alumno manualmente y el cobro automatico no se genero
- Borraste pagos de prueba
- Es inicio de un nuevo ciclo de facturacion

### Como usarlo

1. Ve a **Config** en la pestaña de Gestion de Pagos
2. Baja hasta la tarjeta amarilla **"Cobros Pendientes por Generar"**
3. Haz clic en **"Verificar atletas sin cobro"**
4. El sistema muestra una tabla con los atletas que no tienen pago, el monto calculado segun su plan/equipo, y la fecha de vencimiento
5. Si todo esta correcto, haz clic en **"Confirmar y generar X pago(s)"**

Esto crea cobros con estado "Pendiente" que luego puedes:
- Registrar como pagados manualmente (con el boton "Registrar pago")
- Enviar recordatorios a los padres
- Esperar a que el padre pague online

---

## Resumen del flujo completo

```
ESTUDIANTE SE INSCRIBE
  └── Sistema genera cobro automatico (Pendiente)

SI EL COBRO NO SE GENERO:
  └── Config → "Verificar atletas sin cobro" → Generar

PADRE PAGA EN EFECTIVO O TRANSFERENCIA:
  └── Registrar pago → seleccionar metodo → confirmar
      ├── Todos los pendientes/vencidos → Pagado
      ├── Estudiante → "Al dia"
      ├── Recordatorios → Desaparece
      └── Padre recibe notificacion + correo

PADRE PAGA ONLINE (Wompi/link):
  └── Flujo automatico, no requiere accion de la escuela
```

---

*SportMaps &copy; 2026*
