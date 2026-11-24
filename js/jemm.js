/* TERDEF wargaming platform – JEMM generátor (Event / Storyline / Inject) + bejátszás az incidens-térképre */
(function () {
  'use strict';
  const LWP = window.LWP, U = window.UI, ORG = window.ORG, S = LWP.S, CFG = window.LWP_CONFIG;
  const { esc, $, $$ } = U;
  const h = html => { const t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstElementChild; };
  const norm = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const uid = () => LWP.uuid().slice(0, 8);

  /* ---------- földrajzi segéd: megyék + települések ---------- */
  const COUNTIES = Object.keys(ORG.SEAT).filter(c => c !== 'Pest' || true);
  const TOWNS = {
    'Paks': [46.574, 18.8537], 'Dunaújváros': [46.9619, 18.9355], 'Százhalombatta': [47.3187, 18.9139], 'Ajka': [47.1, 17.55],
    'Sopron': [47.6817, 16.5845], 'Mohács': [45.993, 18.683], 'Baja': [46.1806, 18.9544], 'Hódmezővásárhely': [46.4181, 20.33],
    'Gyula': [46.6486, 21.2833], 'Szentgotthárd': [46.9523, 16.2742], 'Záhony': [48.4076, 22.1747], 'Tokaj': [48.1167, 21.4083],
    'Komárom': [47.7433, 18.1189], 'Esztergom': [47.7928, 18.7406], 'Gödöllő': [47.5972, 19.3608], 'Vác': [47.7759, 19.136],
    'Siófok': [46.9041, 18.0579], 'Keszthely': [46.7684, 17.2432], 'Nagykanizsa': [46.459, 16.9897], 'Cegléd': [47.1727, 19.7967],
    'Szentes': [46.6537, 20.2615], 'Orosháza': [46.5667, 20.6667], 'Kiskunfélegyháza': [46.7117, 19.8517], 'Gyöngyös': [47.7821, 19.9276],
    'Hatvan': [47.6667, 19.6833], 'Ózd': [48.2167, 20.2833], 'Kazincbarcika': [48.25, 20.6167], 'Sátoraljaújhely': [48.3947, 21.6561],
    'Mosonmagyaróvár': [47.8667, 17.2667], 'Tata': [47.65, 18.3167], 'Megyeri híd': [47.6003, 19.0853], 'Ferihegy': [47.4369, 19.2556],
    'Pápa': [47.3303, 17.4686], 'Kecel': [46.5266, 19.2469], 'Makó': [46.2194, 20.4806], 'Szolnok': [47.1621, 20.1825],
    'Kiskunhalas': [46.4337, 19.4833], 'Debrecen': [47.5316, 21.6273], 'Miskolc': [48.1035, 20.7784], 'Pécs': [46.0727, 18.2323],
    'Szeged': [46.253, 20.1414], 'Győr': [47.6875, 17.6504], 'Kecskemét': [46.8964, 19.6897], 'Nyíregyháza': [47.9554, 21.7167],
    'Székesfehérvár': [47.186, 18.4221], 'Szombathely': [47.2307, 16.6218], 'Veszprém': [47.0933, 17.9093], 'Zalaegerszeg': [46.8417, 16.8416],
    'Kaposvár': [46.3594, 17.7968], 'Szekszárd': [46.3474, 18.7062], 'Eger': [47.9025, 20.3772], 'Salgótarján': [48.0936, 19.8003],
    'Békéscsaba': [46.6847, 21.0877], 'Tatabánya': [47.5849, 18.3948], 'Budapest': [47.4979, 19.0402], 'Balaton': [46.83, 17.75]
  };
  const SEVS = ['alacsony', 'közepes', 'magas', 'kritikus'];
  function guessSev(t) { const n = norm(t); if (/kritikus|critical|veszelyhelyzet|robban|tamad/.test(n)) return 'kritikus'; if (/magas|high|sulyos/.test(n)) return 'magas'; if (/alacsony|low|enyhe/.test(n)) return 'alacsony'; return 'közepes'; }
  function geoFromText(txt) {
    const n = norm(txt); if (!n.trim()) return null;
    for (const c of COUNTIES) if (n.includes(norm(c))) { const t = Object.keys(TOWNS).find(k => n.includes(norm(k))); if (t) return { place: t, lat: TOWNS[t][0], lon: TOWNS[t][1], county: window.TDWMap.countyAt(TOWNS[t][0], TOWNS[t][1]) || c, approx: false }; const ct = window.TDWMap.centroid(c); if (ct) return { place: '', lat: ct[0], lon: ct[1], county: c, approx: true }; }
    const t = Object.keys(TOWNS).sort((a, b) => b.length - a.length).find(k => n.includes(norm(k)));
    if (t) return { place: t, lat: TOWNS[t][0], lon: TOWNS[t][1], county: window.TDWMap.countyAt(TOWNS[t][0], TOWNS[t][1]), approx: false };
    return null;
  }

  /* ---------- a JEMM kimenet (JSON vagy szöveg) rugalmas beolvasása ---------- */
  function extractJSON(text) {
    let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    try { return JSON.parse(t); } catch (_) { }
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (m) { try { return JSON.parse(m[1]); } catch (_) { } }
    const i1 = t.indexOf('{'), i2 = t.indexOf('['); const st = i1 >= 0 && i2 >= 0 ? Math.min(i1, i2) : Math.max(i1, i2);
    if (st >= 0) { const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']')); try { return JSON.parse(t.slice(st, end + 1)); } catch (_) { } }
    return null;
  }
  const keyOf = (o, re) => Object.keys(o || {}).find(k => re.test(norm(k)));
  const str = v => v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(str).join('; ') : typeof v === 'object' ? Object.keys(v).map(k => k + ': ' + str(v[k])).join('; ') : String(v);
  const get = (o, re) => { const k = keyOf(o, re); return k ? o[k] : undefined; };
  const arr = (o, re) => { const k = Object.keys(o || {}).find(x => re.test(norm(x)) && Array.isArray(o[x])); return k ? o[k] : null; };
  const numOr = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const toHtml = t => t ? '<p>' + esc(t).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>' : '';

  function normInject(x, ctx) {
    if (typeof x === 'string') x = { description: x };
    const loc = get(x, /^(location|helyszin|place|telepules|geo)/);
    let place = '', county = '', lat = null, lon = null;
    if (loc && typeof loc === 'object') {
      place = str(get(loc, /^(name|place|nev|telepules|helyszin|city|town)/)); county = str(get(loc, /^(county|varmegye|megye)/));
      lat = numOr(get(loc, /^(lat)/)); lon = numOr(get(loc, /^(lon|lng|long)/));
      const co = get(loc, /^(coord|koord)/); if (co && lat == null) { const m = str(co).match(/(-?\d+[.,]\d+)\D+(-?\d+[.,]\d+)/); if (m) { lat = numOr(m[1]); lon = numOr(m[2]); } }
    } else if (loc) { place = str(loc); const m = place.match(/(-?\d{2}[.,]\d+)\D+(-?\d{1,2}[.,]\d+)/); if (m) { lat = numOr(m[1]); lon = numOr(m[2]); } }
    if (lat == null) { const la = get(x, /^(lat)/), lo = get(x, /^(lon|lng)/); if (la != null) { lat = numOr(la); lon = numOr(lo); } }
    if (!county) county = str(get(x, /^(county|varmegye|megye)/));
    const title = str(get(x, /^(title|cim|name|nev|incident)/)) || str(get(x, /^(description|leiras|content|tartalom)/)).slice(0, 80);
    const desc = str(get(x, /^(description|leiras|content|tartalom|text|szoveg)/));
    let approx = false;
    if (lat == null || lon == null || lat < 45.5 || lat > 49 || lon < 15.8 || lon > 23) {
      lat = lon = null;
      const g = geoFromText(place + ' ' + county) || geoFromText(title + ' ' + desc);
      if (g) { lat = g.lat; lon = g.lon; place = place || g.place; county = county || g.county || ''; approx = g.approx; }
    }
    if (!county && lat != null) county = window.TDWMap.countyAt(lat, lon) || '';
    let unit = str(get(x, /^(responsibleunit|felelos|unit|szervezet)/));
    const un = norm(unit); const found = unit && ORG.list.find(o => norm(o.name).includes(un) || un.includes(norm(o.short)));
    unit = found ? found.id : '';
    if (!unit && county) { const u = ORG.unitsOfCounty(county); unit = u.zaszlo || ''; }
    return {
      id: uid(), code: str(get(x, /^(code|kod|id|azonosito)/)) || ctx.code, title: title.trim(), timing: str(get(x, /^(timing|idozites|ido|time)/)),
      sender: str(get(x, /^(sender|source|from|kuldo|feladó|feladi)/)), recipient: str(get(x, /^(recipient|to|cimzett|target)/)), means: str(get(x, /^(means|format|csatorna|eszkoz|channel)/)),
      desc, expected: str(get(x, /^(expectedaction|elvart|expected)/)), severity: guessSev(str(get(x, /^(severity|prioritas|priority|sulyossag)/))), place, county, lat, lon, approx, unit, played: []
    };
  }
  function normStoryline(s, ctx) {
    const injs = arr(s, /inject|incident/) || [];
    const flat = [];
    injs.forEach((i, ix) => { const sub = i && typeof i === 'object' && arr(i, /inject/); if (sub) sub.forEach((j, jx) => flat.push(normInject(Object.assign({ Location: i.Location || i.Helyszín }, typeof j === 'object' ? j : { Description: j }), { code: ctx.code + '-I' + (flat.length + 1) }))); else flat.push(normInject(i, { code: ctx.code + '-I' + (ix + 1) })); });
    return { id: uid(), code: str(get(s, /^(code|kod|id)/)) || ctx.code, title: str(get(s, /^(title|cim|name|nev)/)), desc: str(get(s, /^(description|leiras|summary)/)), injects: flat };
  }
  function normalizePlan(raw, meta) {
    let root = raw; if (Array.isArray(root) && root.length === 1 && root[0] && typeof root[0] === 'object' && !Array.isArray(root[0]) && Object.keys(root[0]).some(k => /event|exercise/.test(norm(k)))) root = root[0];
    let ex = root && !Array.isArray(root) ? (get(root, /^exercise|gyakorlat/) || {}) : {};
    let events = Array.isArray(root) ? root : (arr(root, /^events?$|esemeny/) || (ex && arr(ex, /^events?$|esemeny/)) || (get(root, /mel|main/) && arr(get(root, /mel|main/), /event/)) || null);
    if (!events && root && !Array.isArray(root)) { const k = Object.keys(root).find(x => Array.isArray(root[x])); if (k) events = root[k]; }
    if (!events) return null;
    const evs = events.map((e, ei) => {
      const code = 'E' + (ei + 1);
      let sls = arr(e, /storyline/);
      if (!sls) sls = [e]; // storyline-szint nélküli esemény
      return { id: uid(), code: str(get(e, /^(code|kod|id)/)) || code, title: str(get(e, /^(title|cim|name|nev)/)) || ('Event ' + (ei + 1)), desc: str(get(e, /^(description|leiras|summary)/)), storylines: sls.map((s, si) => normStoryline(s, { code: code + '-S' + (si + 1) })) };
    });
    const n = evs.reduce((a, e) => a + e.storylines.reduce((b, s) => b + s.injects.length, 0), 0);
    if (!n) return null;
    return { exercise: { name: str(get(ex, /^(name|nev)/)) || meta.name, to: str(get(ex, /^trainingobjective|celkituzes/)) || meta.to }, events: evs, meta };
  }

  /* ---------- többszörös választó (chipes) ---------- */
  function MultiSel(host, o) {
    host.classList.add('msel'); const sel = o.selected = o.selected || [];
    host.innerHTML = '<div class="msel-t" tabindex="0"><span class="msel-ph"></span><span class="msel-ar">▾</span></div>';
    const trig = host.firstElementChild; let drop = null;
    const label = t => t.length > 34 ? t.slice(0, 32) + '…' : t;
    function paint() {
      trig.querySelectorAll('.msel-tag').forEach(x => x.remove());
      const ph = trig.querySelector('.msel-ph'); ph.textContent = sel.length ? '' : o.placeholder; ph.style.display = sel.length ? 'none' : '';
      sel.forEach(v => { const t = h(`<span class="msel-tag">${esc(label(o.labelOf ? o.labelOf(v) : v))}<i data-x="${esc(v)}">×</i></span>`); trig.insertBefore(t, trig.querySelector('.msel-ar')); });
      o.onChange && o.onChange(sel);
    }
    function toggle(v) { const i = sel.indexOf(v); if (i >= 0) sel.splice(i, 1); else sel.push(v); paint(); if (drop) fill(); }
    function pos() { const r = trig.getBoundingClientRect(); Object.assign(drop.style, { left: r.left + 'px', top: r.bottom + 'px', width: r.width + 'px' }); }
    function fill() {
      drop.querySelectorAll('.msel-it').forEach(x => x.remove());
      const add = drop.querySelector('.msel-add');
      o.options().forEach(op => { const v = op.v; const d = h(`<div class="msel-it${sel.includes(v) ? ' on' : ''}"><span class="msel-ck">${sel.includes(v) ? '✓' : ''}</span>${esc(op.l)}</div>`); d.addEventListener('mousedown', e => { e.preventDefault(); toggle(v); }); drop.insertBefore(d, add); });
    }
    function open() {
      drop = h(`<div class="msel-drop"><div class="msel-add"><input placeholder="${esc(o.addPh || 'Új elem…')}"><button class="btn sm">+ Hozzáad</button></div></div>`);
      document.body.appendChild(drop); fill(); pos(); trig.classList.add('open');
      const inp = drop.querySelector('input'), add = () => { const v = inp.value.trim(); if (v) { o.add && o.add(v); if (!sel.includes(v)) sel.push(v); inp.value = ''; paint(); fill(); } };
      drop.querySelector('button').onclick = add; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } e.stopPropagation(); };
      setTimeout(() => document.addEventListener('mousedown', away), 0); window.addEventListener('resize', pos, true); document.addEventListener('scroll', pos, true);
    }
    function away(e) { const pth = e.composedPath ? e.composedPath() : []; if (drop && !pth.includes(drop) && !pth.includes(trig)) close(); }
    function close() { if (!drop) return; drop.remove(); drop = null; trig.classList.remove('open'); document.removeEventListener('mousedown', away); window.removeEventListener('resize', pos, true); document.removeEventListener('scroll', pos, true); }
    trig.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { toggle(x.dataset.x); return; } drop ? close() : open(); });
    paint(); return { get: () => sel.slice(), close, set(a) { sel.splice(0, sel.length, ...a); paint(); } };
  }

  /* ---------- bejátszás ---------- */
  /* ---------- területi hatály: a helyszín mindig a címzett szervezeti elem(ek) vármegyéiben legyen ---------- */
  function territory(ids) {
    if (!ids || !ids.length) return null;
    const s = new Set();
    ids.forEach(id => { const o = ORG.get(id); if (!o) return; if (o.level === 'thp') ORG.list.forEach(x => x.county && s.add(x.county)); else (o.counties || []).forEach(c => s.add(c)); });
    return s;
  }
  const inTerr = (T, county) => !T || (county && T.has(county));
  function townIn(county, k) {
    const ts = Object.keys(TOWNS).filter(n => window.TDWMap.countyAt(TOWNS[n][0], TOWNS[n][1]) === county);
    if (ts.length) { const n = ts[k % ts.length]; return { place: n, lat: TOWNS[n][0], lon: TOWNS[n][1] }; }
    const c = ORG.SEAT && ORG.SEAT[county]; return c ? { place: county + ' vármegye', lat: c[0], lon: c[1] } : null;
  }
  function terrText(ids) {
    const T = territory(ids); if (!T) return '';
    const rows = ids.map(id => { const o = ORG.get(id); if (!o) return ''; if (o.level === 'thp') return o.name + ': az ország teljes területe'; if (o.level === 'ezred') return o.name + ': ' + o.counties.map(c => { const z = ORG.list.find(x => x.level === 'zaszlo' && x.county === c); return c + ' vármegye (' + (z ? z.num + '. TVZ' : '') + ')'; }).join(', '); return o.name + ': ' + o.county + ' vármegye'; }).filter(Boolean);
    return 'TERÜLETI HATÁLY (KÖTELEZŐ, ELSŐDLEGES SZEMPONT):\n' + rows.map(r => '  - ' + r).join('\n') + '\nEngedélyezett vármegyék: ' + Array.from(T).join(', ') + '.\nSZABÁLY: minden Inject Location (Name, County, koordináta) mezője KIZÁRÓLAG a fenti vármegyék egyikében lehet, és a szövegben (Title, Description) sem szerepelhet más vármegyében lévő település vagy objektum. A ResponsibleUnit az a zászlóalj legyen, amelynek vármegyéjében a helyszín található. Más szervezeti elem illetékességi területére eső incidenst TILOS generálni.\n\n';
  }
  /* a generált tervben a hatályon kívüli helyszíneket a TA területére igazítja, és megjelöli */
  function enforceTerritory(plan, ids) {
    const T = territory(ids); if (!T || !plan) return 0; const cs = Array.from(T); let n = 0, k = 0;
    plan.events.forEach(e => e.storylines.forEach(sl => sl.injects.forEach(i => {
      const uo = ORG.get(i.unit), uOut = uo && uo.county && !T.has(uo.county);
      const bad = (i.county && !T.has(i.county)) || (i.lat != null && !i.county);
      if (!bad) { if (i.county && (!uo || uOut || (uo.county && uo.county !== i.county))) i.unit = ORG.unitsOfCounty(i.county).zaszlo || i.unit; return; }
      const old = [i.place, i.county].filter(Boolean).join(', ');
      const pref = uo && uo.county && T.has(uo.county) ? uo.county : cs[k++ % cs.length];
      const t = townIn(pref, k); if (!t) return;
      Object.assign(i, { place: t.place, lat: t.lat, lon: t.lon, county: pref, approx: true, unit: ORG.unitsOfCounty(pref).zaszlo || i.unit });
      i.moved = 'Hatályon kívüli helyszín (' + (old || '–') + ') áthelyezve ide: ' + t.place + ' (' + pref + '). Ellenőrizd, hogy a szöveg nem említ más települést.'; n++;
    })));
    return n;
  }
  function expandTargets(ids, withSubs) {
    const set = new Set(ids);
    if (withSubs) ids.forEach(id => { const o = ORG.get(id); if (!o) return; if (o.level === 'thp') ORG.list.forEach(x => set.add(x.id)); else if (o.level === 'ezred') ORG.list.filter(x => x.parent === id).forEach(x => set.add(x.id)); });
    return Array.from(set).filter(id => LWP.group(id));
  }
  async function playIncident(d) {
    // d: {title, bodyHtml, lat, lon, county, place, unit, severity, targets:'all'|[ids], showCop, alarm, ref}
    const inc = await LWP.addIncident({ title: d.title, body: d.bodyHtml, lat: d.lat, lon: d.lon, county: d.county || null, place: d.place || null, unit_id: d.unit || null, severity: d.severity || 'közepes', targets: d.targets, show_cop: d.showCop !== false, ref: d.ref || null });
    const html = `<h3>${esc(d.title)}</h3>${d.bodyHtml}<p>📍 <b>${esc(d.place || d.county || '')}</b>${d.place && d.county ? ' (' + esc(d.county) + ')' : ''} · ${esc(LWP.incCode(inc))}</p>`;
    const mk = ch => LWP.send({ channel: ch, author_type: 'lead', author_id: 'lead', kind: 'event', body: html, media_url: null, media_name: null, media_type: null, pinned: !!d.alarm, incident: inc.id });
    if (d.showCop !== false) await mk('cop');
    const ids = d.targets === 'all' ? S.groups.map(g => g.id) : d.targets;
    for (const id of ids) await mk('lead:' + id);
    await LWP.logEvent(null, 'inject', { code: d.ref && d.ref.inject || null, incident: inc.id, to: d.targets === 'all' ? 'all' : ids.join(',') });
    return inc;
  }

  /* ---------- JEMM lap a gyakorlatvezetői felületen ---------- */
  const CATS = ['Terrorizmus', 'Kémtevékenység / Hírszerzés', 'Szabotázs', 'Felforgatás', 'Szervezett bűnözés', 'Kritikus infrastruktúra elleni támadás', 'Tiltott médiatevékenység', 'Megtévesztés'];
  function leadJemm(L, root) {
    const J = L.jemm = L.jemm || { cats: ['Szabotázs'], extraCats: [], ta: ['thp'], busy: false, open: new Set(), err: null };
    const allCats = () => CATS.concat(J.extraCats);
    root.innerHTML = `<div class="jemm">
      <aside class="jm-form">
        <div class="ph"><h2>JEMM generátor</h2><span class="muted">Scenario → Event → Storyline → Inject</span></div>
        <div class="jm-body">
          <label>Kiképzési célkitűzés (TO) *<textarea id="jto" rows="4" placeholder="Pl.: Az MH THP és alárendeltjei együttműködésének tesztelése kritikus infrastruktúra elleni hibrid fenyegetés esetén…">${esc(J.to || '')}</textarea></label>
          <label>Kiképzési célállomány (TA)<div id="jta"></div></label>
          <label>Eseménysor jellege<div id="jct"></div></label>
          <div class="jm-grid">
            <label>Events<select id="jev">${[...Array(10)].map((_, i) => `<option${(J.ev || 3) == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>
            <label>Storyline / Event<select id="jsl">${[...Array(10)].map((_, i) => `<option${(J.sl || 2) == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>
            <label>Inject / Storyline<select id="jin">${[...Array(10)].map((_, i) => `<option${(J.inj || 3) == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          </div>
          <label>Kiegészítő információ<textarea id="jai" rows="3" placeholder="Pl.: időkeret 72 óra; a gyakorlat fikciós időben játszódik; hangsúly a hadkiegészítésen…">${esc(J.ai || '')}</textarea></label>
          <button class="btn pri jm-go" id="jgo">▶ Generálás</button>
          <p class="muted jm-note">A generálás az n8n JEMM Planner munkafolyamatot hívja, ez több percig is eltarthat. A helyszínek (település, vármegye, koordináta) a térképi bejátszáshoz kellenek – hiányzó helyet kézzel is kijelölhetsz.</p>
        </div>
      </aside>
      <section class="jm-out"><div class="ph"><h2>Generált terv</h2><span class="muted" id="jmeta"></span><span class="jm-tools"><button class="btn sm" id="jexp" hidden>Export (JSON)</button><button class="btn sm warn" id="jclr" hidden>Terv törlése</button></span></div><div id="jplan" class="jm-plan"></div></section></div>`;
    const taMS = MultiSel($('#jta', root), { placeholder: '— Válasszon szervezeti elemet —', selected: J.ta, options: () => ORG.list.map(o => ({ v: o.id, l: (o.level === 'zaszlo' ? '   ' : '') + o.name })), labelOf: v => (ORG.get(v) || { short: v }).short, onChange: s => { J.ta = s; }, addPh: 'Új célállomány…', add: v => { J.ta.push(v); } });
    // egyedi TA szöveg (nem szervezeti azonosító) esetén a labelOf az eredetit mutatja
    const ctMS = MultiSel($('#jct', root), { placeholder: '— Válasszon kategóriát —', selected: J.cats, options: () => allCats().map(c => ({ v: c, l: c })), onChange: s => { J.cats = s; }, addPh: 'Új kategória…', add: v => { if (!allCats().includes(v)) J.extraCats.push(v); } });
    ['jto', 'jai'].forEach(id => $('#' + id, root).addEventListener('input', e => { J[id === 'jto' ? 'to' : 'ai'] = e.target.value; }));
    [['jev', 'ev'], ['jsl', 'sl'], ['jin', 'inj']].forEach(([id, k]) => $('#' + id, root).addEventListener('change', e => { J[k] = +e.target.value; }));
    const taNames = () => J.ta.map(v => ORG.get(v) ? ORG.get(v).name : v).join(', ') || 'Nincs megadva';

    /* --- generálás --- */
    $('#jgo', root).onclick = async () => {
      const to = ($('#jto', root).value || '').trim(); if (!to) { U.toast('A kiképzési célkitűzés megadása kötelező.'); return; }
      const ev = +$('#jev', root).value, sl = +$('#jsl', root).value, inj = +$('#jin', root).value, extra = ($('#jai', root).value || '').trim(), types = J.cats.join(', ') || 'Nincs megadva', ta = taNames();
      const msg = 'JEMM GENERATOR — KÉRÉS (BI-SCD 075-003)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nKIKÉPZÉSI CÉLKITŰZÉS:\n' + to + '\n\nKIKÉPZÉSI CÉLÁLLOMÁNY (TA): ' + ta + '\n\n' + terrText(J.ta) + 'ESEMÉNYSOR JELLEGE: ' + types + '\n\nSTRUKTÚRA:\n  - Events száma: ' + ev + '\n  - Storyline-ok / Event: ' + sl + '\n  - Inject-ek / Storyline: ' + inj + '\n\n' + (extra ? 'KIEGÉSZÍTŐ INFORMÁCIÓ:\n' + extra + '\n\n' : '') +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nKérem generálja le a fenti paraméterek alapján a teljes MEL/MIL struktúrát, storyline-okat és inject-eket a BI-SCD 075-003 direktíva szellemében. A generált tartalom legyen szorosan igazítva a megadott kiképzési célállományhoz (TA): ' + ta + '. A tevékenységek, szerepkörök, struktúrák és felelősségek tükrözzék az adott szervezet valós feladat- és hatáskörét. Magyarul, katonai formátumban.\n\n' +
        'KIMENETI FORMÁTUM (kötelező): kizárólag egyetlen érvényes JSON objektumot adj vissza, magyarázó szöveg és markdown nélkül, pontosan ezzel a szerkezettel:\n{"Exercise":{"Name":"…","TrainingObjective":"…"},"Events":[{"Code":"E1","Title":"…","Description":"…","Storylines":[{"Code":"E1-S1","Title":"…","Description":"…","Injects":[{"Code":"E1-S1-I1","Title":"…","Timing":"STARTEX+02:00","Sender":"HICON","Recipient":"…","Means":"Chat/Radio/Intel Report…","Description":"…","ExpectedAction":"…","Severity":"alacsony|közepes|magas|kritikus","Location":{"Name":"valós magyarországi település vagy objektum","County":"vármegye","Lat":47.1234,"Lon":19.1234},"ResponsibleUnit":"területvédelmi ezred vagy zászlóalj"}]}]}]}\nMinden Inject-hez kötelező a valós magyarországi Location (település/objektum, vármegye, WGS84 koordináta). A ResponsibleUnit a helyszín szerint illetékes területvédelmi zászlóalj/ezred legyen.';
      J.busy = true; J.err = null; drawPlan();
      try {
        const ac = new AbortController(), to_ = setTimeout(() => ac.abort(), 900000);
        const r = await fetch(CFG.jemmWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatInput: msg, sessionId: 'tdw-' + Date.now() }), signal: ac.signal });
        clearTimeout(to_); if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + r.statusText);
        let result; const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) { const d = await r.json(); result = Array.isArray(d) ? (d[0] && (d[0].output || d[0].text || d[0].message || d[0].response)) || JSON.stringify(d) : (d.output || d.response || d.result || d.text || d.message || JSON.stringify(d)); } else result = await r.text();
        const parsed = typeof result === 'object' ? result : extractJSON(result);
        const plan = parsed && normalizePlan(parsed, { name: S.cfg.name, to, ta: J.ta.slice(), cats: J.cats.slice(), generated: new Date().toISOString() });
        if (!plan) { J.raw = String(result); throw new Error('A JEMM kimenete nem értelmezhető Event/Storyline/Inject struktúraként. A nyers kimenet lent látható.'); }
        const moved = enforceTerritory(plan, J.ta);
        plan.meta = { to, ta: J.ta.slice(), cats: J.cats.slice(), generated: new Date().toISOString() };
        J.raw = null; await LWP.setCfg('jemm', plan); U.toast('A terv elkészült és mentésre került.' + (moved ? ' ' + moved + ' inject helyszíne a hatályos területre lett igazítva.' : ''));
      } catch (e) { J.err = e.name === 'AbortError' ? 'Időtúllépés (15 perc).' : (e.message || String(e)); }
      J.busy = false; sig = ''; drawPlan();
    };

    /* --- terv megjelenítése --- */
    let sig = '', saveT = null;
    const plan = () => (S.cfg.jemm && S.cfg.jemm.events ? S.cfg.jemm : null);
    const savePlan = () => { clearTimeout(saveT); saveT = setTimeout(() => LWP.setCfg('jemm', plan()).catch(e => U.toast(e.message)), 700); };
    const unitOpts = sel => '<option value="">— nincs —</option>' + ORG.list.map(o => `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${esc(o.short)} · ${esc(o.name.replace(/^MH /, ''))}</option>`).join('');
    function injHTML(inj, key) {
      const loc = inj.lat != null;
      return `<div class="jinj" data-k="${key}" data-i="${inj.id}"><div class="jinj-h"><span class="ip-code" style="background:${window.TDWMap.sev(inj.severity).c}">${esc(inj.code)}</span><b>${esc(inj.title)}</b>${inj.played.length ? `<span class="badge ok">bejátszva ×${inj.played.length}</span>` : ''}${inj.timing ? `<span class="muted">⏱ ${esc(inj.timing)}</span>` : ''}</div>
        <div class="jinj-m muted">${inj.sender ? 'Küldő: ' + esc(inj.sender) + ' · ' : ''}${inj.recipient ? 'Címzett: ' + esc(inj.recipient) + ' · ' : ''}${inj.means ? 'Csatorna: ' + esc(inj.means) : ''}</div>
        <div class="sx">${toHtml(inj.desc)}</div>${inj.expected ? `<details class="jx"><summary>Elvárt tevékenység (csak vezetőknek)</summary><div class="sx">${toHtml(inj.expected)}</div></details>` : ''}
        ${inj.moved ? `<div class="jinj-warn">⚠ ${esc(inj.moved)}</div>` : ''}<div class="jinj-loc"><span class="${loc ? '' : 'err'}">📍 ${loc ? esc((inj.place || '–') + (inj.county ? ' (' + inj.county + ')' : '')) + ' · ' + inj.lat.toFixed(3) + ', ' + inj.lon.toFixed(3) + (inj.approx ? ' ⚠ közelítő' : '') : '⚠ nincs helyszín'}</span><button class="btn sm" data-act="pick">${loc ? 'Áthelyezés' : 'Kijelölés a térképen'}</button>
          <label>Súlyosság <select data-f="severity">${SEVS.map(s => `<option${s === inj.severity ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Felelős <select data-f="unit">${unitOpts(inj.unit)}</select></label></div>
        <div class="jinj-p"><label>Címzett <select data-f="tmode"><option value="all">Mindenki (COP + minden szervezeti elem)</option><option value="sel">Kiválasztott szervezeti elemek…</option><option value="resp">Csak a felelős szervezeti elem</option></select></label><span class="tsel" hidden></span>
          <label class="chk"><input type="checkbox" data-f="subs" checked> alárendeltekkel</label><label class="chk"><input type="checkbox" data-f="cop" checked> a COP-on is</label><label class="chk"><input type="checkbox" data-f="exp"> elvárt tev. is</label><label class="chk alm"><input type="checkbox" data-f="alm"> 🚨 kiemelt</label>
          <button class="btn pri" data-act="play">▶ Bejátszás</button></div></div>`;
    }
    function drawPlan() {
      const host = $('#jplan', root); if (!host) return;
      if (J.busy) { host.innerHTML = '<div class="jm-busy"><div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>Generálás folyamatban…</p><small>Event / Storyline / Inject – a JEMM Planner munkafolyamat dolgozik, ez néhány percig is eltarthat.</small></div>'; return; }
      const p = plan();
      $('#jexp', root).hidden = $('#jclr', root).hidden = !p;
      if (J.err) { host.innerHTML = `<div class="jm-err"><b>⚠ Hiba</b><p>${esc(J.err)}</p>${J.raw ? `<pre>${esc(J.raw.slice(0, 6000))}</pre>` : ''}</div>`; if (!p) return; }
      if (!p) { host.innerHTML = '<div class="empty">Még nincs terv. Töltsd ki a bal oldali mezőket, majd kattints a Generálásra.</div>'; $('#jmeta', root).textContent = ''; return; }
      const nInj = p.events.reduce((a, e) => a + e.storylines.reduce((b, s) => b + s.injects.length, 0), 0), nNo = p.events.reduce((a, e) => a + e.storylines.reduce((b, s) => b + s.injects.filter(i => i.lat == null).length, 0), 0);
      $('#jmeta', root).textContent = `${p.events.length} event · ${nInj} inject${nNo ? ' · ⚠ ' + nNo + ' helyszín nélkül' : ''} · ${U.fmtTime(p.meta && p.meta.generated || Date.now())}`;
      const parts = [`<div class="jm-ex"><h3>${esc(p.exercise.name || '')}</h3><p class="muted">${esc(p.exercise.to || '')}</p></div>`];
      p.events.forEach(e => {
        const ek = e.id; parts.push(`<details class="jev-d" data-k="${ek}"${J.open.has(ek) ? ' open' : ''}><summary><span class="no">${esc(e.code)}</span><b>${esc(e.title)}</b></summary>${e.desc ? `<div class="sx jdesc">${toHtml(e.desc)}</div>` : ''}`);
        e.storylines.forEach(s => {
          parts.push(`<details class="jsl-d" data-k="${s.id}"${J.open.has(s.id) ? ' open' : ''}><summary><span class="no">${esc(s.code)}</span><b>${esc(s.title)}</b><span class="muted">${s.injects.length} inject</span></summary>${s.desc ? `<div class="sx jdesc">${toHtml(s.desc)}</div>` : ''}`);
          s.injects.forEach(i => parts.push(injHTML(i, i.id))); parts.push('</details>');
        });
        parts.push('</details>');
      });
      host.innerHTML = parts.join('');
    }
    function findInj(id) { const p = plan(); for (const e of p.events) for (const s of e.storylines) for (const i of s.injects) if (i.id === id) return { e, s, i }; return null; }
    const planHost = $('#jplan', root);
    planHost.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.k) { d.open ? J.open.add(d.dataset.k) : J.open.delete(d.dataset.k); } }, true);
    planHost.addEventListener('change', e => {
      const card = e.target.closest('.jinj'); if (!card) return; const f = e.target.dataset.f; const r = findInj(card.dataset.i); if (!r) return;
      if (f === 'severity' || f === 'unit') { r.i[f] = e.target.value; savePlan(); sig = ''; if (f === 'severity') { const code = card.querySelector('.ip-code'); code.style.background = window.TDWMap.sev(r.i.severity).c; } }
      if (f === 'tmode') { const ts = card.querySelector('.tsel'); ts.hidden = e.target.value !== 'sel'; if (!ts.hidden && !ts._ms) { ts._ms = MultiSel(ts, { placeholder: '— Szervezeti elemek —', selected: [], options: () => ORG.list.map(o => ({ v: o.id, l: (o.level === 'zaszlo' ? '   ' : '') + o.name })), labelOf: v => (ORG.get(v) || { short: v }).short }); } }
    });
    planHost.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'); if (!btn) return; const card = btn.closest('.jinj'); const r = findInj(card.dataset.i); if (!r) return; const inj = r.i;
      if (btn.dataset.act === 'pick') { window.TDWMap.pick(inj.lat != null ? { lat: inj.lat, lon: inj.lon, place: inj.place } : null, loc => { Object.assign(inj, { lat: loc.lat, lon: loc.lon, place: loc.place || inj.place, county: loc.county || '', approx: false }); if (!inj.unit && loc.county) inj.unit = ORG.unitsOfCounty(loc.county).zaszlo || ''; savePlan(); sig = ''; drawPlan(); }, inj.code + ' – ' + inj.title); return; }
      if (btn.dataset.act === 'play') {
        if (inj.lat == null) { U.toast('Előbb jelöld ki az inject helyszínét a térképen.'); return; }
        const q = f => card.querySelector(`[data-f="${f}"]`); const mode = q('tmode').value;
        let targets = 'all';
        if (mode === 'sel') { const ms = card.querySelector('.tsel')._ms; const ids = ms ? ms.get() : []; if (!ids.length) { U.toast('Válassz legalább egy szervezeti elemet.'); return; } targets = expandTargets(ids, q('subs').checked); }
        if (mode === 'resp') { if (!inj.unit) { U.toast('Nincs felelős szervezeti elem megadva.'); return; } targets = expandTargets([inj.unit], q('subs').checked); }
        { const T = targets === 'all' ? null : territory(targets); if (T && !inTerr(T, inj.county)) { U.toast('Területi hatály: a helyszín (' + (inj.place || '–') + ', ' + (inj.county || 'ismeretlen vármegye') + ') kívül esik a címzettek illetékességi területén. Módosítsd a helyszínt vagy a címzetteket.'); return; } }
        const label = targets === 'all' ? 'MINDENKI' : targets.map(t => (ORG.get(t) || { short: t }).short).join(', ');
        if (!confirm(`Bejátszod: ${inj.code} – ${inj.title}\nCímzett: ${label}`)) return;
        btn.disabled = true;
        try {
          const body = toHtml(inj.desc) + (q('exp').checked && inj.expected ? '<p><b>Elvárt tevékenység:</b></p>' + toHtml(inj.expected) : '');
          const incd = await playIncident({ title: inj.title, bodyHtml: body, lat: inj.lat, lon: inj.lon, county: inj.county, place: inj.place, unit: inj.unit, severity: inj.severity, targets, showCop: q('cop').checked, alarm: q('alm').checked, ref: { event: r.e.code, storyline: r.s.code, inject: inj.code, timing: inj.timing } });
          inj.played.push({ at: new Date().toISOString(), incident: incd.id, to: label }); await LWP.setCfg('jemm', plan());
          U.toast('Bejátszva: ' + LWP.incCode(incd) + ' – ' + inj.title.slice(0, 50)); sig = ''; drawPlan();
        } catch (err) { U.toast(err.message || 'A bejátszás nem sikerült.'); btn.disabled = false; }
      }
    });
    $('#jexp', root).onclick = () => U.download(`jemm-terv_v${CFG.version}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(plan(), null, 2), 'application/json');
    $('#jclr', root).onclick = async () => { if (confirm('Törlöd a teljes generált tervet? (A már bejátszott incidensek megmaradnak.)')) { try { await LWP.setCfg('jemm', {}); } catch (e) { U.toast(e.message); } } };
    drawPlan();
    return function sync() { const p = plan(); const s2 = JSON.stringify([p && p.events.length, p && p.meta && p.meta.generated, p && p.events.map(e => e.storylines.map(s => s.injects.map(i => i.played.length + '' + (i.lat == null)))), J.busy, J.err]); if (s2 === sig) return; sig = s2; drawPlan(); };
  }

  /* ---------- kézi incidens (JEMM nélkül) ---------- */
  function manualIncident(done) {
    const m = U.modal(`<h3>Új incidens a térképen</h3><div class="mi"><label>Cím<input id="mt" placeholder="Pl.: Gyanús drónok a paksi erőmű felett"></label><label>Leírás<textarea id="mb" rows="4"></textarea></label>
      <div class="row"><label>Súlyosság<select id="ms">${SEVS.map(s => `<option${s === 'közepes' ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Címzett<select id="mto"><option value="all">Mindenki</option><option value="sel">Kiválasztott elemek…</option></select></label></div><span id="mtsel" hidden></span>
      <div class="row"><button class="btn" id="mpk">📍 Helyszín kijelölése</button><span id="mloc" class="muted">nincs kijelölve</span></div>
      <label class="chk"><input type="checkbox" id="mcop" checked> megjelenítés a COP-on is</label><label class="chk alm"><input type="checkbox" id="mal"> 🚨 kiemelt (sziréna)</label><button class="btn pri" id="mgo">▶ Bejátszás</button></div>`);
    let loc = null, ms = null;
    m.querySelector('#mto').onchange = e => { const el = m.querySelector('#mtsel'); el.hidden = e.target.value !== 'sel'; if (!el.hidden && !ms) ms = MultiSel(el, { placeholder: '— Szervezeti elemek —', selected: [], options: () => ORG.list.map(o => ({ v: o.id, l: (o.level === 'zaszlo' ? '   ' : '') + o.name })), labelOf: v => (ORG.get(v) || { short: v }).short }); };
    m.querySelector('#mpk').onclick = () => window.TDWMap.pick(loc, l => { loc = l; m.querySelector('#mloc').textContent = `${l.place || '–'} · ${l.county || ''} · ${l.lat.toFixed(3)}, ${l.lon.toFixed(3)}`; });
    m.querySelector('#mgo').onclick = async e => {
      const title = m.querySelector('#mt').value.trim(); if (!title) return U.toast('Adj meg címet.'); if (!loc) return U.toast('Jelöld ki a helyszínt.');
      let targets = 'all'; if (m.querySelector('#mto').value === 'sel') { targets = expandTargets(ms ? ms.get() : [], true); if (!targets.length) return U.toast('Válassz szervezeti elemet.'); }
      e.target.disabled = true;
      try { const inc = await playIncident({ title, bodyHtml: toHtml(m.querySelector('#mb').value.trim()), lat: loc.lat, lon: loc.lon, county: loc.county, place: loc.place, unit: loc.county ? ORG.unitsOfCounty(loc.county).zaszlo : '', severity: m.querySelector('#ms').value, targets, showCop: m.querySelector('#mcop').checked, alarm: m.querySelector('#mal').checked, ref: { manual: true } }); m.remove(); U.toast('Bejátszva: ' + LWP.incCode(inc)); done && done(inc); } catch (err) { U.toast(err.message); e.target.disabled = false; }
    };
  }

  window.TDWJEMM = { _enforce: enforceTerritory, _terr: terrText, leadJemm, playIncident, manualIncident, MultiSel, expandTargets };
})();
