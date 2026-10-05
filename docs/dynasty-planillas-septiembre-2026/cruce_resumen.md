# Cruce planillas Dynasty Volley Club vs SportMaps (septiembre 2026)

Solo lectura. Fuente BD: payments (periodos 2026-08..10), enrollments, children/unregistered_athletes/profiles, attendance_sessions/records (consultado 2026-10-03). Matching por tokens normalizados; "probable" = tokens con diferencias de letra o atleta fuera del equipo de la hoja. Detalle fila a fila en `cruce_pagos.json` y `cruce_asistencia.json`.

## 1. Pagos: totales por clasificacion (filas con valor)

| Clasificacion | Filas | Suma planilla |
|---|---:|---:|
| MARCAR_PAGADO | 29 | $4.810.000 |
| YA_PAGADO_EN_APP | 136 | $21.343.000 |
| MONTO_DISTINTO | 7 | $970.000 |
| SIN_COBRO | 1 | $150.000 |
| DUDOSO | 34 | $4.963.000 |
| NO_ENCONTRADO | 20 | $2.940.000 |
| **Total** | **227** | **$35.176.000** |

- YA_PAGADO_EN_APP con monto distinto al de la planilla: 11 (ver seccion 4).
- Filas SIN valor en papel cuyo cobro de septiembre ya figura `paid` en la app: 12.

## 2. MARCAR_PAGADO (cobro abierto en la app y monto planilla = monto cobro)

Match exacto o probable fuerte, transcripcion no marcada dudosa, sin pago `paid` con fecha cercana. Igual conviene revisar las notas.

| Img#fila | Nombre planilla | Atleta BD | Grupo | Cobro (id) | Estado | Monto | Fecha | Medio -> app | Nota |
|---|---|---|---|---|---|---:|---|---|---|
| 5#3 | AGUILAR LEÓN SARA VICTORIA | SARA VICTORIA AGUILAR LEON | INFANTIL FEMENINO | `f3396078-5453-4db4-855a-88164b1967bc` | overdue | $210.000 | 2026-09-04 | BC -> transfer |  |
| 5#5 | ALVAREZ ROJAS ISABELLA | ISABELLA ALVAREZ ROJAS | INFANTIL FEMENINO | `7be32dfc-ca03-44af-aae1-147fe530bd2c` | overdue | $180.000 | 2026-08-31 | QR -> transfer | fecha de agosto (adelantado); COBRO DE AGOSTO TAMBIEN ABIERTO |
| 5#17 | CARVAJAL ACOSTA SARAY | SARAY CARVAJAL ACOSTA | INFANTIL FEMENINO | `80f0d836-ee38-4df3-9e7b-7eaf5aa557a4` | overdue | $180.000 | 2026-09-09 | BC -> transfer |  |
| 5#23 | CUERVO LUNA | LUNA ISABELLA CUERVO BELTRAN | INFANTIL FEMENINO | `00baeb03-db75-4906-9e2e-375ff7f07acb` | overdue | $180.000 | 2026-09-07 | TC Deb -> card |  |
| 5#35 | GONZALEZ HERNANDEZ LAURA SOFIA | LAURA SOFIA GONZALEZ HERNANDEZ | INFANTIL FEMENINO | `79d40d81-c7bc-449e-8841-d953773bdcca` | overdue | $150.000 | 2026-09-14 | Efectivo -> cash |  |
| 6#6 | BECERRA EDWARD | Edward Samuel Becerra Perez | INFANTIL MASCULINO | `34cd5b84-bade-4287-b5e8-501128ea1588` | overdue | $180.000 | 2026-09-14 | BC -> transfer |  |
| 6#17 | MORA DUARTE JOSE GABRIEL | JOSE GABRIEL MORA DUARTE | INFANTIL MASCULINO | `7fe769e5-9ca1-4166-8abd-83dfca64f273` | overdue | $150.000 | 2026-09-15 | BC -> transfer |  |
| 6#21 | MUÑOZ SANTIAGO | SANTIAGO MUÑOZ ALVAREZ | INFANTIL MASCULINO | `ef44f1e1-9a67-473d-8d3b-c76d23917b12` | overdue | $180.000 | 2026-09-03 | BC -> transfer |  |
| 6#27 | PUENTES SAMUEL | Samuel Puentes Barrera | INFANTIL MASCULINO | `2a6e74f1-4586-4c10-af09-7dfa93fd4c18` | overdue | $150.000 | 2026-09-08 | Efectivo -> cash |  |
| 6#34 | Ramirez Rincón Arturo | ARTURO RAMIREZ RINCON | INFANTIL MASCULINO | `440d4038-5330-4212-b8eb-4fc639abf2ec` | overdue | $150.000 | 2026-09-13 | Llave -> transfer |  |
| 8#28 | GUERRERO SILVANA | Silvana Guerrero Méndez. | INTERMEDIO | `eb92be6d-49f6-443a-90c6-ef7853365274` | overdue | $150.000 | 2026-09-02 | BC -> transfer |  |
| 11#39 | RODRIGUEZ LOPEZ GABRIELA | GABRIELA RODRIGUEZ LOPEZ | MENORES FEMENINO | `944e6131-f12d-4678-8f4a-d2455e20696e` | overdue | $180.000 | 2026-09-05 | BC -> transfer |  |
| 11#42 | ROZO CORTES SAHARA SOPHIA | SAHARA SOPHIA ROZO CORTES | MENORES FEMENINO | `e6d8db35-5490-4b95-87d7-98d244e6e249` | overdue | $180.000 | 2026-09-03 | BC -> transfer |  |
| 11#44 | SEVILLA MARIANA | MARIANA SEVILLA REY | MENORES FEMENINO | `6362f5a1-b1dd-4dd8-bd90-f03224effaec` | overdue | $180.000 | 2026-09-11 | BC -> transfer |  |
| 12#8 | CRUZ LOPEZ ERIKA JHOANA | ERIKA JHOANA CRUZ LOPEZ | SENIORS | `7f3078f2-9a71-4be2-b727-851a433cc354` | overdue | $130.000 | 2026-09-14 | BC -> transfer |  |
| 12#14 | HERNANDEZ DARWIN | DARWIN HERNANDEZ | SENIORS | `8e245177-9368-4537-945b-33109e926839` | awaiting_approval | $130.000 | 2026-09-06 | Llave -> transfer | ya tiene comprobante en revision: APROBAR, no crear |
| 12#19 | MEDINA DAYANA | Dayana Valentina Medina Escobar | SENIORS | `556841b7-3af3-4458-b396-26f347016f86` | overdue | $130.000 | 2026-09-12 | QR -> transfer | tiene un pago sin periodo |
| 12#20 | MONTEALEGRE MAURICIO | Mauricio Montealegre | SENIORS | `a8af8ba8-a012-447a-b3d3-ffe470ed7b3a` | overdue | $130.000 | 2026-09-14 | BC -> transfer |  |
| 21#39 | GUTIERREZ SUSANA | MARIA SUSANA GUTIERREZ GUEVARA | INFANTIL FEMENINO | `add9479c-f3de-4412-8de5-660e1b892b75` | overdue | $210.000 | 2026-09-03 | BC -> transfer |  |
| 21#46 | LEON JULIANA | JULIANA LEON JAIME | INFANTIL FEMENINO | `a6bfd31a-fff0-40c9-9e75-872dc246c49a` | overdue | $180.000 | 2026-09-16 | Llave -> transfer |  |
| 21#50 | MARIN LOMBO SALOME | SALOME MARIN LOMBO | INFANTIL FEMENINO | `2950ae8e-e632-485f-b6dd-e8d1c1062af6` | overdue | $180.000 | 2026-09-05 | Efectivo -> cash |  |
| 21#55 | MONROY SHADDAI | SHADDAI ALEXANDRA MONROY DIAZ | INFANTIL FEMENINO | `83face8a-1687-41c6-992c-eb951ebc857a` | overdue | $150.000 | 2026-09-14 | Efectivo -> cash |  |
| 21#58 | MORENO SALAS MARIA JOSE | MARIA JOSE MORENO SALAS | INFANTIL FEMENINO | `ed3c7e28-6f0a-48ed-8b6d-12c545b60dbf` | overdue | $180.000 | 2026-09-06 | Efectivo -> cash |  |
| 21#63 | PASTRANA CORREA SOFIA ISABEL | SOFIA ISABEL PASTRANA CORREA | INFANTIL FEMENINO | `aa42727c-07b6-44bd-8eb9-5b587312f375` | overdue | $90.000 | 2026-09-04 | Llave -> transfer |  |
| 23#20 | ZABALETA CRISTIAN | CRISTIAN ZABALETA GUASCA | MENORES MASCULINO | `14160915-d20e-4bc9-a69d-e8fc8ac9cb1c` | overdue | $180.000 | 2026-09-06 | BC -> transfer |  |
| 23#21 | Torres Cristhopher | CHRISTOPHER SMITH TORRES MONDRAGON | MENORES MASCULINO | `77d01077-9e00-4fe3-8299-e49b12c85260` | overdue | $150.000 | 2026-09-05 | Efectivo -> cash | match probable: tokens con diferencia de letras/truncados |
| 27#18 | Goez Manuela | Manuela Góez Cárdenas | MINIVOLLEY BENJAMINES | `daa9f9a7-54fa-425c-9f8b-840759058055` | overdue | $180.000 | 2026-09-01 | BC -> transfer |  |
| 28#79 | SANTACRUZ SILVA SOFIA | SOFIA SANTACRUZ SILVA | INFANTIL FEMENINO | `93533104-19f9-4c64-be8a-a4db878d79de` | overdue | $210.000 | 2026-09-30 | TC -> card |  |
| 28#81 | VANEGAS ISABELLA | ISABELLA VANEGAS PAREJA | INFANTIL FEMENINO | `3beb68f0-6213-4160-9e3a-f891cbfb985a` | overdue | $180.000 | 2026-09-25 | Llave -> transfer |  |

