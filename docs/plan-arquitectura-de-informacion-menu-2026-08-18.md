# Arquitectura de información — el menú y las configuraciones dispersas

**Fecha:** 2026-08-18 · **Estado:** propuesta, sin código · **Alcance:** solo diseño y navegación.
No cambia ninguna regla de negocio.

---

## 1. La desorganización, medida

No es una impresión. Los números:

| | |
|---|---|
| Items de menú declarados | **208** |
| Grupos de menú | **62** |
| Rutas distintas llamadas literalmente «Configuración» | **3** — `/settings`, `/admin/config`, `/organizer/settings` |
| Archivos del frontend que escriben `school_settings` | **14** |
| Páginas de ajustes que existen | **2** — `SettingsPage` (264 líneas) y `SchoolSettingsPage` (306) |

Y el hallazgo que lo resume: **`/school-config` existe, tiene 306 líneas, está ruteada… y no está
en el menú.** Solo se llega escribiendo la URL. Hay una pantalla de configuración de la escuela que
nadie puede encontrar.

### Dónde vive hoy la configuración de una escuela

Repartida en siete lugares, ninguno llamado como uno esperaría:

| Qué se configura | Dónde está | Cómo se llama en el menú |
|---|---|---|
| Cobros, mora, recordatorios, llaves de pago | `/payments-automation` | **«Pagos»** |
| Ajustes generales de la escuela | `/school-config` | **no está en el menú** |
| Perfil público, qué se muestra | `/school/public-profile` | «Mi Perfil Público» |
| Lo que la escuela nos paga a nosotros | `/mi-plan` | «Facturación» |
| Deportes y categorías | `/school-sports` | «Deportes y Categorías» |
| Membresías | `/memberships` | «Membresías» |
| Cuenta personal del usuario | `/settings` | «Configuración» |

La consecuencia práctica: para apagar los cobros de una escuela hay que entrar a una pantalla
llamada **«Pagos»**. Para cambiar sus datos generales hay que saber una URL. Y «Configuración» es
la cuenta del usuario, no la escuela.

---

## 2. Las tres causas

**a) El menú está organizado por tabla, no por trabajo.** «Deportes y Categorías», «Membresías»,
«Mis Planes» son nombres de datos. Nadie entra a la app pensando «voy a administrar la tabla de
categorías»: entra pensando «voy a armar los equipos del semestre».

**b) «Configuración» significa tres cosas y las tres compiten.** Mi cuenta, mi escuela y la
plataforma son tres ámbitos distintos con el mismo nombre. El usuario aprende por prueba y error
cuál de los tres necesita.

**c) Nada obliga a que una pantalla de configuración esté en Configuración.** Por eso hay 14
archivos escribiendo `school_settings` desde donde le quedó cómodo a cada uno, y una pantalla
huérfana.

---

## 3. Las tres reglas que evitan la recaída

Sin reglas, cualquier reorganización se vuelve a desordenar en tres sprints. Estas son verificables:

**Regla 1 — Un ámbito, un lugar.** Tres «Configuración» son tres ámbitos y hay que nombrarlos:

| Ámbito | Nombre propuesto | Quién entra |
|---|---|---|
| El usuario | **Mi cuenta** | cualquiera |
| La escuela | **Configuración de la escuela** | admin de escuela |
| La plataforma | **Super Admin** | nosotros |

**Regla 2 — Si escribe `school_settings`, es configuración de la escuela.** Es mecánica y se puede
verificar con un grep en CI. Hoy la romperían 14 archivos; los que sean pantallas de config se
mueven, y los que solo la leen (checkout, perfil público) se quedan.

**Regla 3 — El menú se nombra por el trabajo, no por la tabla.** «Deportes y Categorías» describe
un dato; «Equipos y categorías» describe lo que la persona va a hacer.

---

## 4. El menú propuesto para el rol escuela

Hoy son 208 items y 62 grupos entre todos los roles. La propuesta no es cortar funciones: es que
cada cosa esté donde se busca.

```
Inicio

Día a día              ← lo que se toca todas las semanas
  Asistencia
  Deportistas
  Equipos
  Calendario

Dinero                 ← solo si cobra por SportMaps
  Cobros
  Finanzas
  Recordatorios

Socios                 ← solo si NO cobra por SportMaps
  Membresías

Espacios               ← solo si tiene reservas
  Instalaciones
  Reservas

Crecimiento
  Informes
  Métricas
  Torneos
  Tienda

Configuración de la escuela      ← UN solo lugar, con secciones
  · Datos y sedes
  · Equipos y categorías          (hoy «Deportes y Categorías»)
  · Cobros y llaves de pago       (hoy dentro de «Pagos»)
  · Reservas y tarifas
  · Perfil público
  · Personal y permisos

Mi cuenta
  · Perfil · Notificaciones · Seguridad
  · Facturación de SportMaps      (hoy «Mi Plan»)
```

Tres cosas que esto arregla, y las tres salen de la sección 1:

- **«Cobros y llaves de pago» sale de una pantalla llamada «Pagos»** y entra a Configuración, que es
  donde se busca. Hoy nadie adivina que ahí se apagan los cobros.
- **`/school-config` deja de ser huérfana**: se convierte en «Datos y sedes», la primera sección.
- **«Dinero» y «Socios» son excluyentes**, gobernados por `billing_enabled` — el mismo flag que ya
  filtra el menú. Una escuela ve uno u otro, nunca los dos.

Y encaja con las capacidades de la otra spec: **«Espacios» aparece con `has_reservations`, y
«Reservas y tarifas» solo pide tarifas si el consumo es `per_use_paid`.** El menú deja de necesitar
saber el tipo de escuela.

---

## 5. Cómo se hace sin romper nada

Todo esto es renombrar, reagrupar y mover pantallas. No toca reglas de negocio ni datos, así que se
puede hacer por partes y en cualquier orden.

| Paso | Qué | Costo | Riesgo |
|---|---|---|---|
| 1 | Renombrar los tres «Configuración» según su ámbito | trivial | ninguno |
| 2 | Poner `/school-config` en el menú como «Datos y sedes» | trivial | ninguno — hoy es inalcanzable |
| 3 | Reagrupar el menú del rol escuela según §4 | chico | ninguno: las rutas no cambian |
| 4 | Crear el contenedor «Configuración de la escuela» con secciones y mover ahí las pantallas que ya existen | mediano | bajo: se mantienen las rutas viejas redirigiendo |
| 5 | Sacar la config de cobros de «Pagos» y dejar ahí solo la operación (cartera, comprobantes) | mediano | bajo |
| 6 | El grep de la Regla 2 en CI | chico | ninguno |

**Nada de esto va antes del 19.** Cambiarle el menú a la app el día que entra un cliente nuevo es
buscarse un problema evitable. Después del trial es el momento: Carmel va a ser el primer cliente que
use «Socios» y «Espacios», así que su experiencia dice si la agrupación funciona.

---

## 6. Lo que no propongo, y por qué

**No propongo un menú configurable por escuela.** Sería la respuesta fácil a «cada uno usa cosas
distintas», y convierte un problema de diseño en un problema de soporte: nadie puede ayudar por
teléfono a alguien cuyo menú no conoce. Las capacidades ya filtran lo que sobra; eso alcanza.

**No propongo tocar los 208 items de una vez.** El rol escuela es el que duele y el que más se usa.
Los demás roles se ordenan con el mismo criterio cuando le toque a cada uno.

**No propongo renombrar rutas.** Los nombres visibles cambian; las URLs se quedan. Hay links
compartidos, QR impresos y correos enviados apuntando a rutas actuales.
