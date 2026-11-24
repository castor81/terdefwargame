/* TERDEF wargaming platform – adattár és háttér-adapterek (Supabase / helyi demó) */
(function () {
  'use strict';
  const CFG = window.LWP_CONFIG;
  const BR = window.ORG.sections;
  const S = {
    groups: [], msgs: [], reacts: [], events: [], incidents: [],
    cfg: { name: 'TERDEF gyakorlat', yellow: 5, red: 15, pin: CFG.leadPinSha256 || '' },
    ready: false, mode: 'local', error: null
  };
  const subs = new Set();
  let pend = null;
  function emit() {
    if (pend) return;
    pend = setTimeout(() => { pend = null; subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }, 30);
  }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  async function sha256(t) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- közös állapotfrissítők ---------- */
  function upsertMsg(r) {
    const i = S.msgs.findIndex(x => x.id === r.id);
    if (i >= 0) S.msgs[i] = Object.assign({}, S.msgs[i], r);
    else {
      S.msgs.push(r);
      const n = S.msgs.length;
      if (n > 1 && S.msgs[n - 2].created_at > r.created_at) S.msgs.sort((a, b) => a.created_at < b.created_at ? -1 : 1);
    }
    emit();
  }
  function addReact(r) {
    if (!S.reacts.some(x => x.message_id === r.message_id && x.actor === r.actor && x.emoji === r.emoji)) S.reacts.push(r);
    emit();
  }
  function delReact(r) {
    S.reacts = S.reacts.filter(x => !(x.message_id === r.message_id && x.actor === r.actor && x.emoji === r.emoji));
    emit();
  }
  const normG = g => { g.branch = window.ORG.sectionOf(g.id); return g; };
  function upsertGroup(r) {
    const i = S.groups.findIndex(x => x.id === r.id);
    if (i >= 0) S.groups[i] = normG(Object.assign({}, S.groups[i], r)); else S.groups.push(normG(r));
    emit();
  }
  function applyCfg(key, v) {
    if (key === 'exercise') { S.cfg.name = v.name || S.cfg.name; S.cfg.yellow = +v.yellow_min || 5; S.cfg.red = +v.red_min || 15; }
    if (key === 'lead_pin_sha256') S.cfg.pin = v;
    if (key === 'scenario') S.cfg.scenario = v;
    if (key === 'jemm') S.cfg.jemm = v;
    emit();
  }
  function upsertInc(r) {
    const i = S.incidents.findIndex(x => x.id === r.id);
    if (i >= 0) S.incidents[i] = Object.assign({}, S.incidents[i], r); else S.incidents.push(r);
    S.incidents.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    emit();
  }
  function addEvent(r) { if (!S.events.some(x => x.id === r.id)) S.events.push(r); emit(); }

  /* ---------- Supabase háttér ---------- */
  function sbBackend() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    async function all(table, order) {
      let out = [], from = 0;
      for (;;) {
        const { data, error } = await sb.from(table).select('*').order(order, { ascending: true }).range(from, from + 999);
        if (error) throw error;
        out = out.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return out;
    }
    return {
      name: 'supabase',
      async load() {
        const [g, m, r, c, e, inc] = await Promise.all([all('tdw_groups', 'id'), all('tdw_messages', 'created_at'), all('tdw_reactions', 'created_at'), all('tdw_config', 'key'), all('tdw_events', 'id'), all('tdw_incidents', 'seq')]);
        S.groups = g.map(normG); S.msgs = m; S.reacts = r; S.events = e; S.incidents = inc.filter(x => !x.deleted);
        c.forEach(x => applyCfg(x.key, x.value));
        const ch = sb.channel('tdw-live');
        const on = (table, fn) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, fn);
        on('tdw_messages', p => { if (p.new && p.new.id) upsertMsg(p.new); });
        on('tdw_reactions', p => { if (p.eventType === 'DELETE') delReact(p.old); else addReact(p.new); });
        on('tdw_groups', p => { if (p.new && p.new.id) upsertGroup(p.new); });
        on('tdw_config', p => { if (p.new && p.new.key) applyCfg(p.new.key, p.new.value); });
        on('tdw_events', p => { if (p.new && p.new.id) addEvent(p.new); });
        on('tdw_incidents', p => { if (p.new && p.new.id) { if (p.new.deleted) { S.incidents = S.incidents.filter(x => x.id !== p.new.id); emit(); } else upsertInc(p.new); } });
        ch.subscribe();
        // védőháló: ha a realtime-kapcsolat kiesne, 20 mp-enként teljes újratöltés a friss üzenetekre
        setInterval(async () => {
          try {
            const last = S.msgs.length ? S.msgs[S.msgs.length - 1].created_at : '1970-01-01';
            const { data } = await sb.from('tdw_messages').select('*').gt('created_at', last).order('created_at');
            (data || []).forEach(upsertMsg);
            const { data: gs } = await sb.from('tdw_groups').select('*');
            (gs || []).forEach(upsertGroup);
            const { data: ic } = await sb.from('tdw_incidents').select('*').order('seq'); if (ic) { S.incidents = ic.filter(x => !x.deleted); emit(); }
          } catch (_) { /* hálózati hiba: a következő ciklus újrapróbálja */ }
        }, 20000);
      },
      async send(m) {
        const { data, error } = await sb.from('tdw_messages').insert(m).select().single();
        if (error) throw error;
        upsertMsg(data);
        return data;
      },
      async upload(file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
        const path = (CFG.mediaPrefix || '') + new Date().toISOString().slice(0, 10) + '/' + uuid() + '.' + ext;
        const { error } = await sb.storage.from(CFG.bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) throw error;
        return { url: sb.storage.from(CFG.bucket).getPublicUrl(path).data.publicUrl, name: file.name };
      },
      async react(message_id, actor, emoji, on) {
        const row = { message_id, actor, emoji };
        if (on) { addReact(row); const { error } = await sb.from('tdw_reactions').insert(row); if (error && error.code !== '23505') { delReact(row); throw error; } }
        else { delReact(row); const { error } = await sb.from('tdw_reactions').delete().match(row); if (error) throw error; }
      },
      async patchGroup(id, patch) { upsertGroup(Object.assign({ id }, patch)); const { error } = await sb.from('tdw_groups').update(patch).eq('id', id); if (error) throw error; },
      async patchMsg(id, patch) { upsertMsg(Object.assign({ id }, patch)); const { error } = await sb.from('tdw_messages').update(patch).eq('id', id); if (error) throw error; },
      async logEvent(group_id, type, data) { const { error } = await sb.from('tdw_events').insert({ group_id, type, data: data || null }); if (error) console.warn(error); },
      async setCfg(key, value) { const { error } = await sb.from('tdw_config').upsert({ key, value }); if (error) throw error; applyCfg(key, value); },
      async addIncident(r) { const { data, error } = await sb.from('tdw_incidents').insert(r).select().single(); if (error) throw error; upsertInc(data); return data; },
      async patchIncident(id, patch) { const { error } = await sb.from('tdw_incidents').update(patch).eq('id', id); if (error) throw error; if (patch.deleted) { S.incidents = S.incidents.filter(x => x.id !== id); emit(); } else upsertInc(Object.assign({ id }, patch)); },
      async reloadEvents() { S.events = await all('tdw_events', 'id'); emit(); }
    };
  }

  /* ---------- helyi demó háttér (localStorage + BroadcastChannel) ---------- */
  function localBackend() {
    const LK = 'tdw-local-v1';
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('tdw-local') : null;
    const dataURL = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
    function read() { try { return JSON.parse(localStorage.getItem(LK)); } catch (_) { return null; } }
    function pull() {
      const d = read(); if (!d) return;
      S.groups = d.groups.map(normG); S.msgs = d.msgs; S.reacts = d.reacts; S.events = d.events; S.incidents = (d.incidents || []).filter(x => !x.deleted);
      Object.keys(d.cfg).forEach(k => applyCfg(k, d.cfg[k]));
    }
    function mutate(fn) {
      const d = read(); fn(d);
      try { localStorage.setItem(LK, JSON.stringify(d)); } catch (e) { throw new Error('A helyi demó tárhelye megtelt (nagy média).'); }
      pull(); if (bc) bc.postMessage('x'); emit();
    }
    return {
      name: 'local',
      async load() {
        if (!read()) {
          const groups = window.ORG.list.map(o => ({ id: o.id, branch: o.section, letter: o.short, name: o.name, token: 'tdw-' + o.id, last_seen: null, last_login: null, active_sec: 0, help: false, created_at: new Date().toISOString() }));
          localStorage.setItem(LK, JSON.stringify({ groups, msgs: [], reacts: [], events: [], incidents: [], cfg: { exercise: { name: 'TERDEF gyakorlat – helyi demó', yellow_min: 5, red_min: 15 }, lead_pin_sha256: CFG.leadPinSha256 } }));
        }
        pull();
        if (bc) bc.onmessage = () => { pull(); emit(); };
        window.addEventListener('storage', e => { if (e.key === LK) { pull(); emit(); } });
      },
      async send(m) {
        const row = Object.assign({ id: uuid(), created_at: new Date().toISOString(), pinned: false, deleted: false }, m);
        mutate(d => d.msgs.push(row));
        return row;
      },
      async upload(file) {
        if (file.size > 2.5 * 1024 * 1024) throw new Error('Demó módban legfeljebb 2,5 MB-os média tölthető fel.');
        return { url: await dataURL(file), name: file.name };
      },
      async react(message_id, actor, emoji, on) {
        mutate(d => {
          d.reacts = d.reacts.filter(x => !(x.message_id === message_id && x.actor === actor && x.emoji === emoji));
          if (on) d.reacts.push({ message_id, actor, emoji, created_at: new Date().toISOString() });
        });
      },
      async patchGroup(id, patch) { mutate(d => { const g = d.groups.find(x => x.id === id); Object.assign(g, patch); }); },
      async patchMsg(id, patch) { mutate(d => { const g = d.msgs.find(x => x.id === id); Object.assign(g, patch); }); },
      async logEvent(group_id, type, data) { mutate(d => d.events.push({ id: Date.now() + Math.random(), ts: new Date().toISOString(), group_id, type, data: data || null })); },
      async setCfg(key, value) { mutate(d => { d.cfg[key] = value; }); },
      async addIncident(r) {
        const d0 = read(); const seq = Math.max(0, ...(d0.incidents || []).map(x => x.seq || 0)) + 1;
        const row = Object.assign({ id: uuid(), seq, created_at: new Date().toISOString(), deleted: false }, r);
        mutate(d => { d.incidents = d.incidents || []; d.incidents.push(row); });
        return row;
      },
      async patchIncident(id, patch) { mutate(d => { const g = (d.incidents || []).find(x => x.id === id); if (g) Object.assign(g, patch); }); },
      async reloadEvents() { pull(); emit(); }
    };
  }

  /* ---------- nyilvános API ---------- */
  let B = null;
  const API = {
    S, BR, uuid, sha256,
    on(f) { subs.add(f); return () => subs.delete(f); },
    async init() {
      const forceLocal = /[?&]local=1/.test(location.search);
      const useSb = CFG.supabaseUrl && window.supabase && !forceLocal;
      B = useSb ? sbBackend() : localBackend();
      S.mode = B.name;
      try { await B.load(); S.ready = true; S.error = null; } catch (e) { S.error = e.message || String(e); console.error(e); }
      emit();
    },
    incident: id => S.incidents.find(x => x.id === id),
    incCode: x => 'INC-' + String(x && x.seq || 0).padStart(3, '0'),
    async addIncident(r) { return B.addIncident(r); },
    async patchIncident(id, p) { return B.patchIncident(id, p); },
    org: id => window.ORG.get(id),
    mode: () => S.mode,
    touch: () => emit(),
    group: id => S.groups.find(g => g.id === id),
    groupByToken: t => S.groups.find(g => g.token === t),
    status(g) {
      if (!g || !g.last_seen) return { key: 'off', min: null };
      const min = (Date.now() - new Date(g.last_seen).getTime()) / 60000;
      return { key: min < S.cfg.yellow ? 'ok' : min < S.cfg.red ? 'warn' : 'bad', min };
    },
    async send(m) { return B.send(m); },
    async upload(f) { return B.upload(f); },
    async react(mid, actor, emoji) {
      const on = !S.reacts.some(r => r.message_id === mid && r.actor === actor && r.emoji === emoji);
      return B.react(mid, actor, emoji, on);
    },
    async beat(gid) {
      const g = API.group(gid); if (!g) return;
      const now = Date.now(), prev = g.last_seen ? new Date(g.last_seen).getTime() : 0;
      const gap = (now - prev) / 1000;
      const add = prev && gap <= 90 ? Math.round(gap) : 0;
      return B.patchGroup(gid, { last_seen: new Date(now).toISOString(), active_sec: (g.active_sec || 0) + add });
    },
    async login(gid) {
      await B.patchGroup(gid, { last_login: new Date().toISOString(), last_seen: new Date().toISOString() });
      return B.logEvent(gid, 'login');
    },
    async setHelp(gid, v) { await B.patchGroup(gid, { help: v }); if (v) await B.logEvent(gid, 'help'); },
    patchMsg: (id, p) => B.patchMsg(id, p),
    logEvent: (g, t, d) => B.logEvent(g, t, d),
    setCfg: (k, v) => B.setCfg(k, v),
    reloadEvents: () => B.reloadEvents()
  };
  window.LWP = API;
})();