## 3. MONTO_DISTINTO (cobro abierto, monto diferente)

| Img#fila | Nombre planilla | Atleta BD | Planilla | Cobro abierto | Cobro id | Fecha | Medio | Nota |
|---|---|---|---:|---:|---|---|---|---|
| 5#2 | AGUDELO MARIA PAULA | MARIA PAULA AGUDELO | $180.000 | $150.000 | `cc167fc1-9b24-484f-b59d-b7d001ec48a0` | 2026-09-21 | Efectivo |  Medio escrito 'Efect.' con tachón |
| 5#25 | ESCALLON CRISTIE | CHRISTIE ESCALLON SANCHEZ | $100.000 | $150.000 | `8d6f28f2-0370-4fd4-949b-9c10b3ac44b8` | 2026-09-02 | Efectivo |  Anotado 'Abona' (abono parcial) |
| 6#3 | AYCARDY OSPINO LUIS FELIPE | LUIS FELIPE AYCARDY OSPINO | $210.000 | $150.000 | `6a140e08-b590-4b52-8b50-6ac89dd50d75` | 2026-09-01 | Llave |  |
| 8#16 | ELIZARLDE SOFIA | LAYLA SOFHIA ELIZALDE GALINDO | $90.000 | $150.000 | `5fa45b72-48f3-46ac-ae01-35348ddca251` | 2026-09-21 | QR |  |
| 21#43 | JOVEN ALEJANDRA | MARIA ALEJANDRA JOVEN REAL | $60.000 | $150.000 | `2f6edcff-cde2-43e1-825c-ee8ca6e06599` | 2026-09-23 | BC |  |
| 21#48 | LUNA PAULA | PAULA JIMENA LUNA CARDENAS | $150.000 | $180.000 | `7eb25ed8-b4c7-45b4-b6ac-fb81f0fa8995` | 2026-09-04 | BC |  |
| 21#52 | MARTINEZ JIMENEZ ANA MARIA | ANA MARIA MARTINEZ JIMENEZ | $180.000 | $250.000 | `8130d7d8-2aef-4993-9301-e23632b23ef5` | 2026-09-16 | BC |  |

## 4. YA_PAGADO_EN_APP con monto distinto (no requieren accion de cobro, pero el valor no cuadra)

