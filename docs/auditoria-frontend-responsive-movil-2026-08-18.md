# Auditoría de frontend y comportamiento responsive móvil — SportMaps

**Fecha:** 2026-08-18 · **Rama:** `develop` · **Alcance:** `frontend/` (web/PWA + Capacitor Android)
**Método:** lectura de archivos reales del repo + inspección del CSS compilado (`frontend/build/assets/index-CMTvfaQ7.css`) y del manifest Android fusionado (`android/app/build/intermediates/merged_manifest/release/…`). No se modificó código.

---

## 1. Resumen ejecutivo

SportMaps es una SPA React 18 + Vite 5 + TailwindCSS 3 con shadcn/ui (52 primitivos), 130 páginas y 491 archivos `.tsx`, empaquetada como PWA y como app nativa **solo Android** vía Capacitor 8.5 — **la plataforma iOS nunca se creó** (`frontend/ios/` no existe, 0 archivos versionados), así que todo lo que este informe dice de iOS aplica al PWA en Safari / "Añadir a inicio", no a una app nativa. El responsive es **mobile-first puro y consistente en su estrategia** (1.259 prefijos `sm:`/`md:`/`lg:`, cero prefijos `max-*`, una sola rama JS por viewport en toda la app), pero la ejecución tiene deuda concentrada en tres frentes: **safe areas prácticamente ausentes** (4 archivos de 491 las usan, contra 15 cabeceras `sticky top-0` y 3 barras flotantes sin compensar), **unidades de viewport estáticas** (113 usos de `100vh`/`min-h-screen` contra 9 de `dvh`) y **targets táctiles bajo el mínimo** (el `Button` base mide 40px, `size="sm"` 36px, y el botón de cerrar de todos los diálogos ~16px).

El sistema de diseño está bien definido en tokens HSL (`index.css`) pero **masivamente eludido**: 3.769 clases de paleta Tailwind fija y 641 literales hexadecimales, incluyendo el verde de marca `#248223` escrito a mano 127 veces — lo que rompe el white-label por escuela, porque `BrandingScope` solo reasigna variables CSS. El modo oscuro está a medio construir (452 prefijos `dark:` en 77 de 491 archivos; 786 líneas con fondos claros `-50`/`-100` sin variante oscura) y las 7 pantallas de auth ignoran el tema por completo con una paleta oscura privada.

Hay además **tres piezas de código muerto que fabrican una falsa sensación de cobertura responsive**: `src/App.css` (241 líneas de correcciones móviles con `!important`, incluido el parche `min-height: 44px` de targets táctiles) **no se importa en ningún lado**; `src/components/ui/responsive.tsx` (`ResponsiveGrid`/`ResponsiveContainer`) no tiene un solo consumidor y además construye clases Tailwind dinámicas que el JIT nunca genera; y `src/components/Layout.tsx` tampoco se usa. Lo mismo en configuración: el bloque `workbox.runtimeCaching` de `vite.config.ts` es config muerta bajo `strategies: 'injectManifest'`, así que las fuentes de Google **no las cachea el SW** (el `sw.js` escrito a mano retorna temprano para cross-origin).

En Android nativo el hallazgo más visible es de tema: `styles.xml` referencia `@color/colorPrimary`/`colorAccent` que **el proyecto no define**, así que hereda los defaults de la librería de Capacitor — **índigo `#3F51B5` y rosa `#FF4081`** en el cursor y los manejadores de selección de texto — y `AppTheme.NoActionBar` fija `android:background=@null`, de modo que las franjas que `MainActivity` paddea por edge-to-edge quedan sin fondo.

---

## 2. Arquitectura general

### 2.1 Stack y estructura

| | |
|---|---|
| Framework | React 18.3.1 + TypeScript 5.8 |
| Bundler | Vite 5.4.19 con `@vitejs/plugin-react-swc` |
| Salida | `build/` (no `dist/` — ver `vite.config.ts:11`) |
| Router | react-router-dom 6.30 (`BrowserRouter`, ~200 rutas, todas `lazy()`) |
| Estado servidor | @tanstack/react-query 5.83 |
| UI | shadcn/ui sobre 27 paquetes `@radix-ui/*` |
| PWA | vite-plugin-pwa 1.2 en modo `injectManifest` + `src/sw.js` propio |
| Nativo | Capacitor 8.5.0 — **solo Android** |

```
frontend/src/
├── pages/        130 páginas
├── components/   57 subcarpetas de dominio + ui/ (52 primitivos)
├── layouts/      AuthLayout.tsx  ← único layout real
├── contexts/     Auth, Theme, Cart, IdleConfig
├── hooks/, lib/, features/, pwa/, integrations/
├── index.css     356 líneas — tokens + utilidades safe-area
├── App.css       241 líneas — NO IMPORTADO (§2.5)
└── sw.js         service worker escrito a mano
```

### 2.2 Capacitor: plugins y configuración

`frontend/capacitor.config.ts` — `appId: co.sportmaps.app`, `webDir: 'build'`, live-reload opcional por `CAP_SERVER_URL`.

Plugins instalados (7, confirmados en `android/app/src/main/assets/capacitor.plugins.json`):
`@capacitor/app`, `@capacitor/barcode-scanner`, `@capacitor/browser`, `@capacitor/camera`, `@capacitor/device`, `@capacitor/push-notifications`, `@aparajita/capacitor-biometric-auth`.

Solo dos plugins están configurados:

```ts
// frontend/capacitor.config.ts:44-57
PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
SystemBars: { insetsHandling: 'disable' },
```

**No están instalados** `@capacitor/keyboard`, `@capacitor/status-bar` ni `@capacitor/splash-screen` — tres ausencias con consecuencias directas que se desarrollan en §4.3, §5.3 y §2.4.

### 2.3 Build y sincronización

```json
// frontend/package.json:19-21
"cap:sync":    "vite build && cap sync",
"cap:android": "vite build && cap sync android && cap open android",
"cap:ios":     "vite build && cap sync ios && cap open ios"
```

El despliegue web pasa por Vercel con el `vercel.json` **de la raíz** (`buildCommand: cd frontend && npm install && npm run build`, `outputDirectory: frontend/build`).

> **HALLAZGO A-01 — `cap:ios` apunta a una plataforma que no existe · severidad: alto**
> `frontend/ios/` no existe en disco y `git ls-files frontend/ios` devuelve 0 archivos. `@capacitor/ios@8.5.0` **sí está en `node_modules/` y en `package-lock.json:1692`, pero no está declarado en `package.json`** (solo `@capacitor/android` en devDependencies). El script `cap:ios` falla al llegar a `cap sync ios`, y la dependencia desaparecerá en la próxima instalación limpia.
> **Impacto iOS:** no hay app nativa iOS hoy. Todo el comportamiento iOS del producto es el de la PWA en Safari, donde no aplica ninguna de las compensaciones que `MainActivity` hace en Android (§4.2). Cualquier plan de release iOS arranca desde `cap add ios`, no desde "sincronizar".

> **HALLAZGO A-02 — Tres manifests PWA, dos colores de marca distintos · severidad: medio**
> Coexisten tres fuentes:
> - `bff/src/routes/pwa.routes.ts:47-60` — **la que se sirve de verdad** (`/app.webmanifest` por rewrite de `vercel.json`), `theme_color: '#248223'`.
> - `frontend/public/manifest.webmanifest` — `theme_color: '#248223'`, pero sus iconos apuntan a `/sportmaps-logo.png` declarado `"type": "image/png"` cuando el archivo es **JPEG** (§5.2).
> - `frontend/public/manifest.json` — `theme_color: "#0ea5e9"` (**celeste, no la marca**), y es el que `src/sw.js:26` precachea en `STATIC_ASSETS`.
>
> Ninguno de los dos estáticos está enlazado desde `index.html`, así que no se aplican; el riesgo es que el siguiente que toque el tema edite el archivo equivocado.

> **HALLAZGO A-03 — El manifest por defecto no declara icono `maskable` · severidad: medio**
> ```ts
> // bff/src/routes/pwa.routes.ts:38-45
> { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
> { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
> ```
> La rama con marca de escuela (líneas 155-160) **sí** emite `purpose: 'maskable'`; la de SportMaps no.
> **Impacto Android:** el launcher aplica su propia máscara adaptativa: el icono queda encogido dentro de un círculo blanco, no a sangre. iOS ignora `purpose` — sin impacto ahí. Curiosamente el `manifest.json` muerto sí lo declaraba (`"purpose": "any maskable"`), así que se perdió al migrar la generación al BFF.

### 2.4 Configuración Android nativa

