/* TERDEF wargaming platform – adattár és háttér-adapterek (Supabase / helyi demó) */
(function () {
  'use strict';
  const CFG = window.LWP_CONFIG;
  const BR = window.ORG.sections;
  const S = {
    groups: [], msgs: [], reacts: [], events: [], incidents: [], reads: [],
    cfg: { name: 'TERDEF gyakorlat', yellow: 5, red: 15, openLogin: true },
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
  function upsertRead(r) {
    const i = S.reads.findIndex(x => x.message_id === r.message_id && x.group_id === r.group_id);
    if (i < 0) S.reads.push(r); else S.reads[i] = Object.assign({}, S.reads[i], r, { seen_at: S.reads[i].seen_at || r.seen_at, opened_at: S.reads[i].opened_at || r.opened_at || null });
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
    if (key === 'open_unit_login') S.cfg.openLogin = !!v;
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

  /* ---------- Supabase háttér: minden hozzáférés szerepkör-alapú, szerveroldalon ellenőrzött RPC-n át ---------- */
  const ERR = { bad_code: 'Hibás belépési kód.', too_many_attempts: 'Túl sok sikertelen próbálkozás – várj néhány percet.', code_required: 'Ehhez a szervezeti elemhez belépési kód szükséges (lásd a QR-lapot).', forbidden: 'Nincs jogosultságod ehhez a művelethez.', unauthorized: 'A munkamenet lejárt – lépj be újra.', code_too_short: 'A kód túl rövid.', bad_emoji: 'Ez a reakció nem engedélyezett.', bad_media: 'Érvénytelen melléklet.', too_long: 'A tartalom túl hosszú.', type_not_allowed: 'Ez a fájltípus nem tölthető fel (kép, videó, hang, PDF engedélyezett).', too_large: 'A fájl túl nagy (legfeljebb 10 MB).' };
  const mapErr = e => { const m = String((e && e.message) || e || ''); const k = Object.keys(ERR).find(x => m.includes(x)); const o = new Error(k ? ERR[k] : m); o.code = k || (e && e.code); return o; };
  function sbBackend() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let sess = null, since = 0, evMax = 0, timer = null, busy = false, lastFull = 0, ready = null;
    const lostCbs = new Set();
    const resetState = () => { S.groups = []; S.msgs = []; S.reacts = []; S.events = []; S.incidents = []; S.reads = []; S.cfg = { name: 'TERDEF gyakorlat', yellow: 5, red: 15 }; since = 0; evMax = 0; };
    function lost() { if (!sess) return; const r = sess.role; sess = null; clearInterval(timer); timer = null; try { localStorage.removeItem('tdw-sess-' + r); } catch (_) { } resetState(); lostCbs.forEach(f => { try { f(r); } catch (_) { } }); emit(); }
    async function rpc(name, args) {
      const { data, error } = await sb.rpc(name, args);
      if (error) { if (error.code === '28000' || /unauthorized/.test(error.message || '')) lost(); throw mapErr(error); }
      return data;
    }
    const S_ = () => ({ p_s: sess && sess.t });
    function apply(d, full) {
      if (full) { resetState(); }
      S.groups = (d.groups || []).map(normG);
      (d.msgs || []).forEach(m => { if (full) S.msgs.push(m); else upsertMsg(m); });
      if (full) S.msgs.sort((a, b) => a.created_at < b.created_at ? -1 : 1);
      (d.reacts || []).forEach(r => { if (r.removed) delReact(r); else addReact(r); });
      (d.reads || []).forEach(upsertRead);
      (d.incidents || []).forEach(i => { if (i.deleted) { S.incidents = S.incidents.filter(x => x.id !== i.id); } else upsertInc(i); });
      if (d.cfg) Object.keys(d.cfg).forEach(k => applyCfg(k, d.cfg[k]));
      (d.events || []).forEach(e => { addEvent(e); if (e.id > evMax) evMax = e.id; });
      if (typeof d.rev === 'number') since = d.rev;
      S.ready = true; emit();
    }
    // a lekérdezés kis átfedéssel fut, hogy a még le nem zárt tranzakciók változásai se vesszenek el
    async function refresh(full) {
      if (!sess || busy) return; busy = true;
      try {
        if (!full && Date.now() - lastFull > 300000) full = true; // 5 percenként teljes újraszinkron (a kiesett/hibás ciklusok ellen is)
        const d = await rpc('tdw_state', { p_s: sess.t, p_since: full ? 0 : Math.max(1, since - 300), p_ev: full ? 0 : evMax });
        if (full) lastFull = Date.now();
        if (sess && d.role === sess.role) apply(d, full);
        S.error = null;
      } catch (e) { if (full) throw e; /* hálózati hiba: a következő ciklus újrapróbálja */ }
      finally { busy = false; }
    }
    let n = 0; const tick = () => { n++; if (!document.hidden || n % 4 === 0) refresh(false); };
    return {
      name: 'supabase',
      onLost(f) { lostCbs.add(f); },
      async load() { /* adatot csak érvényes munkamenettel töltünk */ },
      async use(s) {
        if (sess && sess.t === s.t) return ready;
        clearInterval(timer); sess = s; resetState();
        ready = (async () => { try { await refresh(true); } catch (e) { sess = null; throw e; } if (!sess) return false; timer = setInterval(tick, 3000); return true; })();
        return ready;
      },
      async loginLead(code) { const d = await rpc('tdw_login_lead', { p_code: code }); return { t: d.session, role: 'lead' }; },
      async loginCop(code) { const d = await rpc('tdw_login_cop', { p_code: code }); return { t: d.session, role: 'cop' }; },
      async loginGroup(a) { const d = await rpc('tdw_login_group', { p_token: a.token || null, p_group: a.group || null }); return { t: d.session, role: 'group', gid: d.group_id }; },
      async logout(s) { try { await sb.rpc('tdw_logout', { p_s: s.t }); } catch (_) { } if (sess && sess.t === s.t) { sess = null; clearInterval(timer); timer = null; resetState(); emit(); } },
      async send(m) { const data = await rpc('tdw_send', { p_s: sess.t, p: m }); upsertMsg(data); return data; },
      async upload(file) {
        const r = await fetch(CFG.supabaseUrl + '/functions/v1/tdw-media', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-tdw-session': sess.t, 'x-file-name': encodeURIComponent(file.name || 'fajl') }, body: file });
        let j = {}; try { j = await r.json(); } catch (_) { }
        if (!r.ok || !j.url) throw mapErr(new Error(j.error || ('HTTP ' + r.status)));
        return { url: j.url, name: j.name || file.name };
      },
      async react(message_id, actor, emoji, on) {
        const row = { message_id, actor, emoji, created_at: new Date().toISOString() };
        if (on) addReact(row); else delReact(row);
        try { await rpc('tdw_react', { p_s: sess.t, p_mid: message_id, p_emoji: emoji, p_on: on }); } catch (e) { if (on) delReact(row); else addReact(row); throw e; }
      },
      async markRead(message_id, group_id, opened) {
        const now = new Date().toISOString(), ex = S.reads.find(x => x.message_id === message_id && x.group_id === group_id);
        if (ex && (!opened || ex.opened_at)) return;
        upsertRead({ message_id, group_id, seen_at: now, opened_at: opened ? now : null });
        try { await rpc('tdw_mark_read', { p_s: sess.t, p_mid: message_id, p_opened: !!opened }); } catch (e) { console.warn(e); }
      },
      async beat() { await rpc('tdw_beat', S_()); },
      async loginEvent() { /* a belépést a szerver naplózza */ },
      async setHelp(gid, v) { upsertGroup({ id: gid, help: v }); await rpc('tdw_set_help', { p_s: sess.t, p_v: v }); },
      async patchMsg(id, patch) { upsertMsg(Object.assign({ id }, patch)); await rpc('tdw_patch_msg', { p_s: sess.t, p_id: id, p_patch: patch }); },
      async logEvent(group_id, type, data) { try { await rpc('tdw_log_event', { p_s: sess.t, p_type: type, p_data: data || null }); } catch (e) { console.warn(e); } },
      async setCfg(key, value) { await rpc('tdw_set_cfg', { p_s: sess.t, p_key: key, p_value: value }); applyCfg(key, value); },
      async setCodes(lead, cop) { await rpc('tdw_set_codes', { p_s: sess.t, p_lead: lead || null, p_cop: cop || null }); },
      async setOpenLogin(v) { await rpc('tdw_set_open_login', { p_s: sess.t, p_v: !!v }); S.cfg.openLogin = !!v; emit(); },
      async regenCodes() { await rpc('tdw_regen_codes', S_()); await refresh(true); },
      async jemmTicket() { return rpc('tdw_jemm_ticket', S_()); },
      async addIncident(r) { const data = await rpc('tdw_add_incident', { p_s: sess.t, p: r }); upsertInc(data); return data; },
      async patchIncident(id, patch) { await rpc('tdw_patch_incident', { p_s: sess.t, p_id: id, p_patch: patch }); if (patch.deleted) { S.incidents = S.incidents.filter(x => x.id !== id); emit(); } else upsertInc(Object.assign({ id }, patch)); },
      async reloadEvents() { await refresh(true); }
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
      S.groups = d.groups.map(normG); S.msgs = d.msgs; S.reacts = d.reacts; S.events = d.events; S.reads = d.reads || []; S.incidents = (d.incidents || []).filter(x => !x.deleted);
      Object.keys(d.cfg).forEach(k => applyCfg(k, d.cfg[k]));
    }
    function mutate(fn) {
      const d = read(); fn(d);
      try { localStorage.setItem(LK, JSON.stringify(d)); } catch (e) { throw new Error('A helyi demó tárhelye megtelt (nagy média).'); }
      pull(); if (bc) bc.postMessage('x'); emit();
    }
    return {
      name: 'local',
      onLost() { },
      async use() { return true; },
      async loginLead() { return { t: 'local-lead', role: 'lead' }; },
      async loginCop() { return { t: 'local-cop', role: 'cop' }; },
      async loginGroup(a) { const g = S.groups.find(x => (a.token && x.token === a.token) || (a.group && x.id === a.group)); if (!g) throw new Error('Hibás belépési kód.'); return { t: 'local-' + g.id, role: 'group', gid: g.id }; },
      async logout() { },
      async beat(gid) {
        const g = S.groups.find(x => x.id === gid); if (!g) return;
        const now = Date.now(), prev = g.last_seen ? new Date(g.last_seen).getTime() : 0, gap = (now - prev) / 1000, add = prev && gap <= 90 ? Math.round(gap) : 0;
        mutate(d => { const x = d.groups.find(y => y.id === gid); Object.assign(x, { last_seen: new Date(now).toISOString(), active_sec: (x.active_sec || 0) + add }); });
      },
      async loginEvent(gid) { mutate(d => { const x = d.groups.find(y => y.id === gid); Object.assign(x, { last_login: new Date().toISOString(), last_seen: new Date().toISOString() }); d.events.push({ id: Date.now() + Math.random(), ts: new Date().toISOString(), group_id: gid, type: 'login', data: null }); }); },
      async setHelp(gid, v) { mutate(d => { Object.assign(d.groups.find(y => y.id === gid), { help: v }); if (v) d.events.push({ id: Date.now() + Math.random(), ts: new Date().toISOString(), group_id: gid, type: 'help', data: null }); }); },
      async setCodes() { }, async setOpenLogin(v) { S.cfg.openLogin = !!v; emit(); }, async regenCodes() { }, async jemmTicket() { return 'local'; },
      async load() {
        if (!read()) {
          const groups = window.ORG.list.map(o => ({ id: o.id, branch: o.section, letter: o.short, name: o.name, token: 'tdw-' + o.id, last_seen: null, last_login: null, active_sec: 0, help: false, created_at: new Date().toISOString() }));
          localStorage.setItem(LK, JSON.stringify({ groups, msgs: [], reacts: [], events: [], incidents: [], cfg: { exercise: { name: 'TERDEF gyakorlat – helyi demó', yellow_min: 5, red_min: 15 } } }));
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
      async markRead(message_id, group_id, opened) {
        const now = new Date().toISOString(), ex = S.reads.find(x => x.message_id === message_id && x.group_id === group_id);
        if (ex && (!opened || ex.opened_at)) return;
        mutate(d => { d.reads = d.reads || []; let r = d.reads.find(x => x.message_id === message_id && x.group_id === group_id); if (!r) d.reads.push(r = { message_id, group_id, seen_at: now, opened_at: null }); if (opened && !r.opened_at) r.opened_at = now; });
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
    async beat(gid) { return B.beat(gid); },
    async groupLogged(gid) { return B.loginEvent(gid); },
    async setHelp(gid, v) { return B.setHelp(gid, v); },
    patchMsg: (id, p) => B.patchMsg(id, p),
    logEvent: (g, t, d) => B.logEvent(g, t, d),
    markRead: (m, g, o) => B.markRead(m, g, o),
    setCfg: (k, v) => B.setCfg(k, v),
    reloadEvents: () => B.reloadEvents(),
    setCodes: (l, c) => B.setCodes(l, c), setOpenLogin: v => B.setOpenLogin(v), regenCodes: () => B.regenCodes(), jemmTicket: () => B.jemmTicket(),
    /* ---------- munkamenet-kezelés (a jogosultságot mindig a szerver ellenőrzi) ---------- */
    role: null, gid: null,
    onAuthLost(f) { B.onLost(f); },
    stored(role) { try { return JSON.parse(localStorage.getItem('tdw-sess-' + role)); } catch (_) { return null; } },
    async activate(want) {
      const order = want === 'copview' ? ['lead', 'cop'] : [want];
      for (const r of order) {
        const sess = API.stored(r) || (S.mode === 'local' ? { t: 'local-' + r, role: r } : null); if (!sess) continue;
        try { if (await B.use(sess)) { API.role = sess.role; API.gid = sess.gid || null; return true; } } catch (e) { S.error = e.message || String(e); return false; }
      }
      API.role = null; API.gid = null; return false;
    },
    async signIn(kind, arg) {
      const sess = kind === 'lead' ? await B.loginLead(arg) : kind === 'cop' ? await B.loginCop(arg) : await B.loginGroup(arg);
      try { localStorage.setItem('tdw-sess-' + sess.role, JSON.stringify(sess)); } catch (_) { }
      return sess;
    },
    async logout(role) { const s = API.stored(role); try { localStorage.removeItem('tdw-sess-' + role); } catch (_) { } if (s) await B.logout(s); if (API.role === role) { API.role = null; API.gid = null; } }
  };
  window.LWP = API;
})();
