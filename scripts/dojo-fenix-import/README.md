# Dojo Fénix — carga inicial de roster

Escuela real: **Dojo Fénix** (Karate), owner `psico.xiomaradiaz@gmail.com` (Merly
Xiomara Díaz Piranquive). `school_id = 26bfb68e-87d4-4792-a1bb-3c65ef5358ce`,
sede única `afa7ed1a-709e-4533-bc57-683099682382`. Onboarding ya estaba
`completed` pero sin ningún atleta cargado.

Fuente: `BASE DE DATOS FENIX.xlsx` (14 personas: nombre, fecha de nacimiento,
responsable, contacto, correo, tiempo en el dojo, cinturón, día de pago).

## Corrida real — 2026-09-02

- **11 menores** → `children` (parent_id NULL, contacto del acudiente en
  `parent_name_temp/parent_phone_temp/parent_email_temp` — se linkea con
  `claim_child_for_parent` cuando el padre se registre).
- **3 adultos** sin responsable en el Excel (Ronald Ruiz Perez, Yeid Natalia
  Camargo Hurtado, Darío Peñuela Infante) → cuenta propia vía
  `POST /auth/v1/invite` (correo de invitación real enviado) + `enrollments.user_id`
  + `school_members` (rol `athlete`).
- **Equipo por edad** (a 2026-09-02): <13 Infantil, 13-17 Juvenil, 18+ Adultos.
  La escuela tenía **'Adultos' y 'Juvenil' duplicados** (creados con 1 min de
  diferencia el 2026-08-11, vacíos, mismo coach/precio) — se usó el más
  antiguo de cada par. Los duplicados vacíos quedaron sin tocar; si la escuela
  confirma que sobran, se pueden borrar a mano.
- **7 categorías de cinturón** creadas en `school_categories` (sport=Karate,
  axis='age' por convención del schema — es el único axis usado hoy en toda la
  plataforma —, `belt`=color): Blanco, Azul, Azul FN, Naranja, Naranja FN,
  Verde, Verde FN. "FN" se interpretó como "franja negra" (sub-nivel dentro
  del color) — **a confirmar con la escuela**, podría ser otra cosa.
- **14 `enrollment_categories`** (una por atleta, `is_primary=true`,
  `billable=true`). **`team_id` se dejó NULL a propósito**: el trigger
  `trg_enrollment_categories_check_team` exige que, si se manda,
  `teams.category_id == category_id`, y acá el equipo es por edad, no por
  cinturón — no comparten fila. (Este fue un error real en la primera pasada:
  los 14 `enrollment_categories` fallaron con `team_id ... no pertenece a
  category_id ...`; los `children`/`enrollments`/cuentas adultas ya se habían
  creado antes de ese paso y se completaron a mano con SQL directo, luego se
  corrigió `01_importar.mjs` para que futuras corridas no repitan el error.)
- **14 pagos pendientes de 09/2026** generados con `open_month(school_id, 2026,
  9)` (RPC oficial, idempotente) — no se insertaron a mano. `amount=$100.000`
  (precio del team, ya que `enrollments.monthly_fee` quedó NULL), `due_date =
  2026-09-10` (payment_cutoff_day de `school_settings`, default 10) **para
  los 14 por igual**.

## Lo que el Excel traía y el sistema NO tiene dónde guardar

El "día de pago" por atleta (ej. "los 15", "los 20", "los 6/7") **no existe
como campo** — los cobros los genera `open_month` con un solo
`payment_cutoff_day` por escuela (hoy: día 10). Si la escuela quiere respetar
esas fechas individuales va a requerir trabajo aparte (no hecho acá).

Tampoco había campo para documento de identidad (cédula) de los menores — el
Excel no lo traía, `children.doc_number` quedó NULL para los 11.

## Uso del script

```
node scripts/dojo-fenix-import/01_importar.mjs                # dry-run
node scripts/dojo-fenix-import/01_importar.mjs --confirmar     # escribe (YA CORRIDO el 2026-09-02, no re-ejecutar)
```

`02_rollback.sql` deshace exactamente lo que quedó de esta corrida (con los
ids reales), en orden inverso. **No borra los 3 `auth.users` de los adultos**
porque ya recibieron el correo de invitación y podrían haber iniciado sesión —
si hace falta borrarlos también, confirmar primero que no entraron.
