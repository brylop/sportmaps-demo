/**
 * Panel de la Biblioteca de ejercicios (src/components/school/ExerciseLibraryPanel.tsx):
 * chips de deporte, filtro inicial por el deporte del equipo sin esconder los
 * genéricos, y miniaturas dibujadas en la cancha del ejercicio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TACTICAL_SPORTS } from '@/lib/school/tacticalSports';
import { TEMPLATES } from './fixtures/plantillasEjercicios';

const listExercises = vi.fn();
vi.mock('@/lib/school/exerciseLibrary', async (orig) => {
  const real = await orig<typeof import('@/lib/school/exerciseLibrary')>();
  return { ...real, listExercises: (...args: unknown[]) => listExercises(...args) };
});

import { ExerciseLibraryPanel, SPORT_CHIPS } from '@/components/school/ExerciseLibraryPanel';
import { EXERCISE_SPORT_LABEL, type TrainingExercise } from '@/lib/school/exerciseLibrary';

const asRow = (t: (typeof TEMPLATES)[number]): TrainingExercise => ({
  ...t,
  school_id: null,
  created_by: null,
  is_template: true,
  is_active: true,
  times_used: 0,
  created_at: '2026-10-13T00:00:00Z',
  updated_at: '2026-10-13T00:00:00Z',
});

function setup(defaultSport?: TrainingExercise['sport']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ExerciseLibraryPanel open onOpenChange={vi.fn()} defaultSport={defaultSport} />
    </QueryClientProvider>,
  );
}

const futsal = TEMPLATES.filter((t) => t.sport === 'futsal').map(asRow);
const generic = TEMPLATES.filter((t) => t.sport === 'generico').map(asRow);

beforeEach(() => {
  listExercises.mockReset();
  listExercises.mockImplementation(async (p: { sport?: string; includeGeneric?: boolean }) => {
    if (p.sport === 'futsal') return p.includeGeneric ? [...futsal, ...generic] : futsal;
    return [...futsal, ...generic];
  });
});

describe('ExerciseLibraryPanel', () => {
  it('ofrece un chip por cada deporte de la pizarra', () => {
    expect(SPORT_CHIPS).toEqual([...TACTICAL_SPORTS]);
    setup();
    for (const s of TACTICAL_SPORTS) {
      expect(screen.getByRole('button', { name: EXERCISE_SPORT_LABEL[s] })).toBeTruthy();
    }
  });

  it('arranca filtrando por el deporte del equipo y trae también los genéricos', async () => {
    setup('futsal');
    await waitFor(() => expect(listExercises).toHaveBeenCalled());
    expect(listExercises.mock.calls[0][0]).toMatchObject({ sport: 'futsal', includeGeneric: true, templates: true });
    expect(screen.getByRole('button', { name: EXERCISE_SPORT_LABEL.futsal }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/También ves los genéricos/)).toBeTruthy();
    // Las de futsal y las genéricas, todas en la lista.
    expect(await screen.findByText('Pared y diagonal del ala')).toBeTruthy();
    expect(screen.getByText('El pañuelo: reacción y velocidad')).toBeTruthy();
  });

  it('cada miniatura se dibuja en la cancha de SU deporte', async () => {
    setup('futsal');
    await screen.findByText('Pared y diagonal del ala');
    const courts = Array.from(document.querySelectorAll('[data-court]')).map((n) => n.getAttribute('data-court'));
    expect(courts.filter((c) => c === 'futsal')).toHaveLength(futsal.length);
    expect(courts.filter((c) => c === 'generico')).toHaveLength(generic.length);
  });

  it('«Todos» quita el filtro de deporte; sin deporte del equipo arranca en Todos', async () => {
    setup('futsal');
    await waitFor(() => expect(listExercises).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Todos' })[0]);
    await waitFor(() => expect(listExercises.mock.calls.at(-1)![0].sport).toBeUndefined());
    expect(screen.queryByText(/También ves los genéricos/)).toBeNull();
  });

  it('con «Genérico» elegido no muestra el aviso de genéricos', async () => {
    setup('generico');
    await waitFor(() => expect(listExercises).toHaveBeenCalled());
    expect(listExercises.mock.calls[0][0]).toMatchObject({ sport: 'generico' });
    expect(screen.queryByText(/También ves los genéricos/)).toBeNull();
  });
});
