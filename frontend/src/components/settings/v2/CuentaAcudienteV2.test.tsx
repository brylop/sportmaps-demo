/**
 * «Mi cuenta» del acudiente V2: título claro (sin «Panel de control»), lista
 * de cuatro secciones, «Eliminar cuenta» dentro de Seguridad, estados de
 * carga y error distintos, y que guardar el perfil no borre la biografía ni
 * los intereses que el acudiente no ve. Nada sale a la red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'u1', full_name: 'Mariana Herrera', email: 'mherrera@demo.sportmaps.co', role: 'parent', avatar_url: null },
    updateProfile: vi.fn(),
  }),
}));
vi.mock('@/hooks/useStorage', () => ({ useStorage: () => ({ uploadFile: vi.fn(), uploading: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api/bffClient', () => ({
  bffClient: { get: vi.fn().mockResolvedValue({ request: null }), post: vi.fn(), delete: vi.fn() },
}));

import { CuentaAcudienteV2, type CuentaAcudienteV2Props } from './CuentaAcudienteV2';
import { validarContrasena } from './SeccionesCuentaV2';

const data = {
  profile: {
    full_name: 'Mariana Herrera',
    phone: '+573001234567',
    bio: 'Mamá de Sofía',
    date_of_birth: '1988-05-02',
    sports_interests: ['Fútbol'],
    preferences: { email_notifications: true },
  },
};

function setup(over: Partial<CuentaAcudienteV2Props> = {}, url = '/settings') {
  const props: CuentaAcudienteV2Props = {
    loading: false,
    saving: false,
    data,
    onRetry: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    updateNotificationPreferences: vi.fn().mockResolvedValue(undefined),
    updatePrivacyPreferences: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(
    <MemoryRouter initialEntries={[url]}>
      <CuentaAcudienteV2 {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('CuentaAcudienteV2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('se llama «Mi cuenta», muestra el rol en palabras y no dice «Panel de control»', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByText(/Acudiente · mherrera@demo\.sportmaps\.co/)).toBeInTheDocument();
    expect(screen.queryByText(/panel de control/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parent/)).not.toBeInTheDocument();
    for (const s of ['Perfil', 'Notificaciones', 'Privacidad', 'Seguridad']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${s}`) })).toBeInTheDocument();
    }
  });

  it('Seguridad trae cambiar contraseña y «Eliminar mi cuenta»', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Seguridad/ }));
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Eliminar mi cuenta' })).toBeInTheDocument();
  });

  it('?seccion=seguridad abre la sección directo', async () => {
    setup({}, '/settings?seccion=seguridad');
    expect(await screen.findByRole('button', { name: 'Eliminar mi cuenta' })).toBeInTheDocument();
  });

  it('guardar el perfil conserva biografía e intereses que no se muestran', async () => {
    const props = setup({}, '/settings?seccion=perfil');
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Mariana H.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(props.updateProfile).toHaveBeenCalledTimes(1));
    expect(props.updateProfile).toHaveBeenCalledWith({
      full_name: 'Mariana H.',
      phone: '+573001234567',
      bio: 'Mamá de Sofía',
      date_of_birth: '1988-05-02',
      sports_interests: ['Fútbol'],
    });
  });

  it('notificaciones guarda las mismas llaves que la sección de siempre', async () => {
    const props = setup({}, '/settings?seccion=notificaciones');
    fireEvent.click(screen.getByRole('switch', { name: 'Por correo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar notificaciones' }));
    await waitFor(() => expect(props.updateNotificationPreferences).toHaveBeenCalled());
    expect(props.updateNotificationPreferences).toHaveBeenCalledWith({
      email_notifications: false,
      push_notifications: true,
      activity_alerts: true,
      marketing_emails: false,
      order_updates: true,
      post_training_opt_out: false,
    });
  });

  it('cargando: esqueleto, sin la lista', () => {
    setup({ loading: true, data: null });
    expect(screen.getByLabelText('Cargando tu cuenta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Perfil/ })).not.toBeInTheDocument();
  });

  it('error: lo dice y deja reintentar', () => {
    const props = setup({ data: null });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta');
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('no cambia la contraseña si no coinciden', async () => {
    const props = setup({}, '/settings?seccion=seguridad');
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'secreta1' } });
    fireEvent.change(screen.getByLabelText('Repítela'), { target: { value: 'secreta2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(props.changePassword).not.toHaveBeenCalled();
  });
});

describe('validarContrasena', () => {
  it('pide 6 caracteres y que coincidan', () => {
    expect(validarContrasena('123', '123')).toMatch(/6 caracteres/);
    expect(validarContrasena('123456', '123457')).toMatch(/no coinciden/);
    expect(validarContrasena('123456', '123456')).toBeNull();
  });
});
