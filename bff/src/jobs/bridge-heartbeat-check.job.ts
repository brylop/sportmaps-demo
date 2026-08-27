// bff/src/jobs/bridge-heartbeat-check.job.ts
//
// Revisa bridge_heartbeats (poblada por cada sondeo exitoso de
// GET /bridge/door-commands, ver bridge.routes.ts) y avisa al owner de la
// escuela si un bridge local dejó de responder — típicamente la PC del gym
// apagada o sin red. Sin esto, el dashboard no avisa nada: el botón de abrir
// sigue mostrando "abrirá en los próximos segundos" aunque no haya nadie del
// otro lado, y nadie se entera hasta que alguien lo intenta y falla.
//
// Una sola notificación por caída: al alertar, sella `alerted_at`; el
// próximo latido exitoso lo vuelve a poner en null (ver bridge.routes.ts),
// así que una caída nueva sí vuelve a avisar.

import { supabase } from '../config/supabase';

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 min -- los blips transitorios de red observados en campo se recuperaron solos en unos pocos minutos; por debajo de esto seria ruido.

export async function runBridgeHeartbeatCheck() {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: stale, error } = await supabase
    .from('bridge_heartbeats')
    .select('id, school_id, bridge_name, last_seen_at')
    .lt('last_seen_at', staleBefore)
    .is('alerted_at', null);

  if (error) {
    console.error('[CRON] bridge-heartbeat-check: error consultando bridge_heartbeats:', error.message);
    return;
  }
  if (!stale || stale.length === 0) return;

  for (const hb of stale as any[]) {
    try {
      const { data: school } = await supabase
        .from('schools').select('owner_id, name').eq('id', hb.school_id).maybeSingle();

      if (school?.owner_id) {
        const minutosSinResponder = Math.round((Date.now() - new Date(hb.last_seen_at).getTime()) / 60000);
        await supabase.from('notifications').insert({
          user_id:   school.owner_id,
          school_id: hb.school_id,
          category:  'access',
          type:      'bridge_offline',
          title:     '⚠️ Puente de apertura sin responder',
          message:   `El puente local de apertura de puertas (${hb.bridge_name}) lleva ${minutosSinResponder} min sin responder — probablemente la PC del gym está apagada o sin red. La apertura remota manual no va a funcionar hasta que vuelva a conectar.`,
          link:      '/school/access-control',
        });
      }

      // Sellar aunque no haya owner_id -- evita reintentar cada corrida por
      // una escuela sin dueño configurado.
      await supabase.from('bridge_heartbeats').update({ alerted_at: new Date().toISOString() }).eq('id', hb.id);

      console.log(`[CRON] bridge-heartbeat-check: alertado school=${hb.school_id} bridge=${hb.bridge_name}`);
    } catch (err: any) {
      console.error(`[CRON] bridge-heartbeat-check: error alertando school=${hb.school_id}:`, err?.message || err);
    }
  }
}