| Img#fila | Nombre planilla | Atleta BD | Planilla | Pagado en app |
|---|---|---|---:|---|
| 1#15 | MAHECHA CARLOS | carlos arturo mahecha pinto | $150.000 | 2026-8 $180.000 2026-08-25, 2026-9 $180.000 2026-09-04 |
| 5#18 | CASTILLO NATALIA | NATHALIA CASTILLO PEÑA | $180.000 | 2026-9 $90.000 2026-09-16 |
| 5#26 | ESCOBAR BENITEZ MARIA PAULA | MARIA PAULA ESCOBAR BENITEZ | $180.000 | 2026-9 $210.000 2026-09-17 |
| 6#26 | PASTOR ALDANA JULIAN SANTIAGO | JULIAN SANTIAGO PASTOR ALDANA | $150.000 | 2026-9 $180.000 2026-09-11 |
| 11#35 | RANGEL RUIZ VALERIA | VALERIA RANGEL RUIZ | $100.000 | 2026-9 $150.000 2026-09-05 |
| 21#44 | LEAL CORTES MARIANA | DANNA MARIANA LEAL CORTES | $180.000 | 2026-9 $150.000 2026-09-08 |
| 21#56 | MORA RIGUEROS MARIA JOSE | MARIA JOSE MORA RIGUEROS | $180.000 | 2026-9 $150.000 2026-09-07 |
| 21#66 | RINCON GOMEZ SALOME | SALOME RINCON GOMEZ | $180.000 | 2026-9 $160.000 2026-09-10 |
| 26#10 | Prieto Pedroza Salome | SALOMÉ PRIETO PEDRAZA | $93.000 | 2026-9 $150.000 2026-10-02 |
| 27#32 | Mateus León Isabella | Isabella Mateus Leoon | $180.000 | 2026-9 $150.000 2026-09-12 |
| 30#43 | Illera Echevarria Mattias | MATIAS ILLERA ECHEVERRIA | $90.000 | 2026-9 $180.000 2026-09-17 |

## 5. SIN_COBRO (atleta encontrado, sin cobro vigente del periodo)

- img26#5 Albarracin Arianny -> Arianny Isamar Albarracín Ortega ((sin equipo)) $150.000 2026-09-05 BC. Cobros en ventana: ninguno

## 6. NO_ENCONTRADO

| Img#fila | Grupo | Nombre planilla | Valor | Fecha | Medio | Nota |
|---|---|---|---:|---|---|---|
| 1#27 | Juvenil-Mayores Masculino | Bohorquez Juan Pablo | $50.000 | 2026-09-15 |  | planilla: Nombre manuscrito añadido; 50.000 (¿abono parcial?); sin medio |
| 5#22 | Infantil Femenino | CUCUNUBA LUCIANA | $150.000 | 2026-08-30 | BC | planilla: Anotado 'INCAP.' (incapacidad) |
| 5#28 | Infantil Femenino | FONTECHA MALEJA | $150.000 | 2026-09-04 | Llave |  |
| 6#7 | Infantil Masculino | CALDERON LOPEZ MATHIAS | $210.000 | 2026-09-03 | Datáfono |  |
| 6#10 | Infantil Masculino | CUELLAR JUAN SEBASTIAN | $150.000 | 2026-09-01 |  | planilla: Monto poco claro: 150000 o 180000; sin medio |
| 11#61 | MENORES FEMENINO | Vera Norely | $150.000 | 2026-07 | Efectivo | planilla: Manuscrito; nombre dudoso ('Vera Nordy/Norely'). Columnas corridas: en VALOR dice 'Julio' y en FECHA… |
| 12#22 | SENIORS | OSPINA MANUELA | $130.000 | 2026-09-10 | BC | planilla: Manuscrito junto al nombre: 'Alexandra' (posible segundo nombre) |
| 12#24 | SENIORS | PARDO MALU | $130.000 | 2026-09-03 | QR |  |
| 20#44 | Seniors | Tanya Diaz | $130.000 | 2026-09-16 | BC | planilla: Manuscrito poco legible (se lee 'Ranyd Draz'); probable 'Tanya Díaz' |
| 20#None | Seniors | Trejos Lizeth | $150.000 | 2026-09-15 | BC | planilla: Manuscrito sin numero; se lee 'Trejo, Lizeth' / 'Trejos Lizeth'. Valor '1J0000' interpretado como 15… |
| 23#24 | Menores Masculino (impreso: Infantil Masculino) | Peña Samuel | $100.000 | 2026-09-20 | BC | planilla: Manuscrito ('Peña Jamuel' en la letra -> probable Samuel). Valor '100 000' con trazo inicial raro |
| 23#25 | Menores Masculino (impreso: Infantil Masculino) | Niño Daniel | $300.000 | 2026-09-21 | BC | planilla: Manuscrito: 'Niño Daniel - 2 MESES' (300000 cubre 2 meses). Debajo, una palabra borrada/difuminada q… |
| 26#1 | (no indicado en la hoja) | Saenz Rojas Ana Maria | $150.000 | 2026-09-05 | Efectivo | grupo de la hoja inferido, no impreso |
| 26#2 | (no indicado en la hoja) | Saenz Rojas Sofia | $150.000 | 2026-09-05 | Efectivo | grupo de la hoja inferido, no impreso |
| 26#11 | (no indicado en la hoja) | Garzon Jaraiba Maria Sofia | $150.000 | 2026-09-18 | BC | grupo de la hoja inferido, no impreso / planilla: Apellidos dificiles: se lee 'Caron/Garzon Jodi?ba/Jaraiba'. … |
| 26#12 | (no indicado en la hoja) | Garzon Jaraiba Emanuel | $150.000 | 2026-09-18 | BC | grupo de la hoja inferido, no impreso / planilla: Apellidos dificiles (ver fila 11). Fecha podria ser 'Sep 16'… |
| 26#15 | (no indicado en la hoja) | Sierra Fuentes Antonella | $90.000 | 2026-09-23 | BC | grupo de la hoja inferido, no impreso |
| 27#19 | MINI | Gómez Juan Fernando | $150.000 | 2026-08-31 | BC | planilla: Medio escrito 'BC - NP.' (sigla NP sin interpretar). |
| 30#41 | (no indicado; probablemente Infantil Masculino por los varones y las referencias cruzadas desde Mini) | Zorro Juan Andrés | $150.000 | 2026-09-11 | QR | grupo de la hoja inferido, no impreso / planilla: La 'Z' esta sobrescrita. |
| 30#46 | (no indicado; probablemente Infantil Masculino por los varones y las referencias cruzadas desde Mini) | Emmanuel Garzon Jaraiza | $150.000 | 2026-09-20 | BC | grupo de la hoja inferido, no impreso / planilla: Valor dudoso (150.000 vs 180.000). Apellidos dificiles ('Car… |

