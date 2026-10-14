/**
 * «Analizar jugada» con IA (M3): panel, capa de «Ver contraataque», «Guardar
 * como nueva jugada» y saldo agotado. El BFF va mockeado (bffClient): nada
 * sale a la red ni al modelo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/api/bffClient', () => {
  class BFFError extends Error {
    constructor(public status: number, message: string, public body?: unknown) { super(message); }
  }
  return { bffClient: { post: api.post, get: api.get }, BFFError };
});

import { BFFError } from '@/lib/api/bffClient';
import { TacticalAiOverlay, TacticalAiPanel, type AiPreview } from '@/components/school/TacticalAiPanel';
import {
  balanceLabel, buildAnalyzeRequest, suggestionToBoardFrames, type AiResult, type AiSuggestion,
} from '@/lib/school/tacticalAi';
import { FULL_VIEW } from '@/lib/school/tacticalGeometry';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

const K1 = 'athlete:11111111-1111-4111-8111-111111111111';
const K2 = 'child:22222222-2222-4222-8222-222222222222';

const counter: AiSuggestion = {
  titulo: 'Salida rápida por la banda derecha',
  explicacion: 'El rival recupera y corre al espacio del lateral.',
  frames: [
    { id: 'c1', duration_ms: 1000, players: [{ key: K1, x: 50, y: 90 }, { key: 'rival:2', x: 70, y: 20 }, { key: 'rival:1', x: 40, y: 25 }], ball: { x: 70, y: 20 }, arrows: [] },
    { id: 'c2', duration_ms: 1500, players: [{ key: K1, x: 52, y: 85 }, { key: 'rival:2', x: 75, y: 45 }], ball: null, arrows: [{ type: 'arrow', x1: 70, y1: 20, x2: 75, y2: 45, color: 'red' }] },
    { id: 'c3', duration_ms: 1500, players: [{ key: K1, x: 55, y: 80 }, { key: 'rival:2', x: 78, y: 70 }, { key: 'rival:1', x: 50, y: 60 }], ball: { x: 78, y: 70 }, arrows: [] },
  ],
};
const result: AiResult = {
  lectura: 'La jugada carga la banda derecha con el lateral.',
  riesgos: [{ titulo: 'Espalda del lateral', detalle: 'Queda un carril libre.', zona: 'banda derecha propia' }],
  contraataques: [counter, { ...counter, titulo: 'Pase largo al centro' }],
  variantes: [{ ...counter, titulo: 'Lateral con cobertura', frames: counter.frames.map((f) => ({ ...f, players: f.players.filter((p) => !p.key.startsWith('rival:')) })) }],
};
const balance = (remaining: number, extra: Record<string, unknown> = {}) => ({
  ok: true, remaining, free_remaining: remaining, paid_remaining: 0, used: 15 - remaining, free_quota: 15, period: '2026-10', needs_purchase: remaining === 0, ...extra,
});

const playFrames: TacticalFrame[] = [{
  id: 'f1', duration_ms: 1200,
  players: [{ key: K1, x: 50, y: 90 }, { key: K2, x: 30, y: 60 }],
  ball: null,
  arrows: [
    { type: 'opponent', x1: 50, y1: 20, x2: 50, y2: 20, color: 'orange' },
    { type: 'text', x1: 50, y1: 50, x2: 50, y2: 50, text: 'Juanito presiona' },
    { type: 'freehand', x1: 1, y1: 1, x2: 2, y2: 2, points: [1, 1, 2, 2] },
  ],
}];

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function setup(over: Partial<React.ComponentProps<typeof TacticalAiPanel>> = {}) {
  const onPreview = vi.fn();
  const onApply = vi.fn();
  const getRequest = vi.fn(() => buildAnalyzeRequest({ teamId: 't-1', sport: 'futbol', frames: playFrames, labelOf: () => 'Central' }));
  const props = {
    open: true, onClose: vi.fn(), getRequest, sport: 'futbol' as const, canApply: true, canBuy: true,
    preview: null as AiPreview | null, onPreview, onApply, ...over,
  };
  const utils = render(
    <MemoryRouter initialEntries={['/pizarra']}>
      <Routes>
        <Route path="*" element={<><TacticalAiPanel {...props} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...utils, onPreview, onApply, getRequest, props };
}

beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset();
  api.get.mockResolvedValue(balance(12));
  api.post.mockResolvedValue({ result, cached: false, balance: balance(11) });
});

describe('TacticalAiPanel', () => {
  it('muestra el saldo y, al analizar, la lectura, los riesgos y las tarjetas «Sugerencia IA»', async () => {
    setup();
    expect(await screen.findByText('Te quedan 12 análisis este mes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Analizar jugada/ }));
    expect(await screen.findByText(result.lectura)).toBeInTheDocument();
    expect(screen.getByText(/Espalda del lateral/)).toBeInTheDocument();
    expect(screen.getAllByText('Sugerencia IA').length).toBeGreaterThanOrEqual(4); // lectura + 3 tarjetas
    expect(screen.getByText('Salida rápida por la banda derecha')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 11 análisis este mes')).toBeInTheDocument();
    // Lo que se mandó: sin texto libre ni lápiz, rival en su color.
    const sent = api.post.mock.calls[0][1];
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/school/tactical/analyze');
    expect(JSON.stringify(sent)).not.toContain('Juanito');
    expect(sent.frames[0].arrows.map((a: any) => a.type)).toEqual(['opponent']);
    expect(sent.colors).toEqual({ own: 'green', rival: 'orange' });
    expect(sent.labels[K1]).toBe('Central');
  });

  it('«Ver contraataque» manda la sugerencia a la capa y la capa dibuja a los rivales', async () => {
    const { onPreview } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /Analizar jugada/ }));
    const ver = await screen.findAllByRole('button', { name: 'Ver contraataque' });
    fireEvent.click(ver[0]);
    expect(onPreview).toHaveBeenCalledTimes(2); // null al analizar + la sugerencia
    const p = onPreview.mock.calls[1][0] as AiPreview;
    expect(p.kind).toBe('contraataque');
    expect(p.frames).toBe(counter.frames);
    expect(p.rivalColor).toBe('orange');
    const html = renderToStaticMarkup(<TacticalAiOverlay preview={p} view={FULL_VIEW} />);
    expect(html.match(/data-ai-rival="true"/g)).toHaveLength(2);
    expect(html).toContain('data-ai-own="true"');
    expect(html).toContain('Sugerencia IA');
    expect(html).toContain('#fb923c'); // naranja del rival
  });

  it('«Guardar como nueva jugada» entrega cuadros de pizarra: rivales como material «Rival» y balón', async () => {
    const { onApply } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /Analizar jugada/ }));
    fireEvent.click((await screen.findAllByRole('button', { name: /Guardar como nueva jugada/ }))[0]);
    const [frames, titulo] = onApply.mock.calls[0];
    expect(titulo).toBe('Salida rápida por la banda derecha');
    expect(frames).toHaveLength(3);
    for (const f of frames as TacticalFrame[]) {
      expect(f.players.every((p) => !p.key.startsWith('rival:'))).toBe(true);
      expect(f.arrows[0].type).toBe('ball');
      expect(f.arrows.filter((a) => a.type === 'opponent')).toHaveLength(2); // índice estable
    }
    // rival:1 falta en el cuadro 2: se queda donde estaba.
    expect(frames[1].arrows[1]).toMatchObject({ type: 'opponent', x1: 40, y1: 25, color: 'orange' });
    expect(frames[2].arrows[2]).toMatchObject({ type: 'opponent', x1: 78, y1: 70 });
    expect(new Set(frames.map((f: TacticalFrame) => f.id)).size).toBe(3);
  });

  it('sin permiso táctico no ofrece guardar', async () => {
    setup({ canApply: false });
    fireEvent.click(await screen.findByRole('button', { name: /Analizar jugada/ }));
    await screen.findByText(result.lectura);
    expect(screen.queryByRole('button', { name: /Guardar como nueva jugada/ })).toBeNull();
  });

  it('saldo agotado: el BFF responde 402 y aparece «Comprar 50 análisis», que lleva a los adicionales', async () => {
    api.get.mockResolvedValue(balance(0));
    api.post.mockRejectedValue(new BFFError(402, 'needs', { error: 'Se acabaron los análisis con IA de este mes.', needs_purchase: true, balance: balance(0) }));
    setup();
    expect(await screen.findByText('No te quedan análisis este mes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Analizar jugada/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const buy = await screen.findByRole('button', { name: /Comprar 50 análisis/ });
    fireEvent.click(buy);
    expect(screen.getByTestId('loc').textContent).toBe('/mi-plan?upsell=pizarra_ia');
  });

  it('un coach sin permiso de compra ve a quién pedirle el paquete', async () => {
    api.get.mockResolvedValue(balance(0));
    setup({ canBuy: false });
    expect(await screen.findByText(/Pídele al administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Comprar/ })).toBeNull();
  });

  it('error del modelo: mensaje claro, sin romper el panel', async () => {
    api.post.mockRejectedValue(new BFFError(504, 'x', { error: 'La IA tardó demasiado en responder. No se descontó el análisis; intenta de nuevo.' }));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Analizar jugada/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('tardó demasiado');
    expect(screen.getByRole('button', { name: /Analizar jugada/ })).toBeEnabled();
  });

  it('cancha vacía: no llama al BFF', async () => {
    setup({ getRequest: () => null });
    fireEvent.click(await screen.findByRole('button', { name: /Analizar jugada/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pon al menos un jugador');
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('tacticalAi (lógica)', () => {
  it('balanceLabel', () => {
    expect(balanceLabel(balance(12) as any)).toBe('Te quedan 12 análisis este mes');
    expect(balanceLabel(balance(3, { paid_remaining: 40, remaining: 43 }) as any)).toBe('Te quedan 3 análisis gratis este mes y 40 comprados');
    expect(balanceLabel(balance(0, { paid_remaining: 7, remaining: 7 }) as any)).toBe('Te quedan 7 análisis comprados');
    expect(balanceLabel(null)).toBeNull();
  });
  it('suggestionToBoardFrames sin balón ni rivales (variante) deja solo propios y flechas', () => {
    const out = suggestionToBoardFrames({ titulo: 'v', explicacion: '', frames: [{ id: 'a', duration_ms: 900, players: [{ key: K1, x: 1, y: 2 }], ball: null, arrows: [] }] });
    expect(out[0]).toMatchObject({ duration_ms: 900, players: [{ key: K1, x: 1, y: 2 }], ball: null, arrows: [] });
  });
});
