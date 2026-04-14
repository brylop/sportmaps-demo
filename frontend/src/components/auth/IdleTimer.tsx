import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Componente que maneja la inactividad del usuario.
 * Cierra sesión automáticamente tras 5 minutos sin interacción.
 * Muestra una advertencia 30 segundos antes de expirar.
 */
export const IdleTimer = () => {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [remainingTime, setRemainingTime] = useState(30);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  const WARNING_MS = 4.5 * 60 * 1000; // Aviso a los 4:30

  const resetTimer = () => {
    if (showWarning || isLoggingOut) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Iniciar timer de advertencia
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, WARNING_MS);

    // Iniciar timer de cierre definitivo
    timeoutRef.current = setTimeout(() => {
      handleFinalLogout();
    }, TIMEOUT_MS);
  };

  const startCountdown = () => {
    setRemainingTime(30);
    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleFinalLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setShowWarning(false);
    
    // Limpiar almacenamientos locales para evitar "zombie sessions"
    console.log("[Auth] Idle timeout reached. Signing out...");
    await signOut();
    setIsLoggingOut(false);
  };

  const stayLoggedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  useEffect(() => {
    if (!user) {
      // Si no hay usuario, limpiar todo
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    // Al registrar cualquier evento, reseteamos el timer
    const handleActivity = () => resetTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));
    
    // Iniciar timer inicial
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user]);

  if (!user) return null;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="z-[10000]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            ⚠️ ¿Sigues ahí?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Tu sesión está a punto de expirar por inactividad por razones de seguridad.
            Se cerrará automáticamente en <span className="font-bold text-destructive">{remainingTime} segundos</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={stayLoggedIn}
            className="w-full sm:w-auto"
          >
            Mantener sesión abierta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
