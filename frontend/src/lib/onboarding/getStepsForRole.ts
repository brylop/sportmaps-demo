import { USER_ROLES } from '../../constants/roles';
import { Building, Users, Award, Bell, Activity, Shield, TrendingUp, Trophy, UserCircle, Calendar, Plus, Heart, ShoppingBag } from 'lucide-react';

export const getStepsForRole = (role: string, status: any) => {
    switch (role) {
        case USER_ROLES.SCHOOL:
        case USER_ROLES.SCHOOL_ADMIN:
        case USER_ROLES.ADMIN:
            // If the user is the Owner (no school created yet)
            if (!status.has_school && role === USER_ROLES.SCHOOL) {
                return [
                    { id: 'create_school', title: 'Registrar Academia', description: 'Nombre, logo y dirección fiscal.', completed: false, href: '/setup/school', icon: Building },
                    { id: 'create_branch', title: 'Configurar Sedes', description: 'Crea tu sede principal o sucursales.', completed: status.has_branches, href: '/branches', icon: Building }
                ];
            }

            // Operational flow (Branch Admin or Owner)
            return [
                { id: 'create_branch', title: 'Configurar Sedes', description: 'Gestiona tu sede principal y sucursales.', completed: status.has_branches && status.branches_count > 0, href: '/branches', icon: Building },
                { id: 'create_program', title: 'Programas Deportivos', description: 'Crea clases de fútbol, karate, etc.', completed: status.has_programs, href: '/programs-management', icon: Award },
                { id: 'invite_staff', title: 'Equipo Técnico', description: 'Invita a tus entrenadores.', completed: status.has_staff, href: '/staff', icon: Users },
                { id: 'invite_parents', title: 'Vincular Familias', description: 'Invita a los padres por correo.', completed: status.has_accepted_invite, href: '/students', icon: Bell }
            ];

        case USER_ROLES.PARENT:
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

        case USER_ROLES.COACH:
            return [
                { id: 'accept_invite', title: 'Vincular Academia', description: 'Acepta la invitación de tu escuela.', completed: status.has_accepted_invite, href: '/notifications', icon: Building },
                { id: 'complete_profile', title: 'Perfil Profesional', description: 'Sube tu experiencia y certificaciones.', completed: status.profile_complete, href: '/profile', icon: UserCircle }
            ];

        case USER_ROLES.ATHLETE:
            return [
                { id: 'complete_profile', title: 'Completar Perfil', description: 'Asegúrate de que tus datos estén al día.', completed: status.profile_complete, href: '/profile', icon: UserCircle },
                { id: 'enroll_program', title: 'Inscribirse en Programa', description: 'Busca una academia y únete.', completed: status.has_accepted_invite, href: '/explore', icon: Trophy }
            ];

        default:
            return [];
    }
};
