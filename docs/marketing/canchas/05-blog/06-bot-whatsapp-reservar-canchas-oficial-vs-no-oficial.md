---
titulo_seo: Bot de WhatsApp para canchas: API oficial vs. no oficial
meta_descripcion: Qué cambia entre un bot de WhatsApp sobre la API oficial de Meta y uno sobre WhatsApp Web, qué riesgos tiene tu número y qué preguntar antes de contratar.
slug: bot-whatsapp-reservar-canchas-oficial-vs-no-oficial
keyword_principal: bot de WhatsApp para reservar canchas
keywords_secundarias: [API oficial de WhatsApp Business, WhatsApp Business API canchas, bot WhatsApp reservas, bloqueo número WhatsApp bot, plantillas de mensajes WhatsApp]
publicar_desde: 2026-12-03
enlaces_internos: [/canchas, /calculadora, /comparar/controla-cancha, /blog/software-canchas-sinteticas-colombia-comparativa, /blog/como-acabar-no-shows-cancha, /blog/cobrar-abono-cancha-sintetica]
estado: borrador
---

# Bot de WhatsApp para reservar canchas: API oficial vs. no oficial

En Colombia, las canchas se reservan por WhatsApp. No por app, no por llamada: por chat. Por eso casi todo software de canchas hoy ofrece «un bot de WhatsApp». Y desde afuera todos se ven iguales: el jugador escribe, el bot le muestra las horas libres, el jugador elige.

Por dentro, sin embargo, hay dos formas muy distintas de conectar un bot a WhatsApp, y la diferencia afecta lo más valioso que tienes en el negocio: **el número al que te escriben tus clientes**. En este artículo te explicamos las dos formas, qué riesgos tiene cada una y qué preguntarle a cualquier proveedor antes de conectarle tu número.

## Las dos formas de conectar un bot a WhatsApp

### 1. La API oficial de WhatsApp Business (Meta)

Es el camino que Meta, la dueña de WhatsApp, ofrece para que las empresas automaticen conversaciones. Funciona así:

- La empresa (o el proveedor de software en su nombre) registra el número en la plataforma de WhatsApp Business de Meta y verifica el negocio.
- Los mensajes viajan por la infraestructura de Meta, no por un celular.
- Los mensajes que el negocio inicia (un recordatorio, un aviso de cierre por lluvia) usan **plantillas** que Meta revisa y aprueba antes.
- Meta cobra por ciertas conversaciones según sus tarifas vigentes. <!-- VERIFICAR: no citar tarifas; si se menciona quién asume el costo de las conversaciones en SportMaps (club o SportMaps) según plan. -->

### 2. Sesiones no oficiales (tipo WhatsApp Web)

Es la forma «rápida»: el software abre una sesión de WhatsApp Web (o algo que la imita) con tu número, normalmente escaneando un código QR con tu celular, y desde ahí lee y responde mensajes de forma automática.

- No hace falta registrar nada con Meta.
- Se puede conectar en minutos al mismo número que ya usas.
- La conversación depende de que esa sesión siga abierta y, en muchos casos, de que el celular esté conectado.

## Por qué importa: los riesgos de la sesión no oficial

Usar una sesión no oficial no es «hackeo», y hay productos serios que funcionan así. Pero tienen riesgos que conviene conocer antes de conectarle el número principal de tu cancha:

### Bloqueo del número

Los términos de WhatsApp no permiten el uso automatizado o no autorizado del servicio fuera de sus canales para empresas. Si WhatsApp detecta comportamiento automatizado en un número normal, puede restringirlo o bloquearlo. No pasa siempre ni de inmediato, pero el riesgo existe, y si pasa, el número al que te escriben todos tus clientes queda fuera de servicio, con todos sus chats. <!-- VERIFICAR: redacción final revisada contra los Términos de servicio vigentes de WhatsApp/WhatsApp Business antes de publicar. -->

### Sin plantillas aprobadas

Sin la API oficial no hay plantillas aprobadas por Meta. En la práctica, los mensajes que inicia el negocio (recordatorios, avisos de cierre, «tu hora se liberó») salen como mensajes normales. Mandar muchos mensajes iguales a personas que no escribieron primero es justamente el tipo de comportamiento que puede marcar un número.

### Dependencia de una sesión

Si se cierra la sesión, se desconecta el celular o WhatsApp pide volver a escanear el código, el bot deja de responder. Y suele pasar en el peor momento: un viernes por la noche, cuando más reservas entran.

### Menos control sobre los datos

Con una sesión tipo WhatsApp Web, el software tiene acceso a la cuenta completa, no solo a las conversaciones de reservas. Vale la pena preguntar qué se guarda y quién lo ve.

## Qué tienes que hacer bien con la API oficial

La API oficial tampoco es magia. Tiene sus propias exigencias:

- **Verificar el negocio** con Meta, lo que toma unos días y pide algunos documentos.
- **Aprobar plantillas** para los mensajes que tú inicias. Si una plantilla se rechaza, hay que reescribirla.
- **Costo por conversación** en ciertos casos, según las tarifas de Meta.
- **Elegir bien el número:** a veces conviene un número nuevo dedicado a reservas, en lugar del personal del administrador.

A cambio, ganas estabilidad: el bot no depende de un celular, el número no está en riesgo por usar automatización y los recordatorios llegan como mensajes reconocidos por WhatsApp.

## ¿Qué usa cada software de canchas?

No siempre es fácil saberlo, así que hay que preguntarlo. Dos casos que conocemos:

- **SportMaps Canchas** usa la **API oficial de WhatsApp Business de Meta**. El bot muestra las horas libres, el jugador escribe «Confirmo», recibe el link de pago o los datos para transferir, manda el comprobante por el mismo chat y le llega la confirmación. Puede cancelar o cambiar por el chat y recibe un recordatorio 2 horas antes con el saldo.
- **Controla Cancha**, según su propia documentación pública, funciona sobre una sesión no oficial tipo WhatsApp Web. Es una decisión de producto que le permite conectarse muy rápido al número de cada sede, y su flujo de reserva por WhatsApp con IA tiene muy poca fricción para el jugador. Comparamos ambos productos punto por punto en [SportMaps vs. Controla Cancha](/comparar/controla-cancha).

Si estás evaluando otras opciones, la [comparativa de software para canchas en Colombia](/blog/software-canchas-sinteticas-colombia-comparativa) te da el panorama completo.

## Cinco preguntas antes de conectarle tu número a un bot

1. **¿Usan la API oficial de WhatsApp Business de Meta o una sesión tipo WhatsApp Web?** Pide que te lo digan por escrito.
2. **¿Qué pasa con mi número si WhatsApp lo restringe?** ¿Quién responde y cómo se recupera?
3. **¿Los recordatorios y avisos salen con plantillas aprobadas?**
4. **¿El bot depende de que un celular esté prendido y conectado?**
5. **¿Quién paga las conversaciones de Meta, si aplican?** ¿Está incluido en el plan?

Si el proveedor no puede contestarlas con claridad, ya tienes tu respuesta.

## Lo que un buen bot de reservas debe hacer, más allá de la conexión

La conexión es la base. Encima, el bot tiene que resolver lo que de verdad te quita tiempo:

- **Mostrar solo horas realmente libres,** sin chocar con las reservas que entran por la web o por recepción. En SportMaps, la base de datos impide que dos reservas ocupen la misma cancha y hora, vengan de donde vengan.
- **Cobrar antes del partido,** con pasarela o con comprobante validado. Más en [cómo cobrar el abono de tu cancha](/blog/cobrar-abono-cancha-sintetica).
- **Verificar al jugador:** en SportMaps, el número se verifica con un código, para que nadie reserve a nombre de otro.
- **Recordar y dejar cancelar,** que es lo que más baja los no-shows. Lo explicamos en [cómo acabar con los no-shows](/blog/como-acabar-no-shows-cancha).

Para ponerle número a lo que hoy pierdes por horas sin vender, usa la [calculadora](/calculadora).

## Preguntas frecuentes

### ¿Puedo usar mi número actual con la API oficial?

En muchos casos sí, pero el número tiene que registrarse en la plataforma de Meta y eso cambia cómo lo usas día a día. Te acompañamos a decidir si te conviene migrar tu número actual o abrir uno dedicado a reservas. <!-- VERIFICAR: proceso de alta del número (migración vs. número nuevo, convivencia con la app WhatsApp Business) tal como lo opera SportMaps. -->

### ¿Un bot no oficial siempre termina bloqueado?

No necesariamente. El riesgo depende del volumen, del tipo de mensajes y de las políticas de WhatsApp en cada momento. El punto es que es un riesgo que la API oficial no tiene por esa causa.

### ¿El bot de SportMaps está en el plan gratis?

No. El plan Gratis incluye página pública de reservas, agenda, transferencia con aprobación manual y efectivo. El bot de WhatsApp está en Canchas Pro ($99.000/mes), sin tope de reservas.

### ¿El jugador tiene que descargar algo?

No. Reserva desde el mismo WhatsApp que ya usa, sin crear cuenta.

## Conecta tu cancha a WhatsApp por la puerta oficial

Tu cancha se reserva y se cobra sola por WhatsApp. Sin comisiones, sin dobles reservas, sin cuaderno.

**[Crea tu sede gratis](/canchas)**. Los primeros 50 clubes tienen 3 meses de Canchas Pro gratis, con el bot de WhatsApp sobre la API oficial de Meta.

¿Quieres verlo funcionando? Escríbenos por WhatsApp al **+57 320 268 3539**.