## 7. DUDOSO (transcripcion dudosa, match ambiguo/debil, o posible dinero ya registrado)

| Img#fila | Nombre planilla | Candidato(s) BD | Valor | Fecha | Cobros sep | Motivo |
|---|---|---|---:|---|---|---|
| 1#21 | PELAEZ HOLMAN | HOLLMAN ANDRES PELAEZ CHAPARRO | $150.000 | 2026-10-01 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Escrito justo bajo 'RETIRADO', en el borde entre filas 21 y 22; por el patrón de la hoja (e… |
| 5#30 | GARZON CONTRERAS ISABELLA | ISABELLA GARZON CONTRERAS | $150.000 | 2026-09-27 | 9:$180.000:overdue | cobro(s) abiertos: [180000] vs planilla 150000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / planilla: Día poco claro: 27 (podría ser 21) |
| 6#4 | BALAGUERA VALBUENA JOSHUA | JOSHUA NICOLAS BALAGUERA VALBUENA | $150.000 | 2026-08-27 | 8:$150.000:paid, 9:$150.000:overdue | OJO: ya hay pago(s) paid con fecha cercana: 2026-8 150000 2026-08-27 (19b67d85-f157-45f7-b672-e1636438426a) / clasificacion original MARCAR_PAGADO; posible mismo dinero y… |
| 6#15 | HERRERA TORRES SERGIO | SERGIO HERRERA TORRES [(sin inscripcion activa)]; Sergio Herrera [INFANTIL MASCULINO] | $210.000 | 2026-09-14 |  | match ambiguo: fuera del equipo de la planilla (estuvo inscrito en ese equipo); en el equipo de la planilla hay otro registro/candidato: Sergio Herrera [IM] 0.667 |
| 6#18 | MORA DUARTE ANDRES ESTEBAN | ANDRES ESTEBAN MORA DUARTE | $150.000 | 2026-09-15 | 9:$180.000:overdue | cobro(s) abiertos: [180000] vs planilla 150000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / planilla: Segundo dígito sobrescrito (5 sobre 8): 1… |
| 6#22 | NIGRINIS SANTIAGO | SANTIAGO NIGRINIS GARCIA | $150.000 | 2026-09-05 | 9:$150.000:overdue | OJO: ya hay pago(s) paid con fecha cercana: 2026-8 150000 2026-09-04 (c86ea215-536d-481a-8aed-1c7b8b12b76b) / clasificacion original MARCAR_PAGADO; posible mismo dinero y… |
| 6#38 | Andres Felipe Rial Rodriguez | ANDRES FELIPE RIOS RODRIGUEZ | $90.000 | 2026-09-05 | 9:$90.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Manuscrito; 'Rial' poco legible |
| 8#6 | BARON SALOME | SALOME BARON GARCIA | $150.000 | 2026-09-13 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil |
| 8#15 | CRUZ REAL SILVANA | Silvanna Cruz Real | $150.000 | 2026-08-29 | 8:$150.000:overdue, 9:$150.000:overdue | OJO: el cobro de AGOSTO tambien esta abierto; el pago fechado en agosto podria ser de agosto / clasificacion original MARCAR_PAGADO; match probable debil |
| 11#37 | RIAÑO XIMENA | ASTRID JIMENA RUBIANO ACOSTA [SENIORS]; MARIA XIMENA ROJAS PINEDA [NUEVA ERA] | $180.000 | 2026-08-30 |  | match ambiguo: varios candidatos con el mismo puntaje |
| 11#50 | VARGAS BENAVIDES MARIANA | MARIANA VARGAS BENAVIDES | $150.000 |  | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Fecha solo 'Sep' sin día; sin medio. Monto parece 150 000 (podría ser 180 000). |
| 11#52 | VASQUEZ KATHALINA | KATHALINA VASQUEZ VELASQUEZ | $90.000 | 2026-08-26 | 8:$90.000:paid, 9:$90.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil / planilla: Medio escrito 'B C.' |
| 11#60 | Zambrano Daniela | DANIELA SOFIA ZAMBRANO HENAO | $150.000 | 2026-09-05 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Manuscrito. Repite la fila 54 impresa 'ZAMBRANO DANIELA' (posible duplicado). El monto podr… |
| 19#40 | SANCHEZ ANA MARIA | ANA MARIA SANCHEZ PRIETO | $150.000 | 2026-09-10 | 9:$90.000:overdue | cobro(s) abiertos: [90000] vs planilla 150000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / grupo de la hoja inferido, no impreso / planilla: Di… |
| 20#38 | SUAREZ MARTINEZ DANIEL | DANIEL SUAREZ MARTINEZ | $65.000 | 2026-09-21 | 9:$130.000:overdue | cobro(s) abiertos: [130000] vs planilla 65000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / planilla: Dia escrito raro (parece '£1'); probable 2… |
| 20#42 | Aycardy Luis Manuel | LUIS MANUEL AYCARDY VEGAS | $130.000 | 2026-09-01 | 9:$130.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Manuscrito; apellido podria ser 'Aycardi' |
| 20#None | Vela Gómez Leonel | LEONEL VELA GOMEZ | $100.000 |  |  | medio 'Oct.' sin mapeo / clasificacion original SIN_COBRO; transcripcion marcada dudosa / planilla: Fila manuscrita en TINTA AZUL sin numero (misma persona que la fila 40… |
| 21#41 | HERNANDEZ GABRIELA | GABRIELA HERNANDEZ RONDON | $180.000 |  | 9:$180.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Letra 'P' escrita antes del valor (¿pendiente?). Dia ilegible ('Sep 0' + un trazo, con una … |
| 21#59 | NIETO ROJAS MIA GABRIELA | MIA GABRIELA NIETO ROJAS | $150.000 | 2026-08-30 | 8:$150.000:paid, 9:$150.000:overdue | OJO: ya hay pago(s) paid con fecha cercana: 2026-8 150000 2026-08-30 (82ba9889-0315-4514-a1d0-f52728d0e7f0) / clasificacion original MARCAR_PAGADO; posible mismo dinero y… |
| 21#74 | RUIZ LAURA | LAURA NICOLE RUIZ CRUZ | $150.000 | 2026-09-12 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil |
| 23#16 | QUINTERO SEBASTIAN | JUAN SEBASTIAN QUINTERO SERRANO | $210.000 | 2026-09-21 | 9:$210.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Fecha escrita 'Sep 2ı' (digitos pegados): probable 21, podria ser 2 |
| 26#3 | Rojas Valencia Antonella | ANTONELA ROJAS VALENCIA | $210.000 | 2026-09-05 | 9:$150.000:overdue | cobro(s) abiertos: [150000] vs planilla 210000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / grupo de la hoja inferido, no impreso / planilla: V… |
| 26#13 | Ballesteros Guevara Luciana | LUCIANA BALLESTEROS GUEVARA | $150.000 | 2026-09-19 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil / grupo de la hoja inferido, no impreso |
| 27#4 | Bejarano Sara | Sara Camila Bejarano | $180.000 | 2026-09-14 | 9:$180.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Valor: segundo digito poco claro (180.000 vs 100.000/160.000). |
| 27#5 | Caicedo Bayona Juan Felipe | JUAN FELIPE CAICEDO BAYONA | $90.000 | 2026-09-18 | 9:$90.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Valor sobrescrito: '9?.000' (podria ser 97.000 o 90.000). En img 30 fila 45 aparece 'Caiced… |
| 27#9 | Castro Sofía | Sara Sofía Castro Sánchez | $150.000 | 2026-09-05 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil |
| 27#10 | Ceballos Velandia María José | MARIA JOSE CEBALLOS VELANDIA | $180.000 | 2026-09-08 | 9:$180.000:overdue | clasificacion original MARCAR_PAGADO; transcripcion marcada dudosa / planilla: Valor: segundo digito poco claro (180.000 vs 150.000). |
| 27#16 | García María Paula | MARIA PAULA GARCIA SALTOS | $90.000 | 2026-08-31 | 8:$110.000:paid, 9:$90.000:overdue | OJO: ya hay pago(s) paid con fecha cercana: 2026-8 110000 2026-08-31 (c21f0904-37bb-4183-8afd-595e71c77aaf) / clasificacion original MARCAR_PAGADO; posible mismo dinero y… |
| 27#36 | Núñez Osorio Gabriela | Gabriela nuñez osorio [(sin equipo)]; Gabriela Núñez [MINIVOLLEY BENJAMINES] | $180.000 | 2026-09-16 |  | match ambiguo: fuera del equipo de la planilla; en el equipo de la planilla hay otro registro/candidato: Gabriela Núñez [MINI] 0.667 |
| 28#75 | SABOGAL MARIANA | MARIANA SABOGAL GORDO | $150.000 | 2026-09-01 | 9:$150.000:overdue | clasificacion original MARCAR_PAGADO; match probable debil |
| 28#78 | SÁNCHEZ MARIANA | MARIANA ARIZA SANCHEZ [INFANTIL FEMENINO]; MARIANA SANCHEZ POVEDA [INFANTIL FEMENINO]; LINDA ARIANA SANCHEZ HE… | $180.000 | 2026-09-21 |  | match ambiguo: varios candidatos con el mismo puntaje |
| 28#87 | Cely Hernandez Maria Alejandra | MARIA ALEJANDRA CELY HERNANDEZ | $168.000 | 2026-09-06 | 9:$180.000:overdue | cobro(s) abiertos: [180000] vs planilla 168000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / planilla: Manuscrito. Valor '16&000': tercer digito… |
| 30#39 | Torres Mendieta Juan Jose | JUAN JOSE TORRES MENDIETA | $90.000 | 2026-09-06 | 9:$150.000:overdue | cobro(s) abiertos: [150000] vs planilla 90000 / clasificacion original MONTO_DISTINTO; transcripcion marcada dudosa / grupo de la hoja inferido, no impreso / planilla: Ap… |
| 30#42 | Vargas Saldaña Santiago | SANTIAGO VASQUEZ SALDAÑA [INFANTIL MASCULINO]; JULIAN SANTIAGO PASTOR ALDANA [INFANTIL MASCULINO] | $90.000 | 2026-09-12 |  | match ambiguo: varios candidatos con el mismo puntaje / grupo de la hoja inferido, no impreso / planilla: Fecha corregida/sobrescrita (se lee 'Sep 1?': 12 o 17). Numero d… |

