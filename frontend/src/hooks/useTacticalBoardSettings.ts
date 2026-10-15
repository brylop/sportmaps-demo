/**
 * Ajustes de la pizarra del coach (M6g): estado + persistencia por usuario.
 * La lógica (curvas, normalizar, claves por usuario) vive en
 * lib/school/tacticalBoardSettings.ts; acá solo se conecta con React y con el
 * usuario de la sesión.
 */
import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from '@/contexts/AuthContext';
import {
  loadBoardSettings, saveBoardSettings, type TacticalBoardSettings,
} from '@/lib/school/tacticalBoardSettings';

export interface UseTacticalBoardSettings {
  settings: TacticalBoardSettings;
  update: (patch: Partial<TacticalBoardSettings>) => void;
}

export function useTacticalBoardSettings(): UseTacticalBoardSettings {
  const userId = useOptionalAuth()?.user?.id ?? null;
  const [settings, setSettings] = useState<TacticalBoardSettings>(() => loadBoardSettings(userId));

  // Cambio de cuenta en el mismo dispositivo: se leen los ajustes del NUEVO
  // usuario (nunca se quedan los del anterior en memoria).
  useEffect(() => {
    setSettings(loadBoardSettings(userId));
  }, [userId]);

  const update = useCallback((patch: Partial<TacticalBoardSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveBoardSettings(userId, next);
      return next;
    });
  }, [userId]);

  return { settings, update };
}
