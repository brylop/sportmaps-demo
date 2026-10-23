# Dreamers — bloqueo de la entrada por mora u horas agotadas: qué probamos y qué opciones hay

**Fecha:** 2026-10-23 · **Para revisar con:** Julián (lectores MB360 de Dreamers) · **Estado:** sin decisión; nada de esto está encendido en producción.

## 1. Qué queremos lograr

Que SportMaps pueda **impedir la próxima entrada** de una persona al torniquete cuando:

- tiene una mensualidad vencida (mora), o
- se le acabaron las horas del mes (banco de horas),

y que se pueda **volver a permitir** sola cuando se ponga al día. Sin borrar a nadie del lector, y sin cortar una clase que ya empezó.

## 2. Cómo está montado hoy

- Dos lectores **MB360/ID** (firmware *Ver 6.60 Sep 19 2019*): uno de **entrada** (serie `CEZU222860004`, IP 192.168.1.201) y uno de **salida** (serie `CEZU214960067`, IP 192.168.1.202).
- Los lectores no llegan a internet. Una **PC en la sede** corre el *bridge* (`dreamers_bridge.py`, Python + `pyzk`), que lee las marcaciones en vivo por el puerto 4370 y las manda a SportMaps, y que ejecuta comandos que SportMaps le envía por WebSocket.
- **El lector decide solo** si abre el torniquete: reconoce la huella (o el código) y su relé abre.
- SportMaps evalúa cada marcación **después** de que ocurrió (`validateAccess`: mora, día no permitido, etc.) y solo la registra y avisa. No participa en abrir o no abrir.

Lectura real de los dos lectores (hecha el 2026-10-23 con `get_users()`, solo lectura):

| | Entrada | Salida |
|---|---|---|
| Usuarios | 603 | 605 |
| Deshabilitados | 0 | 0 |
| Administradores (privilegio 14) | 7 | 7 (los mismos) |

SportMaps solo tiene mapeados **6 PIN** de esas ~600 personas (Dreamers opera sus clientes en otro sistema); el resto no existe en SportMaps.

## 3. Lo que ya probamos y NO funciona

### 3.1 Deshabilitar al usuario con el bit de privilegio (`disable_user`)

- El bridge intentaba deshabilitar con `privilege | 1` (bit 0 = «deshabilitado» en el registro de usuario).
- **Hallazgo 1 — pyzk 0.9 lo recortaba:** `zk/base.py:867` hace `if privilege not in [USER_DEFAULT(0), USER_ADMIN(14)]: privilege = USER_DEFAULT`. El bit nunca llegaba al lector. Se comprobó con los datos: 108 comandos `disable_user` (sobre solo 5 PIN) entre el 5-sep y el 6-oct, todos «ejecutados» pero sin efecto; la relectura del 6-oct lo dejó escrito (*«privilege antes=0 después=0»*). Quedaron invalidados en la base el 23-oct.
- **Hallazgo 2 — aun con el parche, el lector no lo respeta:** se parchó el privilegio para que llegue intacto y se hizo una **prueba en el lector de entrada, con un usuario normal (PIN 12)**:
  - el lector **guardó** el cambio (relectura: `privilegio = 1`, «OK: el lector guardó el cambio»);
  - al marcar, **el lector la dejó pasar igual**.
  - Conclusión: el MB360 almacena el bit pero **no lo usa para negar la verificación**.
- Falta (pendiente de repetir): marcar **solo con la huella** y **solo con el código** por separado mientras el usuario está deshabilitado, porque en Dreamers se marca con huella o con un «código fácil», y no sabemos con cuál pasó en la prueba.

### 3.2 Mover a un grupo (`set_group`)

- Ya se había descartado antes (septiembre): el comando se ejecuta, pero según lo conversado con Julián **el equipo no tiene un grupo de acceso** que niegue la entrada.
- El lector sí tiene una **zona horaria** configurada solo para el horario de la sede (aplica a todos, no por persona).

## 4. Opciones

### Opción a — SportMaps controla la puerta (el lector deja de abrir solo)

El lector sigue reconociendo a la persona, pero **su relé deja de abrir el torniquete por sí mismo**. El bridge, en la PC, recibe cada marcación y manda el pulso de apertura (`CMD_UNLOCK`, ya implementado como `open_door`) **solo si la persona no está en la lista de bloqueados**. SportMaps mantiene esa lista (mora + horas agotadas) y se la entrega al bridge cada ~1 minuto; el bridge la guarda localmente, así la puerta no depende de un viaje a internet por cada niña.

