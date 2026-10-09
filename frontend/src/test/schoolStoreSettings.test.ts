import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRANSFER_INSTRUCTIONS, accountReasonLabel, formFromAdminSettings, settingsPayload, storePublicUrl,
  storeSettingsErrorMessage, storeStatusMessage, validateStoreSettings, type StoreAdminSettings,
} from '../lib/store/schoolStore';
import { getVendorNavGroup } from '../config/navigation';

function admin(over: Partial<StoreAdminSettings> = {}): StoreAdminSettings {
  return {
    store: { id: 'vp', slug: 'gym-rm', display_name: 'GYM RM', vendor_type: 'school', school_id: 's' },
    status: { selling: false, store_enabled: true, in_pilot: false, addon: true, operational: true, can_sell_products: true },
    settings: null,
    accounts: [
      { id: 'nequi', type: 'nequi', label: 'Nequi', value_masked: '•••• 2233', eligible: true, selected: true },
      { id: 'breb', type: 'breb', label: 'Bre-B', value_masked: '@gym', eligible: true, selected: true },
      { id: 'insc', type: 'nequi', label: 'Nequi dueño', value_masked: '•••• 8877', eligible: false, selected: false, reason: 'restricted' },
    ],
    branches: [
      { id: 'b1', name: 'Sede principal', is_main: true, selected: true },
      { id: 'b2', name: 'Sede norte', is_main: false, selected: true },
    ],
    gateways: { wompi: false, mercadopago: false },
    ...over,
  };
}

describe('Tu tienda → Ajustes → Cobros', () => {
  it('sin fila de ajustes arranca como enable_school_store: transferencia + efectivo + solo retiro', () => {
    const f = formFromAdminSettings(admin());
    expect(f).toMatchObject({
      acceptTransfer: true, allAccounts: true, acceptCash: true, acceptWompi: false,
      allowShipping: false, allBranches: true, transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
    });
    expect(f.accountIds).toEqual(['nequi', 'breb']);
  });

  it('el payload nunca manda una cuenta no apta ni una pasarela sin conectar', () => {
    const a = admin();
    const f = { ...formFromAdminSettings(a), allAccounts: false, accountIds: ['nequi', 'insc'], acceptWompi: true };
    const p = settingsPayload(f, a);
    expect(p.transfer_account_ids).toEqual(['nequi']);
    expect(p.accept_wompi).toBe(false);
    expect(p.pickup_branch_ids).toBeNull();
  });

  it('«todas las cuentas» = null (incluye las que se agreguen después); sedes elegidas = lista', () => {
    const a = admin();
    const f = { ...formFromAdminSettings(a), allBranches: false, branchIds: ['b2'], allowShipping: true };
    const p = settingsPayload(f, a);
    expect(p.transfer_account_ids).toBeNull();
    expect(p.pickup_branch_ids).toEqual(['b2']);
    expect(p.allow_shipping).toBe(true);
  });

  it('respeta la selección guardada y descarta ids que ya no son aptos', () => {
    const a = admin({
      settings: {
        vendor_profile_id: 'vp', accept_wompi: false, accept_mercadopago: false, accept_transfer: true,
        accept_cash_pickup: false, transfer_instructions: null, transfer_hold_hours: 48, cash_hold_hours: 48,
        transfer_account_ids: ['breb', 'insc'], allow_shipping: true, pickup_branch_ids: ['b1'],
      },
    });
    const f = formFromAdminSettings(a);
    expect(f.allAccounts).toBe(false);
    expect(f.accountIds).toEqual(['breb']);
    expect(f.acceptCash).toBe(false);
    expect(f.allBranches).toBe(false);
    expect(f.branchIds).toEqual(['b1']);
  });

  it('valida lo mismo que la base, con copy', () => {
    const a = admin();
    const base = formFromAdminSettings(a);
    expect(validateStoreSettings(base, a)).toBeNull();
    expect(validateStoreSettings({ ...base, acceptTransfer: false, acceptCash: false }, a)).toMatch(/al menos un medio/);
    expect(validateStoreSettings({ ...base, allAccounts: false, accountIds: [] }, a)).toMatch(/al menos una cuenta/);
    expect(validateStoreSettings({ ...base, allBranches: false, branchIds: [] }, a)).toMatch(/sede de retiro/);
    const sinCuentas = admin({ accounts: [{ id: 'insc', type: 'nequi', eligible: false, selected: false, reason: 'restricted' }] });
    expect(validateStoreSettings({ ...base, acceptTransfer: true }, sinCuentas)).toMatch(/solo para inscripciones/);
  });

  it('estado de habilitación: SportMaps habilita; sin adicional pide Mi plan', () => {
    expect(storeStatusMessage(admin().status)).toMatchObject({ tone: 'wait', title: 'SportMaps está habilitando tu tienda' });
    expect(storeStatusMessage({ ...admin().status, selling: true }).tone).toBe('ok');
    expect(storeStatusMessage({ ...admin().status, addon: false }).title).toMatch(/adicional Tienda/);
  });

  it('copy sin voseo ni «vendedor/marketplace»', () => {
    const textos = [
      ...Object.values(storeStatusMessage(admin().status)),
      ...Object.values(storeStatusMessage({ ...admin().status, addon: false })),
      accountReasonLabel('restricted'),
      storeSettingsErrorMessage({ message: 'NO_TRANSFER_ACCOUNTS' }),
      storeSettingsErrorMessage({ message: 'INVALID_TRANSFER_ACCOUNT' }),
      storeSettingsErrorMessage({ message: 'NOT_OWNER' }),
    ].join(' ');
    expect(textos).not.toMatch(/vendedor|marketplace|\b(tenés|podés|querés|vos|elegí|agregá)\b/i);
  });

  it('enlace público', () => {
    expect(storePublicUrl('https://app.sportmaps.co/', 'gym-rm')).toBe('https://app.sportmaps.co/tienda/gym-rm');
  });

  it('menú de la escuela: «Tu tienda», sin Liquidaciones ni Verificación', () => {
    const open = getVendorNavGroup({
      canSellProducts: true, canSellServices: false, verificationStatus: 'pending', storeEnabled: true, isSchool: true, storeOpen: true,
    });
    expect(open.title).toBe('Tu tienda');
    const titles = open.items.map(i => i.title);
    expect(titles).toEqual(['Pedidos', 'Productos', 'Inventario', 'Cobros y entrega']);
    expect(titles.join(' ')).not.toMatch(/Liquidaciones|Verificación|Panel Tienda/);

    const closed = getVendorNavGroup({
      canSellProducts: false, canSellServices: false, verificationStatus: null, storeEnabled: true, isSchool: true, storeOpen: false,
    });
    expect(closed.items.map(i => i.href)).toEqual(['/tienda-escuela/ajustes']);

    const off = getVendorNavGroup({
      canSellProducts: true, canSellServices: false, verificationStatus: null, storeEnabled: false, isSchool: true, storeOpen: true,
    });
    expect(off.items).toHaveLength(0);
  });
});
