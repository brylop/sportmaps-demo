/**
 * Pestaña «Paquetes» de la Biblioteca (pizarra M2, D4 de
 * docs/specs/pizarra-multideporte-3d-ia.md): tarjetas por paquete, botones
 * solo para quien gestiona, aviso al desactivar el último, exportar, y la
 * importación con vista previa → confirmar → resultado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  listExercisePacks: vi.fn(),
  activateExercisePack: vi.fn(),
  deactivateExercisePack: vi.fn(),
  exportExercisePack: vi.fn(),
  previewPackImport: vi.fn(),
  importExercisePack: vi.fn(),
  downloadPackFile: vi.fn(),
}));
vi.mock('@/lib/school/exercisePacks', async (orig) => {
  const real = await orig<typeof import('@/lib/school/exercisePacks')>();
  return { ...real, ...api };
});
const listExercises = vi.fn();
const listLibrarySports = vi.fn();
vi.mock('@/lib/school/exerciseLibrary', async (orig) => {
  const real = await orig<typeof import('@/lib/school/exerciseLibrary')>();
  return { ...real, listExercises: (...a: unknown[]) => listExercises(...a), listLibrarySports: (...a: unknown[]) => listLibrarySports(...a) };
});

import { ExercisePacksTab } from '@/components/school/ExercisePacksTab';
import { ExerciseLibraryPanel } from '@/components/school/ExerciseLibraryPanel';
import { readPackFile, packFileName, type ExercisePackList } from '@/lib/school/exercisePacks';
import { startHintFormationLabel } from '@/lib/school/tacticalStartHint';

const pack = (id: string, over: Record<string, unknown> = {}) => ({
  id, name: `Paquete ${id}`, description: 'Descripción', sport: 'futbol', version: 1, is_system: true,
  activated: false, visible: true, exercise_count: 11, updated_at: '2026-10-14T00:00:00Z', ...over,
});
const LIST: ExercisePackList = {
  mode: 'todos',
  can_manage: true,
  loose_own_count: 3,
  packs: [
    pack('p1', { name: 'Fútbol: fundamentos y juego' }) as any,
    pack('p2', { name: 'Fútbol 7 y fútbol 5', sport: 'futbol7', exercise_count: 3 }) as any,
    pack('p7', { name: 'Preparación física', sport: 'generico', exercise_count: 2 }) as any,
    pack('own', { name: 'Arqueros', is_system: false, activated: true, exercise_count: 4 }) as any,
  ],
};

let qc: QueryClient;
function setup(ui = <ExercisePacksTab />) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const card = (name: string) => screen.getByText(name).closest('[data-testid="exercise-pack-card"]') as HTMLElement;
const chooseFile = (content: string, name = 'paquete.json') => {
  const input = screen.getByTestId('pack-file-input') as HTMLInputElement;
  const file = new File([content], name, { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.listExercisePacks.mockResolvedValue(LIST);
  api.activateExercisePack.mockResolvedValue({ activated: true });
  api.deactivateExercisePack.mockResolvedValue({ activated: false });
  api.downloadPackFile.mockReturnValue('paquete-x.json');
  listExercises.mockReset().mockResolvedValue([]);
  listLibrarySports.mockReset().mockResolvedValue(['futbol', 'futbol7', 'futbol5', 'generico']);
});
afterEach(() => vi.restoreAllMocks());

describe('ExercisePacksTab', () => {
  it('tarjetas por paquete con deporte, número de ejercicios y estado; secciones SportMaps / de tu escuela', async () => {
    setup();
    expect(await screen.findByText('Fútbol: fundamentos y juego')).toBeTruthy();
    expect(within(card('Fútbol: fundamentos y juego')).getByText('Fútbol 11 · 11 ejercicios')).toBeTruthy();
    expect(within(card('Fútbol 7 y fútbol 5')).getByText('Fútbol 7 · 3 ejercicios')).toBeTruthy();
    expect(within(card('Preparación física')).getByText('Preparación física · 2 ejercicios')).toBeTruthy();
    expect(screen.getByText('Paquetes SportMaps')).toBeTruthy();
    expect(screen.getByText('De tu escuela')).toBeTruthy();
    // Modo «todos»: lo explica y todos salen «Visible».
    expect(screen.getByText(/Hoy ves todos los paquetes de tus deportes/)).toBeTruthy();
    expect(within(card('Fútbol: fundamentos y juego')).getByText('Visible')).toBeTruthy();
    expect(within(card('Arqueros')).getByText('Activado')).toBeTruthy();
  });

  it('quien gestiona ve Activar/Desactivar e Importar; activar llama al BFF y refresca la biblioteca', async () => {
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    const spy = vi.spyOn(qc, 'invalidateQueries');
    expect(screen.getByRole('button', { name: /Importar paquete/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Activar Fútbol: fundamentos y juego' }));
    await waitFor(() => expect(api.activateExercisePack).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/activado/));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['training-exercises'] });
    // El paquete propio activo ofrece Desactivar.
    expect(screen.getByRole('button', { name: 'Desactivar Arqueros' })).toBeTruthy();
  });

  it('sin permiso de gestión: ve la lista y Exportar, pero no Activar ni Importar', async () => {
    api.listExercisePacks.mockResolvedValue({ ...LIST, can_manage: false });
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    expect(screen.queryByRole('button', { name: /^Activar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Desactivar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar paquete/ })).toBeNull();
    expect(screen.queryByTestId('pack-file-input')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Exportar (?!mis)/ }).length).toBe(4);
    expect(screen.getByRole('button', { name: /Exportar mis ejercicios/ })).toBeTruthy();
  });

  it('desactivar el ÚLTIMO activado avisa que vuelve a «todos»; si cancela no llama al BFF', async () => {
    api.listExercisePacks.mockResolvedValue({
      ...LIST, mode: 'seleccion',
      packs: [pack('p1', { name: 'Uno', activated: true }), pack('p2', { name: 'Dos', visible: false })],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar Uno' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/último paquete activado/));
    expect(api.deactivateExercisePack).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Uno' }));
    await waitFor(() => expect(api.deactivateExercisePack).toHaveBeenCalledWith('p1'));
    expect(within(card('Dos')).getByText('Oculto')).toBeTruthy();
  });

  it('Exportar descarga el archivo del paquete; «Exportar mis ejercicios» usa «mine»', async () => {
    const file = { format: 'sportmaps-ejercicios', version: 1, pack: { name: 'X', sport: 'futbol' }, exercises: [] };
    api.exportExercisePack.mockResolvedValue(file);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Exportar Fútbol 7 y fútbol 5' }));
    await waitFor(() => expect(api.downloadPackFile).toHaveBeenCalledWith(file));
    expect(api.exportExercisePack).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: /Exportar mis ejercicios \(3\)/ }));
    await waitFor(() => expect(api.exportExercisePack).toHaveBeenCalledWith('mine'));
  });

  it('503 (migración sin aplicar): mensaje claro, sin reintentar', async () => {
    api.listExercisePacks.mockRejectedValue(Object.assign(new Error('x'), { status: 503 }));
    setup();
    expect(await screen.findByText('Los paquetes de ejercicios todavía no están disponibles.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});

describe('Importar paquete: vista previa → confirmar → resultado', () => {
  const FILE = { format: 'sportmaps-ejercicios', version: 1, pack: { name: 'Arqueros', sport: 'futbol' }, exercises: [{ name: 'a' }] };

  it('válido: muestra cuántos ejercicios y qué deportes; confirmar importa y muestra el resultado', async () => {
    api.previewPackImport.mockResolvedValue({ valid: true, errors: [], summary: { name: 'Arqueros', sport: 'futbol', exercises: 12, sports: ['futbol', 'generico'] } });
    api.importExercisePack.mockResolvedValue({ pack_id: 'n1', exercises: 12, summary: { name: 'Arqueros', sport: 'futbol', exercises: 12, sports: ['futbol', 'generico'] } });
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    chooseFile(JSON.stringify(FILE), 'arqueros.json');
    const preview = await screen.findByTestId('pack-import-preview');
    expect(api.previewPackImport).toHaveBeenCalledWith(FILE);
    expect(within(preview).getByText('Paquete «Arqueros»')).toBeTruthy();
    expect(preview.textContent).toMatch(/12 ejercicios · Fútbol 11, Preparación física/);
    expect(preview.textContent).toMatch(/arqueros\.json/);
    expect(api.importExercisePack).not.toHaveBeenCalled(); // la vista previa no escribe
    fireEvent.click(within(preview).getByRole('button', { name: 'Importar 12 ejercicios' }));
    const done = await screen.findByTestId('pack-import-done');
    expect(api.importExercisePack).toHaveBeenCalledWith(FILE);
    expect(done.textContent).toMatch(/se importaron 12 ejercicios en «Arqueros»/);
  });

  it('inválido: lista de errores, sin botón de importar', async () => {
    api.previewPackImport.mockResolvedValue({
      valid: false,
      errors: Array.from({ length: 11 }, (_, i) => `Ejercicio ${i + 1}: jugada: cuadro 1: jugador inválido`),
      summary: { name: 'Malo', sport: null, exercises: 11, sports: [] },
    });
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    chooseFile(JSON.stringify(FILE));
    const preview = await screen.findByTestId('pack-import-preview');
    expect(preview.textContent).toMatch(/el archivo tiene 11 errores\. No se guardó nada/);
    expect(within(preview).getAllByRole('listitem')).toHaveLength(9); // 8 + «… y 3 más»
    expect(preview.textContent).toMatch(/… y 3 más/);
    expect(within(preview).queryByRole('button', { name: /^Importar/ })).toBeNull();
  });

  it('archivo que no es JSON: error local, ni siquiera llama al BFF', async () => {
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    chooseFile('esto no es json {');
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es un JSON válido/);
    expect(api.previewPackImport).not.toHaveBeenCalled();
  });

  it('si el BFF rechaza al confirmar (422 con details) vuelve a la vista previa con los errores', async () => {
    api.previewPackImport.mockResolvedValue({ valid: true, errors: [], summary: { name: 'A', sport: 'futbol', exercises: 1, sports: ['futbol'] } });
    api.importExercisePack.mockRejectedValue(Object.assign(new Error('El paquete no se puede importar'), { status: 422, body: { details: ['Ejercicio 1: name es requerido.'] } }));
    setup();
    await screen.findByText('Fútbol: fundamentos y juego');
    chooseFile(JSON.stringify(FILE));
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 1 ejercicio' }));
    await waitFor(() => expect(screen.getByTestId('pack-import-preview').textContent).toMatch(/name es requerido/));
  });
});

describe('integración con el panel de la biblioteca', () => {
  it('la pestaña «Paquetes» aparece junto a las otras dos y muestra los paquetes', async () => {
    setup(<ExerciseLibraryPanel open onOpenChange={vi.fn()} defaultSport="futbol" />);
    const tab = await screen.findByRole('tab', { name: 'Paquetes' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Plantillas SportMaps', 'De mi escuela', 'Paquetes']);
    fireEvent.click(tab);
    expect(await screen.findByTestId('exercise-packs-tab')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar ejercicio')).toBeNull();
  });
});

describe('helpers', () => {
  it('readPackFile: tamaño y JSON', async () => {
    expect(await readPackFile(new Blob(['{"a":1}']))).toEqual({ data: { a: 1 } });
    expect(await readPackFile(new Blob(['nope']))).toMatchObject({ error: expect.stringMatching(/JSON/) });
    const big = { size: 5 * 1024 * 1024, text: async () => '{}' } as unknown as Blob;
    expect(await readPackFile(big)).toEqual({ error: 'El archivo pesa más de 4 MB.' });
  });

  it('packFileName: sin tildes ni símbolos', () => {
    expect(packFileName('Fútbol: fundamentos y juego')).toBe('paquete-futbol-fundamentos-y-juego.json');
    expect(packFileName('<script>')).toBe('paquete-script.json');
    expect(packFileName('')).toBe('paquete-ejercicios.json');
  });

  it('«Empieza aquí»: la formación sin doble paréntesis', () => {
    expect(startHintFormationLabel({ key: 'vb-rotacion', label: 'Rotación (zonas 1-6)' })).toBe('Rotación zonas 1-6');
    expect(startHintFormationLabel({ key: 'f7-2-3-1', label: 'Fútbol 7: 2-3-1' })).toBe('F7 2-3-1');
    expect(startHintFormationLabel({ key: '433', label: '4-3-3' })).toBe('4-3-3');
    expect(startHintFormationLabel(null)).toBe('');
  });
});
