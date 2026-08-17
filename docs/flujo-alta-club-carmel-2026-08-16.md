# Dar de alta un club como Carmel, desde cero

**Fecha:** 2026-08-16 · Revisión del flujo real (registro → onboarding), con lo que hay que
elegir en cada pantalla y lo que el flujo **no** contempla todavía.

Caso: **Club Campestre Carmel** — 8 disciplinas, escuela formativa **y** membresías del club que
**se pagan en el club, no por SportMaps**.

---

## 1. El flujo tal como está hoy

| # | Pantalla | Qué pide | Qué hace con eso |
|---|---|---|---|
1 | `RegisterPage` | Rol, nombre de la escuela, **UN deporte**, correo, contraseña | Guarda `sport_id`, `sport_name` y `suggested_categories` en `user_metadata` |
2 | `SchoolSetupPage` | «Tipo de organización»: Escuela / Club / Academia / Gimnasio | Escribe `schools.school_type` |
3 | `SchoolOnboardingWizard` | 6 pasos (abajo) | Crea sede, equipos y/o planes, invita entrenador, primer atleta, métodos de cobro |

Los 6 pasos del wizard, y cuáles son obligatorios de verdad:

| Paso | ¿Obligatorio? | Nota |
|---|---|---|
Tu Sede | **Sí** | — |
Modelo | **Sí** | `teams` / `plans` / `both`. Decide qué pasos siguen |
Primer Equipo | Sí, si el modelo es `teams` o `both` | |
Primer Plan | Sí, si el modelo es `plans` o `both` | |
Entrenador | No — se puede **Saltar** | |
Primer Atleta | No — se puede **Saltar** | |
Cobros | No — se puede **Saltar** | Pero si intentas *guardar*, exige mínimo un método |

---

## 2. Qué elegir para Carmel, pantalla por pantalla

### Registro
- Rol: **Escuela**
- Deporte: **cualquiera** (ver §3.1 — el dato no se usa; poner Fútbol y seguir)

### Tipo de organización
- **Club Deportivo**.
  Después se pasa a `hybrid` desde el panel de super admin, que es lo que prende Reservas.
  No se elige `hybrid` acá porque esa opción no existe en el selector del cliente — y así debe ser:
  el tipo lo asigna el equipo, no el cliente.

### Modelo — **«Equipos / grupos»**, no «Planes / membresías»

Esta es la que se presta a error. Parece que Carmel debería elegir «Planes / membresías» porque
vive de membresías, y es justo al revés:

- Un **plan** en SportMaps es un producto **facturable**: tiene precio y genera cartera. Es la
  «Mensualidad gym, paquete 10 clases» del propio texto de la pantalla.
- La **membresía de Carmel se paga en el club**. Nosotros solo reflejamos su estado. Modelarla como
  plan la mete en la facturación, que es exactamente lo que se decidió no hacer.
- Y su escuela formativa **sí** se organiza por equipos: Sub-12 de fútbol, natación formativa, etc.

Entonces: **Equipos / grupos**. La membresía va por fuera, en `memberships` (`CAR-4`), que todavía
no existe — hasta que exista, el estado de membresía no se refleja en ninguna parte.

### Primer Equipo
Uno real, del deporte que más se use. El resto se cargan después.

### Entrenador y Primer Atleta
**Saltar**. Se cargan con los datos reales cuando estén, y así el acuerdo de tratamiento de datos
(Ley 1581) se firma antes de subir gente de verdad — sobre todo menores.

### Cobros — **Saltar**
Carmel no cobra por SportMaps. El paso permite saltarse, pero si se intenta guardar, exige al menos
un Nequi, una llave Bre-B o una cuenta bancaria. **No poner ninguna**: una llave de cobro cargada
en una escuela que no cobra solo puede terminar en un pago mal dirigido.

### Después del wizard — `scripts/carmel-configurar.mjs`

```bash
node scripts/carmel-configurar.mjs --school-id=<uuid>          # ensayo
node scripts/carmel-configurar.mjs --school-id=<uuid> --apply
```

Deja `school_type='hybrid'`, `billing_enabled=false`, los 8 `sport_configs` con su eje, y las
instalaciones con los 6 carriles de piscina.

---

## 3. Lo que el flujo NO contempla

### 3.1 El deporte del registro es decorativo

La pantalla promete: *«Este deporte autogenerará categorías sugeridas para tu academia»*.

**No ocurre.** `RegisterPage` guarda `sport_id`, `sport_name` y `suggested_categories` en
`user_metadata`, y **nadie los lee**: ni el trigger `handle_new_user` (que sí lee `role`,
`school_name`, `date_of_birth`, `full_name`, `phone`), ni el BFF, ni el wizard. Verificado por grep
sobre migraciones, BFF y frontend.

Así que hoy el selector no crea ni una categoría, ni un `sport_config`, ni un equipo.

**Implicación para el multideporte:** el problema no es que el selector sea de a uno — es que el
dato no se consume. Volverlo múltiple sin escribir el consumidor no cambiaría nada. El orden
correcto es: **primero consumirlo, después permitir varios.**

### 3.2 Ninguna opción de «Modelo» describe a Carmel

Las tres opciones asumen que todo lo que agrupa deportistas se cobra por SportMaps. Falta el caso
«tengo equipos, y además membresías que cobro yo por fuera». Hoy se resuelve eligiendo
`teams` + la tabla `memberships` de `CAR-4`; sería más honesto que la pantalla lo dijera.

### 3.3 El paso de Cobros no sabe que hay escuelas que no cobran

Ahora existe `billing_enabled`. El paso debería **ocultarse** cuando está apagado, en vez de pedir
métodos de pago y confiar en que el usuario acierte a saltarlo. Es un `if` en `buildSteps()`.

### 3.4 `school_type` lo elegía el cliente y nadie lo podía corregir

**Resuelto hoy** (`CAR-1b`): RPC `admin_set_school_type` + selector en el panel de super admin, con
badges que muestran si la escuela quedó con Academia y Reservas.

Y de paso apareció que el selector del onboarding guardaba **`academia`** (con i), valor que la
vista de entitlements no reconoce: una escuela que eligiera esa opción nacía **sin ningún módulo**.
Corregido a `academy`. No había ninguna fila con ese valor — nadie lo había pulsado.

---

## 4. Lo que arreglaría, y cuándo

| # | Qué | Cuándo |
|---|---|---|
1 | Ocultar el paso **Cobros** cuando `billing_enabled = false` | Chico. Después del 19 |
2 | **Consumir** el deporte del registro: crear su `sport_config` al terminar el onboarding | Después del 19 |
3 | Multi-deporte en el registro, encima de (2) | Después de (2) |
4 | Una cuarta opción de Modelo, o renombrar «Planes / membresías» → «Planes que cobro por SportMaps» | Cuando se toque esa pantalla |
5 | `memberships` (`CAR-4`) — sin esto el estado de membresía no se ve en ningún lado | Antes de que Carmel lo pida en serio |

Ninguno bloquea el arranque del martes: con «Equipos / grupos», saltando Cobros y corriendo el
script después, Carmel queda operativo.
