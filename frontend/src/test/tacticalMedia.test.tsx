/**
 * Pizarra M6c: notas y videos de la jugada (lib/school/tacticalMedia.ts y
 * componentes de components/school/tacticalMedia).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FRAME_NOTE_MAX, NOTE_TAGS_MAX, NOTE_TEXT_MAX, PLAY_VIDEOS_MAX, embedUrl, formatClock, hydrateNotes, hydrateVideos,
  noteToPlainLines, parseClock, parseNote, parseTimeParam, parseVideoUrl, publicVideos, sanitizeNoteText,
  serializeNotes, serializeVideos, watchUrl, type PlayVideo,
} from '@/lib/school/tacticalMedia';
import { hydrateFrames, serializeFrames } from '@/lib/school/tacticalAnimation';
import { buildAnalyzeRequest } from '@/lib/school/tacticalAi';
import { NoteText } from '@/components/school/tacticalMedia/NoteText';
import { applyFormat } from '@/components/school/tacticalMedia/PlayNotesDialog';
import { buildDraftVideo } from '@/components/school/tacticalMedia/PlayVideosDialog';
import { frameIndexAt } from '@/components/school/tacticalMedia/FrameNoteBar';
import { filterPresetsByTag, presetTags } from '@/components/school/tacticalMedia/PresetTagFilter';
import { VideoPreview } from '@/components/school/tacticalMedia/VideoPreview';

vi.mock('@/lib/api/bffClient', () => ({ bffClient: { get: vi.fn(), post: vi.fn() }, BFFError: class extends Error {} }));

const ok = (url: string) => {
  const r = parseVideoUrl(url);
  if (!r.ok) throw new Error(`esperaba válido: ${url} → ${'error' in r ? r.error : ''}`);
  return r.video;
};

describe('parseVideoUrl: YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 0],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=90', 90],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s', 90],
    ['https://youtu.be/dQw4w9WgXcQ?t=90', 90],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc&t=1h2m3s', 3723],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 0],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?t=45s', 45],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=12', 12],
    ['youtu.be/dQw4w9WgXcQ', 0],
    ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', 0],
  ])('%s → start %i', (url, start) => {
    const v = ok(url);
    expect(v).toMatchObject({ provider: 'youtube', video_id: 'dQw4w9WgXcQ', start_s: start });
  });
  it('arma el embed youtube-nocookie con start (y end)', () => {
    const v = ok('https://youtube.com/watch?v=dQw4w9WgXcQ&t=90');
    expect(embedUrl({ ...v, end_s: null })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90&rel=0');
    expect(embedUrl({ ...v, end_s: 120 })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90&end=120&rel=0');
    expect(watchUrl({ ...v, url: null })).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s');
  });
  it('t= inválido no rompe: arranca en 0', () => {
    expect(ok('https://youtu.be/dQw4w9WgXcQ?t=abc').start_s).toBe(0);
  });
});

describe('parseVideoUrl: Vimeo', () => {
  it.each([
    ['https://vimeo.com/76979871', null, 0],
    ['https://vimeo.com/76979871#t=95s', null, 95],
    ['https://vimeo.com/76979871/abc123def0', 'abc123def0', 0],
    ['https://player.vimeo.com/video/76979871?h=abc123def0', 'abc123def0', 0],
    ['https://vimeo.com/channels/staffpicks/76979871', null, 0],
  ])('%s', (url, hash, start) => {
    expect(ok(url)).toMatchObject({ provider: 'vimeo', video_id: '76979871', hash, start_s: start });
  });
  it('embed de player.vimeo.com con la clave privada y el inicio', () => {
    const v = ok('https://vimeo.com/76979871/abc123def0#t=1m5s');
    expect(embedUrl({ ...v, end_s: null })).toBe('https://player.vimeo.com/video/76979871?h=abc123def0#t=65s');
  });
});

describe('parseVideoUrl: cámaras y plataformas (tarjeta con enlace, sin iframe)', () => {
  it.each([
    ['https://app.veo.co/matches/20261012-club-vs-rival-abc123/', 'veo'],
    ['https://www.hudl.com/video/3/12345/abcdef', 'hudl'],
    ['https://traceup.com/watch/abc', 'trace'],
    ['https://app.pixellot.tv/event/123', 'pixellot'],
    ['https://www.vidswap.com/v/abc', 'pixellot'],
    ['https://play.spiideo.com/recordings/123', 'spiideo'],
    ['https://xbotgo.com/share/abc', 'xbotgo'],
    ['https://app.reeplayer.com/match/1', 'reeplayer'],
    ['https://www.dropbox.com/scl/fi/abc/partido.mp4?rlkey=xyz&dl=0', 'dropbox'],
  ])('%s → %s', (url, provider) => {
    const v = ok(url);
    expect(v.provider).toBe(provider);
    expect(v.url).toBe(url.replace(/#.*$/, ''));
    expect(embedUrl({ ...v, end_s: null })).toBeNull();
    expect(watchUrl(v)).toBe(v.url);
  });
  it('Google Drive: archivo normalizado; carpeta rechazada', () => {
    const v = ok('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing');
    expect(v).toMatchObject({ provider: 'drive', video_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view' });
    expect(ok('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345').video_id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(parseVideoUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345').ok).toBe(false);
  });
  it('la tarjeta abre en otra pestaña con noopener noreferrer y no hay iframe', () => {
    const v: PlayVideo = { ...ok('https://app.veo.co/matches/abc/'), title: 'Final', start_s: 600, end_s: null, is_private: false };
    const { container } = render(<VideoPreview video={v} />);
    expect(container.querySelector('iframe')).toBeNull();
    const a = screen.getByRole('link', { name: /Ver en Veo/ });
    expect(a.getAttribute('href')).toBe('https://app.veo.co/matches/abc/');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(/desde el minuto 10:00/)).toBeTruthy();
  });
  it('YouTube sí va en iframe de youtube-nocookie', () => {
    const v: PlayVideo = { ...ok('https://youtu.be/dQw4w9WgXcQ?t=90'), title: 'Clip', end_s: null, is_private: false };
    const { container } = render(<VideoPreview video={v} />);
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90&rel=0');
  });
});

describe('parseVideoUrl: maliciosos y otros dominios', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
    '//youtube.com/watch?v=dQw4w9WgXcQ',
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'https://evilyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://veo.co.evil.com/matches/x',
    'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com:8080/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXc',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQQ',
    'https://www.youtube.com/watch?v=dQw4w9W%3Cscript',
    'https://youtu.be/dQw4w9WgXcQ/../../x',
    'https://www.youtube.com/embed/dQw4w9WgXcQ"onload="x',
    'https://www.youtube.com/channel/UC123',
    'https://vimeo.com/abc',
    'https://vimeo.com/76979871/NO-ES-HASH',
    'https://app.veo.co/',
    'https://www.dropbox.com/home',
    'https://you tube.com/watch?v=dQw4w9WgXcQ',
    '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ">',
    '',
  ])('rechaza %s', (url) => {
    const r = parseVideoUrl(url);
    expect(r.ok).toBe(false);
  });
  it('hydrateVideos descarta lo que no valida (dato del BFF o de un paquete)', () => {
    const list = hydrateVideos([
      { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'ok', start_s: 5 },
      { provider: 'youtube', video_id: '"><svg onload=1>', title: 'x', start_s: 0 },
      { provider: 'veo', url: 'javascript:alert(1)', title: 'x' },
      { provider: 'hudl', url: 'https://evil.com/x', title: 'x' },
      { provider: 'iframe', url: 'https://youtube.com', title: 'x' },
      { provider: 'sportmaps', asset_id: 'no-uuid', title: 'x' },
      null, 'texto',
    ]);
    expect(list.map((v) => v.video_id)).toEqual(['dQw4w9WgXcQ']);
  });
});

describe('tiempos', () => {
  it('parseTimeParam / parseClock / formatClock', () => {
    expect(parseTimeParam('90')).toBe(90);
    expect(parseTimeParam('2m')).toBe(120);
    expect(parseTimeParam('x')).toBeNull();
    expect(parseClock('1:30')).toBe(90);
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('12')).toBe(720);
    expect(parseClock('')).toBeNull();
    expect(parseClock('1:75')).toBeNaN();
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(3723)).toBe('1:02:03');
  });
  it('buildDraftVideo toma el t= del enlace y valida fin > inicio', () => {
    const d = buildDraftVideo({ url: 'https://youtu.be/dQw4w9WgXcQ?t=90', title: '', start: '', end: '', isPrivate: true });
    expect(d).toEqual({ ok: true, video: expect.objectContaining({ start_s: 90, end_s: null, is_private: true, title: 'Video de YouTube' }) });
    expect(buildDraftVideo({ url: 'https://youtu.be/dQw4w9WgXcQ', title: 't', start: '2:00', end: '1:00', isPrivate: false }).ok).toBe(false);
    expect(buildDraftVideo({ url: 'https://evil.com/x', title: 't', start: '', end: '', isPrivate: false }).ok).toBe(false);
  });
});

describe('notas: saneo, formato y topes', () => {
  it('quita HTML, esquemas peligrosos y controles; normaliza saltos', () => {
    expect(sanitizeNoteText('<script>alert(1)</script>Hola\r\n<b>mundo</b>')).toBe('alert(1)Hola\nmundo');
    expect(sanitizeNoteText('<scr<b>ipt>x')).not.toMatch(/<[a-z]/i);
    expect(sanitizeNoteText('ver javascript:alert(1) y data:text/html,x')).toBe('ver alert(1) y ,x');
    expect(sanitizeNoteText('a\u0000b\n\n\n\nc')).toBe('ab\n\nc');
    expect(sanitizeNoteText('x'.repeat(NOTE_TEXT_MAX + 50)).length).toBe(NOTE_TEXT_MAX);
    expect(sanitizeNoteText(12)).toBe('');
  });
  it('parseNote: párrafos, saltos, listas y negrita', () => {
    expect(parseNote('**Salida** por derecha\notra línea\n\n- uno\n- **dos**')).toEqual([
      { type: 'p', lines: [[{ text: 'Salida', bold: true }, { text: ' por derecha', bold: false }], [{ text: 'otra línea', bold: false }]] },
      { type: 'ul', items: [[{ text: 'uno', bold: false }], [{ text: 'dos', bold: true }]] },
    ]);
    expect(noteToPlainLines('**A** b\n- c')).toEqual(['A b', '', '• c']);
  });
  it('NoteText pinta elementos, nunca HTML crudo', () => {
    const { container } = render(<NoteText text={'**Clave**\n- <img src=x onerror=alert(1)>uno\n- dos'} />);
    expect(container.querySelector('strong')?.textContent).toBe('Clave');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
  });
  it('hydrate/serialize: etiquetas normalizadas con tope, vacío = null', () => {
    const n = hydrateNotes({ text: ' hola ', tags: ['Presión', 'presión', '<b>x</b>', ...Array.from({ length: 20 }, (_, i) => `t${i}`)] });
    expect(n?.text).toBe('hola');
    expect(n?.tags[0]).toBe('presión');
    expect(n?.tags).toHaveLength(NOTE_TAGS_MAX);
    expect(n?.tags.some((t) => /[<>]/.test(t))).toBe(false);
    expect(serializeNotes({ text: '  ', tags: [] })).toBeNull();
    expect(hydrateNotes('x')).toBeNull();
  });
  it('serializeVideos: tope, solo campos conocidos, privados fuera de lo público', () => {
    const v = { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'a', start_s: 1, end_s: null, is_private: false, extra: 'x' } as any;
    const many = serializeVideos(Array.from({ length: 14 }, () => v))!;
    expect(many).toHaveLength(PLAY_VIDEOS_MAX);
    expect('extra' in many[0]).toBe(false);
    expect(serializeVideos([])).toBeNull();
    expect(publicVideos([v, { ...v, is_private: true }])).toHaveLength(1);
  });
  it('applyFormat: negrita y lista', () => {
    expect(applyFormat('hola mundo', 5, 10, 'bold')).toEqual({ text: 'hola **mundo**', start: 7, end: 12 });
    expect(applyFormat('uno\ndos', 0, 7, 'list').text).toBe('- uno\n- dos');
    expect(applyFormat('- uno', 0, 0, 'list').text).toBe('- uno');
  });
});

describe('nota por cuadro', () => {
  const fr = (id: string, note?: string) => ({ id, duration_ms: 1000, players: [{ key: 'slot#0', x: 50, y: 50 }], ball: null, arrows: [], ...(note ? { note } : {}) });
  it('hydrateFrames y serializeFrames la conservan saneada y con tope', () => {
    const h = hydrateFrames([fr('a', '<b>Arranca</b> el 8'), fr('b', 'x'.repeat(FRAME_NOTE_MAX + 10)), fr('c')])!;
    expect(h[0].note).toBe('Arranca el 8');
    expect(h[1].note).toHaveLength(FRAME_NOTE_MAX);
    expect(h[2].note).toBeUndefined();
    const s = serializeFrames(h)!;
    expect(s[0].note).toBe('Arranca el 8');
    expect('note' in s[2]).toBe(false);
  });
  it('frameIndexAt: el cuadro al que va la reproducción', () => {
    const frames = [fr('a'), fr('b'), fr('c')];
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 500)).toBe(1);
    expect(frameIndexAt(frames, 1000)).toBe(1);
    expect(frameIndexAt(frames, 1500)).toBe(2);
    expect(frameIndexAt(frames, 9999)).toBe(2);
  });
  it('buildAnalyzeRequest manda la intención y las notas de cuadro, con tope', () => {
    const req = buildAnalyzeRequest({
      teamId: 't', sport: 'football11' as any, frames: [fr('a', 'Arranca'), fr('b')], labelOf: () => 'Central',
      intention: `  ${'i'.repeat(2500)}`,
    });
    expect(req.intencion).toHaveLength(2000);
    expect(req.frames[0]).toMatchObject({ note: 'Arranca' });
    expect('note' in req.frames[1]).toBe(false);
    const sin = buildAnalyzeRequest({ teamId: 't', sport: 'football11' as any, frames: [fr('a')], labelOf: () => undefined });
    expect('intencion' in sin).toBe(false);
  });
});

describe('Mis jugadas: filtro por etiqueta', () => {
  const presets = [
    { id: '1', notes: { text: '', tags: ['presión', 'balón parado'] } },
    { id: '2', notes: { text: 'x', tags: ['presión'] } },
    { id: '3', notes: null },
  ];
  it('lista de etiquetas y filtro', () => {
    expect(presetTags(presets)).toEqual(['balón parado', 'presión']);
    expect(filterPresetsByTag(presets, 'presión').map((p) => p.id)).toEqual(['1', '2']);
    expect(filterPresetsByTag(presets, null)).toHaveLength(3);
  });
});