## 8. Atletas que aparecen en mas de una fila con pago

- JUAN ANDRES APARICIO ROMERO: img6#2 (Infantil Masculino) $150.000 2026-08-27 BC -> YA_PAGADO_EN_APP; img23#1 (Menores Masculino (impreso: Infantil Masculino)) $150.000 2026-09-01 BC -> YA_PAGADO_EN_APP | cobros: 2026-8 $150.000 paid 2026-07-29, 2026-9 $150.000 paid 2026-10-01
- SEBASTIAN PEREZ PEÑA: img6#8 (Infantil Masculino) $150.000 2026-09-02 BC -> YA_PAGADO_EN_APP; img6#37 (Infantil Masculino) $150.000 2026-09-04 Llave -> YA_PAGADO_EN_APP | cobros: 2026-9 $150.000 paid 2026-09-04
- JUAN MARTIN FORERO PINZON: img6#36 (Infantil Masculino) $150.000 2026-09-03 QR -> YA_PAGADO_EN_APP; img23#5 (Menores Masculino (impreso: Infantil Masculino)) $150.000 2026-09-15 BC -> YA_PAGADO_EN_APP | cobros: 2026-9 $90.000 cancelled None, 2026-9 $90.000 cancelled None, 2026-9 $150.000 paid 2026-09-03

## 9. Retiros, deudas, incapacidades y cambios de grupo (anotados en papel) vs estado en la app

Incluye filas con nota de retiro/DEBE/INCAP/cambio de grupo y filas resaltadas en azul (codigo de color de la hoja, no escrito).

