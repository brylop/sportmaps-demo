/** Reglas puras de M6h: tipos, tamaños, duración, TTL y clips. */
import { describe, expect, it } from 'vitest';
import { clampTtl, isAllowedVideoType, parseClip, parseUploadRequest, PLAYBACK_TTL_MAX_S } from './policy';

const ok = { title: 'Partido sábado', mime_type: 'video/mp4', size_bytes: 500 * 1024 ** 2 };

describe('tipos permitidos', () => {
  it('mp4, quicktime (iPhone) y webm; con parámetros y mayúsculas', () => {
    expect(isAllowedVideoType('video/mp4')).toBe(true);
    expect(isAllowedVideoType('video/quicktime')).toBe(true);
    expect(isAllowedVideoType('video/webm;codecs=vp9')).toBe(true);
    expect(isAllowedVideoType('VIDEO/MP4')).toBe(true);
  });
  it('rechaza todo lo demás (415)', () => {
    for (const t of ['video/x-msvideo', 'video/x-matroska', 'image/png', 'application/octet-stream', '', undefined, 'text/html']) {
      expect(isAllowedVideoType(t)).toBe(false);
      const r = parseUploadRequest({ ...ok, mime_type: t });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(415);
    }
  });
});

describe('tamaño y duración', () => {
  it('4 GB entra; 4 GB + 1 byte → 413', () => {
    expect(parseUploadRequest({ ...ok, size_bytes: 4 * 1024 ** 3 }).ok).toBe(true);
    const r = parseUploadRequest({ ...ok, size_bytes: 4 * 1024 ** 3 + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });
  it('tamaño 0, negativo, decimal o texto → 422', () => {
    for (const s of [0, -1, 1.5, 'mucho', null]) {
      const r = parseUploadRequest({ ...ok, size_bytes: s });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(422);
    }
  });
  it('duración declarada: reserva lo medido + 60 s; sin dato reserva el techo (3 h); más de 3 h → 422', () => {
    const a = parseUploadRequest({ ...ok, duration_s: 600.4 });
    expect(a.ok && a.value.maxDurationS).toBe(661);
    const b = parseUploadRequest(ok);
    expect(b.ok && b.value.maxDurationS).toBe(10800);
    const c = parseUploadRequest({ ...ok, duration_s: 10801 });
    expect(c.ok).toBe(false);
  });
  it('título obligatorio, sin HTML; equipo uuid; origen de la lista; fecha AAAA-MM-DD', () => {
    expect(parseUploadRequest({ ...ok, title: '   ' }).ok).toBe(false);
    const t = parseUploadRequest({ ...ok, title: '<b>Final</b> sub 13' });
    expect(t.ok && t.value.title).toBe('bFinal/b sub 13');
    expect(parseUploadRequest({ ...ok, team_id: 'no-uuid' }).ok).toBe(false);
    const s = parseUploadRequest({ ...ok, source: 'tiktok' });
    expect(s.ok && s.value.source).toBe('phone');
    const v = parseUploadRequest({ ...ok, source: 'veo', recorded_at: '2026-10-11' });
    expect(v.ok && v.value).toMatchObject({ source: 'veo', recordedAt: '2026-10-11' });
    expect(parseUploadRequest({ ...ok, recorded_at: '11/10/2026' }).ok).toBe(false);
  });
});

describe('TTL de la URL firmada', () => {
  it('default 15 min; acota entre 60 s y 6 h', () => {
    expect(clampTtl(undefined)).toBe(900);
    expect(clampTtl('5')).toBe(60);
    expect(clampTtl(120)).toBe(120);
    expect(clampTtl(10 ** 9)).toBe(PLAYBACK_TTL_MAX_S);
    expect(clampTtl('abc')).toBe(900);
  });
});

describe('clips', () => {
  const L = '11111111-2222-4333-8444-555555555555';
  it('válido, redondeado a centésimas, vinculado a UNA jugada', () => {
    const r = parseClip({ title: 'Salida por izquierda', start_s: 12.345, end_s: 20, lineup_id: L }, 100);
    expect(r).toEqual({ ok: true, value: { title: 'Salida por izquierda', startS: 12.35, endS: 20, lineupId: L, presetId: null, exerciseId: null } });
  });
  it('fin antes del inicio, < 1 s, después del final, dos jugadas o id raro → error', () => {
    expect(parseClip({ title: 'x', start_s: 10, end_s: 5 }, 100).ok).toBe(false);
    expect(parseClip({ title: 'x', start_s: 10, end_s: 10.5 }, 100).ok).toBe(false);
    expect(parseClip({ title: 'x', start_s: 10, end_s: 150 }, 100).ok).toBe(false);
    expect(parseClip({ title: 'x', start_s: 0, end_s: 5, lineup_id: L, preset_id: L }, 100).ok).toBe(false);
    expect(parseClip({ title: 'x', start_s: 0, end_s: 5, exercise_id: 'drop table' }, 100).ok).toBe(false);
    expect(parseClip({ title: '', start_s: 0, end_s: 5 }, 100).ok).toBe(false);
  });
});
