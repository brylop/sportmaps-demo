/**
 * Módulo de Dotación — wrappers de acceso a datos (RPCs + lecturas directas).
 * Todo el stock se muta vía RPCs SECURITY DEFINER (nunca UPDATE desde el cliente).
 * Aislado del marketplace.
 */
import { supabase } from '@/integrations/supabase/client';

// ── Tipos de dominio ─────────────────────────────────────────────────────────
export type EquipmentCondition = 'nuevo' | 'usado' | 'deteriorado';
export type ReturnCondition = 'bueno' | 'dañado' | 'perdido';
export type CheckoutOverride = 'permitido' | 'bloqueado' | null;

export type AssignmentStatus =
  | 'pendiente_aceptacion' | 'pendiente_aprobacion_entrega' | 'activa'
  | 'en_disputa' | 'rechazada' | 'cancelada' | 'cerrada';

export interface EquipmentItem {
  id: string;
  name: string;
  size: string | null;
  quantity_total: number;
  quantity_available: number;
  condition: EquipmentCondition;
  photo_url: string | null;
  branch_id: string | null;
  branch_name: string | null;
  self_checkout_override: CheckoutOverride;
  is_active: boolean;
}

export interface EquipmentSettings {
  school_id: string;
  self_checkout_enabled: boolean;
  require_photo_admin_mode: boolean;
  default_return_days: number | null;
}

export interface CoachOption {
  profile_id: string;
  full_name: string | null;
}

export interface PendingDelivery {
  id: string;
  quantity: number;
  checkout_photo_url: string | null;
  checkout_note: string | null;
  created_at: string;
  branch_id: string | null;
  item_name: string;
  coach_name: string | null;
}

export interface PendingReturn {
  id: string;
  quantity: number;
  condition: ReturnCondition;
  photo_url: string | null;
  note: string | null;
  status: 'pendiente_aprobacion' | 'en_disputa';
  requested_at: string;
  assignment_id: string;
  assigned_quantity: number;
  checkout_photo_url: string | null;
  item_name: string;
  coach_name: string | null;
}

// ── Helper genérico ────────────────────────────────────────────────────────────
async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, (params ?? {}) as never);
  if (error) throw new Error(error.message);
  return data as T;
}

// ── API ─────────────────────────────────────────────────────────────────────
export const equipmentApi = {
  // Config
  async getSettings(schoolId: string): Promise<EquipmentSettings | null> {
    const { data, error } = await supabase
      .from('equipment_settings' as never)
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EquipmentSettings | null) ?? null;
  },
  saveSettings(p: {
    p_school_id: string;
    p_self_checkout_enabled: boolean;
    p_require_photo_admin_mode: boolean;
    p_default_return_days: number | null;
  }) {
    return rpc<void>('equipment_save_settings', p);
  },

  // Sedes (para filtros y formularios)
  async listBranches(schoolId: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase
      .from('school_branches' as never)
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name');
    if (error) throw new Error(error.message);
    return (data as Array<{ id: string; name: string }>) ?? [];
  },

  // Coaches (para el modal de asignación)
  listCoaches(schoolId: string) {
    return rpc<CoachOption[]>('equipment_list_coaches', { p_school_id: schoolId });
  },

  // Ítems
  listItems(p: {
    p_school_id: string;
    p_branch_id?: string | null;
    p_status?: string | null;
    p_search?: string | null;
    p_limit?: number;
    p_offset?: number;
  }) {
    return rpc<{ total: number; rows: EquipmentItem[] }>('equipment_list_items', p);
  },
  upsertItem(p: {
    p_school_id: string;
    p_name: string;
    p_quantity_total: number;
    p_id?: string | null;
    p_branch_id?: string | null;
    p_size?: string | null;
    p_condition?: EquipmentCondition;
    p_photo_url?: string | null;
    p_self_checkout_override?: CheckoutOverride;
  }) {
    return rpc<string>('equipment_upsert_item', p);
  },
  softDeleteItem(itemId: string) {
    return rpc<void>('equipment_soft_delete_item', { p_item_id: itemId });
  },

  // Asignación (Modo A)
  assign(p: {
    p_item_id: string;
    p_assigned_to: string;
    p_quantity: number;
    p_branch_id?: string | null;
    p_return_due_at?: string | null;
    p_note?: string | null;
    p_photo_url?: string | null;
  }) {
    return rpc<string>('equipment_assign', p);
  },

  // Cola de aprobación
  pendingApprovals(schoolId: string) {
    return rpc<{ deliveries: PendingDelivery[]; returns: PendingReturn[] }>(
      'equipment_pending_approvals',
      { p_school_id: schoolId }
    );
  },
  approveDelivery(assignmentId: string) {
    return rpc<void>('equipment_approve_delivery', { p_assignment_id: assignmentId });
  },
  rejectDelivery(assignmentId: string, note: string) {
    return rpc<void>('equipment_reject_delivery', { p_assignment_id: assignmentId, p_note: note });
  },
  approveReturn(returnId: string, finalCondition: ReturnCondition) {
    return rpc<void>('equipment_approve_return', { p_return_id: returnId, p_final_condition: finalCondition });
  },
  disputeReturn(returnId: string, note: string) {
    return rpc<void>('equipment_dispute_return', { p_return_id: returnId, p_note: note });
  },
  resolveDispute(p: {
    p_assignment_id: string;
    p_action: 'corregir' | 'cancelar';
    p_new_quantity?: number | null;
    p_note?: string | null;
  }) {
    return rpc<void>('equipment_resolve_dispute', p);
  },
  closeWithShortage(assignmentId: string, note: string) {
    return rpc<void>('equipment_close_with_shortage', { p_assignment_id: assignmentId, p_note: note });
  },
};