`android/app/src/main/AndroidManifest.xml` es correcto y bien comentado: App Links verificados sobre `app.sportmaps.co`, `launchMode="singleTask"`, `configChanges` amplio, `FileProvider`. El manifest fusionado confirma los permisos que aportan los plugins: `POST_NOTIFICATIONS`, `CAMERA`, `USE_BIOMETRIC`, `WAKE_LOCK`, `com.google.android.c2dm.permission.RECEIVE`. `variables.gradle` está al día: `minSdk 26`, `compile/targetSdk 36`.

> **HALLAZGO A-04 — El tema nativo hereda los colores Material de Capacitor, no la marca · severidad: alto**
> ```xml
> <!-- android/app/src/main/res/values/styles.xml:6-10 -->
> <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
>     <item name="colorPrimary">@color/colorPrimary</item>
>     <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
>     <item name="colorAccent">@color/colorAccent</item>
> </style>
> ```
> **`android/app/src/main/res/values/` solo contiene `strings.xml`, `styles.xml` e `ic_launcher_background.xml`. No hay `colors.xml`.** Los tres colores se resuelven contra la librería de Capacitor:
> ```xml
> <!-- node_modules/@capacitor/android/capacitor/src/main/res/values/colors.xml -->
> <color name="colorPrimary">#3F51B5</color>     <!-- índigo Material -->
> <color name="colorPrimaryDark">#303F9F</color>
> <color name="colorAccent">#FF4081</color>      <!-- rosa Material -->
> ```
> **Impacto Android:** `colorAccent` pinta el caret y los manejadores de selección de texto de los inputs dentro del WebView, y el resalte de recientes. Es decir: **cada campo de texto de la app muestra cursor y "gotas" de selección rosa Material sobre una app verde**. Sin impacto iOS.

> **HALLAZGO A-05 — Las franjas de edge-to-edge quedan sin fondo · severidad: alto**
> `BridgeActivity.onCreate` cambia el tema en caliente (`node_modules/@capacitor/android/…/BridgeActivity.java:25-26`: `setTheme(R.style.AppTheme_NoActionBar)`), y ese tema declara:
> ```xml
> <!-- android/app/src/main/res/values/styles.xml:12-16 -->
> <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
>     <item name="android:background">@null</item>
> </style>
> ```
> `MainActivity` paddea `android.R.id.content` con los insets del sistema y **consume** el WindowInsets (`MainActivity.java:47`, `WindowInsetsCompat.CONSUMED`). Ese padding aparta el WebView de las barras, pero lo que queda debajo es el fondo de ventana — que es `@null`.
> **Impacto Android:** en API 35+ (edge-to-edge obligatorio) las franjas de barra de estado y de barra de gestos no tienen color propio; se ven negras. En tema claro es una banda negra sobre una app blanca. Se arregla con una línea (`<item name="android:windowBackground">@color/brand_bg</item>`) o dando color de fondo a la vista paddeada.

> **HALLAZGO A-06 — `Theme.AppCompat.DayNight` sigue al SO; el tema web sigue a localStorage · severidad: bajo**
> El tema nativo es `DayNight` (sigue el modo oscuro del sistema) mientras `ThemeContext.tsx:44-47` arranca de `localStorage.getItem('theme') || 'system'`. Si el usuario fija Claro en la app con el SO en Oscuro, el chrome nativo (scrollbars del WebView, selección, fondo de ventana) queda oscuro y el contenido claro.

> **HALLAZGO A-07 — Orientación bloqueada en PWA, libre en nativo · severidad: medio**
> `bff/src/routes/pwa.routes.ts:53` declara `orientation: 'portrait'`, pero `AndroidManifest.xml` **no fija `android:screenOrientation`** y `configChanges` incluye `orientation|screenSize`, así que la app nativa rota libremente sin recrear la Activity. No hay una sola clase `landscape:` en `src/` ni ninguna lógica de orientación: el layout nunca se diseñó para horizontal, pero en nativo se puede llegar ahí.
> Nota: los `drawable-land-*/splash.png` sí existen, así que el splash sí contempla horizontal — la app no.

### 2.5 Código muerto que simula cobertura responsive

> **HALLAZGO A-08 — `src/App.css` no se importa en ningún archivo · severidad: alto**
> `grep -rn "App.css" src/ index.html` no devuelve nada. `main.tsx:4` importa únicamente `./index.css`. Son **241 líneas** de "Global Responsive Fixes" que no se aplican, entre ellas:
> ```css
> /* src/App.css:91-94 — el parche de targets táctiles que NO corre */
> button, a, input, select, textarea { min-height: 44px; }
> ```
> ```css
> /* src/App.css:47-55 — además roto: en CSS el escape es \: no \\: */
> .md\\:grid-cols-2, .md\\:grid-cols-3, … { grid-template-columns: 1fr !important; }
> ```
> ```css
> /* src/App.css:118-124 — con 100vh (no dvh) y margin sobre un elemento centrado por transform */
> [role="dialog"] { max-width: calc(100vw - 2rem) !important; max-height: calc(100vh - 2rem) !important; margin: 1rem !important; }
> ```
> **Impacto en iOS y Android:** hoy es benigno (varias de esas reglas habrían causado daño: `[class*="grid-cols"] { grid-template-columns: 1fr !important }` en `src/App.css:139-143` aplastaría **todos** los grids intencionales a una columna, y `table { display: block; white-space: nowrap }` en `src/App.css:72-77` rompería la semántica de tabla). El problema es de mantenimiento: quien lea el repo concluye que los targets táctiles y los diálogos ya están resueltos. Los hallazgos R-07 y R-08 existen precisamente porque este archivo no corre.

> **HALLAZGO A-09 — `ui/responsive.tsx` sin consumidores y con clases que el JIT no genera · severidad: medio**
> `ResponsiveContainer`, `ResponsiveGrid` y `ResponsiveImage` (`src/components/ui/responsive.tsx`) no tienen un solo consumidor: los 60 `ResponsiveContainer` del código son el de Recharts. Y si se usaran, `ResponsiveGrid` no funcionaría:
> ```tsx
> // src/components/ui/responsive.tsx:41-46
> cols.md && `md:grid-cols-${cols.md}`,
> ```
> Tailwind escanea texto estático; `md:grid-cols-${n}` nunca aparece literal, así que la clase no se emite y el grid colapsa a una columna implícita.

> **HALLAZGO A-10 — `src/components/Layout.tsx` sin consumidores · severidad: bajo**
> Ningún archivo lo importa. Contiene además la única referencia a la fuente Lexend (§6.3). El layout real es `src/layouts/AuthLayout.tsx`.

> **HALLAZGO A-11 — `.main-content-with-nav` definida y nunca usada · severidad: bajo**
> ```css
> /* src/index.css:269-272 */
> @media (max-width: 768px) { .main-content-with-nav { padding-bottom: 80px; } }
> ```
> `grep -rn "main-content-with-nav" src/ --include=*.tsx` no devuelve nada. El espaciado del bottom nav se resuelve con `pb-20` inline en `AuthLayout.tsx:110` — insuficiente, ver R-03.

---

## 3. Sistema de diseño

### 3.1 Tokens: bien definidos, ampliamente eludidos

`src/index.css:18-108` define un sistema completo y coherente en HSL — paleta de marca, gradientes, sombras, curvas de transición, radio — y `tailwind.config.ts` lo expone como escalas Tailwind. La disciplina de "todos los colores en HSL" está escrita en el propio archivo (`index.css:13`).

El código de aplicación no la sigue:

| Métrica | Conteo | Cómo se midió |
|---|---|---|
| Clases de paleta Tailwind fija (`text-green-600`, `bg-amber-50`, …) | **3.769** | `grep -rhoE "\b(bg\|text\|border)-(gray\|slate\|…)-[0-9]{2,3}\b" src/ --include=*.tsx` |
| Literales hexadecimales en TSX | **641** en 48 archivos | `grep -rhoE "#[0-9a-fA-F]{3,8}\b" src/ --include=*.tsx` |
| Valores arbitrarios `[...]` en clases | **2.337** | `grep -rhoE "\b[a-z-]+-\[[^]]+\]" src/ --include=*.tsx` |
| Usos de `font-poppins` explícito (ya heredado del `body`) | 39 | |

Los 10 hexadecimales más repetidos:

```
127  #248223   ← verde de marca, ya disponible como hsl(var(--primary))
 39  #2ea82d    32  #8a9186    29  #0f2614    27  #4a5246
 24  #FB9F1E   ← naranja de marca, ya disponible como hsl(var(--accent))
 23  #f5f7f2    23  #1e293b    16  #d4d8d0    16  #64748b
```