```
Persona marca -> MB360 reconoce (no abre) -> live_capture del bridge
   -> ¿PIN en la lista local de bloqueados?  no -> CMD_UNLOCK (abre)   si -> no hace nada
SportMaps (mora / horas) --cada ~1 min--> lista de bloqueados --> bridge (copia local)
```

Ya existe: pulso de apertura en el bridge, captura en vivo, evaluación de cada marcación en el backend. Hay que construir: la lista y su entrega, la decisión en el bridge, funcionamiento sin internet (usa la última lista), configuración del relé del lector, y pruebas con un lector real. Orden de magnitud: código mediano; en sitio, media jornada de configuración; 1–2 días de pruebas con personas de prueba.

**Riesgos de la opción a:**

- Con el relé del lector desactivado, **si la PC o el bridge se caen, nadie puede entrar**. Hoy, si la PC se cae, la puerta sigue abriendo. Exige PC siempre encendida y sin suspensión, arranque automático, vigilante (el bridge ya tiene watchdog), idealmente UPS, y una forma de abrir a mano.
- La latencia marcación → apertura sube un poco (decisión local en el bridge; hay que medirla en sitio).
- Hoy el bridge apunta a `bffdev` (servidor de desarrollo): para controlar la puerta real tendría que apuntar a producción.
- Volver atrás es simple: reactivar el relé en el menú del lector.

### Opción b — No bloquear por hardware

Se dejan los avisos por app y correo (escalera de saldo de horas y avisos de mora), los cobros automáticos de excedentes, y una **lista de bloqueados a la vista de recepción**; quien está en la puerta decide. No toca el hardware ni la operación. No impide físicamente la entrada.

### Opción c — Cambiar el equipo de la puerta

Un lector o controlador con **control de acceso por usuario** (grupos / zonas por persona) que sí niegue la entrada, o un controlador de acceso aparte. Es la solución «limpia», con costo y obra.

## 5. Qué le preguntaríamos a Julián

1. **¿Se puede dejar el relé del lector sin abrir al verificar?** (retardo cero o desactivado), de modo que solo abra con el pulso externo (`CMD_UNLOCK` por el SDK). ¿Dónde está esa opción en el menú de este modelo/firmware?
2. Si la respuesta es sí: **¿cuánto tarda hoy** entre que la persona marca y se abre el torniquete? Y con el pulso externo, ¿se mantiene el mismo comportamiento del torniquete (tiempo abierto, sentido)?
3. Si es no: ¿el torniquete se puede **conectar a otro relé** que controle la PC (o un módulo de relés por red)?
4. **¿Cómo marcan las niñas?** Huella y «código fácil»: ¿el código solo (sin huella) abre la puerta? Si el código solo abre, cualquier mecanismo que dependa de la huella dejaría esa vía abierta.
5. ¿El MB360 de Dreamers tiene en su menú **«Control de acceso»** (zonas horarias, grupos, «usar horario de grupo»)? La zona horaria que ya usan, ¿se puede asignar por usuario?
6. ¿La PC de la sede puede **quedarse siempre encendida** (sin suspensión) y tener UPS? ¿Hay un botón o llave de apertura manual en el torniquete?

## 6. Lo que ya quedó hecho (por si sirve para cualquiera de las opciones)

- **Bridge parchado** (versión `dreamers-ws-2026-10-23.1`, en el repo, sin desplegar): el privilegio llega intacto al lector, relectura obligatoria, **no deshabilita administradores**, no escribe si ya está en el estado pedido, `set_group` conserva el privilegio, y la versión viaja en cada ack y latido.
- Scripts de **solo lectura** para la PC: listado de todos los usuarios de los dos lectores (por serie de equipo, no por IP) y una **prueba guiada de bloqueo de un solo PIN** que lo deja siempre habilitado al terminar.
- La base ya no cree que alguien está bloqueado: se invalidaron los 101 comandos sin efecto.

## 7. Lo que NO depende del lector y puede avanzar ya

- Avisos de saldo de horas por app y correo (50 %, 20 %, 10 %, 0 %).
- Excedentes automáticos: bandeja «Cobrar todos», confirmación bajo tope, recordatorio.
- Lectura de usuarios de los lectores desde SportMaps (que SportMaps «vea» a las ~600 personas y se puedan asociar a atletas importados).

Mientras no se resuelva el bloqueo físico, **no se enciende ningún bloqueo automático por mora ni por horas**.
