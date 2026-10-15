/**
 * Panel de la Biblioteca de ejercicios (src/components/school/ExerciseLibraryPanel.tsx):
 * chips de deporte (SOLO los de la escuela, D1 de M1), filtro inicial por el
 * deporte del equipo sin esconder lo genérico («Preparación física»), y
 * miniaturas dibujadas en la cancha del ejercicio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Canchas CON biblioteca (M6f: rugby, tenis… abren la pizarra pero no la biblioteca).
import { LIBRARY_BOARD_SPORTS } from '@/lib/sports/sportCatalog';
import { TEMPLATES } from './fixtures/plantillasEjercicios';

const listExercises = vi.fn();
const listLibrarySports = vi.fn();
vi.mock('@/lib/school/exerciseLibrary', async (orig) => {
  const real = await orig<typeof import('@/lib/school/exerciseLibrary')>();
  return {
    ...real,
    listExercises: (...args: unknown[]) => listExercises(...args),
    listLibrarySports: (...args: unknown[]) => listLibrarySports(...args),
  };
});

import { ExerciseLibraryPanel, librarySportChips } from '@/components/school/ExerciseLibraryPanel';
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

const sportChip = (s: keyof typeof EXERCISE_SPORT_LABEL) => screen.queryByRole('button', { name: EXERCISE_SPORT_LABEL[s] });

beforeEach(() => {
  listLibrarySports.mockReset();
  // Por defecto, escuela multideporte con todas las canchas.
  listLibrarySports.mockResolvedValue([...LIBRARY_BOARD_SPORTS]);
  listExercises.mockReset();
  listExercises.mockImplementation(async (p: { sport?: string; includeGeneric?: boolean }) => {
    if (p.sport === 'futsal') return p.includeGeneric ? [...futsal, ...generic] : futsal;
    return [...futsal, ...generic];
  });
});

describe('ExerciseLibraryPanel', () => {
  it('escuela con todas las canchas: un chip por deporte, lo genérico como «Preparación física»', async () => {
    setup();
    for (const s of LIBRARY_BOARD_SPORTS) expect(await screen.findByRole('button', { name: EXERCISE_SPORT_LABEL[s] })).toBeTruthy();
    expect(EXERCISE_SPORT_LABEL.generico).toBe('Preparación física');
    expect(screen.queryByRole('button', { name: 'Genérico' })).toBeNull();
  });

  it('escuela de fútbol (11 y 7): sin chip de voleibol ni de otros deportes', async () => {
    listLibrarySports.mockResolvedValue(['futbol', 'futbol7', 'generico']);
    setup('futbol');
    expect(await screen.findByRole('button', { name: EXERCISE_SPORT_LABEL.futbol7 })).toBeTruthy();
    expect(sportChip('futbol')).toBeTruthy();
    expect(sportChip('generico')).toBeTruthy();
    for (const s of ['voleibol', 'baloncesto', 'balonmano', 'futsal', 'futbol5'] as const) expect(sportChip(s), s).toBeNull();
  });

  it('un solo deporte: sin fila de chips de deporte, y la lista sin filtro (el BFF ya trae solo lo suyo)', async () => {
    listLibrarySports.mockResolvedValue(['voleibol', 'generico']);
    setup('voleibol');
    await waitFor(() => expect(listLibrarySports).toHaveBeenCalled());
    await waitFor(() => expect(listExercises.mock.calls.at(-1)![0].sport).toBeUndefined());
    expect(screen.queryByText('Deporte')).toBeNull();
    expect(sportChip('voleibol')).toBeNull();
    expect(sportChip('generico')).toBeNull();
    // La fila de objetivos sigue.
    expect(screen.getByText('Objetivo')).toBeTruthy();
  });

  it('librarySportChips: genérico siempre al final; sin respuesta del BFF, solo el deporte del equipo', () => {
    expect(librarySportChips(['futbol', 'generico'])).toEqual({ chips: ['futbol', 'generico'], showRow: false });
    expect(librarySportChips(['futbol', 'futbol7', 'generico'])).toEqual({ chips: ['futbol', 'futbol7', 'generico'], showRow: true });
    expect(librarySportChips(undefined, 'voleibol')).toEqual({ chips: ['voleibol', 'generico'], showRow: false });
    expect(librarySportChips(undefined)).toEqual({ chips: ['generico'], showRow: false });
  });

  it('arranca filtrando por el deporte del equipo y trae también los genéricos', async () => {
    setup('futsal');
    await waitFor(() => expect(listExercises).toHaveBeenCalled());
    expect(listExercises.mock.calls[0][0]).toMatchObject({ sport: 'futsal', includeGeneric: true, templates: true });
    expect((await screen.findByRole('button', { name: EXERCISE_SPORT_LABEL.futsal })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/También ves la preparación física/)).toBeTruthy();
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
    await screen.findByRole('button', { name: EXERCISE_SPORT_LABEL.futsal });
    fireEvent.click(screen.getAllByRole('button', { name: 'Todos' })[0]);
    await waitFor(() => expect(listExercises.mock.calls.at(-1)![0].sport).toBeUndefined());
    expect(screen.queryByText(/También ves la preparación física/)).toBeNull();
  });

  it('con «Preparación física» elegida no muestra el aviso', async () => {
    setup('generico');
    await waitFor(() => expect(listExercises).toHaveBeenCalled());
    expect(listExercises.mock.calls[0][0]).toMatchObject({ sport: 'generico' });
    expect(screen.queryByText(/También ves la preparación física/)).toBeNull();
  });
});