> **HALLAZGO D-01 — El verde de marca escrito a mano 127 veces anula el white-label · severidad: crítico**
> `BrandingScope` aplica la marca de la escuela **reasignando variables CSS** en un contenedor:
> ```ts
> // src/contexts/ThemeContext.tsx:145-152
> return {
>   ['--primary' as any]: hexToHsl(branding.primary_color),
>   ['--secondary' as any]: hexToHsl(branding.secondary_color),
>   …
> };
> ```
> Todo lo que esté escrito como `#248223`, `bg-green-500` o `text-green-600` es **inmune a ese mecanismo**. Con 127 `#248223` + 162 `bg-green-500` + 172 `text-green-600` + 99 `text-green-500` + 84 `border-green-500` repartidos por la app, una escuela con marca roja o azul ve **verde SportMaps filtrándose** en botones, badges, iconos y bordes de decenas de pantallas.
> **Impacto iOS y Android:** idéntico en ambas plataformas y en web. Es el hallazgo de mayor valor comercial del informe: bloquea el addon `pwa_branding`/`whitelabel` que ya se vendió.
> Un ejemplo dentro de un componente central:
> ```tsx
> // src/components/navigation/MobileBottomNav.tsx:95
> <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FB9F1E] rounded-full" />
> ```

> **HALLAZGO D-02 — La pantalla de acceso tiene una paleta privada que ignora el tema · severidad: alto**
> ```tsx
> // src/pages/LoginPage.tsx:148
> <div className={`min-h-screen flex ${tenant ? 'bg-[#0d0f12]' : 'bg-[#0a1a0d]'} text-[#f5f7f2] font-['DM_Sans'] overflow-x-hidden`}>
> ```
> El mismo patrón en `src/pages/RegisterPage.tsx:435` y `src/pages/OnboardingRolePage.tsx:95`; y `Inter` hardcodeada en `src/components/pages/AthleteRegister.tsx:415`, `CoachRegister.tsx:476`, `RoleSelection.tsx:152`, `SchoolRegister.tsx:511`.
> **Impacto:** las 7 pantallas del embudo de entrada están fijas en oscuro sin importar `ThemeContext`, con 5 hexadecimales (`#0d0f12`, `#0a1a0d`, `#0f2614`, `#f5f7f2`, `#8a9186`) fuera del sistema. Es también el punto donde el branding por escuela más importa (`tenant ? …`) y donde menos puede aplicarse.

### 3.2 Modo oscuro: a medio construir

`ThemeContext.tsx` está bien implementado — clase en `documentElement`, tres estados (`light`/`dark`/`system`), listener de `prefers-color-scheme` y persistencia. `index.css:139-176` define el bloque `.dark` completo. El problema es la cobertura en las páginas:

| | |
|---|---|
| Prefijos `dark:` totales | **452** |
| Archivos `.tsx` con al menos un `dark:` | **77 de 491** (15,7 %) |
| Líneas con fondo claro `-50`/`-100` **sin** `dark:` en la misma línea | **786** (de 947) |

> **HALLAZGO D-03 — 786 fondos claros sin variante oscura · severidad: alto**
> Patrones como `bg-green-50` (49 usos), `bg-amber-50` (47), `bg-blue-50` (43), `bg-red-50` (40) no se invierten. En modo oscuro quedan paneles casi blancos con texto de color sobre ellos, o texto claro sobre fondo claro donde el `text-*` sí se adaptó.
> **Impacto Android:** agravado — el tema nativo es `DayNight` (A-06), así que un teléfono en modo oscuro del sistema entra a la app en oscuro por defecto (`theme: 'system'`) y estas 786 líneas son lo primero que se ve.

> **HALLAZGO D-04 — Sin `<meta name="theme-color">` y `background_color` fijo en blanco · severidad: medio**
> `frontend/index.html` no declara `theme-color` (verificado: `grep -n "theme-color" index.html` → sin resultados). El color de barra viene solo del manifest, que además fija `background_color: '#ffffff'` (`bff/src/routes/pwa.routes.ts:54`).
> **Impacto Android:** el splash de la PWA instalada es blanco incluso en modo oscuro → destello blanco en cada arranque. **Impacto iOS:** en standalone la barra de estado toma el color del `body`; sin `theme-color` con variante `prefers-color-scheme` no hay control explícito.

### 3.3 Inventario de componentes y consistencia

52 primitivos en `src/components/ui/` (shadcn estándar + tres locales: `number-stepper.tsx`, `phone-input.tsx`, `responsive.tsx`). La base es sana: `Table` ya envuelve en un contenedor con scroll (`ui/table.tsx:7`), así que los 54 archivos que renderizan tablas heredan el scroll horizontal sin repetirlo.

Donde falta consistencia es en los tamaños:

> **HALLAZGO D-05 — `Input` protege contra el auto-zoom de iOS; `Textarea` no · severidad: medio**
> ```tsx
> // src/components/ui/input.tsx:11 — 16px en móvil, 14px en desktop. Correcto.
> "… px-3 py-2 text-base … md:text-sm"
> ```
> ```tsx
> // src/components/ui/textarea.tsx:11 — 14px SIEMPRE
> "flex min-h-[80px] w-full … px-3 py-2 text-sm …"
> ```
> **Impacto iOS:** Safari hace zoom automático al enfocar un campo con `font-size` menor a 16px. Alguien alguna vez lo resolvió en `Input` y no replicó en `Textarea`: al tocar cualquier área de texto larga (notas del coach, descripción de plan, mensajes) la página salta con zoom, y al desenfocar no vuelve. Sin impacto Android.

> **HALLAZGO D-06 — Cuatro escalas de tipografía diminuta sin justificación · severidad: alto**
> ```
> 673  text-[10px]     187  text-[11px]     142  text-[9px]
>  18  text-[8px]        1  text-[7px]      (+ 1.523 text-xs = 12px)
> ```
> **1.021 ocurrencias por debajo de 12px.** Apple HIG fija 11pt como piso absoluto y recomienda 17pt para cuerpo; Android recomienda 12sp mínimo. Ejemplos en rutas críticas:
> ```tsx
> // src/pages/LoginPage.tsx:294 — el mensaje de error del campo email
> {errors.email && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.email.message}</p>}
> ```
> ```tsx
> // src/layouts/AuthLayout.tsx:76 — el rol del usuario en la cabecera
> <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase …">
> ```
> **Impacto iOS y Android:** igual en ambas, y sin escape porque el zoom está deshabilitado (R-09). Los mensajes de validación a 10px en un formulario de acceso son un problema de conversión, no solo de accesibilidad.

---

## 4. Responsive y adaptación móvil

### 4.1 Estrategia: mobile-first, correctamente aplicada

Este es el punto más sólido del frontend y conviene decirlo con datos:

| Prefijo | Usos |
|---|---|
| `sm:` (≥640px) | 536 |
| `md:` (≥768px) | 571 |
| `lg:` (≥1024px) | 140 |
| `xl:` (≥1280px) | 12 |
| `max-sm:` / `max-md:` / … | **0** |

`tailwind.config.ts` no sobreescribe `screens`, así que rigen los breakpoints por defecto de Tailwind. Cero prefijos `max-*` confirma mobile-first estricto. Y la adaptación es **CSS, no JavaScript**: `useIsMobile` (`src/hooks/use-mobile.tsx`) tiene **un solo consumidor en toda la app** (`ui/sidebar.tsx:51`), lo que evita el clásico problema de hidratación/salto por medir `window.innerWidth`.

> **HALLAZGO R-01 — `container` con 32px de gutter fijo en móvil · severidad: medio**
> ```ts
> // tailwind.config.ts:8-14
> container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
> ```
> `padding` es un escalar, no un objeto responsive. Con 165 usos de `container` en el código, en una pantalla de 360px quedan **296px útiles** (18 % del ancho gastado en márgenes). La corrección a `1rem` en móvil existía… en `src/App.css:37-40`, que no se importa (A-08).

### 4.2 Safe areas: el hallazgo estructural

`index.css` define tres utilidades correctas y bien comentadas — `.screen-safe` (206), `.dialog-safe` (221), `.safe-area-bottom` (264). El problema es su adopción:

| | |
|---|---|
| Archivos en `src/` que usan safe areas | **4** de 491 (`MobileBottomNav`, `OnboardingShell`, `TrainerOnboarding`, `ui/dialog`) |
| Cabeceras `sticky top-0` sin padding superior de safe area | **15** |
| Barras flotantes `fixed` sin compensar el borde inferior | 3 |

> **HALLAZGO R-02 — 15 cabeceras `sticky top-0` sin safe area superior · severidad: crítico (iOS PWA)**
> ```tsx
> // src/layouts/AuthLayout.tsx:48 — la cabecera de TODA la app autenticada
> <header className="h-14 sm:h-16 flex items-center border-b px-3 sm:px-4 … sticky top-0 z-50">
> ```
> ```html
> <!-- frontend/index.html:6 -->
> <meta name="viewport" content="… viewport-fit=cover" />
> ```
> `viewport-fit=cover` extiende el viewport bajo las barras del sistema. En iOS instalado como PWA (donde `index.html:110-116` inyecta `apple-mobile-web-app-capable` cuando hay tenant) el contenido arranca en y=0, **debajo del notch / Dynamic Island**. Sin `padding-top: env(safe-area-inset-top)` la hamburguesa, el logo de la escuela, la campana y el avatar quedan tapados.
> Las otras 14: `components/pages/Landing.tsx:236`, `SchoolSearch.tsx:162`, `Shop.tsx:129`, `UserProfile.tsx:137`, `Wellness.tsx:125`, `pages/CheckoutPage.tsx:350`, `ChildAttendancePage.tsx:122`, `ChildProgressPage.tsx:110`, `events/EventsMapPage.tsx:71`, `ExplorarGlobalPage.tsx:548` y `:637`, `App.tsx:257`, `components/Layout.tsx:107` (muerto), `school/TeamPerformanceEntryModal.tsx:251`.
> **Impacto Android:** **mitigado**, y de forma deliberada. `MainActivity.java:37-51` paddea el contenedor del WebView con los insets del sistema, con `SystemBars.insetsHandling: 'disable'` en `capacitor.config.ts:55` para que Capacitor no lo haga dos veces. El comentario del propio archivo lo dice: *"La app son ~78 páginas escritas sin safe-area (17 cabeceras `sticky top-0` repartidas), así que en vez de auditar cada una paddeamos el contenedor del WebView"*. La deuda está reconocida y contenida en Android — pero esa red de seguridad **no existe en la PWA de iOS**, que es hoy la única vía iOS del producto (A-01).

> **HALLAZGO R-03 — El `padding-bottom` del contenido es menor que la barra inferior · severidad: alto**
> ```tsx
> // src/components/navigation/MobileBottomNav.tsx:70-71
> <nav className="fixed bottom-0 left-0 right-0 z-30 … md:hidden safe-area-bottom">
>   <div className="flex items-center justify-around h-16 px-2">
> ```
> ```tsx
> // src/layouts/AuthLayout.tsx:110
> <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto pb-20 sm:pb-6 w-full max-w-full">
> ```
> La barra mide `h-16` (64px) **más** `env(safe-area-inset-bottom)`. El contenido reserva `pb-20` (80px).
> **Impacto iOS:** en iPhone con home indicator el inset es 34px → barra de 98px contra 80px de reserva: **18px del último elemento quedan tapados**. En una lista de cobros o un botón de "Pagar" al final del formulario, eso es funcional, no cosmético. **Impacto Android:** con barra de gestos el inset es ~24px → 88px contra 80px, 8px tapados. Menor pero presente.

> **HALLAZGO R-04 — Las tres barras flotantes ignoran el inset inferior y tapan el bottom nav · severidad: alto**
> ```tsx
> // src/pwa/InstallBanner.tsx:82
> <div className="fixed bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 … z-50 border border-sky-100 …">
> ```
> ```tsx
> // src/components/PushPermissionBanner.tsx:57
> fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4
> ```
> ```tsx
> // src/pwa/UpdateBanner.tsx:15
> <div className="fixed top-0 left-0 right-0 bg-sky-500 text-white … py-2.5 z-[100] …">
> ```
> Tres problemas de una vez:
> 1. `bottom-4` (16px) y `bottom-6` (24px) contra un bottom nav de 64px+ y `z-50` contra `z-30` → **los banners se dibujan encima de la navegación**, no arriba de ella.
> 2. `UpdateBanner` en `top-0` sin `env(safe-area-inset-top)` → en iOS standalone queda **bajo la Dynamic Island**: el aviso de "hay una versión nueva" es ilegible justo cuando importa.
> 3. Los tres usan paleta celeste fuera de marca (`bg-sky-500`, `border-sky-100`, `text-slate-900`) y `bg-white` fijo → sin modo oscuro y sin branding.

> **HALLAZGO R-05 — `Sheet` (top/bottom) y `Drawer` sin safe area · severidad: medio**
> ```tsx
> // src/components/ui/sheet.tsx:36-38
> top:    "inset-x-0 top-0 border-b …",
> bottom: "inset-x-0 bottom-0 border-t …",
> ```
> ```tsx
> // src/components/ui/drawer.tsx:34
> "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
> ```
> Ninguno reserva el inset. Un bottom sheet o un drawer de vaul con un botón de acción al pie deja ese botón bajo el home indicator en iOS y bajo la barra de gestos en Android. Además `sheet.tsx:39,41` fija `w-3/4` para los laterales: 270px en una pantalla de 360px.

### 4.3 Unidades de viewport y teclado

| | |
|---|---|
| `100vh` / `min-h-screen` / `h-screen` | **113** |
| `dvh` | **9** |
| `max-h-[90vh]` en diálogos | **41** |

> **HALLAZGO R-06 — `max-h-[90vh]` en 41 diálogos está siendo anulado a `100dvh` · severidad: alto**
> Verificado en el CSS compilado (`build/assets/index-CMTvfaQ7.css`):
> ```
> byte  32.087 → .max-h-\[90vh\]{max-height:90vh}
> byte 153.460 → .dialog-safe{max-height:100vh;max-height:100dvh;overflow-y:auto;padding-bottom:max(1.5rem,env(safe-area-inset-bottom))}
> ```
> Misma especificidad (una clase), y `.dialog-safe` va **después** → gana. La segunda aparición de `90vh` (byte 233.044) es `.sm:max-h-[90vh]`, dentro de `@media (min-width:640px)`: solo desktop.
> ```tsx
> // src/components/ui/dialog.tsx:36-43 — el origen: dialog-safe se aplica a TODO DialogContent
> "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] …",
> "dialog-safe",
> ```
> **Impacto iOS y Android:** en móvil, los 41 diálogos que su autor limitó al 90 % de la pantalla ocupan en realidad el 100 % del viewport dinámico. Centrados con `translate-y-[-50%]`, un diálogo que llena el alto arranca en y=0 → su título queda **bajo la barra de estado / notch** (con `viewport-fit=cover`), sin los 5 % de aire que el `90vh` pretendía dar arriba y abajo. La intención del autor y el resultado no coinciden en ninguno de los 41 sitios.
> Nota positiva: `dialog-safe` sí resuelve bien lo importante — `100dvh` en vez de `100vh` y `padding-bottom` con `env()`.

> **HALLAZGO R-07 — El botón de cerrar de todos los diálogos mide ~16×16px · severidad: alto**
> ```tsx
> // src/components/ui/dialog.tsx:48-50
> <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 …">
>   <X className="h-4 w-4" />
> ```
> Sin `padding` ni `h-*`/`w-*` en el `Close`, el área táctil es el propio icono: **16×16px**, contra los 44×44pt de Apple y 48×48dp de Android. Es el control más usado de la app (aparece en cada diálogo del sistema) y el más difícil de acertar. Está a un `p-2` de quedar en 32px y a `h-11 w-11` de cumplir.

> **HALLAZGO R-08 — La escala base de `Button` está bajo el mínimo táctil · severidad: alto**
> ```ts
> // src/components/ui/button.tsx:23-29
> default: "h-10 px-4 py-2",      // 40px
> sm:      "h-9 rounded-md px-3", // 36px  ← 527 usos de size="sm"
> lg:      "h-11 rounded-md px-8", // 44px  ✅ el único que cumple
> icon:    "h-10 w-10",           // 40px  ← 125 usos de size="icon"
> ```
> Y encima se reduce por sitio: **16 botones a `h-8 w-8`** (32px) y **10 a `h-7 w-7`** (28px), con un caso a `h-5 w-5` (20px):
> ```tsx
> // src/components/admin/UserStateDialog.tsx:260
> type="button" variant="ghost" size="icon" className="h-5 w-5"
> ```
> ```tsx
> // src/pages/ReportsPage.tsx:429-450 — cuatro controles de 28px en fila
> size="icon" className="h-7 w-7" title="Barras horizontales"
> ```
> **Impacto iOS y Android:** iOS pide 44pt, Android 48dp; nada en la escala base llega salvo `lg`. En páginas de acciones destructivas (`h-8 w-8` para eliminar en `BlockBuilder.tsx:314`, `TeamsPage.tsx:778`, `SchoolFacilitiesPage.tsx:395`) el riesgo de toque errado sobre un botón de borrar es real. Recordatorio: el parche que compensaba esto (`min-height: 44px`) vive en el `App.css` no importado (A-08).

> **HALLAZGO R-09 — Zoom deshabilitado globalmente · severidad: medio**
> ```html
> <!-- frontend/index.html:6 -->
> <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
> ```
> `maximum-scale=1.0, user-scalable=no` incumple WCAG 2.1 SC 1.4.4 (Resize Text). Combinado con D-06 (1.021 textos bajo 12px) el usuario **no tiene ninguna forma de agrandar** lo que no puede leer. En Android WebView `user-scalable=no` se respeta al pie de la letra; Safari iOS lo ignora para el pinch desde iOS 10 (ahí el pinch sigue disponible), así que **el perjudicado principal es Android**.

> **HALLAZGO R-10 — Sin `@capacitor/keyboard`: el teclado se maneja solo en Java, y solo en Android · severidad: alto**
> `@capacitor/keyboard` no está instalado (`ls node_modules/@capacitor/` → `android app barcode-scanner browser camera cli core device ios push-notifications`). La única gestión de teclado del proyecto es nativa:
> ```java
> // android/app/src/main/java/co/sportmaps/app/MainActivity.java:43-48
> Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
> boolean keyboardVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
> view.setPadding(bars.left, bars.top, bars.right, keyboardVisible ? ime.bottom : bars.bottom);
> ```
> Eso está bien resuelto: con teclado abierto manda el inset del IME.
> **Impacto Android:** el viewport se encoge, pero **la app no reacciona**: solo hay 3 `scrollIntoView` en todo el código (`StoreChat.tsx:65`, `MessagesDetailPage.tsx:63`, `ParentCheckoutPage.tsx:122`) y ninguno se dispara al enfocar un input. En formularios largos (`AddChildDialog`, `SchoolOnboardingWizard`, `CreateTeamModal`) el campo enfocado puede quedar detrás del teclado sin que nada lo traiga a la vista.
> **Impacto iOS:** peor. Sin plugin y sin compensación nativa, WKWebView en la PWA hace *scroll* del contenido de forma poco predecible y **no encoge el viewport**: `100dvh` ayuda en los 9 sitios que lo usan, pero los 113 `min-h-screen`/`100vh` quedan altos, y los `position: fixed` (34 en el código) flotan sobre el teclado.

### 4.4 Scroll y overscroll

> **HALLAZGO R-11 — Sin `overscroll-behavior` en ningún lado · severidad: medio**
> `grep -rn "overscroll\|touch-action" src/` solo encuentra la mención en un comentario de `RecepcionPage.tsx:55`. Ni una declaración real (`-webkit-overflow-scrolling: touch` existe únicamente en el `App.css:77` no importado).
> **Impacto iOS:** el *rubber-band* del documento se propaga; con un modal abierto, arrastrar sobre el overlay hace rebotar la página de fondo. Se corta con `overscroll-behavior: contain` en el contenedor de scroll.
> **Impacto Android:** el pull-to-refresh de Chrome se dispara al arrastrar hacia abajo estando arriba del scroll — recarga la SPA y **pierde el estado de formularios y modales**. En el WebView de Capacitor no aplica (no hay pull-to-refresh nativo), pero sí en la PWA sobre Chrome Android, que es una vía de acceso real.
> El único lugar que lo enfrentó lo hizo a mano y solo para su pantalla:
> ```ts
> // src/pages/recepcion/RecepcionPage.tsx:56-64
> html.style.overflow = 'hidden'; body.style.overflow = 'hidden';
> body.style.backgroundColor = '#020617'; // slate-950: sin flash blanco al hacer overscroll
> ```

> **HALLAZGO R-12 — Scroll anidado: `main` es el contenedor de scroll · severidad: medio**
> ```tsx
> // src/layouts/AuthLayout.tsx:110
> <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto pb-20 sm:pb-6 w-full max-w-full">
> ```
> El documento no scrollea; scrollea `main`. Dentro, cada `<Table>` abre otro contenedor (`ui/table.tsx:7`, `overflow-auto`).
> **Impacto iOS:** en contenedores de scroll anidados el momentum se transfiere mal (el gesto "atrapa" el interior y no continúa en el exterior) y se pierde el "tocar la barra de estado para ir arriba". **Impacto Android:** menos notorio, pero el gesto horizontal sobre una tabla ancha compite con el swipe de navegación del sistema.
> Detalle relacionado: la cabecera es *hermana* de `main`, no hija, así que su `sticky top-0` (`AuthLayout.tsx:48`) es un no-op — funciona por ser el primer hijo de una columna flex que no scrollea. Lo mismo `App.tsx:257` (`EnvironmentBanner`, `sticky top-0 z-[9999]`).

### 4.5 Grids sin variante móvil

> **HALLAZGO R-13 — Grids de 3 a 7 columnas sin escalón móvil · severidad: medio**
> 397 clases `grid-cols-N` (N≥2) sin `grid-cols-1` acompañante. Los casos que más aprietan:
> ```
> src/components/school/AvailabilityManager.tsx:231      grid grid-cols-7 gap-2   ← selector de días
> src/components/coach/CoachProfileWizard.tsx:351        grid grid-cols-5 gap-3
> src/components/modals/WelcomeModal.tsx:181             grid grid-cols-5 gap-2
> src/components/school/FacilityReservationModal.tsx:219 grid grid-cols-4 gap-2
> src/components/school/OwnerReservationModal.tsx:342    grid grid-cols-4 gap-2
> ```
> A 360px: `(360 − 32 de gutter − 48 de gaps) / 7 = 40px` por celda en el selector de 7 días. Bajo los 44pt/48dp de R-08, y dentro de un diálogo que además está a ancho completo (R-06).

---

## 5. Diferencias iOS vs Android

### 5.1 Lógica condicional por plataforma

Hay tres detectores de plataforma, todos con la misma técnica correcta — leer `window.Capacitor` de forma síncrona y cargar los plugins por `import()` dinámico para no contaminar el bundle web:

```ts
// src/lib/openExternalUrl.ts:23-26
export function isNativePlatform(): boolean {
    const cap = (globalThis as any).Capacitor;
    return !!cap?.isNativePlatform?.();
}
```
```ts
// src/hooks/useDeviceContext.ts:51-55 — el único sitio que distingue ios de android
const platform: 'web' | 'ios' | 'android' = isNative
    ? (cap.getPlatform() === 'ios' ? 'ios' : 'android')
    : 'web';
```

`src/pwa/tenant.ts:250-256` añade la detección de `display-mode` para el modo instalado. `openExternalUrl` está bien resuelto y bien documentado: los cobros de suscripción SaaS salen al navegador del sistema vía `@capacitor/browser` para no violar Play Billing / IAP.

> **HALLAZGO P-01 — Cero estilos condicionales por plataforma · severidad: bajo**
> `getPlatform()` se usa una sola vez y solo para telemetría de dispositivo. No hay una clase, un token ni una rama de estilo que distinga iOS de Android. Con las diferencias reales de safe area, teclado y gestos entre WKWebView y Chrome WebView, tarde o temprano hará falta al menos un `data-platform` en `<html>` para poder afinar sin `if` repartidos.

### 5.2 Diferencias de render de WebView

> **HALLAZGO P-02 — Cinco archivos son el mismo JPEG con extensión `.png` · severidad: medio**
> Verificado por magic bytes:
> ```
> public/icons/icon-{72,96,128,144,192,512}.png  → 89 50 4e 47  (PNG real ✅)
> public/favicon.png                             → ff d8 ff e0  (JPEG ❌)
> public/sportmaps-logo.png                      → ff d8 ff e0  (JPEG ❌)
> public/logo-bienvenida.png                     → ff d8 ff e0  (JPEG ❌)
> src/assets/sportmaps-logo.png                  → ff d8 ff e0  (JPEG ❌)
> src/assets/logo-bienvenida.png                 → ff d8 ff e0  (JPEG ❌)
> ```
> Los cinco JPEG tienen **el mismo md5** (`d6996e8722cbc2b5a9e710cd4f297741`): son cinco copias del mismo archivo, 63 KB cada una.
> **Impacto:** el BFF ya esquiva el problema y lo documenta (`pwa.routes.ts:35-37`: *"no apuntar a /sportmaps-logo.png ni /favicon.png, que son JPEG con extensión .png y Chrome los rechaza como iconos inválidos"*), pero `public/manifest.webmanifest` sigue declarándolos con `"type": "image/png"`, y `vite.config.ts:63` los precachea (`includeAssets: ['favicon.png', 'sportmaps-logo.png']`). Consecuencia visual permanente: al ser JPEG **no tienen canal alfa**, así que el logo arrastra un recuadro sólido en cualquier fondo que no sea el suyo. Ambos WebViews se comportan igual aquí; la diferencia la marca el consumidor (Chrome valida el `type` del manifest, iOS no).

> **HALLAZGO P-03 — El autofill de Chrome se corrige a mano; Safari queda por verificar · severidad: bajo**
> ```css
> /* src/index.css:340-356 */
> input:-webkit-autofill, … {
>   -webkit-text-fill-color: hsl(var(--foreground));
>   -webkit-box-shadow: 0 0 0 1000px hsl(var(--background)) inset;
>   transition: background-color 9999s ease-in-out 0s;
> }
> ```
> Buen parche, y bien comentado. Cubre Chrome/Edge (por tanto Android WebView). Safari usa el mismo prefijo `-webkit-`, así que en la práctica debería aplicar también — queda anotado como verificación pendiente en dispositivo, no como defecto.

### 5.3 Barra de estado

> **HALLAZGO P-04 — Sin control de barra de estado en ninguna plataforma · severidad: medio**
> `grep -rn "StatusBar" src/` → sin resultados; `@capacitor/status-bar` no está instalado.
> **Impacto Android:** el estilo de los iconos de la barra (claros u oscuros) queda a criterio del tema `DayNight` (A-06), no del tema de la app. Con la app en Claro y el SO en Oscuro se obtienen **iconos claros sobre la franja de una app clara**: invisibles. Y la franja además no tiene fondo (A-05).
> **Impacto iOS:** en la PWA standalone la barra toma el color del `body` y el estilo de los iconos del `theme-color`, que no se declara (D-04).

### 5.4 Gestos nativos vs gestos web

> **HALLAZGO P-05 — El botón atrás de Android no cierra modales · severidad: medio**
> `@capacitor/app` está instalado pero **no se registra ningún listener**: `grep -rn "backButton\|App.addListener" src/` → sin resultados.
> `BridgeActivity` de Capacitor delega por defecto a `webView.goBack()`, y como el router usa `pushState` el historial existe, así que la navegación atrás funciona. Lo que **no** funciona: los diálogos y sheets de Radix no están en el historial. Con un modal abierto, el botón/gesto atrás **navega la ruta de fondo dejando el modal montado** o cierra la app desde la primera pantalla. En un modal de pago a medio llenar eso es pérdida de datos.
> **Impacto iOS:** el swipe-back de Safari sí funciona en el PWA en pestaña; en standalone no hay swipe-back de sistema y **no hay botón atrás propio en la cabecera** de `AuthLayout.tsx` — el usuario depende de la navegación de la app.

---

## 6. Performance visual

### 6.1 Animaciones

| Propiedad animada | Usos | Compositor-friendly |
|---|---|---|
| `transition-colors` | 344 | sí (paint) |
| `transition-all` | **292** | **no — observa todas las propiedades** |
| `transition-transform` | 70 | sí |
| `transition-opacity` | 32 | sí |
| `hover:scale-*` | 60 | sí (transform) |
| `animate-pulse` | 64 | sí (opacity) |

> **HALLAZGO V-01 — 292 `transition-all`, varios sobre propiedades que provocan layout · severidad: medio**
> `transition-all` hace que el navegador observe **todas** las propiedades animables. Cuando el cambio incluye `width`, `height`, `padding` o `box-shadow` en un contenedor, cada frame dispara *layout* + *paint*. Ejemplos en componentes que se repiten en listas:
> ```css
> /* src/index.css:112 — .role-card */
> @apply … transition-all duration-300 hover:border-primary hover:shadow-card;
> ```
> ```ts
> // src/components/ui/button.tsx:19-20 — variantes hero/orange
> hero:   "bg-gradient-hero … hover:shadow-performance transition-all duration-300 hover:scale-105 border-0",
> orange: "bg-gradient-orange … hover:shadow-performance transition-all duration-300 hover:scale-105 border-0",
> ```
> **Impacto iOS y Android:** en móvil `:hover` casi no se dispara, así que el costo real es bajo hoy. El riesgo es que `transition-all` también capta cambios de clase por estado (`data-[state=open]`, condicionales de React), que sí ocurren al tocar. En listas largas con `shadow` animada se nota como *jank* al hacer scroll durante la transición.

> **HALLAZGO V-02 — 70 `backdrop-blur` sobre elementos `sticky`/`fixed` · severidad: medio**
> ```
> backdrop-blur-sm  41    backdrop-blur-md  14    backdrop-blur  9
> backdrop-blur-lg   1    backdrop-blur-xl   2    backdrop-blur-  3
> ```
> ```tsx
> // src/layouts/AuthLayout.tsx:48 — en la cabecera global, sobre TODA la app
> "… bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 … sticky top-0 z-50"
> ```
> `backdrop-filter` obliga al compositor a releer y desenfocar el contenido de debajo en cada frame de scroll.
> **Impacto Android:** el más afectado — en gama media/baja, un `backdrop-blur` sobre una cabecera fija durante el scroll es una fuente conocida de caída de FPS. **Impacto iOS:** WKWebView lo acelera mejor (es el efecto nativo de UIKit), pero suma en dispositivos antiguos. El `supports-[backdrop-filter]:` está bien puesto para degradar donde no hay soporte; falta el escape por rendimiento.
> Además, `will-change` solo aparece en `src/App.css:170`, que no se importa: **cero pistas de compositor en el CSS activo**.

### 6.2 Imágenes

| | |
|---|---|
| `<img>` en el código | **112** |
| Con `loading="lazy"` | **6** (5,4 %) |
| Con `srcSet` / `sizes` | **0** |
| Con `decoding="async"` | **0** |
| Con `width`/`height` explícitos | 0 |

> **HALLAZGO V-03 — Sin lazy loading, sin imágenes responsive, sin dimensiones · severidad: alto**
> Los 106 `<img>` sin `loading="lazy"` se descargan aunque estén fuera de pantalla. Sin `width`/`height` ni `aspect-ratio`, cada imagen que llega **recoloca el layout** (CLS) — y son avatares y logos dentro de listas, que es el peor caso.
> Sin `srcSet`, el móvil recibe el mismo archivo que el escritorio. `public/icons/icon-512.png` pesa **335 KB** y `src/assets/hero-sportsmaps.jpg` **224 KB**, servidos tal cual a un teléfono. Cero WebP/AVIF en todo el proyecto.
> **Impacto iOS y Android:** igual en ambas. En conexión móvil colombiana media, la landing y el explorador de escuelas pagan varios cientos de KB evitables, y el salto de layout al cargar avatares se percibe como una pantalla "que baila".

### 6.3 Fuentes

```html
<!-- frontend/index.html:181-183 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Cero `@font-face` propios, cero `.woff2` en el repo: **todas las fuentes son remotas**.

> **HALLAZGO V-04 — 5 pesos de Poppins remotos y bloqueantes, sin cachear por el SW · severidad: alto**
> Tres problemas encadenados:
> 1. **Bloqueante:** `<link rel="stylesheet">` en el `<head>` bloquea el render hasta resolver `fonts.googleapis.com`. `display=swap` evita el FOIT pero garantiza **FOUT** (texto en fallback y luego re-layout).
> 2. **Cinco pesos** (400/500/600/700/800) = cinco descargas para una app cuya jerarquía real usa regular, semibold y bold.
> 3. **El SW no las cachea.** `vite.config.ts:70-99` define `runtimeCaching` con `CacheFirst` para `fonts.googleapis.com` y `fonts.gstatic.com` — pero con `strategies: 'injectManifest'` **ese bloque es config muerta** (el propio archivo lo advierte para `globPatterns` en la línea 101; vale igual para `runtimeCaching`). El SW real es `src/sw.js`, escrito a mano, y retorna temprano para cross-origin:
>    ```js
>    // src/sw.js:88-91
>    if (url.origin !== self.location.origin) { return; }
>    ```
> **Impacto Android nativo:** el más grave. Los assets de la app se sirven del filesystem local, pero **la tipografía sale a Internet en cada arranque frío con caché HTTP vacía**: la app nativa muestra texto en fallback del sistema hasta que la red responda, y sin red **nunca** carga su tipografía. En una app empaquetada, las fuentes deberían ir dentro del APK. **Impacto iOS:** mismo FOUT en la PWA, mitigado por la caché HTTP de Safari tras la primera visita.

> **HALLAZGO V-05 — Tres familias tipográficas fantasma · severidad: medio**
> Solo Poppins se carga. En el código se piden tres más que nunca llegan:
> ```
> 4  fontFamily: 'Inter, sans-serif'   → components/pages/{AthleteRegister:415, CoachRegister:476, RoleSelection:152, SchoolRegister:511}
> 3  font-['DM_Sans']                  → pages/{LoginPage:148, RegisterPage:435, OnboardingRolePage:95}
> 1  fontFamily: 'Lexend, sans-serif'  → components/Layout.tsx:38 (archivo muerto, A-10)
> ```
> Las siete pantallas caen silenciosamente a `sans-serif` del sistema. **Impacto iOS:** San Francisco. **Impacto Android:** Roboto. Es decir: **el embudo de registro y acceso se renderiza con una tipografía distinta según el teléfono**, y ninguna es la de la marca. Nadie lo ha notado porque el fallback es legible.

### 6.4 Bundle

```
590 KB  index-DfeJd--r.js            ← el chunk principal
469 KB  vendor-react-DJ1eJ3Pc.js
435 KB  vendor-pdfjs-C2NMrW9w.js
381 KB  jspdf.es.min-Cu52Ihl1.js
331 KB  generateCategoricalChart-BFKPDfsz.js   (recharts)
197 KB  html2canvas.esm-CBrSDip1.js
133 KB  vision_bundle-DuCNxPTS.js    (@mediapipe/tasks-vision)
120 KB  PaymentsAutomationPage-CRgyb2Z7.js
─────
7,6 MB  total build/assets
```

El code splitting está bien planteado: todas las rutas son `lazy()` y `vite.config.ts:14-21` aparta manualmente tesseract, pdfjs y react. `injectManifest.globIgnores` (líneas 103-115) excluye del precache los pesos muertos con una nota medida en fecha — buen trabajo, ya hecho.

> **HALLAZGO V-06 — El chunk `index` de 590 KB está en la ruta crítica de cada arranque · severidad: medio**
> 590 KB (sin comprimir) del chunk principal más 469 KB de vendor-react se descargan y **parsean** antes del primer render útil. En la PWA hay caché; en el WebView nativo se lee de disco (rápido) pero el **parse/compile de JS** lo paga igual cada arranque frío en un teléfono de gama media. `build.target` no está fijado en `vite.config.ts`, así que aplica el default `'modules'` (chrome87/safari14/es2020) — razonable para `minSdk 26` con WebView actualizable y para iOS 14+.

> **HALLAZGO V-07 — El SW corre también en la app nativa, donde no aporta y sí arriesga · severidad: medio**
> ```ts
> // src/pwa/register.ts:4-9
> if (!('serviceWorker' in navigator)) return;
> if (import.meta.env.DEV) return;
> ```
> No hay guarda por `isNativePlatform()`. En Capacitor el WebView sirve desde `https://localhost`, así que el SW **se registra y toma control** dentro del APK: añade una capa de caché sobre assets que ya son locales e inmutables, y arrastra la lógica de `controllerchange → requestPwaReload()` (líneas 28-35) a un contexto donde nunca hay un deploy nuevo. Toda la clase de bugs de "recarga en bucle" que el propio archivo documenta haber peleado en web queda viva en nativo sin ningún beneficio a cambio.
> Detalle relacionado: `src/sw.js:26` precachea `/manifest.json` en `STATIC_ASSETS`, y `cache.addAll()` **rechaza entero si un solo recurso falla**. En Vercel funciona porque el catch-all `/(.*)` → `index.html` devuelve 200 para cualquier ruta. `build/manifest.json` sí existe hoy, así que no hay fallo — pero la instalación del SW está apoyada en un archivo que ningún `<link>` referencia (A-02) y en un rewrite que enmascara los 404.

---

## 7. Tabla priorizada de deuda de diseño responsive

Orden por (impacto × alcance) ÷ esfuerzo. "Alcance" = cuántas pantallas toca.

| # | Hallazgo | Sev. | Alcance | Esfuerzo | iOS | Android |
|---|---|---|---|---|---|---|
| 1 | **D-01** `#248223` / `green-*` a mano anulan el white-label | crítico | 480+ sitios | alto | ✕ | ✕ |
| 2 | **R-02** 15 cabeceras `sticky top-0` sin safe area superior | crítico | toda la app | bajo | ✕✕ | mitigado |
| 3 | **R-07** botón de cerrar de diálogo de 16×16px | alto | todos los diálogos | trivial | ✕ | ✕ |
| 4 | **R-03** `pb-20` menor que el bottom nav + inset | alto | todas las móviles | trivial | ✕✕ | ✕ |
| 5 | **R-04** 3 banners tapan el nav e ignoran los insets | alto | global | bajo | ✕✕ | ✕ |
| 6 | **R-08** escala de `Button` bajo 44pt/48dp (+26 reducidos a mano) | alto | global | medio | ✕ | ✕ |
| 7 | **V-04** Poppins remota, 5 pesos, sin cachear por el SW | alto | global | bajo | ✕ | ✕✕ |
| 8 | **A-08** `App.css` (241 líneas) no importado | alto | — | trivial | — | — |
| 9 | **R-06** `max-h-[90vh]` anulado a `100dvh` en 41 diálogos | alto | 41 diálogos | bajo | ✕ | ✕ |
| 10 | **D-03** 786 fondos claros sin variante oscura | alto | ~200 archivos | alto | ✕ | ✕✕ |
| 11 | **R-10** sin `@capacitor/keyboard` ni reacción al foco | alto | formularios | medio | ✕✕ | ✕ |
| 12 | **V-03** 106/112 `<img>` sin lazy, sin `srcSet`, sin dimensiones | alto | global | medio | ✕ | ✕ |
| 13 | **D-06** 1.021 textos bajo 12px | alto | global | alto | ✕ | ✕ |
| 14 | **A-04** tema nativo con índigo/rosa de Capacitor | alto | app nativa | trivial | — | ✕✕ |
| 15 | **A-05** franjas de edge-to-edge sin fondo | alto | app nativa | trivial | — | ✕✕ |
| 16 | **D-02** 7 pantallas de auth con paleta privada | alto | embudo de entrada | medio | ✕ | ✕ |
| 17 | **A-01** `cap:ios` sin plataforma iOS | alto | release iOS | alto | ✕✕ | — |
| 18 | **R-11** sin `overscroll-behavior` | medio | global | trivial | ✕ | ✕✕ |
| 19 | **P-05** atrás de Android no cierra modales | medio | global | bajo | — | ✕✕ |
| 20 | **R-13** grids de 4–7 columnas sin escalón móvil | medio | ~20 pantallas | medio | ✕ | ✕ |
| 21 | **D-05** `Textarea` a 14px → auto-zoom de iOS | medio | formularios | trivial | ✕✕ | — |
| 22 | **V-02** 70 `backdrop-blur` sobre `sticky`/`fixed` | medio | global | bajo | ✕ | ✕✕ |
| 23 | **R-01** `container` con 32px de gutter en móvil | medio | 165 usos | trivial | ✕ | ✕ |
| 24 | **R-09** zoom deshabilitado (WCAG 1.4.4) | medio | global | trivial | — | ✕✕ |
| 25 | **A-07** orientación libre en nativo, sin layout horizontal | medio | app nativa | bajo | — | ✕ |
| 26 | **V-07** el SW corre en la app nativa | medio | app nativa | trivial | — | ✕ |
| 27 | **P-04** sin control de barra de estado | medio | app nativa | bajo | ✕ | ✕✕ |
| 28 | **A-03** manifest por defecto sin icono `maskable` | medio | instalación | trivial | — | ✕ |
| 29 | **V-05** 3 familias tipográficas fantasma | medio | 7 pantallas | trivial | ✕ | ✕ |
| 30 | **R-05** `Sheet` top/bottom y `Drawer` sin safe area | medio | sheets/drawers | bajo | ✕✕ | ✕ |
| 31 | **P-02** 5 JPEG con extensión `.png` (mismo md5) | medio | iconos/logo | trivial | ✕ | ✕ |
| 32 | **V-01** 292 `transition-all` | medio | global | medio | ✕ | ✕ |
| 33 | **A-09** `ui/responsive.tsx` muerto y roto | medio | — | trivial | — | — |
| 34 | **V-06** chunk `index` de 590 KB | medio | arranque | medio | ✕ | ✕ |
| 35 | **R-12** scroll anidado (`main` como contenedor) | medio | toda la app | alto | ✕✕ | ✕ |
| 36 | **A-02** tres manifests, dos colores de marca | medio | — | trivial | ✕ | ✕ |
| 37 | **D-04** sin `theme-color`, `background_color` blanco | medio | instalación | trivial | ✕ | ✕ |
| 38 | **A-06** nativo `DayNight` vs tema web en localStorage | bajo | app nativa | bajo | — | ✕ |
| 39 | **P-01** cero estilos condicionales por plataforma | bajo | — | — | ✕ | ✕ |
| 40 | **A-10/A-11/P-03** `Layout.tsx`, `.main-content-with-nav`, autofill Safari | bajo | — | trivial | — | — |

`✕✕` = impacto directo y visible · `✕` = impacto presente · `—` = no aplica

---

## 8. Recomendaciones

Ordenadas por retorno sobre esfuerzo. Las tres primeras tandas no tocan lógica de negocio.

### Tanda 1 — Correcciones de una línea, alto impacto (medio día)

**1. Definir los colores nativos** (A-04, A-05, P-04). Crear `android/app/src/main/res/values/colors.xml` con el verde y el naranja de marca, y dar fondo a la ventana:
```xml
<!-- nuevo: values/colors.xml -->
<color name="colorPrimary">#248223</color>
<color name="colorPrimaryDark">#1B6119</color>
<color name="colorAccent">#FB9F1E</color>
<color name="windowBg">#FFFFFF</color>
```
```xml
<!-- styles.xml: AppTheme.NoActionBar -->
<item name="android:windowBackground">@color/windowBg</item>  <!-- reemplaza android:background=@null -->
```
Elimina de golpe el cursor rosa Material y las franjas negras de edge-to-edge.

**2. Agrandar el botón de cerrar de los diálogos** (R-07) — un cambio, todos los modales:
```tsx
// src/components/ui/dialog.tsx:48
- className="absolute right-4 top-4 rounded-sm opacity-70 …"
+ className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-sm opacity-70 …"
```

**3. Arreglar el hueco del bottom nav** (R-03):
```tsx
// src/layouts/AuthLayout.tsx:110
- pb-20 sm:pb-6
+ pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)] sm:pb-6
```

**4. Subir el `Textarea` a 16px en móvil** (D-05) — igualar el patrón que ya usa `Input`:
```tsx
// src/components/ui/textarea.tsx:11
- "… px-3 py-2 text-sm …"
+ "… px-3 py-2 text-base md:text-sm …"
```

**5. Gutter del `container` responsive** (R-01):
```ts
// tailwind.config.ts:11
- padding: "2rem",
+ padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
```

**6. Contener el overscroll** (R-11) — en `index.css`, sobre `html, body` y el `main` de `AuthLayout`: `overscroll-behavior: contain`.

**7. Borrar el código muerto** (A-08, A-09, A-10, A-11, A-02): `src/App.css`, `src/components/ui/responsive.tsx`, `src/components/Layout.tsx`, la regla `.main-content-with-nav`, `public/manifest.json` y `public/manifest.webmanifest`, y el bloque `workbox.runtimeCaching` de `vite.config.ts`. Cada uno de estos archivos hace creer que un problema está resuelto. **Antes de borrar `App.css` conviene decidir qué de su contenido debería vivir de verdad en `index.css`** — el parche de `min-height: 44px` es justamente lo que R-08 pide.

**8. Declarar el icono `maskable`** (A-03) — replicar en `SPORTMAPS_ICONS` lo que la rama de escuela ya hace en `bff/src/routes/pwa.routes.ts:155-160`.

**9. Guardar el SW del entorno nativo** (V-07):
```ts
// src/pwa/register.ts, tras la guarda de DEV
if ((window as any).Capacitor?.isNativePlatform?.()) return;
```

### Tanda 2 — Una utilidad de safe area y aplicarla (2–3 días)

**10. Añadir a `index.css` las utilidades que faltan y usarlas** (R-02, R-04, R-05):
```css
@layer utilities {
  .safe-top    { padding-top: env(safe-area-inset-top); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .sticky-safe { position: sticky; top: 0; padding-top: env(safe-area-inset-top); }
}
```
Aplicar `sticky-safe` en las 15 cabeceras listadas en R-02 (empezando por `AuthLayout.tsx:48`, que cubre toda la app autenticada), `safe-bottom` en `sheet.tsx` (variantes `bottom`), `drawer.tsx` y los tres banners de R-04. En Android es idempotente — `MainActivity` ya consume los insets, así que `env()` devuelve 0 y no hay doble margen; en la PWA de iOS es la diferencia entre usable e inusable.

**11. Reparar los tres banners** (R-04): subir el `bottom` por encima del nav (`bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] md:bottom-4`), `safe-top` en `UpdateBanner`, y cambiar `bg-sky-*`/`bg-white`/`text-slate-*` por tokens (`bg-card`, `text-card-foreground`, `bg-primary`) — resuelve de paso el modo oscuro y el branding de esas tres piezas.

**12. Resolver los 41 `max-h-[90vh]`** (R-06): decidir uno de los dos. Lo más limpio es quitar `max-height` de `.dialog-safe` (dejando `overflow-y: auto` y el `padding-bottom` con `env()`) y normalizar los sitios a `max-h-[90dvh]`; así la intención del autor vuelve a valer y se gana el margen superior que evita el notch.

**13. Bundlear Poppins** (V-04): descargar los `.woff2` de los 3 pesos que se usan de verdad, servirlos desde `public/fonts/` con `@font-face` + `font-display: swap`, añadir `<link rel="preload" as="font" crossorigin>` y quitar el `<link>` bloqueante a Google Fonts. Es el arreglo que más se nota en la app nativa (deja de depender de la red para la tipografía) y elimina dos `preconnect` de la ruta crítica.

**14. Unificar las familias fantasma** (V-05): quitar `Inter`, `DM Sans` y `Lexend` de los 8 sitios y dejar que herede Poppins del `body`.

**15. Manejar el atrás de Android** (P-05): un listener de `@capacitor/app` que cierre primero el modal abierto y solo después navegue.
```ts
if (isNativePlatform()) {
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (cerrarCapaSuperiorSiHay()) return;
    canGoBack ? history.back() : App.exitApp();
  });
}
```

### Tanda 3 — Trabajo de fondo, por fases (semanas)

**16. Campaña de tokens** (D-01) — el de mayor valor comercial, porque desbloquea el white-label ya vendido. Por fases medibles:
- Fase 1: sustituir los **127 `#248223` y 24 `#FB9F1E`** por `hsl(var(--primary))` / `hsl(var(--accent))`. Es mecánico y es donde el branding se rompe de forma más visible.
- Fase 2: mapear los verdes de Tailwind (`bg-green-500` 162, `text-green-600` 172, `text-green-500` 99, `border-green-500` 84) a tokens.
- Fase 3: definir tokens semánticos de estado (`--success`, `--warning`, `--danger`, `--info`) y migrar amber/red/blue/emerald — esto resuelve **D-03 al mismo tiempo**, porque los tokens ya tienen su valor en `.dark`.
- Añadir una regla de ESLint (o un test de repo) que falle ante un hexadecimal nuevo en `src/`, para que la deuda no vuelva a crecer.

**17. Auditoría de targets táctiles** (R-08): subir la escala base de `Button` a `default: h-11`, `sm: h-10`, `icon: h-11 w-11`; revisar los 26 sitios que la reducen a `h-7`/`h-8` y los que están junto a acciones destructivas. Donde el diseño exija un icono visualmente pequeño, mantener el icono pequeño y agrandar el área táctil con padding.

**18. Escala tipográfica mínima** (D-06): definir 12px como piso, migrar los 1.021 usos por debajo, y quitar `maximum-scale=1.0, user-scalable=no` del viewport (R-09) para recuperar el cumplimiento de WCAG 1.4.4 — el auto-zoom de iOS ya está cubierto por los 16px de `Input`, y bastará replicarlo en `Textarea` (recomendación 4).

**19. Imágenes** (V-03): `loading="lazy"` + `decoding="async"` + `width`/`height` en los 106 `<img>` sin ellos; convertir `hero-sportsmaps.jpg` (224 KB) e `icon-512.png` (335 KB) a WebP; dedupe de los 5 JPEG idénticos (P-02) y renombrarlos a `.jpg` o reconvertirlos a PNG real.

**20. Grids móviles** (R-13): revisar los 397 `grid-cols-N` sin escalón, priorizando los de 4–7 columnas dentro de diálogos.

**21. Decisión sobre iOS** (A-01, A-07): si iOS entra en el roadmap, `cap add ios` es el punto de partida — y con él hay que trasladar a CSS lo que `MainActivity` resuelve en Java, porque en iOS no hay equivalente. Antes de eso, fijar `android:screenOrientation="portrait"` en la Activity para alinear el nativo con el `orientation: portrait` que el manifest ya declara, o bien invertir el criterio y diseñar para horizontal.

### Lo que ya está bien y conviene no romper

Vale la pena dejarlo escrito, porque son decisiones que costaron trabajo y sus comentarios lo documentan:

- **Mobile-first estricto**, cero prefijos `max-*`, y un solo consumidor de `useIsMobile`: la adaptación es CSS, no JavaScript. Es la base correcta.
- **`MainActivity` + `SystemBars.insetsHandling: 'disable'`** — la solución de edge-to-edge para Android 15/16 está bien razonada y bien comentada, incluida la advertencia de que solo puede haber un listener de insets.
- **`openExternalUrl`** — el split de cobros que evita el rechazo de Play/App Store, con el historial del bug que lo originó anotado en el propio archivo.
- **Los guardas de plugins nativos** — `isNativePlatform()` síncrono + `import()` dinámico mantiene el bundle web limpio de código nativo. `useDeviceContext.ts:16-19` lo deja como regla explícita.
- **El script inline de tenant PWA de `index.html`** — resolver la escuela antes de que el navegador evalúe la instalabilidad, con el razonamiento de por qué `localStorage` solo se lee en modo instalado, es la clase de decisión que se pierde si no está comentada. Está.
- **`injectManifest.globIgnores`** — el recorte del precache de 7,4 MB con la medición fechada.
- **`ui/table.tsx`** — el scroll horizontal resuelto en el primitivo, así que los 54 archivos que muestran tablas lo heredan sin repetirlo.
- **El parche de autofill de `index.css:340-356`** — con la explicación de por qué es un `box-shadow` inset y no un `background`.
