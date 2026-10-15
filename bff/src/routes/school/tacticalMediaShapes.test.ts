/**
 * Pizarra M6c: notas y videos de la jugada — validación (BFF), notas por
 * cuadro, board de la biblioteca, paquetes (importar/exportar) y la intención
 * del coach en el prompt de la IA (filtrada, sin nombres, con tope).
 */
import { describe, expect, it } from 'vitest';
import {
  FRAME_NOTE_MAX, NOTE_TEXT_MAX, PLAY_VIDEOS_MAX, checkLinkUrl, isMissingMediaColumn, isMissingSavedVideosTable,
  parseMediaBody, validatePlayNotes, validatePlayVideos, validateVideo,
} from './tacticalMediaShapes';
import { sanitizeFrames, validateFrames } from './footballShapes';
import { validateExerciseInput } from './exerciseShapes';
import { buildPackFile, validatePackFile } from './exercisePackShapes';
import {
  INTENTION_PROMPT_MAX, anonymizePlay, boardHash, buildUserPrompt, parseAnalyzeInput, promptLeaks, rosterNameTokens, safeCoachNote,
} from './tacticalAiShapes';

const YT = { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'Salida', start_s: 90, end_s: null, is_private: false };
const frame = (id: string, note?: unknown) => ({
  id, duration_ms: 1200, players: [{ key: 'slot#0', x: 50, y: 50 }], ball: null, arrows: [], ...(note !== undefined ? { note } : {}),
});

describe('validatePlayNotes', () => {
  it('acepta texto con markdown mínimo y etiquetas (normalizadas, sin repetir)', () => {
    const r = validatePlayNotes({ text: '**Salida** por derecha\r\n- Lateral sube\n\n\n\n- Volante apoya', tags: ['Presión', 'presión', ' Salida de balón '] });
    expect(r.errors).toEqual([]);
    expect(r.value).toEqual({ text: '**Salida** por derecha\n- Lateral sube\n\n- Volante apoya', tags: ['presión', 'salida de balón'] });
  });
  it('null borra; vacío queda null', () => {
    expect(validatePlayNotes(null)).toEqual({ errors: [], value: null });
    expect(validatePlayNotes({ text: '   ', tags: [] }).value).toBeNull();
  });
  it('rechaza HTML, javascript:, campos extra y topes', () => {
    expect(validatePlayNotes({ text: '<img src=x onerror=alert(1)>' }).errors[0]).toMatch(/HTML/);
    expect(validatePlayNotes({ text: 'ver javascript:alert(1)' }).errors[0]).toMatch(/HTML/);
    expect(validatePlayNotes({ text: 'x', html: '<b>' }).errors[0]).toMatch(/no es un campo/);
    expect(validatePlayNotes({ text: 'a'.repeat(NOTE_TEXT_MAX + 1) }).errors[0]).toMatch(/demasiado larga/);
    expect(validatePlayNotes({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).errors[0]).toMatch(/Demasiadas/);
    expect(validatePlayNotes({ tags: ['a'.repeat(41)] }).errors[0]).toMatch(/larga/);
    expect(validatePlayNotes({ tags: ['"><script>'] }).errors.length).toBe(1);
    expect(validatePlayNotes('texto suelto').errors.length).toBe(1);
    expect(validatePlayNotes({ text: 7 }).errors[0]).toMatch(/texto/);
  });
});

describe('validateVideo: YouTube y Vimeo (embed)', () => {
  it('acepta id válido y deja solo campos conocidos', () => {
    const r = validateVideo({ ...YT, extra: 'x', url: 'https://evil.com' }, 'v');
    expect(r.value).toEqual({ provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'Salida', start_s: 90, end_s: null, is_private: false });
  });
  it('rechaza ids raros, proveedor desconocido y tiempos inválidos', () => {
    for (const bad of ['dQw4w9WgXc', 'dQw4w9WgXcQQ', 'dQw4w9WgX<Q', '../../evil', 'dQw4w9WgXc/']) {
      expect(validateVideo({ ...YT, video_id: bad }, 'v').value).toBeNull();
    }
    expect(validateVideo({ ...YT, provider: 'dailymotion' }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, start_s: -1 }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, start_s: 1.5 }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, start_s: 100, end_s: 50 }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, title: '<b>x</b>' }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, title: '' }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, is_private: 'si' }, 'v').value).toBeNull();
  });
  it('Vimeo: id numérico y clave privada opcional', () => {
    expect(validateVideo({ ...YT, provider: 'vimeo', video_id: '76979871', hash: 'abc123def0' }, 'v').value?.hash).toBe('abc123def0');
    expect(validateVideo({ ...YT, provider: 'vimeo', video_id: 'abc' }, 'v').value).toBeNull();
    expect(validateVideo({ ...YT, provider: 'vimeo', video_id: '76979871', hash: 'ZZ<>' }, 'v').value).toBeNull();
  });
  it("'sportmaps' (M6h) solo con asset_id uuid", () => {
    expect(validateVideo({ provider: 'sportmaps', asset_id: '0b1c2d3e-0000-4000-8000-000000000001', title: 'Subido', start_s: 0 }, 'v').value?.asset_id)
      .toBe('0b1c2d3e-0000-4000-8000-000000000001');
    expect(validateVideo({ provider: 'sportmaps', title: 'Subido', start_s: 0 }, 'v').value).toBeNull();
  });
});

