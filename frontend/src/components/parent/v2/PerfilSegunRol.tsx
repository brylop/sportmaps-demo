/**
 * /profile para el acudiente V2: una sola «Mi cuenta» (= /settings: datos,
 * avisos, privacidad, contraseña y eliminar cuenta). Mi perfil repetía los
 * mismos datos; sus documentos de los hijos viven en Hijos › Ficha y salud y
 * los puntos SportMaps están fuera por ahora. Los demás roles no cambian.
 */
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { ACUDIENTE_V2 } from '@/lib/feature-flags';

const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

export default function PerfilSegunRol() {
  const { profile } = useAuth();
  const { currentUserRole } = useSchoolContext();
  if (ACUDIENTE_V2 && (currentUserRole ?? profile?.role) === 'parent') return <Navigate to="/settings" replace />;
  return <ProfilePage />;
}
