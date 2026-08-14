import Landing from "@/components/pages/Landing";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { resolveTenantSlug } from "@/pwa/tenant";

const Index = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si la visita pertenece a una escuela, no se muestra la landing comercial de
  // SportMaps ("Escuelas Deportivas", "Tienda", "Fútbol como los grandes"): se
  // manda al login, que sí está pintado con su marca.
  //
  // Ademas de ser lo correcto, esto arregla las apps YA INSTALADAS: quedaron con
  // start_url = /?t=<slug> de antes de que apuntara al login, y ese start_url no
  // se puede cambiar sin que el navegador las trate como otra app distinta. Sin
  // este redirect, abrir el icono de la escuela caia en la landing de SportMaps.
  const tenant = resolveTenantSlug();
  if (tenant) {
    return <Navigate to={`/login?t=${encodeURIComponent(tenant)}`} replace />;
  }

  return <Landing />;
};

export default Index;
