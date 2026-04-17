/**
 * Vendor Capability Validation (Frontend)
 * Helpers para verificar que puede hacer cada vendor segun su perfil.
 * El enforcement real es via triggers de BD (Fase 1).
 * Estos helpers solo controlan visibilidad de UI.
 */

export interface VendorCapabilities {
  can_sell_products: boolean;
  can_sell_services: boolean;
}

export function canCreateProduct(capabilities: VendorCapabilities | null | undefined): boolean {
  return capabilities?.can_sell_products === true;
}

export function canCreateService(capabilities: VendorCapabilities | null | undefined): boolean {
  return capabilities?.can_sell_services === true;
}

export function getVendorTypeLabel(vendorType: string): string {
  switch (vendorType) {
    case 'store': return 'Tienda';
    case 'wellness': return 'Profesional de Salud';
    case 'school': return 'Escuela';
    default: return 'Vendedor';
  }
}

export function getVerificationStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'verified': return { label: 'Verificado', color: 'text-green-600 bg-green-50' };
    case 'pending': return { label: 'Pendiente', color: 'text-amber-600 bg-amber-50' };
    case 'rejected': return { label: 'Rechazado', color: 'text-red-600 bg-red-50' };
    default: return { label: status, color: 'text-gray-600 bg-gray-50' };
  }
}
