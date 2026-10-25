/**
 * Hijos del acudiente (V2): selector de hijo, cambio de pestaña con ?tab=,
 * estado vacío de progreso y funciones puras (máscara, escala, asistencia).
 * Los datos van mockeados en el módulo de hooks: nada sale a la red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const q = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data, isLoading: false, isError: false, refetch: vi.fn(), ...extra,
});

const hooks = vi.hoisted(() => ({
  entries: vi.fn(),
  evolution: vi.fn(),
  reports: vi.fn(),
  snapshot: vi.fn(),
  attendance: vi.fn(),
  docs: vi.fn(),
}));

// DocumentosHijo (Ficha y salud) sube con el uid del acudiente y avisa con toast.
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-acudiente' } }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock('./useHijosData', () => ({
  childDocsFolder: (u: string, c: string) => `children/${u}/${c}/docs`,
  useChildPerformanceEntries: hooks.entries,
  useChildPerformanceEvolution: hooks.evolution,
  useChildReports: hooks.reports,
  useLatestReportSnapshot: hooks.snapshot,
  useChildAttendance: hooks.attendance,
  useChildDocuments: hooks.docs,
}));

import { HijosV2 } from './HijosV2';
import {
  attendanceSummary,
  hijoSubtitle,
  maskDocument,
  recentSessions,
  skillRows,
  type Hijo,
} from './hijosUtils';

const sofia: Hijo = {
  id: 'h1',
  full_name: 'Sofía Ramírez Castro',
  date_of_birth: '2016-03-10',
  doc_type: 'TI',
  doc_number: '1012344521',
  teams: { name: 'Sub 11', sport: 'futbol', coach: { full_name: 'Laura Gómez' } },
  enrollments: [],
};
const tomas: Hijo = {
  id: 'h2',
  full_name: 'Tomás Ramírez',
  date_of_birth: '2019-01-02',
  teams: { name: 'Sub 8', sport: 'futbol', coach: { full_name: 'Andrés Pérez' } },
  enrollments: [],
};

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.search}</span>;
}

function renderHijos(hijos: Hijo[], url = '/children') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HijosV2 hijos={hijos} onEdit={vi.fn()} onUploadDocs={vi.fn()} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hooks.entries.mockReturnValue(q([]));
  hooks.evolution.mockReturnValue(q({ evolution: {}, metrics: [], period_days: 365 }));
  hooks.reports.mockReturnValue(q([]));
  hooks.snapshot.mockReturnValue(q(undefined));
  hooks.attendance.mockReturnValue(q([]));
  hooks.docs.mockReturnValue(q({ identity: true, eps: false }));
});

describe('HijosV2', () => {
  it('con un solo hijo no muestra selector', () => {
    renderHijos([sofia]);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sofía Ramírez Castro' })).toBeInTheDocument();
  });

  it('el selector cambia de hijo y lo deja en ?hijo=', () => {
    renderHijos([sofia, tomas]);
    const group = screen.getByRole('radiogroup', { name: 'Elige a tu hijo' });
    expect(within(group).getByRole('radio', { name: 'Sofía' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(within(group).getByRole('radio', { name: 'Tomás' }));

    expect(screen.getByRole('heading', { name: 'Tomás Ramírez' })).toBeInTheDocument();
    expect(screen.getByText(/Profe Andrés/)).toBeInTheDocument();
    expect(screen.getByTestId('loc').textContent).toContain('hijo=h2');
  });

  it('abre la pestaña que llega en ?tab= y el hijo de ?hijo=', () => {
    hooks.attendance.mockReturnValue(q([
      { attendance_date: toYmd(new Date()), status: 'present' },
    ]));
    renderHijos([sofia, tomas], '/children?hijo=h2&tab=asistencia');
    expect(screen.getByRole('heading', { name: 'Tomás Ramírez' })).toBeInTheDocument();
    expect(screen.getByText('Este mes vino a 1 de 1 entreno.')).toBeInTheDocument();
  });

  it('progreso sin datos muestra el estado vacío, no un error', () => {
    renderHijos([sofia]);
    expect(screen.getByText('Todavía no hay evaluaciones de Sofía.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('progreso con error muestra el error con reintento', () => {
    hooks.entries.mockReturnValue(q(undefined, { isError: true }));
    hooks.evolution.mockReturnValue(q(undefined, { isError: true }));
    renderHijos([sofia]);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar el progreso de Sofía');
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();
  });

  it('Ficha y salud enmascara el documento', () => {
    renderHijos([sofia], '/children?tab=ficha');
    expect(screen.getByText('TI •••• 4521')).toBeInTheDocument();
    expect(screen.queryByText(/1012344521/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mostrar carnet/ })).toHaveAttribute('href', '/my-cards');
  });

  it('Documentos: los 10 tipos de la escuela, todos opcionales, firmas incluidas', () => {
    hooks.docs.mockReturnValue(q({ eps_certificate: [{ nombre: 'eps-1.pdf', ruta: 'x/eps-1.pdf' }] }));
    renderHijos([sofia], '/children?tab=ficha');
    for (const t of ['Firma del acudiente', 'Firma del deportista', 'Paz y salvo', 'Foto del deportista', 'Documento del acudiente (frente)']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.getByText(/Ninguno es obligatorio/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subir' })).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
  });
});

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('hijosUtils', () => {
  it('subtítulo: deporte + equipo · edad · profe', () => {
    expect(hijoSubtitle(sofia, new Date('2026-10-24T12:00:00'))).toBe('Fútbol Sub 11 · 10 años · Profe Laura');
  });

  it('maskDocument deja solo los 4 últimos', () => {
    expect(maskDocument('TI', '1012344521')).toBe('TI •••• 4521');
    expect(maskDocument(null, '')).toBeNull();
  });

  it('recentSessions prefiere la calificación del profe', () => {
    const r = recentSessions([
      { metric_key: 'self_effort_pct', value: 50, context_type: 'session', recorded_at: '2026-10-06T22:00:00Z' },
      { metric_key: 'coach_effort_rating', value: 90, context_type: 'session', recorded_at: '2026-10-06T22:00:00Z' },
      { metric_key: 'coach_effort_rating', value: 60, context_type: 'session', recorded_at: '2026-10-01T22:00:00Z' },
    ]);
    expect(r.source).toBe('coach');
    expect(r.rows.map((x) => x.rating)).toEqual(['Bien', 'Le costó']);
  });

  it('skillRows lleva a escala de 5, respeta «menos es mejor» y omite las del post-entreno', () => {
    const rows = skillRows(
      [
        { metric_key: 'control', display_name: 'Control de balón', min_value: 1, max_value: 5, higher_is_better: true },
        { metric_key: 'sprint', display_name: 'Velocidad', unit: 's', min_value: null, max_value: null, higher_is_better: false },
        { metric_key: 'rpe_borg', display_name: 'Cansancio', min_value: 0, max_value: 10, higher_is_better: false },
      ],
      {
        control: [{ date: '2026-09-01', value: 3.6 }, { date: '2026-10-01', value: 4.2 }],
        sprint: [{ date: '2026-09-01', value: 6.0 }, { date: '2026-10-02', value: 5.5 }],
        rpe_borg: [{ date: '2026-10-03', value: 7 }],
      },
    );
    expect(rows.map((r) => r.key)).toEqual(['sprint', 'control']);
    const control = rows.find((r) => r.key === 'control')!;
    expect(control.valueLabel).toBe('4,2 de 5');
    expect(control.deltaLabel).toBe('+0,6');
    const sprint = rows.find((r) => r.key === 'sprint')!;
    expect(sprint.score).toBeNull();
    expect(sprint.improved).toBe(true);
  });

  it('attendanceSummary cuenta la tardanza como asistencia', () => {
    const s = attendanceSummary(
      [
        { attendance_date: '2026-10-06', status: 'present' },
        { attendance_date: '2026-10-01', status: 'late' },
        { attendance_date: '2026-09-29', status: 'absent' },
      ],
      new Date('2026-10-24T12:00:00'),
    );
    expect(s.thisMonth).toEqual({ came: 2, total: 2 });
    expect(s.months.map((m) => m.label)).toEqual(['Jul', 'Ago', 'Sep', 'Oct']);
    expect(s.last.map((l) => l.label)).toEqual(['Vino', 'Vino', 'No vino']);
  });
});