| Img#fila | Nombre planilla | Nota / resaltado | Match | Atleta BD | Inscripciones (equipo:estado; A=activa, X=cancelada) |
|---|---|---|---|---|---|
| 1#20 | PALACIOS HENRY | RETIRADO | probable | HENRY PALACIOS LOAIZA | JUVENIL MAYORES MASCULINO:X, JUVENIL MAYORES MASCULINO:X |
| 1#21 | PELAEZ HOLMAN | Escrito justo bajo 'RETIRADO', en el borde entre filas 21 y 22; por el… | probable | HOLLMAN ANDRES PELAEZ CHAPARRO | JUVENIL MAYORES MASCULINO:A, JUVENIL MAYORES MASCULINO:X |
| 5#16 | CARRION MARIA JOSE | Escrito 'Nueva ERA.' (se pasó a Nueva Era; aparece en la asistencia de… | probable | MARIA JOSE CARRION REINA | NUEVA ERA:A, NUEVA ERA:X |
| 5#22 | CUCUNUBA LUCIANA | Anotado 'INCAP.' (incapacidad) | no_encontrado | - | - |
| 6#13 | GUILLEN ARAQUE EYCKER ADRIAN | Retirado; Nº resaltado en amarillo | probable | EYCKER ADRIAN GUILLEN ARAQUE | INTERMEDIO:A, INTERMEDIO:X |
| 6#23 | ORTEGON JUAN DAVID | Retirado | probable | JUAN DAVID ORTEGON PALACIOS | (sin equipo):X, INFANTIL MASCULINO:X |
| 6#28 | QUINTERO CASALLAS MATTIAS | Anotado '-Menores' (se pasó al grupo Menores) | probable | MATIAS QUINTERO CASALLAS | INFANTIL MASCULINO:A |
| 8#3 | ARENAS MAFE | '→ Nueva era.' (se pasó a Nueva Era) | no_encontrado | - | - |
| 8#4 | ARTURO PINZON MARIA ANTONIA | 'DEBE → SE RETIRA' | probable | Maria ANTONIA ARTURO PINZÓN | MINIVOLLEY BENJAMINES:A |
| 8#7 | BARRETO VALERY | Retirada | probable | VALERY BARRETO CARVALHO | NUEVA ERA:A |
| 8#9 | BERMUDEZ MANUELA | Retirada. [azul] | probable | Manuela Alejandra Bermudez González | INTERMEDIO:X |
| 8#11 | BERTEL VANESA | 'DEBE $180 000' (el segundo dígito está borroso: 180000 o 100000). Es … | no_encontrado | - | - |
| 8#12 | CABEZAS GAR DANNA GABRIELA | [azul] | probable | DANNA GABRIELA CABEZAS GARCIA | (sin equipo):X, INTERMEDIO:A |
| 8#13 | CALDERON MARIA PAULA | [azul] | exacto | MARIA PAULA CALDERON MONTENEGRO | INTERMEDIO:A, INTERMEDIO:X |
| 8#21 | GARZON MICHELL KATHERINE | [azul] | exacto | MICHELL KATHERINE GARZON RODRIGUEZ | (sin equipo):X, INTERMEDIO:A |
| 8#23 | GIRALDO ALISSON | 'Debe $180 000' (deuda, no pago) | no_encontrado | - | - |
| 8#25 | GOMEZ SALOME38 | Así está impreso: 'GOMEZ SALOME38' [azul] | ambiguo | SALOME GOMEZ PRADO | (sin equipo):X, INFANTIL FEMENINO:A |
| 8#26 | GUAUTA FERNANDA | [azul] | exacto | MARAI FERNANDA GUAUTA QUINTERO | INTERMEDIO:A |
| 8#27 | GUERRA FABIANA | [azul] | exacto | FABIANA SOFIA GUERRA BLANCO | (sin equipo):X, INTERMEDIO:A |
| 8#30 | GUTIERREZ MARIANA | [azul] | ambiguo | Mariana Gutierrez Guerrero | (sin equipo):A |
| 8#32 | JURADO SALOME | Retirada [azul] | exacto | SALOME JURADO LOZADA | (sin equipo):X, INTERMEDIO:A |
| 8#33 | LADINO ANA MARIA | Retirada. [azul] | exacto | ANA MARIA LADINO GUTIERREZ | (sin equipo):X, INTERMEDIO:A |
| 8#35 | LEGUIZAMON RODRIGUEZ ISABELLA | Retirada [azul] | exacto | ISABELLA LEGUIZAMON RODRIGUEZ | INTERMEDIO:A, INTERMEDIO:X |
| 8#37 | LOPEZ SARA SOFIA | [azul] | ambiguo | SARA SOFIA LOPEZ MACHADO | MINIVOLLEY BENJAMINES:A |
| 11#36 | REYES CASTILLO MARIA ALEJANDRA | Retirada (escrito sobre la columna VALOR) | no_encontrado | MARIA ALEJANDRA CANTOR CASTILLA [(sin inscripcion activa)]; MARIA ALEJANDRA FONTECHA GONZALEZ [INFANTIL FEMENINO]; MARIA ALEJANDRA CELY HERNANDEZ [INFANTIL FEMENINO] | - |
| 11#47 | SUPELANO JUANITA | Retirada. | probable | JUANITA SUPELANO OJEDA | MENORES FEMENINO:X |
| 11#48 | TOLOZA TATIANA | Retirada | no_encontrado | - | - |
| 12#25 | PARDO RODRIGUEZ MARIA LUISA | Nombre TACHADO con una línea (posible retiro) | exacto | MARIA LUISA PARDO RODRIGUEZ | SENIORS:A |
| 19#None | Prieto Martinez Isabella | Fila sin numero, prefijo 'INT' a la izquierda y en MEDIO escribe 'Inte… | probable | ISABELLA PRIETO MARTINEZ | INTERMEDIO:A |
| 19#49 | Buitrago Forero Gabriela | Manuscrito. En asistencia Infantil Femenino (idx 18, fila 12) 'Buitrag… | exacto | Gabriela Buitrago Forero | NUEVA ERA:A |
| 21#47 | LOPEZ BRIKYN ZHUANI | Retirada (fila resaltada en azul) [azul] | probable | BIRKYM ZHANIA LOPEZ VARGAS | (sin equipo):X, INFANTIL FEMENINO:A |
| 21#53 | MIDEROS RODRIGUEZ SARA SOFIA | Retirada (fila resaltada en azul) [azul] | exacto | SARA SOFIA MIDEROS RODRIGUEZ | (sin equipo):X, INFANTIL FEMENINO:A |
| 21#57 | MORA RODRIGUEZ MARIA JOSE | 'INCAP.' (incapacidad) escrito junto al nombre; fila resaltada en azul… | exacto | MARIAJOSE MORA RODRIGUEZ | INFANTIL FEMENINO:A |
| 21#70 | RODRIGUEZ ESPITIA MARIA JULIANA | Fila resaltada en azul sin texto (en el resto de la hoja el azul acomp… | ambiguo | MARIA JULIANA RODRIGUEZ ESPITIA | INFANTIL FEMENINO:X |
| 21#72 | ROJAS MORENO SARA ISABELLA | Retirada (fila resaltada en azul) [azul] | exacto | SARA ISABELLA ROJAS MORENO | (sin equipo):X, INFANTIL FEMENINO:A |
| 21#73 | RUEDA SARA | Retirada (fila resaltada en azul) [azul] | exacto | SARA RUEDA SUAREZ | INFANTIL FEMENINO:A, INFANTIL FEMENINO:X |
| 23#5 | GALINDO GABRIEL | Sin pago (numero 5 repetido en la hoja) | exacto | GABRIEL ENRIQUE GALINDO PAEZ | (sin equipo):X, MENORES MASCULINO:A |
| 23#17 | SAN MIGUEL DAVID Santiago | Numero 17 repetido; 'Santiago' añadido a mano | exacto | DAVID SANTIAGO SANMIGUEL LINARES | MENORES MASCULINO:A |
| 23#25 | Niño Daniel | Manuscrito: 'Niño Daniel - 2 MESES' (300000 cubre 2 meses). Debajo, un… | no_encontrado | - | - |
| 27#2 | Anaya Sofía | Fila completa resaltada en azul, sin pago. [azul] | ambiguo | SOFIA ANAYA VARGAS [MINIVOLLEY BENJAMINES]; Sofia Anaya [MINIVOLLEY BENJAMINES] | - |
| 27#6 | Campos Martín | Anotacion manuscrita: 'BEBE Infantil Masculino' (primera palabra dudos… | probable | JUAN MARTIN CAMPOS QUINTANA | INFANTIL MASCULINO:A |
| 27#11 | Charry Juliana | Fila resaltada en azul, sin pago. [azul] | exacto | JULIANA ORTIZ CHARRY | MINIVOLLEY BENJAMINES:A |
| 27#14 | Díaz Morales Gabriela | Fila resaltada en azul, sin pago. [azul] | exacto | GABRIELA DIAZ MORALES | MINIVOLLEY BENJAMINES:A |
| 27#15 | Forero Garzón Ana Isabella | Fila resaltada en azul; anotacion '2 Clases' en la columna valor (podr… | probable | Anna Isabella Forero Garzón | (sin equipo):X, MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR):X, MINIVOLLEY BENJAMINES:A |
| 27#17 | Giraldo Salomé | Anotacion: '— Intermedio' (se paso a Intermedio). | exacto | SALOME GIRALDO OBANDO | MINIVOLLEY BENJAMINES:A |
| 27#22 | Lemus María Nathalia | Fila resaltada en azul, sin pago. [azul] | probable | María Natalia Lemus Díaz | INFANTIL FEMENINO:A |
| 27#24 | López Cortés Isabella | Fila resaltada en azul, sin pago. [azul] | exacto | ISABELLA LOPEZ CORTES | MINIVOLLEY BENJAMINES:A |
| 27#28 | Mancera Isabella | Fila resaltada en azul, sin pago. [azul] | exacto | ISABELLA MANCERA SARMIENTO | MINIVOLLEY BENJAMINES:A |
| 27#29 | Marín Castellanos Ana Sofía | 'Retirada.' Fila resaltada en azul. [azul] | exacto | ANA SOFIA MARIN CASTELLANOS | MINIVOLLEY BENJAMINES:A |
| 27#30 | Márquez Reyes Elizabeth Sofía | Fila resaltada en azul, sin pago. [azul] | probable | Elizabeth Sofía Márquez Reyes | INTERMEDIO:A |
| 27#31 | Martínez Jiménez Oliver | 'Retirado.' Fila resaltada en azul. [azul] | ambiguo | ANA MARIA MARTINEZ JIMENEZ | (sin equipo):X, INFANTIL FEMENINO:A |
| 27#34 | Montoya Valeria | 'Retirada' Fila resaltada en azul. [azul] | no_encontrado | - | - |
| 27#35 | Naranjo Sofía | 'Retirada.' Fila resaltada en azul. [azul] | exacto | SOFIA NARANJO RAMIREZ | MINIVOLLEY BENJAMINES:A |
| 27#38 | Orozco Taliana Salomé | 'Retirada.' Fila resaltada en azul. [azul] | no_encontrado | - | - |
| 28#76 | SALAS MORENO MARIA JOSE | Anotacion 'Repetida.' (registro duplicado). Fila resaltada en azul. [a… | exacto | MARIA JOSE MORENO SALAS | INFANTIL FEMENINO:A |
| 28#88 | Malforga Julieta | Manuscrito; el numero escrito parece '86' (repetido), por secuencia es… | probable | Julieta Mayorga Veloza | INFANTIL FEMENINO:A |
| 30#44 | Campos Juan Martin | Anotacion '3 Meses.' sin valor/fecha/medio. (En img 27 Mini: 'Campos M… | exacto | JUAN MARTIN CAMPOS QUINTANA | INFANTIL MASCULINO:A |
| 30#45 | Caicedo Juan Felipe | Sin pago en esta hoja. (En img 27 Mini figura 'Caicedo Bayona Juan Fel… | probable | JUAN FELIPE CAICEDO BAYONA | MINIVOLLEY BENJAMINES:A |

