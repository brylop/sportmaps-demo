/**
 * Elige la plantilla de correo de invitación según el rol invitado.
 *
 * Vivía duplicado (y divergido) en cada pantalla que invita: la de Invitaciones
 * mandaba 'parent_invitation' fijo, así que a un entrenador le llegaba "para
 * gestionar la información deportiva de tu hijo(a)". Los tres call sites usan
 * esto ahora para que no vuelva a pasar.
 *
 * IMPORTANTE: un `type` que la edge function send-email no conozca hace throw y
 * el correo NO sale. Si se agrega un tipo acá, `send-email` debe estar desplegada
 * antes (se despliega a mano: no viaja con el push del frontend).
 *
 * `referral` no pasa por acá: usa el RPC create_school_referral.
 */

const STAFF_ROLE_LABELS: Record<string, string> = {
  school_admin: 'Administrador de sede',
  reporter: 'Súper Usuario',
};

export interface InvitationEmailPayload {
  type: string;
  to: string;
  data: Record<string, string>;
}

export function invitationEmailPayload(params: {
  role: string | undefined;
  to: string;
  /** Nombre de la persona invitada (o del menor, si el rol es acudiente). */
  name?: string | null;
  registrationUrl: string;
  schoolName: string;
}): InvitationEmailPayload {
  const { role, to, registrationUrl, schoolName } = params;
  const name = (params.name || '').trim();

  switch (role) {
    case 'coach':
      return {
        type: 'coach_invitation',
        to,
        // La plantilla saluda "Hola <coachName>,": sin fallback quedaría "Hola ,".
        data: { schoolName, coachName: name || 'entrenador', registrationUrl },
      };

    case 'athlete':
      return {
        type: 'athlete_invitation',
        to,
        data: { schoolName, athleteName: name, registrationUrl },
      };

    case 'school_admin':
    case 'reporter':
      return {
        type: 'staff_invitation',
        to,
        data: {
          schoolName,
          staffName: name,
          roleLabel: STAFF_ROLE_LABELS[role] || 'miembro del equipo',
          registrationUrl,
        },
      };

    default:
      return {
        type: 'parent_invitation',
        to,
        data: { schoolName, childName: name, registrationUrl },
      };
  }
}
