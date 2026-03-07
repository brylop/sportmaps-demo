/**
 * Diccionario y utilidad para traducir errores técnicos de Supabase/PostgREST
 * a mensajes amigables y entendibles para el usuario final en español.
 */

export const ERROR_MAPPINGS: Record<string, string> = {
    // Errores de Row Level Security (RLS)
    'new row violates row-level security policy': 'No tienes permisos suficientes para realizar esta acción o no eres el propietario del registro.',
    'row-level security policy': 'Acceso denegado por políticas de seguridad. Contacta al administrador si crees que es un error.',

    // Errores de Base de Datos (Constraints)
    'duplicate key value violates unique constraint': 'Esta información ya existe en el sistema (ej. el correo o documento ya está registrado).',
    'violates foreign key constraint': 'No se puede eliminar o modificar este registro porque está vinculado a otros datos existentes.',
    'violates check constraint': 'Los datos ingresados no cumplen con las reglas de validación del sistema.',

    // Errores de Autenticación
    'Invalid login credentials': 'El correo o la contraseña son incorrectos. Por favor, verifica e intenta de nuevo.',
    'User already registered': 'Este correo ya se encuentra registrado. Intenta iniciar sesión.',
    'Email not confirmed': 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.',
    'Invalid token': 'El enlace de invitación ha expirado o no es válido.',

    // Errores de Red / Conexión
    'Failed to fetch': 'Error de conexión. Por favor, verifica tu internet e intenta de nuevo.',
    'Network request failed': 'Parece que hubo un problema de red. Reintenta en unos momentos.',

    // Otros
    'Database error': 'Ocurrió un inconveniente técnico en nuestro servidor. Estamos trabajando para solucionarlo.'
};

/**
 * Toma un error (objeto o string) y devuelve un mensaje apto para el usuario final.
 */
export function getUserFriendlyError(error: any): string {
    if (!error) return 'Ocurrió un error inesperado. Intenta de nuevo.';

    // Extraer el mensaje base
    const rawMessage = typeof error === 'string'
        ? error
        : error.message || error.error_description || String(error);

    // Buscar coincidencias en nuestro diccionario
    for (const [technical, friendly] of Object.entries(ERROR_MAPPINGS)) {
        if (rawMessage.toLowerCase().includes(technical.toLowerCase())) {
            return friendly;
        }
    }

    // Fallback amigable si no hay mapping específico
    console.warn('Unhandled technical error:', rawMessage);
    return 'Lo sentimos, ocurrió un inconveniente inesperado. Por favor, intenta de nuevo o contacta soporte si el problema persiste.';
}