## 10. Asistencia

**Lo que existe hoy en la app para septiembre 2026 (Dynasty):**

- SENIORS: sesiones 2026-08-31 (35 reg, finalized=True), 2026-09-03 (37 reg, finalized=True), 2026-09-07 (38 reg, finalized=True)
- INTERMEDIO: sesiones 2026-09-23 (106 reg, finalized=True)
- Ningun otro equipo tiene sesiones ni registros de asistencia en septiembre.

**Por hoja:**

| Img | Equipo | Filas | Match (exacto/probable/ambiguo/no_enc) | Marcas ✓ | Marcas por confirmar |
|---|---|---:|---|---:|---:|
| 2 | SENIORS | 22 | 15/4/0/3 | 43 | 0 |
| 3 | INFANTIL FEMENINO | 20 | 10/7/1/2 | 63 | 45 |
| 4 | NUEVA ERA | 15 | 8/6/1/0 | 132 | 1 |
| 7 | INFANTIL FEMENINO | 25 | 19/5/1/0 | 56 | 92 |
| 9 | INTERMEDIO | 28 | 15/9/0/4 | 138 | 6 |
| 10 | INTERMEDIO | 27 | 13/9/3/2 | 137 | 4 |
| 13 | INFANTIL MASCULINO | 20 | 16/1/1/2 | 0 | 116 |
| 14 | SENIORS | 25 | 17/2/0/6 | 70 | 0 |
| 15 | NUEVA ERA | 15 | 12/3/0/0 | 102 | 2 |
| 16 | NUEVA ERA | 16 | 11/3/0/2 | 106 | 0 |
| 17 | MENORES FEMENINO | 24 | 17/5/1/1 | 132 | 21 |
| 18 | INFANTIL FEMENINO | 22 | 11/9/0/2 | 71 | 63 |
| 22 | MENORES FEMENINO | 17 | 5/9/0/3 | 35 | 5 |
| 24 | INFANTIL FEMENINO | 25 | 17/6/0/2 | 108 | 56 |
| 25 | JUVENIL MAYORES MASCULINO / MENORES MASCULINO (inferido) | 19 | 16/2/0/1 | 151 | 3 |
| 29 | INTERMEDIO | 27 | 21/3/3/0 | 147 | 5 |
| 31 | MENORES MASCULINO | 15 | 7/6/1/1 | 85 | 0 |
| 32 | INFANTIL MASCULINO (inferido) | 15 | 8/4/2/1 | 0 | 70 |

