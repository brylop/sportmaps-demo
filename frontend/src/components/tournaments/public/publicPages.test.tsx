import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fixture from './__fixtures__/torneo-demo.json';

const get = vi.fn();
vi.mock('@/lib/api/bffClient', () => ({
  bffClient: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  BFFError: class BFFError extends Error {},
}));

import TournamentLivePage from '@/pages/events/TournamentLivePage';
import TournamentMatchPage from '@/pages/events/TournamentMatchPage';
import TournamentTvPage from '@/pages/events/TournamentTvPage';

const clone = () => JSON.parse(JSON.stringify(fixture));
const routeLive = (path = '/torneo/copa/en-vivo') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/torneo/:slug/en-vivo" element={<TournamentLivePage />} />
      <Route path="/torneo/:slug/partido/:matchId" element={<TournamentMatchPage />} />
      <Route path="/torneo/:slug/tv" element={<TournamentTvPage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { get.mockReset(); localStorage.clear(); });

describe('<TournamentLivePage /> v2', () => {
  it('encabezado con marca, estado, en vivo y Powered by SportMaps', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Copa Campestre de Vóley 2026' })).toBeTruthy());
    expect(screen.getByText('Organiza Club Campestre Demo')).toBeTruthy();
    expect(screen.getByTestId('phase').textContent).toContain('En curso');
    expect(screen.getByTestId('live-badge').textContent).toContain('En vivo · 1 partido');
    expect(screen.getByText('31 oct – 1 nov 2026')).toBeTruthy();
    expect(screen.getByTestId('powered-by').textContent).toContain('Powered by SportMaps');
    expect(screen.getByText('Ver transmisión')).toBeTruthy();
    expect(screen.getByText('Reglamento')).toBeTruthy();
    expect(screen.getByText('Patrocinador principal')).toBeTruthy();
    expect(get.mock.calls[0][2]).toBe('public');
  });

  it('abre en Partidos con el filtro En vivo cuando hay juego, y el set en curso resaltado', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Partidos', selected: true })).toBeTruthy());
    expect(screen.getByRole('radio', { name: /En vivo/, checked: true })).toBeTruthy();
    const card = screen.getAllByTestId('public-match')[0];
    expect(within(card).getByText('12-14').getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Jugados/ }));
    expect(screen.getAllByTestId('public-match')).toHaveLength(10);
  });

  it('posiciones de voleibol por grupo con leyenda de copas', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => screen.getByRole('tab', { name: 'Posiciones' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Posiciones' }));
    expect(screen.getByRole('region', { name: 'Grupo A' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Grupo B' })).toBeTruthy();
    for (const h of ['PJ', 'PG', 'PP', 'PTS', 'SG', 'SP', 'DS', 'PF', 'PC', 'DP']) expect(screen.getAllByText(h).length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Quién clasifica' }).textContent).toContain('→ Copa oro');
  });

  it('recuerda la categoría y muestra la copa con campeón', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => screen.getByRole('radio', { name: 'Mayores · Masculino' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Mayores · Masculino' }));
    expect(localStorage.getItem('torneo:copa:categoria')).toBe('c2');
    fireEvent.click(screen.getByRole('tab', { name: 'Copas' }));
    expect(screen.getByTestId('champion').textContent).toContain('Campestre Titanes');
    expect(screen.getByText('3.º y 4.º puesto')).toBeTruthy();
  });

  it('ficha del equipo al tocarlo', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => screen.getByRole('tab', { name: 'Posiciones' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Posiciones' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Halcones del Norte/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Halcones del Norte' })).toBeTruthy();
    expect(within(dialog).getAllByTestId('public-match').length).toBe(3);
  });

  it('hoja Compartir con QR, enlace y WhatsApp', async () => {
    get.mockResolvedValue(clone());
    routeLive();
    await waitFor(() => screen.getByRole('button', { name: /Compartir/ }));
    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('share-qr').querySelector('svg')).toBeTruthy();
    expect(within(dialog).getByTestId('share-link').textContent).toMatch(/\/torneo\/copa\/en-vivo$/);
    expect(within(dialog).getByText('WhatsApp').closest('a')!.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Categoría' }));
    expect(within(dialog).getByTestId('share-link').textContent).toContain('?cat=c1');
  });

  it('Ranking solo aparece si el payload trae player_stats', async () => {
    get.mockResolvedValue(clone());
    const { unmount } = routeLive();
    await waitFor(() => screen.getByRole('tab', { name: 'Posiciones' }));
    expect(screen.queryByRole('tab', { name: 'Ranking' })).toBeNull();
    unmount();
    get.mockResolvedValue({ ...clone(), player_stats: [{ player_label: 'N.º 7', team_id: 't1', team_name: 'Campestre Águilas', points: 14, category_id: 'c1' }] });
    routeLive();
    await waitFor(() => screen.getByRole('tab', { name: 'Ranking' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }));
    expect(screen.getAllByTestId('ranking-row')).toHaveLength(1);
  });

  it('funciona con el payload de hoy (sin campos nuevos)', async () => {
    const legacy = clone();
    delete legacy.tournament; delete legacy.teams;
    for (const m of legacy.matches) delete m.cup_label;
    get.mockResolvedValue(legacy);
    routeLive();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    expect(screen.getByText('Organiza Club Campestre Demo')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Copas' }));
    expect(screen.getByRole('region', { name: 'Fase final' })).toBeTruthy();
    expect(screen.getAllByTestId('team-avatar').length).toBeGreaterThan(0);
  });

  it('404 muestra estado vacío', async () => {
    get.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }));
    routeLive('/torneo/no/en-vivo');
    await waitFor(() => expect(screen.getByText(/No encontramos este torneo/)).toBeTruthy());
  });
});

