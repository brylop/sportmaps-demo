import { useState, useEffect } from "react";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import logoImage from "@/assets/logo-bienvenida.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  url?: string; // Para forzar un logo específico (ej: en Login con invitación)
  showName?: boolean; // Para mostrar el nombre de la escuela al lado del logo
}

const Logo = ({ size = "md", className = "", url, showName = false }: LogoProps) => {
  const { schoolBranding, schoolName } = useSchoolContext();
  const [imgSrc, setImgSrc] = useState<string>(logoImage);

  // 1. Resolvemos qué logo usar en orden de prioridad
  const targetUrl = url || schoolBranding?.logo_url || logoImage;

  // 2. Sincronizamos el estado de la imagen si cambia el targetUrl
  useEffect(() => {
    setImgSrc(targetUrl);
  }, [targetUrl]);

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl"
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={imgSrc}
        alt={`${schoolName || 'SportMaps'} Logo`}
        className={`${sizeClasses[size]} object-contain`}
        onError={() => setImgSrc(logoImage)} // Si el custom falla, volvemos al de SportMaps
      />
      {showName && schoolName && (
        <span className={`font-bold truncate ${textClasses[size]} drop-shadow-sm`}>
          {schoolName}
        </span>
      )}
    </div>
  );
};

export default Logo;