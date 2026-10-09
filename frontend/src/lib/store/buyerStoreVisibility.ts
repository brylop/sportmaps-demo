/**
 * ¿Qué entradas a la tienda ve un COMPRADOR (padre / atleta)?
 *
 * El flag global `store_enabled()` se prende para el piloto (GYM RM, allowlist
 * en `platform_config`). Si el menú dependiera solo del flag, TODOS los padres
 * de TODAS las escuelas verían «Tienda» y entrarían a una tienda vacía. Por eso
 * la entrada depende de que LA ESCUELA ACTIVA del usuario tenga una tienda que
 * puede vender: `store_seller_allowed(vendor de la escuela)`, que ya combina
 * flag + allowlist + adicional + escuela operativa (lo devuelve el BFF en
 * GET /marketplace/school-store/:schoolId → `selling`).
 *
 *   Tienda       → flag AND la escuela vende
 *   Mis compras  → flag AND (la escuela vende OR el usuario ya tiene pedidos)
 *
 * Fail-closed: cualquier dato que falte (cargando, error, sin escuela) cuenta
 * como «no».
 */
export interface BuyerStoreInputs {
  /** Flag global de plataforma (`useStoreEnabled`). */
  storeEnabled: boolean;
  /** `store_seller_allowed` de la tienda de la escuela activa. */
  schoolSells: boolean;
  /** El usuario ya tiene al menos un pedido. */
  hasOrders: boolean;
}

export interface BuyerStoreVisibility {
  showStore: boolean;
  showMyPurchases: boolean;
}

export const BUYER_STORE_HIDDEN: BuyerStoreVisibility = { showStore: false, showMyPurchases: false };

export function buyerStoreVisibility(i: Partial<BuyerStoreInputs> | null | undefined): BuyerStoreVisibility {
  const flag = i?.storeEnabled === true;
  const sells = i?.schoolSells === true;
  const orders = i?.hasOrders === true;
  return {
    showStore: flag && sells,
    showMyPurchases: flag && (sells || orders),
  };
}

/** Roles que compran en la tienda de su escuela (menú y barra móvil). */
export const BUYER_ROLES = new Set(['parent', 'athlete']);