describe('<TournamentMatchPage />', () => {
  it('marcador, sets en cuadrícula y estados vacíos si el endpoint social no existe', async () => {
    get.mockImplementation((url: string) => (url.endsWith('/social') ? Promise.reject(Object.assign(new Error('x'), { status: 404 })) : Promise.resolve(clone())));
    routeLive('/torneo/copa/partido/m11');
    await waitFor(() => expect(screen.getByTestId('match-detail')).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Campestre Cóndores vs EDF La Calera');
    expect(screen.getByLabelText('Marcador 1 a 0')).toBeTruthy();
    expect(screen.getByText('14').className).toMatch(/border-red-500/);
    fireEvent.click(screen.getByRole('tab', { name: /Comentarios/ }));
    await waitFor(() => expect(screen.getByText('Aún no hay comentarios')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: 'Fotos' }));
    expect(screen.getByText('Aún no hay fotos ni videos de este partido')).toBeTruthy();
  });
  it('pinta comentarios y fotos cuando el endpoint responde', async () => {
    get.mockImplementation((url: string) => (url.endsWith('/social')
      ? Promise.resolve({ comments: [{ id: 'k1', author_label: 'Mamá de Sofi', body: '¡Vamos Cóndores!', created_at: '2026-10-31T15:00:00Z' }], media: [{ id: 'p1', kind: 'photo', url: 'https://x/p.jpg' }] })
      : Promise.resolve(clone())));
    routeLive('/torneo/copa/partido/m11');
    await waitFor(() => screen.getByTestId('match-detail'));
    fireEvent.click(screen.getByRole('tab', { name: /Comentarios/ }));
    await waitFor(() => expect(screen.getByText('¡Vamos Cóndores!')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: 'Fotos' }));
    expect(screen.getByAltText('Foto del partido')).toBeTruthy();
  });
});

describe('<TournamentTvPage />', () => {
  it('rota sola sin interacción y siempre dice Powered by SportMaps', async () => {
    get.mockResolvedValue(clone());
    routeLive('/torneo/copa/tv');
    await waitFor(() => expect(screen.getByTestId('tv')).toBeTruthy());
    expect(screen.getByText('En vivo', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText(/Powered by SportMaps/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
