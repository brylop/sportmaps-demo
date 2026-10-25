/**
 * Pantallas internas de un hijo (acudiente V2): informes y asistencia.
 * Estados de carga / vacío / error distintos, palabras V2 y selector de hijo.
 * react-query va mockeado por clave de consulta: nada sale a la red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean };
const m = vi.hoisted(() => ({
  byKey: {} as Record<string, Q>,
  reports: { data: undefined, isLoading: false, isError: false } as Q,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-acudiente' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: undefined, isLoading: false, isError: false, refetch: vi.fn(),
    ...(m.byKey[String(queryKey[0])] ?? {}),
  }),
}));
vi.mock('@/hooks/useAthleteReports', () => ({
  useAthleteReports: () => ({ refetch: vi.fn(), ...m.reports }),
}));

import ChildReportsPage from '@/pages/ChildReportsPage';
import AttendancePage from '@/pages/AttendancePage';

function Ruta() {
  const l = useLocation();
  return <span data-testid="ruta">{l.pathname}</span>;
}

function renderAt(path: string, pattern: string, el: JSX.Element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<>{el}<Ruta /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  m.byKey = { 'child-basic': { data: { id: 'h1', full_name: 'Sofía Herrera' } } };
  m.reports = { data: undefined, isLoading: false, isError: false };
});

describe('ChildReportsPage (V2)', () => {
  it('lista los informes con el mes en palabras y marca los nuevos', () => {
    m.reports = {
      data: [
        { id: 'r2', period_month: 9, period_year: 2026, viewed_at: null },
        { id: 'r1', period_month: 8, period_year: 2026, viewed_at: '2026-09-02' },
      ],
    };
    renderAt('/children/h1/reports', '/children/:id/reports', <ChildReportsPage />);
    expect(screen.getByRole('heading', { name: 'Informes de Sofía' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Informe de septiembre 2026.*Nuevo/ })).toHaveAttribute('href', '/children/h1/reports/r2');
    expect(screen.getByRole('link', { name: /Informe de agosto 2026.*Visto/ })).toBeInTheDocument();
    expect(screen.getByText('2 informes publicados por la escuela.')).toBeInTheDocument();
  });

  it('vacío, error y carga son distintos', () => {
    m.reports = { data: [] };
    const r1 = renderAt('/children/h1/reports', '/children/:id/reports', <ChildReportsPage />);
    expect(screen.getByText('Todavía no hay informes mensuales de Sofía.')).toBeInTheDocument();
    r1.unmount();

    m.reports = { isError: true };
    const r2 = renderAt('/children/h1/reports', '/children/:id/reports', <ChildReportsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los informes mensuales');
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();
    r2.unmount();

    m.reports = { isLoading: true };
    renderAt('/children/h1/reports', '/children/:id/reports', <ChildReportsPage />);
    expect(screen.getByRole('status', { name: 'Cargando los informes' })).toBeInTheDocument();
  });
});

describe('AttendancePage (V2)', () => {
  const hijos = [
    { id: 'h1', full_name: 'Sofía Herrera' },
    { id: 'h2', full_name: 'Tomás Herrera' },
  ];

  it('una frase arriba, historial por mes y llegar tarde cuenta como venir', () => {
    const hoy = new Date();
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    m.byKey['hijo-detalle-hijos'] = { data: hijos };
    m.byKey.attendance = {
      data: [
        { id: 'a1', attendance_date: `${mes}-03`, status: 'present', notes: null },
        { id: 'a2', attendance_date: `${mes}-02`, status: 'late', notes: 'Llegó del colegio' },
        { id: 'a3', attendance_date: `${mes}-01`, status: 'absent', notes: null },
      ],
    };
    renderAt('/children/h1/attendance', '/children/:id/attendance', <AttendancePage />);
    expect(screen.getByRole('heading', { name: 'Asistencia de Sofía' })).toBeInTheDocument();
    expect(screen.getByText('Este mes vino a 2 de 3 entrenos.')).toBeInTheDocument();
    expect(screen.getByText('Llegó tarde')).toBeInTheDocument();
    expect(screen.getByText('Llegó del colegio')).toBeInTheDocument();
    expect(screen.getByText('Vino a 2 de 3 entrenos')).toBeInTheDocument();
  });

  it('cambiar de hijo lleva a su pantalla', () => {
    m.byKey['hijo-detalle-hijos'] = { data: hijos };
    m.byKey.attendance = { data: [] };
    renderAt('/children/h1/attendance', '/children/:id/attendance', <AttendancePage />);
    expect(screen.getByText('Todavía no hay asistencia registrada.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Tomás' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/children/h2/attendance');
  });

  it('si la lectura falla lo dice y deja reintentar', () => {
    m.byKey['hijo-detalle-hijos'] = { data: hijos };
    m.byKey.attendance = { isError: true };
    renderAt('/children/h1/attendance', '/children/:id/attendance', <AttendancePage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar la asistencia de Sofía');
  });
});
