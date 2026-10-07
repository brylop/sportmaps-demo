import { Navigate } from 'react-router-dom';

/** La agenda del profesional vive ahora en /schedule (confirmar, reprogramar, atender). */
export default function VendorAppointmentsPage() {
  return <Navigate to="/schedule" replace />;
}