describe('checkLinkUrl: cámaras y plataformas (tarjeta, nunca iframe)', () => {
  const ok: [string, string][] = [
    ['veo', 'https://app.veo.co/matches/20261012-club-vs-rival-abc123/'],
    ['veo', 'https://veo.co/shared/xyz'],
    ['hudl', 'https://www.hudl.com/video/3/12345/abcdef'],
    ['hudl', 'https://fan.hudl.com/usa/ga/team/broadcast/123'],
    ['trace', 'https://traceup.com/watch/abc'],
    ['pixellot', 'https://app.pixellot.tv/event/123'],
    ['pixellot', 'https://www.vidswap.com/v/abc'],
    ['spiideo', 'https://play.spiideo.com/recordings/123'],
    ['xbotgo', 'https://xbotgo.com/share/abc'],
    ['reeplayer', 'https://app.reeplayer.com/match/1'],
    ['dropbox', 'https://www.dropbox.com/scl/fi/abc/partido.mp4?rlkey=xyz&dl=0'],
  ];
  it.each(ok)('%s acepta %s', (provider, url) => {
    const r = checkLinkUrl(provider, url);
    expect(r.error).toBeNull();
    expect(r.url!.startsWith('https://')).toBe(true);
  });
  it('Google Drive: solo archivo, normalizado a /view', () => {
    const r = checkLinkUrl('drive', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview');
    expect(r).toEqual({ error: null, url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', video_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345' });
    expect(checkLinkUrl('drive', 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345').error).not.toBeNull();
  });
  const bad: [string, string][] = [
    ['veo', 'javascript:alert(1)'],
    ['veo', 'data:text/html,<script>alert(1)</script>'],
    ['veo', 'http://app.veo.co/matches/x'],
    ['veo', 'https://veo.co.evil.com/x'],
    ['veo', 'https://evilveo.co/x'],
    ['veo', 'https://user:pass@app.veo.co/x'],
    ['veo', 'https://app.veo.co:8443/x'],
    ['veo', 'https://app.veo.co/'],
    ['hudl', 'https://app.veo.co/matches/x'],
    ['dropbox', 'https://www.dropbox.com/home/privado'],
    ['trace', `https://traceup.com/${'a'.repeat(520)}`],
    ['spiideo', 'https://play.spiideo.com/x y'],
  ];
  it.each(bad)('%s rechaza %s', (provider, url) => {
    expect(checkLinkUrl(provider, url).error).not.toBeNull();
  });
  it('en validateVideo el proveedor de enlace exige url y no acepta id', () => {
    const v = validateVideo({ provider: 'veo', url: 'https://app.veo.co/matches/a', title: 'Partido', start_s: 600, is_private: true }, 'v').value;
    expect(v).toEqual({ provider: 'veo', url: 'https://app.veo.co/matches/a', title: 'Partido', start_s: 600, end_s: null, is_private: true });
    expect(validateVideo({ provider: 'veo', title: 'x', start_s: 0 }, 'v').value).toBeNull();
  });
});

describe('validatePlayVideos / parseMediaBody', () => {
  it('lista vacía = null; tope de 10', () => {
    expect(validatePlayVideos([])).toEqual({ errors: [], value: null });
    expect(validatePlayVideos(Array.from({ length: PLAY_VIDEOS_MAX + 1 }, () => YT)).errors[0]).toMatch(/máximo 10/);
    expect(validatePlayVideos('x').errors.length).toBe(1);
  });
  it('ausentes = no tocar; presentes se validan', () => {
    expect(parseMediaBody({})).toEqual({ errors: [], fields: {} });
    expect(parseMediaBody({ notes: null, videos: null })).toEqual({ errors: [], fields: { notes: null, videos: null } });
    expect(parseMediaBody({ videos: [{ ...YT, video_id: 'x' }] }).errors[0]).toMatch(/video 1/);
  });
  it('detecta columnas y tabla sin aplicar', () => {
    expect(isMissingMediaColumn({ code: 'PGRST204', message: "Could not find the 'notes' column" })).toBe(true);
    expect(isMissingMediaColumn({ code: '42703', message: 'column match_lineups.videos does not exist' })).toBe(true);
    expect(isMissingMediaColumn({ code: '42703', message: 'column frames does not exist' })).toBe(false);
    expect(isMissingSavedVideosTable({ code: 'PGRST205', message: "Could not find the table 'public.tactical_saved_videos'" })).toBe(true);
  });
});

describe('nota por cuadro', () => {
  it('validateFrames la acepta, la limpia y sanitizeFrames la conserva', () => {
    const frames = [frame('f1', 'Arranca **el 8**'), frame('f2')];
    expect(validateFrames(frames)).toEqual([]);
    const out = sanitizeFrames(frames);
    expect(out[0].note).toBe('Arranca **el 8**');
    expect('note' in out[1]).toBe(false);
  });
  it('rechaza nota larga, con HTML o que no es texto', () => {
    expect(validateFrames([frame('f1', 'a'.repeat(FRAME_NOTE_MAX + 1)), frame('f2')])[0]).toMatch(/cuadro 1/);
    expect(validateFrames([frame('f1'), frame('f2', '<script>x</script>')])[0]).toMatch(/cuadro 2/);
    expect(validateFrames([frame('f1', 12), frame('f2')])[0]).toMatch(/texto/);
  });
});

describe('biblioteca: board.notes / board.videos', () => {
  it('validateExerciseInput las valida y las guarda dentro de board', () => {
    const { errors, fields } = validateExerciseInput({
      name: 'Salida', board: { players: [], arrows: [], frames: [frame('f1', 'nota 1'), frame('f2')], notes: { text: 'Hola', tags: ['presión'] }, videos: [YT] },
    }, false);
    expect(errors).toEqual([]);
    expect(fields.board?.notes).toEqual({ text: 'Hola', tags: ['presión'] });
    expect(fields.board?.videos?.[0].video_id).toBe('dQw4w9WgXcQ');
    expect(fields.board?.frames[0].note).toBe('nota 1');
  });
  it('board con video malicioso → error', () => {
    const { errors } = validateExerciseInput({ name: 'x', board: { videos: [{ provider: 'veo', url: 'javascript:alert(1)', title: 'x', start_s: 0 }] } }, false);
    expect(errors.join(' ')).toMatch(/jugada: video 1/);
  });
});

describe('paquetes con notas y videos', () => {
  const file = (board: unknown) => ({
    format: 'sportmaps-ejercicios', version: 1,
    pack: { name: 'Paquete', sport: 'futbol' },
    exercises: [{ name: 'Salida', board }],
  });
  it('importa notas, notas de cuadro y videos válidos', () => {
    const r = validatePackFile(file({
      players: [{ key: 'x', slot_label: 'Central', x: 50, y: 50 }], arrows: [],
      frames: [frame('f1', 'Arranca'), frame('f2')], notes: { text: '**Clave**', tags: ['presión'] },
      videos: [YT, { provider: 'hudl', url: 'https://www.hudl.com/video/1', title: 'Hudl', start_s: 0 }],
    }), ['futbol']);
    expect(r.errors).toEqual([]);
    const b = r.value!.exercises[0].board;
    expect(b.notes).toEqual({ text: '**Clave**', tags: ['presión'] });
    expect(b.videos).toHaveLength(2);
    expect(b.frames[0].note).toBe('Arranca');
  });
  it('rechaza el archivo entero si una nota, una etiqueta o un video trae código', () => {
    expect(validatePackFile(file({ notes: { text: '<iframe src=//evil>' } }), ['futbol']).errors.length).toBeGreaterThan(0);
    expect(validatePackFile(file({ frames: [frame('f1', 'javascript:alert(1)'), frame('f2')] }), ['futbol']).errors.length).toBeGreaterThan(0);
    expect(validatePackFile(file({ videos: [{ provider: 'youtube', video_id: 'x"><svg>', title: 't', start_s: 0 }] }), ['futbol']).errors.length).toBeGreaterThan(0);
    expect(validatePackFile(file({ videos: [{ provider: 'veo', url: 'https://veo.co.evil.com/x', title: 't', start_s: 0 }] }), ['futbol']).errors.length).toBeGreaterThan(0);
  });
  it('exporta la nota y deja fuera los videos de «enlace privado»', () => {
    const out = buildPackFile({ name: 'P', description: null, sport: 'futbol', version: 1 }, [{
      name: 'E', objective: null, minutes: null, age_group: null, materials: null, tags: [], sport: 'futbol', description: null,
      board: { players: [], arrows: [], frames: [], notes: { text: 'n', tags: [] }, videos: [YT, { ...YT, video_id: 'aaaaaaaaaaa', is_private: true }] as any },
    }]);
    expect(out.exercises[0].board.notes).toEqual({ text: 'n', tags: [] });
    expect(out.exercises[0].board.videos?.map((v) => v.video_id)).toEqual(['dQw4w9WgXcQ']);
  });
});

describe('IA: intención del coach en el prompt', () => {
  const roster = rosterNameTokens(['Juan Pablo Restrepo', 'Sofía Gómez']);
  it('safeCoachNote: sin formato, una línea, con tope', () => {
    expect(safeCoachNote('**Salida** por derecha\n- Lateral sube\n- Volante apoya', roster, 600))
      .toBe('Salida por derecha · Lateral sube · Volante apoya');
    const long = safeCoachNote('presión alta '.repeat(100), roster, INTENTION_PROMPT_MAX);
    expect(long.length).toBeLessThanOrEqual(INTENTION_PROMPT_MAX + 1);
    expect(long.endsWith('…')).toBe(true);
  });
  it('si la nota nombra a alguien del plantel se descarta entera', () => {
    expect(safeCoachNote('Pase largo a Restrepo por la banda', roster, 600)).toBe('');
    expect(safeCoachNote('la sofia cierra el centro', roster, 600)).toBe('');
  });
  it('datos de contacto, enlaces o ids → se descarta', () => {
    for (const t of ['llamar al 300 123 4567', 'escribe a coach@club.co', 'ver https://youtu.be/x', 'pregunta a @profe_juan', 'id 0b1c2d3e-0000-4000-8000-000000000001']) {
      expect(safeCoachNote(t, roster, 600)).toBe('');
    }
  });
  it('un nombre que no está en el plantel (mayúscula en medio de la frase) se enmascara', () => {
    expect(safeCoachNote('Salida corta y pase a Juanito por dentro. Arquero juega con los pies', roster, 600))
      .toBe('Salida corta y pase a [jugador] por dentro. Arquero juega con los pies');
  });

  const body = {
    team_id: '0b1c2d3e-0000-4000-8000-000000000001', sport: 'futbol',
    frames: [
      { id: 'f1', duration_ms: 1200, players: [{ key: 'athlete:1', x: 50, y: 80 }], ball: null, arrows: [], note: 'Arranca **el central**' },
      { id: 'f2', duration_ms: 1200, players: [{ key: 'athlete:1', x: 50, y: 60 }], ball: null, arrows: [], note: 'Pase a Restrepo' },
    ],
    labels: { 'athlete:1': 'Central' },
    intencion: '**Salir jugando** desde atrás\n- Central abre',
  };
  it('parseAnalyzeInput acepta intencion y la limita', () => {
    expect(parseAnalyzeInput(body).input?.intencion).toBe(body.intencion);
    expect(parseAnalyzeInput({ ...body, intencion: 'x'.repeat(2001) }).errors[0]).toMatch(/intencion/);
    expect(parseAnalyzeInput({ ...body, intencion: 5 }).errors[0]).toMatch(/intencion/);
  });
  it('el prompt lleva la intención y las notas de cuadro filtradas, sin nombres', () => {
    const { input } = parseAnalyzeInput(body);
    const { play } = anonymizePlay(input!, roster);
    expect(play.intencion).toBe('Salir jugando desde atrás · Central abre');
    expect(play.cuadros[0].nota).toBe('Arranca el central');
    expect(play.cuadros[1].nota).toBeUndefined(); // nombra a alguien del plantel
    const prompt = buildUserPrompt(play);
    expect(prompt).toContain('Intención del entrenador');
    expect(prompt).toContain('Salir jugando desde atrás');
    expect(promptLeaks(prompt, ['Juan Pablo Restrepo', 'Sofía Gómez', 'athlete:1'])).toEqual([]);
  });
  it('sin notas el prompt y el hash son los de siempre (la caché no se invalida)', () => {
    const plain = { ...body, intencion: undefined, frames: body.frames.map(({ note: _n, ...f }) => f) };
    const { play } = anonymizePlay(parseAnalyzeInput(plain).input!, roster);
    expect('intencion' in play).toBe(false);
    expect(play.cuadros.every((c) => !('nota' in c))).toBe(true);
    expect(buildUserPrompt(play)).not.toContain('Intención');
    const withNote = anonymizePlay(parseAnalyzeInput(body).input!, roster).play;
    expect(boardHash(play)).not.toBe(boardHash(withNote));
  });
});
