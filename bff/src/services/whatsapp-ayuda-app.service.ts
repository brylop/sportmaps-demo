/**
 * Ayuda para entrar y usar la app (ajuste `wa_ayuda_app`, spec
 * docs/specs/whatsapp-ajustes-por-escuela.md).
 *
 * Besser: buena parte de lo que les escriben es «no puedo entrar», «olvidé la
 * clave», «cómo pago en la app». El bot contesta con el paso a paso y los
 * nombres REALES de los botones (LoginPage, MyPaymentsPage), sin modelo.
 *
 * «¿Cómo pago?» suelto NO dispara esto: sin mencionar la app sigue yendo a los
 * medios de pago (las cuentas), como siempre.
 */

export type TemaAyudaApp = 'clave' | 'pagar_app' | 'entrar' | 'instalar';

function normalizar(t: string | null | undefined): string {
    return String(t ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const APP = /\b(app|aplicacion|aplicaciones|plataforma|sportmaps|pagina|portal)\b/;

const CLAVE: RegExp[] = [
    /\bolvid\w* (la |mi )?(contrasena|clave)\b/,
    /\b(recuperar|restablecer|cambiar|resetear) (la |mi )?(contrasena|clave|cuenta)\b/,
    /\b(contrasena|clave) (incorrecta|equivocada|no sirve|no funciona|no me sirve)\b/,
    /\bno (me acuerdo|recuerdo) (de )?(la |mi )?(contrasena|clave)\b/,
];

const ENTRAR: RegExp[] = [
    /\bno (puedo|me deja|logro|he podido|pude|consigo) (entrar|ingresar|iniciar sesion|acceder|loguearme|loguear)\b/,
    /\bcomo (entro|ingreso|accedo|inicio sesion|me registro|me logueo)\b/,
    /\b(entrar|ingresar|acceder) (a|en) (la )?(app|aplicacion|plataforma|pagina|cuenta)\b/,
    /\bno me (abre|carga|funciona|sirve) la (app|aplicacion|plataforma|pagina)\b/,
    /\b(usuario|correo) y (contrasena|clave)\b/,
];

const PAGAR = /\b(pago|pagar|pague|pagamos|mensualidad|cobro|comprobante)\b/;
const COMO_PAGAR = /\b(como|donde|no (puedo|me deja|logro|pude)|ayuda|ayudame|ensename|paso a paso)\b/;

const INSTALAR: RegExp[] = [
    /\b(descargar|descargo|instalar|instalo|bajar|bajo) (la )?(app|aplicacion)\b/,
    /\bdonde (descargo|esta|encuentro) la (app|aplicacion)\b/,
    /\b(app|aplicacion) (en|para) (el )?(celular|iphone|android)\b/,
];

/** Qué ayuda de la app pide, o null. Orden: clave > pagar en la app > entrar > instalar. */
export function pideAyudaDeApp(texto: string | null | undefined): TemaAyudaApp | null {
    const t = normalizar(texto);
    if (!t) return null;
    if (CLAVE.some((re) => re.test(t))) return 'clave';
    if (APP.test(t) && PAGAR.test(t) && COMO_PAGAR.test(t)) return 'pagar_app';
    if (ENTRAR.some((re) => re.test(t))) return 'entrar';
    if (INSTALAR.some((re) => re.test(t))) return 'instalar';
    return null;
}

const INSTALAR_TEXTO =
    '📲 No hay que descargarla de la tienda: se usa desde el navegador del celular. Para tenerla como app, ' +
    'ábrela y en *Android (Chrome)* toca el menú ⋮ → *«Agregar a pantalla de inicio»*; ' +
    'en *iPhone (Safari)* toca Compartir → *«Agregar a inicio»*.';

/**
 * El paso a paso. `urlLogin` ya viene con la marca de la escuela.
 * `identificado` = el número es de una familia con cuenta: a un desconocido se
 * le agrega cómo se crea la cuenta.
 */
export function textoAyudaApp(tema: TemaAyudaApp, p: { urlLogin: string; identificado: boolean }): string {
    const sinCuenta = p.identificado
        ? []
        : ['', 'Si todavía no tienes cuenta, se crea al inscribir a tu hijo/a con el enlace de inscripción de la escuela. Si ya lo inscribiste y no puedes entrar, escríbeme el *correo* con el que te registraste.'];

    const recuperar = [
        `1️⃣ Abre ${p.urlLogin}`,
        '2️⃣ Toca *«¿Olvidaste tu contraseña?»*.',
        '3️⃣ Escribe el *correo* con el que te registraste y toca *«Enviar instrucciones»*.',
        '4️⃣ Abre el correo que te llega (revisa también *spam* o *promociones*) y crea una contraseña nueva.',
    ];

    switch (tema) {
        case 'clave':
            return ['Para crear una contraseña nueva:', ...recuperar, ...sinCuenta].join('\n');
        case 'pagar_app':
            return [
                'Para pagar desde la app:',
                `1️⃣ Entra a ${p.urlLogin} con tu correo y contraseña.`,
                '2️⃣ En el menú abre *«Pagos»*.',
                '3️⃣ En el cobro que vas a pagar toca *«Pagar Ahora»*.',
                '4️⃣ Transfiere a una de las cuentas que aparecen ahí y *sube la foto del comprobante* en esa misma pantalla.',
                'La escuela lo revisa y el cobro queda pagado. También puedes mandarme el comprobante por aquí. 🙌',
                ...sinCuenta,
            ].join('\n');
        case 'entrar':
            return [
                'Para entrar a la app:',
                `1️⃣ Abre ${p.urlLogin}`,
                '2️⃣ Escribe el *correo* con el que te registraste y tu *contraseña*, y toca *«Entrar ahora»*.',
                '',
                'Si no recuerdas la contraseña, en esa misma pantalla toca *«¿Olvidaste tu contraseña?»*, escribe tu correo y te llega un enlace para crear una nueva (revisa también *spam*).',
                '',
                INSTALAR_TEXTO,
                ...sinCuenta,
            ].join('\n');
        case 'instalar':
            return [`La app está en ${p.urlLogin}`, '', INSTALAR_TEXTO, ...sinCuenta].join('\n');
    }
}
