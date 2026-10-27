/**
 * Clase de prueba — configuración única por canal y prospectos de la pestaña
 * «Clase de prueba» de Deportistas (mig. 20261026155701).
 *
 * Los prospectos viven en `school_signup_leads` (WhatsApp, formulario y
 * registro rápido en la escuela); no son deportistas hasta completar el alta.
 * Los cupos del bot son `school_trial_slots` (RPC de 20260825151250).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConfigClasePrueba {
  enabled: boolean;
  presencial_enabled: boolean;
  whatsapp_enabled: boolean;
  self_service_enabled: boolean;
  cupos_desde_entrenamientos: boolean;
  indicaciones: string | null;
  slug: string | null;
  es_admin: boolean;
}

export type CanalProspecto = 'presencial' | 'whatsapp' | 'formulario';

export interface ProspectoClasePrueba {
  id: string;
  full_name: string;
  guardian_name: string | null;
  phone: string;
  email: string | null;
  gender: string | null;
  birth_date: string | null;
  notes: string | null;
  status: 'new' | 'contacted';
  created_at: string;
  canal: CanalProspecto | string;
  asistencia: 'asistio' | 'no_vino' | null;
  fecha_clase: string | null;
  cupo_label: string | null;
  cupo_hora: string | null;
}

export interface CupoClasePrueba {
  id: string;
  team_id: string | null;
  label: string;
  slot_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  max_capacity: number;
  reserved_count: number;
  is_open: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function useConfigClasePrueba(schoolId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ['clase-prueba-config', schoolId];

  const query = useQuery({
    queryKey: key,
    enabled: !!schoolId,
    queryFn: () => rpc<ConfigClasePrueba>('obtener_config_clase_prueba', { p_school_id: schoolId }),
  });

  const guardar = useMutation({
    mutationFn: (cambios: Partial<Pick<ConfigClasePrueba,
      'enabled' | 'presencial_enabled' | 'whatsapp_enabled' | 'cupos_desde_entrenamientos' | 'indicaciones'>>) =>
      rpc<ConfigClasePrueba>('guardar_config_clase_prueba', {
        p_school_id: schoolId,
        p_enabled: cambios.enabled ?? null,
        p_presencial_enabled: cambios.presencial_enabled ?? null,
        p_whatsapp_enabled: cambios.whatsapp_enabled ?? null,
        p_cupos_desde_entrenamientos: cambios.cupos_desde_entrenamientos ?? null,
        p_indicaciones: cambios.indicaciones ?? null,
      }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      // El switch general también lo lee la config de Instalaciones.
      qc.invalidateQueries({ queryKey: ['trial-class-settings'] });
    },
  });

  return { config: query.data, isLoading: query.isLoading, guardar };
}

export function useProspectosClasePrueba(schoolId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ['clase-prueba-prospectos', schoolId];
  const refrescar = () => qc.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    enabled: !!schoolId,
    queryFn: () => rpc<ProspectoClasePrueba[]>('listar_clase_prueba', { p_school_id: schoolId }),
  });

  const registrar = useMutation({
    mutationFn: (p: { acudiente: string; telefono: string; nombres: string[]; esAdulto: boolean }) =>
      rpc<{ ok: boolean; creados: number; actualizados: number }>('registrar_clase_prueba_rapida', {
        p_school_id: schoolId,
        p_acudiente: p.acudiente,
        p_telefono: p.telefono,
        p_nombres: p.nombres,
        p_es_adulto: p.esAdulto,
      }),
    onSuccess: refrescar,
  });

  const cerrar = useMutation({
    mutationFn: (p: { leadId: string; estado: 'converted' | 'discarded'; childId?: string | null; userId?: string | null; unregisteredId?: string | null }) =>
      rpc('cerrar_prospecto_clase_prueba', {
        p_lead_id: p.leadId,
        p_estado: p.estado,
        p_child_id: p.childId ?? null,
        p_user_id: p.userId ?? null,
        p_unregistered_id: p.unregisteredId ?? null,
      }),
    onSuccess: refrescar,
  });

  return { prospectos: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null, registrar, cerrar };
}

export function useCuposClasePrueba(schoolId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const key = ['clase-prueba-cupos', schoolId];
  const refrescar = () => qc.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    enabled: !!schoolId && enabled,
    queryFn: () => rpc<CupoClasePrueba[]>('list_school_trial_slots', { p_school_id: schoolId }),
  });

  const crear = useMutation({
    mutationFn: (c: { label: string; fecha: string; inicio: string; fin: string | null; lugar: string | null; capacidad: number }) =>
      rpc('create_school_trial_slot', {
        p_school_id: schoolId,
        p_label: c.label,
        p_slot_date: c.fecha,
        p_start_time: c.inicio,
        p_end_time: c.fin,
        p_location: c.lugar,
        p_max_capacity: c.capacidad,
        p_team_id: null,
      }),
    onSuccess: refrescar,
  });

  const cerrar = useMutation({
    mutationFn: (slotId: string) => rpc('cerrar_cupo_clase_prueba', { p_slot_id: slotId }),
    onSuccess: refrescar,
  });

  return { cupos: query.data ?? [], isLoading: query.isLoading, crear, cerrar };
}
