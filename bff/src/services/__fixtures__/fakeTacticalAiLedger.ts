/**
 * Libro de cupo EN MEMORIA, fiel a las RPC de 20261014155445 (reserve / settle /
 * release / cache hit / balance). Para probar la lógica del servicio y la
 * concurrencia sin base.
 *
 * `serialize = true` emula el FOR UPDATE de la fila de la escuela: cada RPC
 * corre entera antes de la siguiente. Entre leer el saldo y escribir hay una
 * pausa (como el ida y vuelta a la base), así que con `serialize = false` dos
 * reservas en paralelo leen el mismo saldo y se pasan del presupuesto: eso
 * demuestra que la prueba de concurrencia detecta la carrera.
 */
import type { LedgerSnapshot } from '../tactical-ai-budget';
import type { SettleArgs, TacticalAiLedger } from '../tactical-ai.service';

interface URow { budget: number; extra: number; used: number; reserved: number; analyses: number; cache_hits: number; needs_more: number; tokens: number }
interface SRow { ceiling: number; extra: number; used: number; reserved: number; analyses: number; needs_more: number }
interface Run { id: string; school: string; user: string; status: string; reserved: number; cost: number }

const pause = () => new Promise((r) => setTimeout(r, 1));

export class FakeTacticalAiLedger implements TacticalAiLedger {
  period = '2026-10';
  budget = 1_000_000;
  factor = 10;
  serialize = true;
  users = new Map<string, URow>();
  schools = new Map<string, SRow>();
  runs = new Map<string, Run>();
  calls: string[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private seq = 0;

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.serialize) return fn();
    const p = this.chain.then(fn);
    this.chain = p.catch(() => undefined);
    return p;
  }
  private s(school: string): SRow {
    let r = this.schools.get(school);
    if (!r) { r = { ceiling: this.budget * this.factor, extra: 0, used: 0, reserved: 0, analyses: 0, needs_more: 0 }; this.schools.set(school, r); }
    return r;
  }
  private u(school: string, user: string): URow {
    const k = `${school}|${user}`;
    let r = this.users.get(k);
    if (!r) { r = { budget: this.budget, extra: 0, used: 0, reserved: 0, analyses: 0, cache_hits: 0, needs_more: 0, tokens: 0 }; this.users.set(k, r); }
    return r;
  }
  user(school: string, user: string) { return this.u(school, user); }
  school(school: string) { return this.s(school); }

  snapshot(school: string, user: string | null): LedgerSnapshot {
    const s = this.s(school);
    const u = user ? this.u(school, user) : null;
    return {
      period: this.period,
      user: u ? { budget_micro_usd: u.budget, extra_micro_usd: u.extra, used_micro_usd: u.used, reserved_micro_usd: u.reserved, analyses: u.analyses, cache_hits: u.cache_hits } : null,
      school: { ceiling_micro_usd: s.ceiling, extra_micro_usd: s.extra, used_micro_usd: s.used, reserved_micro_usd: s.reserved },
    };
  }

  reserve(a: { schoolId: string; userId: string; sport: string; estimateMicro: number }): Promise<LedgerSnapshot> {
    this.calls.push('reserve');
    return this.locked(async () => {
      const s = this.s(a.schoolId);
      const u = this.u(a.schoolId, a.userId);
      const userAvail = u.budget + u.extra - u.used - u.reserved;
      const schoolAvail = s.ceiling + s.extra - s.used - s.reserved;
      await pause(); // ida y vuelta a la base entre leer y escribir
      const scope = userAvail < a.estimateMicro ? 'user' : schoolAvail < a.estimateMicro ? 'school' : null;
      if (scope) {
        u.needs_more += 1;
        if (scope === 'school') s.needs_more += 1;
        return { ...this.snapshot(a.schoolId, a.userId), ok: false, denied_scope: scope };
      }
      const id = `res-${++this.seq}`;
      this.runs.set(id, { id, school: a.schoolId, user: a.userId, status: 'reserved', reserved: a.estimateMicro, cost: 0 });
      u.reserved = u.reserved + a.estimateMicro;
      s.reserved = s.reserved + a.estimateMicro;
      return { ...this.snapshot(a.schoolId, a.userId), ok: true, reservation_id: id };
    });
  }

  settle(a: SettleArgs): Promise<LedgerSnapshot> {
    this.calls.push('settle');
    return this.locked(async () => {
      const r = this.runs.get(a.reservationId);
      if (!r) throw Object.assign(new Error('reserva inexistente'), { code: 'P0002' });
      if (r.status !== 'reserved' && r.status !== 'expired') return { ...this.snapshot(r.school, r.user), ok: true };
      const hold = r.status === 'reserved' ? r.reserved : 0;
      const u = this.u(r.school, r.user);
      const s = this.s(r.school);
      u.reserved = Math.max(0, u.reserved - hold); s.reserved = Math.max(0, s.reserved - hold);
      u.used += a.costMicro; s.used += a.costMicro;
      u.analyses += 1; s.analyses += 1;
      u.tokens += a.tokens.input + a.tokens.output + a.tokens.cacheRead + a.tokens.cacheWrite;
      r.status = 'settled'; r.cost = a.costMicro;
      return { ...this.snapshot(r.school, r.user), ok: true };
    });
  }

  release(id: string): Promise<LedgerSnapshot> {
    this.calls.push('release');
    return this.locked(async () => {
      const r = this.runs.get(id);
      if (!r) throw Object.assign(new Error('reserva inexistente'), { code: 'P0002' });
      if (r.status === 'reserved') {
        const u = this.u(r.school, r.user);
        const s = this.s(r.school);
        u.reserved = Math.max(0, u.reserved - r.reserved); s.reserved = Math.max(0, s.reserved - r.reserved);
        r.status = 'released';
      }
      return { ...this.snapshot(r.school, r.user), ok: true };
    });
  }

  cacheHit(a: { schoolId: string; userId: string; sport: string }): Promise<LedgerSnapshot> {
    this.calls.push('cacheHit');
    return this.locked(async () => {
      this.u(a.schoolId, a.userId).cache_hits += 1;
      return { ...this.snapshot(a.schoolId, a.userId), ok: true };
    });
  }

  async balance(schoolId: string, userId: string): Promise<LedgerSnapshot> {
    this.calls.push('balance');
    return { ...this.snapshot(schoolId, userId), ok: true };
  }
}
