/**
 * Utility to map Supabase/PostgreSQL error messages to user-friendly Spanish.
 */
export const getErrorMessage = (error: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!error) return 'Ha ocurrido un error inesperado';

    const message = error.message || '';
    const code = error.code || '';

    // Supabase Auth Errors
    if (message.includes('Invalid login credentials')) {
        return 'Email o contraseña incorrectos. Por favor, verifica tus datos.';
    }

    if (message.includes('User already registered') || code === '23505') {
        return 'Este correo electrónico ya está registrado. Intenta iniciar sesión.';
    }

    if (message.includes('Password should be at least')) {
        return 'La contraseña es demasiado corta. Debe tener al menos 8 caracteres.';
    }

    if (message.includes('Email not confirmed')) {
        return 'Por favor, confirma tu correo electrónico para continuar.';
    }

    if (message.includes('User not found')) {
        return 'No hemos encontrado una cuenta con ese correo electrónico.';
    }

    if (message.includes('database error')) {
        return 'Error de conexión con el servidor. Inténtalo de nuevo más tarde.';
    }

    if (message.includes('rate limit')) {
        return 'Has realizado demasiados intentos. Por favor, espera un momento.';
    }

    // Fallback to original message or a generic one
    return message || 'Ocurrió un error al procesar tu solicitud';
};
