import { USER_ROLES } from '../../constants/roles';
import { Building, Users, Award, Bell, Activity, Shield, TrendingUp, Trophy, UserCircle, Calendar, Plus, Heart, ShoppingBag, CreditCard } from 'lucide-react';

export const getStepsForRole = (role: string, status: any) => {
    switch (role) {
        case USER_ROLES.SCHOOL:
        case USER_ROLES.SCHOOL_ADMIN:
        case USER_ROLES.ADMIN:
            // If the user is the Owner (no school created yet)
            if (!status.has_school && role === USER_ROLES.SCHOOL) {
                return [
                    { id: 'create_school', title: 'Registrar Academia', description: 'Nombre, logo y dirección fiscal.', completed: false, href: '/setup/school', icon: Building },
                    { id: 'create_branch', title: 'Configurar Sedes', description: 'Crea tu sede principal o sucursales.', completed: status.has_branches, href: '/branches', icon: Building },
                    { id: 'create_team', title: 'Equipos', description: 'Crea tus equipos y grupos de entrenamiento.', completed: status.has_teams, href: '/teams', icon: Users }
                ];
            }

            // Operational flow (Branch Admin or Owner)
            return [
                { id: 'create_branch', title: 'Configurar Sede Principal', description: 'Edita dirección, ciudad y capacidad de tu sede.', completed: status.has_branches, href: '/branches', icon: Building },
                { id: 'create_team', title: 'Equipos', description: 'Crea tus equipos y grupos de entrenamiento.', completed: status.has_teams, href: '/teams', icon: Users },
                { id: 'invite_staff', title: 'Equipo Técnico', description: 'Invita a tus entrenadores.', completed: status.has_staff, href: '/staff', icon: Users },
                { id: 'setup_payments', title: 'Configurar Pagos', description: 'Define datos bancarios y ciclo de cobro antes de inscribir atletas.', completed: status.payment_setup_completed === true, href: '/payments', icon: CreditCard },
                { id: 'invite_parents', title: 'Vincular Familias', description: 'Envía invitaciones o agrega estudiantes.', completed: status.has_accepted_invite, href: '/students', icon: Bell }
            ];

        case USER_ROLES.PARENT: {
            const parentSteps = [];

            // Only show accept_invite if there's a pending invitation or it was already accepted
            if (status.has_pending_invitation || status.has_accepted_invite) {
                parentSteps.push({ id: 'accept_invite', title: 'Aceptar Invitación', description: 'Vinculate a la escuela de tu hijo.', completed: status.has_accepted_invite, href: '/notifications', icon: Bell });
            }

            parentSteps.push(
                { id: 'add_child', title: 'Perfil del Deportista', description: 'Crea la ficha de tu hijo.', completed: status.has_children, href: '/children', icon: Users },
                { id: 'medical_info', title: 'Ficha Médica', description: 'Sube EPS y datos de salud.', completed: status.has_medical_records, href: '/children', icon: Heart }
            );
            return parentSteps;
        }

        case USER_ROLES.COACH:
            return [
                { id: 'accept_invite', title: 'Vincular Academia', description: 'Acepta la invitación de tu escuela.', completed: status.has_accepted_invite, href: '/notifications', icon: Building },
                { id: 'complete_profile', title: 'Perfil Profesional', description: 'Sube tu experiencia y certificaciones.', completed: status.has_professional_profile, href: '/profile', icon: UserCircle }
            ];

        case USER_ROLES.ATHLETE: {
            const athleteSteps = [];

            // Paso 1: Verificar correo (si está pendiente)
            if (!status.email_verified) {
                athleteSteps.push({ id: 'verify_email', title: 'Verifica tu correo', description: 'Confirma tu dirección de email para activar tu cuenta.', completed: false, href: '/settings', icon: Shield });
            }

            // Paso 2: Completar perfil deportivo
            athleteSteps.push({ id: 'complete_profile', title: 'Completa tu perfil', description: 'Datos personales, documento y nivel de experiencia.', completed: status.profile_complete, href: '/settings', icon: UserCircle });

            // Paso 3: Foto de perfil (opcional pero recomendado)
            if (!status.has_avatar) {
                athleteSteps.push({ id: 'upload_avatar', title: 'Foto de perfil', description: 'Sube una foto para que te reconozcan.', completed: false, href: '/settings', icon: UserCircle });
            }

            // Paso 4: Seleccionar deporte de interés
            athleteSteps.push({ id: 'select_sport', title: 'Elige tu deporte', description: 'Selecciona los deportes que te interesan.', completed: status.has_sports_interest, href: '/settings', icon: Activity });

            // Paso 5: Inscribirse o aceptar invitación
            if (status.has_pending_invitation || status.has_accepted_invite) {
                athleteSteps.push({ id: 'accept_invite', title: 'Aceptar invitación', description: 'Vincúlate con tu academia deportiva.', completed: status.has_accepted_invite, href: '/notifications', icon: Bell });
            }
            athleteSteps.push({ id: 'enroll_program', title: 'Inscribirse en programa', description: 'Busca una academia y únete a un equipo.', completed: status.has_accepted_invite || status.has_enrollment, href: '/explore', icon: Trophy });

            return athleteSteps;
        }

        default:
            return [];
    }
};