**Registros nuevos de presente (✓) que habria que crear: 1374** (atleta matcheado exacto/probable, deduplicado por atleta+fecha, sin registro existente).

| Equipo | Registros nuevos | de match exacto | de match probable | Dias |
|---|---:|---:|---:|---|
| INTERMEDIO | 348 | 254 | 94 | 2, 4, 5, 6, 7, 9, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| NUEVA ERA | 312 | 257 | 55 | 2, 3, 4, 6, 9, 10, 11, 13, 15, 16, 17, 18, 20, 22, 23, 25 |
| INFANTIL FEMENINO | 281 | 193 | 88 | 2, 5, 6, 7, 9, 12, 13, 14, 16, 20, 21, 23, 26, 27, 30 |
| MENORES MASCULINO | 193 | 140 | 53 | 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27, 29 |
| MENORES FEMENINO | 151 | 126 | 25 | 1, 3, 4, 5, 6, 8, 10, 11, 15, 17, 18, 19, 22, 26, 27, 29 |
| SENIORS | 61 | 57 | 4 | 3, 10, 14, 17 |
| (equipo por confirmar: hoja sin titulo) | 16 | 0 | 16 | 1, 3, 5, 6, 8, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27, 29 |
| JUVENIL MAYORES MASCULINO | 12 | 12 | 0 | 1, 6, 8, 10, 12, 13, 15, 19, 22, 24, 26, 29 |

- Marcas ✓ que ya existen en la app (mismo atleta y fecha): 55 ({'absent': 31, 'present': 24}). Las que hoy estan `absent` y en papel tienen ✓ serian correcciones, no altas.
- Marcas por confirmar (siglas/otros, NO interpretadas): 490 -> {'X': 164, 'Repetida': 2, 'repetida': 1, 'garabato': 29, '✓R': 92, 'R': 21, 'VR': 76, 'C': 1, '✓': 1, 'Incapacidad': 2, 'Retirada': 1, '29': 4, '✓ tachado': 1, '1': 1, '/': 10, 'X/✓': 1, 'R(tachada)': 22, 'VA': 4, 'X(tachado)': 1, '4': 2, 'R✓': 1, 'X(sobre ✓)': 1, "✓10 (✓ con '10'/'R0' pequeño al lado; literal dudoso)": 1, 'Y': 1, 'U': 1, 'borron azul': 2, 'x (azul)': 1, '✓ tachado (parece X sobre ✓)': 1, '/ (tenue)': 1, 'x': 42, 'x (tenue)': 1, 'x (con tachon)': 1}
- Las hojas 13 y 32 (Infantil Masculino) solo usan X: todo queda por confirmar. La hoja 32 ademas no tiene encabezado de dias visible (columnas c1..c20).
- Hoja 4 (Nueva Era): columnas impresas 23/24 se asumieron dias 22/23 segun la correccion manuscrita (sin confirmar).
- Filas de asistencia sin match (no_encontrado/ambiguo) NO generan registros: sus ✓ se pierden hasta resolver el nombre.

**Dias de la planilla con ✓ y sin sesion en la app** (habria que crear la sesion antes de cargar registros):

- SENIORS: 10, 14, 17 (3 sesiones)
- INFANTIL FEMENINO: 2, 5, 6, 7, 9, 12, 13, 14, 16, 20, 21, 23, 26, 27, 30 (15 sesiones)
- NUEVA ERA: 2, 3, 4, 6, 9, 10, 11, 13, 15, 16, 17, 18, 20, 22, 23, 25 (16 sesiones)
- INTERMEDIO: 2, 4, 5, 6, 7, 9, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30 (23 sesiones)
- MENORES FEMENINO: 1, 3, 4, 5, 6, 8, 10, 11, 15, 17, 18, 19, 22, 26, 27, 29 (16 sesiones)
- JUVENIL MAYORES MASCULINO: 1, 6, 8, 10, 12, 13, 15, 19, 22, 24, 26, 29 (12 sesiones)
- MENORES MASCULINO: 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27, 29 (17 sesiones)
