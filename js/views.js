/* TERDEF wargaming platform – nézetek: nyitó, COP, dashboard, gyakorlatvezető, csoport */
(function () {
  'use strict';
  const LWP = window.LWP, { S, BR } = LWP, U = window.UI;
  const { esc, h, $, $$, fmtTime, fmtHM, fmtDur } = U;
  const app = document.getElementById('app');
  const STC = { ok: '#585f35', warn: '#b5850f', bad: '#a43b26', off: '#878787' };
  const STL = { ok: 'aktív', warn: '5–15 perce inaktív', bad: '15+ perce inaktív', off: 'nincs bejelentkezve' };
  const BKEYS = Object.keys(BR);

  let cleanup = [];
  function mount(fn) { cleanup.forEach(f => { try { f(); } catch (_) { } }); cleanup = []; U.notifStop(); document.body.className = ''; app.innerHTML = ''; window.TDW.hideEntry(); fn(); }
  function onSync(f, every) {
    cleanup.push(LWP.on(f));
    const iv = setInterval(f, every || 15000); cleanup.push(() => clearInterval(iv));
    f();
  }
  const stText = g => { const s = LWP.status(g); return s.key === 'off' ? STL.off : s.key === 'ok' ? 'aktív' : Math.floor(s.min) + ' perce inaktív'; };
  const dot = k => `<i class="dot" style="background:${STC[k]}"></i>`;
  const groupsOf = b => S.groups.filter(g => g.branch === b).sort((a, c) => ORG.list.indexOf(ORG.get(a.id)) - ORG.list.indexOf(ORG.get(c.id)));
  const brand = '<div class="brand"><svg class="mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 3 42 10v14c0 10-8 18-18 21C14 42 6 34 6 24V10z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 15 35 33H13z" fill="currentColor"/></svg><span>TERDEF <small>wargaming platform</small></span></div>';
  const ver = () => `v${window.LWP_CONFIG.version} · ${window.LWP_CONFIG.date}`;

  async function post(o) {
    let media_url = null, media_name = null, media_type = null, kind = o.kind || 'text';
    if (o.file) {
      const up = o.upload || await LWP.upload(o.file);
      media_url = up.url; media_name = up.name; media_type = U.kindOfFile(o.file);
      if (kind !== 'event') kind = media_type;
    } else if (o.media) { media_url = o.media.url; media_name = o.media.name; media_type = o.media.type; if (kind !== 'event') kind = media_type; }
    return LWP.send({ channel: o.channel, author_type: o.type, author_id: o.id, kind, body: o.html || null, media_url, media_name, media_type, pinned: !!o.pinned, incident: o.incident || null, reply_to: o.reply_to || window.UI._sendReply || null });
  }

  /* ---------- nyitóoldal ---------- */
  function viewHome() { window.TDW.showEntry(); }

  /* ---------- COP ---------- */
  function qrModal(g) {
    const url = U.groupUrl(g), st = LWP.status(g);
    const mm = U.modal(`<div class="qrbox"><h2 style="color:${BR[g.branch].color}">${esc(g.name)}</h2><div class="qrimg" title="Kattints a teljes méretű nagyításhoz / kicsinyítéshez">${U.qrSvg(url)}</div><p class="muted">Olvasd be a táblagéppel a belépéshez · kattints a kódra a nagyításhoz</p><p class="st">${dot(st.key)} ${esc(stText(g))}</p><code class="url">${esc(url)}</code></div>`, 'qrm');
    mm.querySelector('.qrimg').onclick = e => e.currentTarget.classList.toggle('xl');
  }
  function allQr() {
    const m = U.modal(`<h2>Csoportok belépő QR-kódjai</h2>
      <div class="qrtools"><label>Méret <input type="range" id="qz" min="110" max="330" value="170"></label><span class="muted">Kattints egy kódra a nagyításhoz.</span><button class="btn" onclick="window.print()">Nyomtatás</button></div>
      ${BKEYS.map(b => `<section class="qrsec" style="--c:${BR[b].color}"><h3>${BR[b].name}</h3><div class="qrgrid">${groupsOf(b).map(g => `<figure data-g="${g.id}" title="Nagyítás"><div class="qrimg">${U.qrSvg(U.groupUrl(g))}</div><figcaption>${esc(g.name)}</figcaption></figure>`).join('')}</div></section>`).join('')}`, 'wide printable');
    m.addEventListener('click', e => { const f = e.target.closest('figure[data-g]'); if (f) qrModal(LWP.group(f.dataset.g)); });
    m.querySelector('#qz').oninput = e => m.style.setProperty('--qs', e.target.value + 'px');
    return m;
  }
  /* teljes képernyő ikon (jobb felső sarok) + bezárás ikon kiterjesztett állapotban */
  function addFs(el, after) {
    const b = document.createElement('button'); b.className = 'fs-btn'; b.type = 'button';
    const set = on => { el.classList.toggle('fs', on); document.body.classList.toggle('fs-open', on); b.textContent = on ? '✕' : '⛶'; b.title = b.ariaLabel = on ? 'Bezárás' : 'Teljes képernyő'; after && after(on); };
    b.onclick = () => set(!el.classList.contains('fs'));
    el.appendChild(b); set(false);
    el.addEventListener('click', e => { if (el.classList.contains('fs') && e.target.closest('[data-inc]')) setTimeout(() => set(false), 0); });
    const esc = e => { if (e.key === 'Escape' && el.classList.contains('fs')) set(false); };
    document.addEventListener('keydown', esc); cleanup.push(() => document.removeEventListener('keydown', esc));
  }
  function viewCOP() {
    mount(() => {
      document.body.classList.add('cop-body');
      app.innerHTML = `<div class="cop">
        <header class="top glass">${brand}<h1 id="exn"></h1>
          <div class="legend">${['ok', 'warn', 'bad', 'off'].map(k => `<span>${dot(k)}${STL[k]}</span>`).join('')}</div>
          <div class="acts"><span id="clock" class="clock"></span><button class="btn" id="bqr">QR-kódok</button><button class="btn pri" id="bdash">Dashboard</button><button class="btn" id="bfs" title="Teljes képernyő">⛶</button></div></header>
        <section class="branches" id="br"></section>
        <section class="mid mid-map"><aside class="side glass" id="sl"></aside><div class="mapwrap glass" id="mapw"></div>
          <div class="chat glass" id="chatw"><div class="chat-h"><b>JCHAT</b><span>közlések és csoportjelentések</span></div><div id="feed"></div></div>
          <aside class="side glass" id="sr"></aside></section></div>`;
      const feed = U.Feed($('#feed'), { channel: 'cop', actor: null, big: true, collapse: true, emptyText: 'Várakozás az első közlésre…' });
      U.notifStart({ relevant: m => m.channel === 'cop', mine: () => false });
      const mapCtl = window.TDWMap.create($('#mapw'), { visible: inc => inc.show_cop !== false, msgFilter: m => m.channel === 'cop', autoFlash: true });
      $('#mapw').insertAdjacentHTML('beforeend', '<div class="fs-title">Közös operatív kép</div>');
      addFs($('#mapw'), () => mapCtl.map && setTimeout(() => mapCtl.map.invalidateSize(), 60));
      addFs($('#chatw'), () => feed.forceBottom && feed.forceBottom());
      cleanup.push(() => mapCtl.destroy());
      const follow = document.createElement('label'); follow.className = 'mapfollow'; follow.innerHTML = '<input type="checkbox" checked> új incidensre ugrás'; $('#mapw').appendChild(follow);
      let lastSeq = Math.max(0, ...S.incidents.map(x => x.seq || 0));
      cleanup.push(LWP.on(() => { const mx = Math.max(0, ...S.incidents.map(x => x.seq || 0)); if (mx > lastSeq) { const inc = S.incidents.find(x => x.seq === mx); lastSeq = mx; if (inc && inc.show_cop !== false && follow.querySelector('input').checked && Date.now() - new Date(inc.created_at) < 30000) setTimeout(() => mapCtl.map.flyTo([inc.lat, inc.lon], Math.max(mapCtl.map.getZoom(), 8), { duration: 1.2 }), 3200); } }));
      $('.acts').insertBefore(Object.assign(document.createElement('span'), { id: 'sndh' }), $('#clock'));
      U.soundBtn($('#sndh'));
      if (LWP.role === 'lead') $('#bqr').onclick = allQr; else $('#bqr').remove();
      $('#bdash').onclick = () => { location.hash = '#/cop/dashboard'; };
      $('#bfs').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => { }); };
      $('#br').onclick = e => { const b = e.target.closest('[data-g]'); if (b) qrModal(LWP.group(b.dataset.g)); };
      onSync(() => {
        $('#exn').textContent = S.cfg.name;
        $('#clock').textContent = new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        $('#br').innerHTML = BKEYS.map(b => `<div class="bp glass" style="--c:${BR[b].color}"><h3>${BR[b].name}</h3><div class="chips5">${groupsOf(b).map(g => { const s = LWP.status(g); return `<button class="gchip" data-g="${g.id}" title="${esc(g.name)} – ${esc(stText(g))} · kattints a QR-kódért"><span class="ring" style="--s:${STC[s.key]}"><b>${ORG.ringLabel(g.id)}</b></span><span class="gs">${s.key === 'off' ? 'nincs bent' : s.key === 'ok' ? 'aktív' : Math.floor(s.min) + ' p'}</span>${g.help ? '<span class="help" title="Segítséget kér">🆘</span>' : ''}</button>`; }).join('')}</div></div>`).join('');
        feed.sync();
        const pinned = S.msgs.filter(m => m.channel === 'cop' && m.pinned && !m.deleted).slice(-4).reverse();
        const helps = S.groups.filter(g => g.help);
        $('#sl').innerHTML = `<h4>📌 Kiemelt</h4>${pinned.length ? pinned.map(m => `<div class="mini"><time>${fmtHM(m.created_at)}</time>${m.body ? U.sanitize(m.body).replace(/<[^>]+>/g, ' ').slice(0, 140) : esc(m.media_name || 'média')}</div>`).join('') : '<p class="muted">Nincs kiemelt közlés.</p>'}<h4>🆘 Segítségkérés</h4>${helps.length ? helps.map(g => `<div class="mini warnb" style="--c:${BR[g.branch].color}">${esc(g.name)}</div>`).join('') : '<p class="muted">Nincs aktív kérés.</p>'}`;
        const cop = S.msgs.filter(m => m.channel === 'cop' && !m.deleted);
        const act = S.groups.filter(g => LWP.status(g).key === 'ok').length;
        const med = cop.filter(m => U.mediaType(m)).length;
        $('#sr').innerHTML = `<h4>Összkép</h4><div class="kpi"><b>${act}<small>/${S.groups.length}</small></b><span>aktív csoport</span></div><div class="kpi"><b>${cop.length}</b><span>közlés a COP-on</span></div><div class="kpi"><b>${S.incidents.filter(x => x.show_cop !== false).length}</b><span>incidens a térképen</span></div><div class="kpi"><b>${med}</b><span>média</span></div><div class="kpi"><b>${S.reacts.length}</b><span>reakció</span></div>`;
      });
    });
  }

  /* ---------- statisztika (közös számítások) ---------- */
  function stats() {
    const per = S.groups.map(g => {
      const mine = S.msgs.filter(m => m.author_type === 'group' && m.author_id === g.id && !m.deleted);
      const ids = new Set(mine.map(m => m.id));
      const got = S.reacts.filter(r => ids.has(r.message_id)).length;
      // válaszidő: vezetői üzenet a csoport csatornájában -> a csoport első üzenete utána
      const ch = S.msgs.filter(m => m.channel === 'lead:' + g.id && !m.deleted);
      const times = [];
      ch.forEach((m, i) => {
        if (m.author_type !== 'lead') return;
        const r = ch.slice(i + 1).find(x => x.author_type === 'group');
        if (r) times.push((new Date(r.created_at) - new Date(m.created_at)) / 1000);
      });
      times.sort((a, b) => a - b);
      const med = times.length ? times[Math.floor(times.length / 2)] : null;
      const ev = S.events.filter(e => e.group_id === g.id);
      return { g, msgs: mine.length, media: mine.filter(m => U.mediaType(m)).length, reacts: got, active: g.active_sec || 0, logins: ev.filter(e => e.type === 'login').length, helps: ev.filter(e => e.type === 'help').length, med, leadMsgs: ch.filter(m => m.author_type === 'lead').length };
    });
    return per;
  }
  function exportMessages() {
    const rows = [['idő', 'csatorna', 'szerző', 'típus', 'szöveg', 'média', 'kiemelt', 'törölt', 'reakciók']];
    S.msgs.forEach(m => {
      const rx = S.reacts.filter(r => r.message_id === m.id).map(r => r.emoji + ' ' + U.actorName(r.actor)).join(' | ');
      const txt = m.body ? (m.author_type === 'group' ? m.body : U.sanitize(m.body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : '';
      rows.push([m.created_at, m.channel, U.author(m).name, m.kind, txt, m.media_name || '', m.pinned ? 'igen' : '', m.deleted ? 'igen' : '', rx]);
    });
    U.download(`terdef-uzenetek_v${window.LWP_CONFIG.version}_${new Date().toISOString().slice(0, 10)}.csv`, U.toCSV(rows), 'text/csv;charset=utf-8');
  }
  function exportSummary() {
    const rows = [['ezred', 'csoport', 'üzenetek', 'média', 'kapott reakciók', 'aktív idő (perc)', 'belépések', 'segélykérések', 'vezetői közlések', 'medián válaszidő (mp)', 'utolsó aktivitás']];
    stats().forEach(s => rows.push([BR[s.g.branch].name, s.g.name, s.msgs, s.media, s.reacts, Math.round(s.active / 60), s.logins, s.helps, s.leadMsgs, s.med == null ? '' : Math.round(s.med), s.g.last_seen || '']));
    U.download(`terdef-osszesito_v${window.LWP_CONFIG.version}_${new Date().toISOString().slice(0, 10)}.csv`, U.toCSV(rows), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    U.download(`terdef-teljes-export_v${window.LWP_CONFIG.version}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported: new Date().toISOString(), version: window.LWP_CONFIG.version, config: { name: S.cfg.name, yellow: S.cfg.yellow, red: S.cfg.red }, incidents: S.incidents, jemm: S.cfg.jemm || null, groups: S.groups.map(g => Object.assign({}, g, { token: undefined })), messages: S.msgs, reactions: S.reacts, events: S.events }, null, 1), 'application/json');
  }

  /* ---------- dashboard ---------- */
  function viewDash() {
    mount(() => {
      document.body.classList.add('cop-body');
      app.innerHTML = `<div class="dash">
        <header class="top glass">${brand}<h1>Gyakorlat-kiértékelés · dashboard</h1>
          <div class="acts"><button class="btn" id="e1">Üzenetek CSV</button><button class="btn" id="e2">Összesítő CSV</button><button class="btn" id="e3">Teljes export JSON</button><button class="btn pri" id="back">← COP</button></div></header>
        <section class="kpis" id="kp"></section>
        <section class="grid">
          <div class="cc glass"><h3>Üzenetek csoportonként</h3><div class="blg" id="lg1"></div><div class="cv"><canvas id="c1"></canvas></div></div>
          <div class="cc glass"><h3>Aktivitás időben <small>üzenet / 15 perc</small></h3><div class="cv"><canvas id="c2"></canvas></div></div>
          <div class="cc glass"><h3>Csoportok állapota most</h3><div class="cv sm"><canvas id="c3"></canvas></div></div>
          <div class="cc glass"><h3>Aktív idő csoportonként <small>perc</small></h3><div class="blg" id="lg4"></div><div class="cv"><canvas id="c4"></canvas></div></div>
          <div class="cc glass"><h3>Tartalom típusa</h3><div class="cv sm"><canvas id="c5"></canvas></div></div>
          <div class="cc glass"><h3>Leggyakoribb reakciók</h3><div class="cv sm"><canvas id="c6"></canvas></div></div>
        </section>
        <section class="glass tbl"><h3>Csoportonkénti összesítő</h3><div class="tw"><table id="tb"></table></div></section></div>`;
      $('#back').onclick = () => { location.hash = '#/cop'; };
      $('#e1').onclick = exportMessages; $('#e2').onclick = exportSummary; $('#e3').onclick = exportJSON;
      const lg = BKEYS.map(b => `<span><i class="sw" style="background:${BR[b].color}"></i>${BR[b].name}</span>`).join('');
      $('#lg1').innerHTML = lg; $('#lg4').innerHTML = lg;
      if (!window.Chart) { $('#kp').innerHTML = '<p>A diagramkönyvtár nem töltődött be.</p>'; return; }
      Chart.defaults.color = '#585857'; Chart.defaults.font.family = "Inter, system-ui, sans-serif"; Chart.defaults.borderColor = 'rgba(100,93,69,.12)';
      const grid = { color: 'rgba(100,93,69,.10)' };
      const base = { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } };
      const charts = {
        c1: new Chart($('#c1'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] }, options: Object.assign({}, base, { indexAxis: 'y', scales: { x: { grid, beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } }) }),
        c2: new Chart($('#c2'), { type: 'line', data: { labels: [], datasets: BKEYS.map(b => ({ label: BR[b].name, data: [], borderColor: BR[b].color, backgroundColor: BR[b].color, borderWidth: 2, pointRadius: 3, pointBorderColor: '#ffffff', pointBorderWidth: 2, tension: .3 })) }, options: Object.assign({}, base, { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { display: false } }, y: { grid, beginAtZero: true, ticks: { precision: 0 } } } }) }),
        c3: new Chart($('#c3'), { type: 'doughnut', data: { labels: Object.values(STL), datasets: [{ data: [], backgroundColor: Object.values(STC), borderColor: '#ffffff', borderWidth: 3 }] }, options: Object.assign({}, base, { cutout: '62%', plugins: { legend: { display: true, position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } }) }),
        c4: new Chart($('#c4'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] }, options: Object.assign({}, base, { indexAxis: 'y', scales: { x: { grid, beginAtZero: true }, y: { grid: { display: false } } } }) }),
        c5: new Chart($('#c5'), { type: 'bar', data: { labels: ['szöveg', 'kép', 'hang', 'videó'], datasets: [{ data: [], backgroundColor: '#6c87ac', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 36 }] }, options: Object.assign({}, base, { scales: { x: { grid: { display: false } }, y: { grid, beginAtZero: true, ticks: { precision: 0 } } } }) }),
        c6: new Chart($('#c6'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#6c87ac', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 36 }] }, options: Object.assign({}, base, { scales: { x: { grid: { display: false }, ticks: { font: { size: 18 } } }, y: { grid, beginAtZero: true, ticks: { precision: 0 } } } }) })
      };
      cleanup.push(() => Object.values(charts).forEach(c => c.destroy()));
      LWP.reloadEvents().catch(() => { });
      const evIv = setInterval(() => LWP.reloadEvents().catch(() => { }), 30000); cleanup.push(() => clearInterval(evIv));

      onSync(() => {
        const per = stats(), msgs = S.msgs.filter(m => !m.deleted && m.author_type === 'group');
        const lead = S.msgs.filter(m => !m.deleted && m.author_type === 'lead');
        const medias = S.msgs.filter(m => !m.deleted && U.mediaType(m));
        const act = S.groups.filter(g => LWP.status(g).key === 'ok').length;
        const meds = per.filter(p => p.med != null).map(p => p.med);
        const avgMed = meds.length ? meds.reduce((a, b) => a + b, 0) / meds.length : null;
        const tile = (v, l, s) => `<div class="kt glass"><b>${v}</b><span>${l}</span>${s ? `<small>${s}</small>` : ''}</div>`;
        $('#kp').innerHTML = tile(msgs.length, 'csoportüzenet', `${lead.length} vezetői közlés`) + tile(medias.length, 'média', `${medias.filter(m => U.mediaType(m) === 'image').length} kép · ${medias.filter(m => U.mediaType(m) === 'audio').length} hang · ${medias.filter(m => U.mediaType(m) === 'video').length} videó`) + tile(S.reacts.length, 'reakció', '') + tile(`${act}/${S.groups.length}`, 'aktív csoport most', `${S.groups.filter(g => g.last_login).length} csoport lépett be`) + tile(S.groups.filter(g => g.help).length + ' / ' + S.events.filter(e => e.type === 'help').length, 'segélykérés (nyitott / összes)', '') + tile(avgMed == null ? '–' : fmtDur(avgMed), 'átlagos válaszidő', 'a vezetői közlésre (csoportok mediánjából)');
        const ordered = per.slice().sort((a, b) => b.msgs - a.msgs);
        charts.c1.data.labels = ordered.map(p => p.g.name); charts.c1.data.datasets[0].data = ordered.map(p => p.msgs); charts.c1.data.datasets[0].backgroundColor = ordered.map(p => BR[p.g.branch].color); charts.c1.update();
        const o4 = per.slice().sort((a, b) => b.active - a.active);
        charts.c4.data.labels = o4.map(p => p.g.name); charts.c4.data.datasets[0].data = o4.map(p => Math.round(p.active / 60)); charts.c4.data.datasets[0].backgroundColor = o4.map(p => BR[p.g.branch].color); charts.c4.update();
        // idősor
        const all = S.msgs.filter(m => !m.deleted && m.author_type === 'group');
        if (all.length) {
          const B = 15 * 60000, t0 = Math.floor(new Date(all[0].created_at) / B) * B, t1 = Math.floor(new Date(all[all.length - 1].created_at) / B) * B;
          const n = Math.min(Math.floor((t1 - t0) / B) + 1, 400);
          charts.c2.data.labels = Array.from({ length: n }, (_, i) => { const d = new Date(t0 + i * B); return (d.getMonth() + 1) + '.' + d.getDate() + '. ' + fmtHM(d); });
          BKEYS.forEach((b, bi) => { const arr = new Array(n).fill(0); all.forEach(m => { const g = LWP.group(m.author_id); if (g && g.branch === b) { const i = Math.floor((new Date(m.created_at) - t0) / B); if (i >= 0 && i < n) arr[i]++; } }); charts.c2.data.datasets[bi].data = arr; });
        } else { charts.c2.data.labels = []; charts.c2.data.datasets.forEach(d => d.data = []); }
        charts.c2.update();
        const sc = { ok: 0, warn: 0, bad: 0, off: 0 }; S.groups.forEach(g => sc[LWP.status(g).key]++);
        charts.c3.data.datasets[0].data = [sc.ok, sc.warn, sc.bad, sc.off]; charts.c3.update();
        const vis = S.msgs.filter(m => !m.deleted);
        const cnt = t => vis.filter(m => U.mediaType(m) === t).length;
        charts.c5.data.datasets[0].data = [vis.filter(m => !U.mediaType(m)).length, cnt('image'), cnt('audio'), cnt('video')]; charts.c5.update();
        const rc = {}; S.reacts.forEach(r => rc[r.emoji] = (rc[r.emoji] || 0) + 1);
        const rk = Object.keys(rc).sort((a, b) => rc[b] - rc[a]);
        charts.c6.data.labels = rk; charts.c6.data.datasets[0].data = rk.map(k => rc[k]); charts.c6.update();
        $('#tb').innerHTML = `<thead><tr><th>Ezred</th><th>Csoport</th><th>Üzenet</th><th>Média</th><th>Kapott reakció</th><th>Aktív idő</th><th>Belépés</th><th>Segélykérés</th><th>Vezetői közlés</th><th>Medián válaszidő</th><th>Utolsó aktivitás</th></tr></thead><tbody>${per.sort((a, b) => a.g.id < b.g.id ? -1 : 1).map(p => `<tr><td><i class="sw" style="background:${BR[p.g.branch].color}"></i>${BR[p.g.branch].name}</td><td>${esc(p.g.name)}</td><td>${p.msgs}</td><td>${p.media}</td><td>${p.reacts}</td><td>${fmtDur(p.active)}</td><td>${p.logins}</td><td>${p.helps}</td><td>${p.leadMsgs}</td><td>${p.med == null ? '–' : fmtDur(p.med)}</td><td>${p.g.last_seen ? fmtTime(p.g.last_seen) : '–'}</td></tr>`).join('')}</tbody>`;
      }, 8000);
    });
  }

  /* ---------- gyakorlatvezető ---------- */
  const lread = ch => localStorage.getItem('tdw-lr:' + ch) || '1970';
  function viewLead() {
    mount(() => {
      const L = { tab: 'cop', gid: S.groups[0] ? S.groups[0].id : null, chan: 'lead' };
      app.innerHTML = `<div class="lead"><aside class="nav glass">${brand}<nav>
        <button data-t="cop">📣 COP-közlés</button><button data-t="map">🗺 Térkép / incidensek</button><button data-t="jemm">🎯 JEMM generátor</button><button data-t="audit">🔎 Nyomkövetés</button><button data-t="groups">👥 Szervezeti elemek</button><button data-t="script">📋 Forgatókönyv (Word)</button><button data-t="settings">⚙ Beállítások</button></nav>
        <div class="navf"><a href="#/cop" target="_blank" rel="noopener">COP megnyitása ↗</a><a href="#/cop/dashboard" target="_blank" rel="noopener">Dashboard ↗</a><button id="lo">Kilépés</button><small>${ver()}</small></div></aside>
        <section class="main glass" id="mn"></section></div>`;
      U.notifStart({ relevant: m => m.author_type === 'group' && (m.channel === 'cop' || m.channel.startsWith('lead:')), mine: m => m.author_type === 'lead' });
      U.soundBtn($('.navf'));
      let tabSync = () => { };
      const go = t => { if (L.dispose) { L.dispose(); L.dispose = null; } L.tab = t; $$('.nav nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); tabSync = ({ cop: leadCop, map: leadMap, jemm: window.TDWJEMM.leadJemm, audit: window.TDWAudit.leadAudit, groups: leadGroups, script: leadScript, settings: leadSettings }[t])(L, $('#mn')); tabSync && tabSync(); };
      $('.nav nav').onclick = e => { const b = e.target.closest('[data-t]'); if (b) go(b.dataset.t); };
      $('#lo').onclick = async () => { await LWP.logout('lead'); location.hash = '#/'; };
      cleanup.push(LWP.on(() => tabSync && tabSync()));
      go('cop');
    });
  }
  function copLogin(back) {
    app.innerHTML = `<main class="home">${brand}<form class="card glass login" id="cf"><h3>Közös operatív kép – belépés</h3><p class="muted">A COP megtekintéséhez COP-kód (vagy gyakorlatvezetői kód) szükséges.</p><input type="password" name="p" placeholder="COP-kód" autocomplete="current-password" autofocus><button class="btn pri">Megnyitás</button><p class="err" id="er"></p><a href="#/">← vissza</a></form></main>`;
    $('#cf').onsubmit = async e => {
      e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await LWP.signIn('cop', e.target.p.value); route(); } catch (er) { $('#er').textContent = er.message; } finally { btn.disabled = false; }
    };
  }
  function leadLogin() {
    app.innerHTML = `<main class="home">${brand}<form class="card glass login" id="lf"><h3>Gyakorlatvezetői belépés</h3><input type="password" name="p" placeholder="Belépési kód" autocomplete="current-password" autofocus><button class="btn pri">Belépés</button><p class="err" id="er"></p><a href="#/">← vissza</a></form></main>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await LWP.signIn('lead', e.target.p.value); location.hash = '#/lead'; route(); } catch (er) { $('#er').textContent = er.message; } finally { btn.disabled = false; }
    };
  }
  function leadMap(L, root) {
    root.innerHTML = `<div class="pane"><div class="ph"><h2>Térkép és incidensek</h2><span class="muted">A bejátszott injectek háromszögként jelennek meg; kattints rá a részletekért.</span><button class="btn pri" id="mnew">＋ Új incidens</button></div><div class="leadmap"><div class="mapwrap" id="lm"></div><aside class="inclist" id="il"></aside></div><div id="c"></div></div>`;
    const ctl = window.TDWMap.create($('#lm'), { msgFilter: () => true, canMod: true, onReply: id => { comp.setIncident(id); comp.focus(); } });
    L.dispose = () => ctl.destroy();
    const comp = U.Composer($('#c'), { rich: true, incidents: true, incidents: true, keepIncident: true, placeholder: 'Közlés a COP-ra a kiválasztott incidenshez (Ctrl+Enter)…', onSend: async ({ body, file, incident }) => { await post({ channel: 'cop', type: 'lead', id: 'lead', html: body, file, incident }); } });
    $('#mnew').onclick = () => window.TDWJEMM.manualIncident();
    $('#il').onclick = e => { const b = e.target.closest('[data-inc]'); if (b) ctl.focusIncident(b.dataset.inc); };
    return function sync() {
      const list = S.incidents.slice().sort((a, b) => b.seq - a.seq);
      $('#il').innerHTML = '<h4>Incidensek (' + list.length + ')</h4>' + (list.length ? list.map(x => { const n = S.msgs.filter(m => m.incident === x.id && !m.deleted).length; return `<button class="inci" data-inc="${esc(x.id)}"><i class="sevdot" style="background:${window.TDWMap.sev(x.severity).c}"></i><span><b>${esc(LWP.incCode(x))}</b> ${esc(x.title)}<small>${esc(x.place || x.county || '')} · ${fmtHM(x.created_at)} · 💬 ${n}</small></span></button>`; }).join('') : '<p class="muted">Még nincs bejátszott incidens.</p>');
    };
  }
  function leadCop(L, root) {
    root.innerHTML = `<div class="pane"><div class="ph"><h2>COP-közlés</h2><span class="muted">A közlés mindenki számára megjelenik a kivetítőn és a csoportoknál.</span></div><div id="f"></div><div id="c"></div></div>`;
    const feed = U.Feed($('#f'), { channel: 'cop', actor: 'lead', canMod: true });
    U.Composer($('#c'), { rich: true, incidents: true, placeholder: 'Közlés szövege (Ctrl+Enter: küldés)…', extra: '<label class="chk alm"><input type="checkbox" id="pin"> 🚨 Kiemelt közlés – sziréna + pulzáló megjelenés, rögzítve a COP-on</label>', onSend: async ({ body, file, root: r, incident }) => {
      await post({ channel: 'cop', type: 'lead', id: 'lead', html: body, file, pinned: $('#pin', r).checked, incident }); $('#pin', r).checked = false; feed.forceBottom();
    } });
    return () => feed.sync();
  }
  function leadGroups(L, root) {
    root.innerHTML = `<div class="split"><div class="glist" id="gl"></div><div class="pane"><div class="ph" id="gh"></div><div class="chsel" id="cs"></div><div id="f"></div><div id="c"></div></div></div>`;
    let feed = null, composer = null, curKey = '', csSig = '';
    const dmChans = gid => {
      const out = new Map();
      S.msgs.forEach(m => { if (m.channel.startsWith('dm:') && m.channel.slice(3).split('~').includes(gid) && !m.deleted) out.set(m.channel, (out.get(m.channel) || 0) + 1); });
      return out;
    };
    function mountFeed() {
      const key = L.gid + '|' + L.chan; if (key === curKey) return; curKey = key;
      $('#f').innerHTML = ''; $('#c').innerHTML = '';
      const gid = L.gid, ch = L.chan;
      const filter = ch === 'lead' ? (m => m.channel === 'lead:' + gid) : ch === 'cop' ? (m => m.channel === 'cop' && m.author_id === gid && m.author_type === 'group') : (m => m.channel === ch);
      feed = U.Feed($('#f'), { filter, actor: ch === 'lead' ? 'lead' : null, canMod: true, emptyText: 'Még nincs üzenet ebben a csatornában.' });
      if (ch === 'lead') {
        composer = U.Composer($('#c'), { rich: true, incidents: true, placeholder: 'Üzenet / esemény a csoportnak (Ctrl+Enter: küldés)…', extra: `<label>Címzett <select id="tg"><option value="one">csak ez a szervezeti elem</option>${BKEYS.map(b => `<option value="b:${b}">${BR[b].name} – mind (${groupsOf(b).length})</option>`).join('')}<option value="all">minden szervezeti elem (${S.groups.length})</option></select></label><label class="chk"><input type="checkbox" id="ev" checked> Eseményként</label><label class="chk alm"><input type="checkbox" id="al"> 🚨 Kiemelt közlés (sziréna + pulzálás)</label>`, onSend: async ({ body, file, root: r, incident }) => {
          const tg = $('#tg', r).value, g0 = LWP.group(L.gid);
          const targets = tg === 'one' ? [g0.id] : tg === 'all' ? S.groups.map(g => g.id) : S.groups.filter(g => 'b:' + g.branch === tg).map(g => g.id);
          let up = null; if (file) up = await LWP.upload(file);
          for (const id of targets) await post({ channel: 'lead:' + id, type: 'lead', id: 'lead', html: body, file, upload: up, kind: $('#ev', r).checked ? 'event' : 'text', pinned: $('#al', r).checked, incident });
          $('#al', r).checked = false; feed.forceBottom();
        } });
      } else $('#c').innerHTML = '<p class="muted ro">Betekintés – csak olvasható nézet.</p>';
    }
    return function sync() {
      $('#gl').innerHTML = BKEYS.map(b => `<h4 style="color:${BR[b].color}">${BR[b].name}</h4>` + groupsOf(b).map(g => { const s = LWP.status(g); const un = S.msgs.filter(m => m.channel === 'lead:' + g.id && m.author_type === 'group' && m.created_at > lread('lead:' + g.id) && !(L.tab === 'groups' && L.gid === g.id && L.chan === 'lead')).length; return `<button class="gr${g.id === L.gid ? ' on' : ''}" data-g="${g.id}" style="--c:${BR[b].color}">${dot(s.key)}<span>${esc(g.name)}</span>${g.help ? '🆘' : ''}${un ? `<em>${un}</em>` : ''}</button>`; }).join('')).join('');
      $('#gl').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { L.gid = b.dataset.g; L.chan = 'lead'; csSig = ''; sync(); } };
      const g = LWP.group(L.gid), s = LWP.status(g);
      $('#gh').innerHTML = `<h2 style="color:${BR[g.branch].color}">${esc(g.name)}</h2><span class="muted">${dot(s.key)} ${esc(stText(g))}${g.last_seen ? ' · utoljára ' + fmtHM(g.last_seen) : ''} · aktív idő: ${fmtDur(g.active_sec || 0)}</span>${g.help ? '<button class="btn warn" id="hh">🆘 Segítségkérés lezárása</button>' : ''}<button class="btn" id="qq">QR</button>`;
      if ($('#hh')) $('#hh').onclick = () => LWP.setHelp(g.id, false);
      $('#qq').onclick = () => qrModal(g);
      const dms = dmChans(L.gid);
      const sig = L.gid + '|' + L.chan + '|' + Array.from(dms).join(',');
      if (sig !== csSig) {
        csSig = sig;
        $('#cs').innerHTML = `<label>Csatorna <select id="chs"><option value="lead">Vezetői csatorna (írható)</option><option value="cop">A csoport közlései a COP-on</option>${Array.from(dms).map(([c, n]) => { const o = c.slice(3).split('~').find(x => x !== L.gid) || L.gid; return `<option value="${esc(c)}">Beszélgetés: ${esc((LWP.group(o) || { name: o }).name)} (${n})</option>`; }).join('')}</select></label>`;
        $('#chs').value = L.chan;
        $('#chs').onchange = e => { L.chan = e.target.value; mountFeed(); sync(); };
      }
      mountFeed();
      const list = feed.sync();
      if (L.chan === 'lead') localStorage.setItem('tdw-lr:lead:' + L.gid, new Date().toISOString());
      return list;
    };
  }
  /* ---- forgatókönyv: Word-import + tárolás (lwp_config 'scenario') ---- */
  const TEMPLATE = 'assets/forgatokonyv-sablon.docx';
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const txt = html => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  function splitTitle(html) {
    const d = document.createElement('div'); d.innerHTML = U.sanitize(html);
    const first = Array.from(d.children).find(e => (e.textContent || '').trim());
    if (!first) return { title: '', html: '' };
    const t = first.textContent.replace(/\s+/g, ' ').trim();
    if (t.length <= 100) { first.remove(); return { title: t, html: d.innerHTML }; }
    return { title: t.slice(0, 90) + '…', html: d.innerHTML };
  }
  function parseTables(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = []; let cur = null;
    doc.querySelectorAll('table').forEach(tb => {
      const rows = Array.from(tb.querySelectorAll('tr'));
      let map = { no: 0, time: 1, to: 2, mode: 3, content: 4, task: 5 };
      const hdr = Array.from(rows[0] ? rows[0].children : []).map(c => norm(c.textContent));
      if (hdr.some(x => /kozles|szama|kinek|tartalom/.test(x))) {
        const m = {};
        hdr.forEach((x, i) => {
          if (/szama|sorszam/.test(x)) m.no = i;
          else if (/idotartam|idopont|^ido/.test(x)) m.time = i;
          else if (/kinek|cimzett/.test(x)) m.to = i;
          else if (/modja|eszkoz|csatorna/.test(x)) m.mode = i;
          else if (/tartalom|tenyallas/.test(x)) m.content = i;
          else if (/tevekenyseg|feladat|eredmeny|gyakorlo/.test(x)) m.task = i;
        });
        map = Object.assign(map, m); rows.shift();
      }
      rows.forEach(tr => {
        const c = Array.from(tr.children), g = k => (c[map[k]] ? c[map[k]].innerHTML : ''), gt = k => (c[map[k]] ? txt(c[map[k]].innerHTML) : '');
        const no = gt('no'), content = g('content'), task = g('task');
        if (/^\d+/.test(no)) {
          const sp = splitTitle(content);
          cur = { no: String(parseInt(no, 10)), time: gt('time'), to: gt('to'), mode: gt('mode'), title: sp.title || ('Esemény ' + parseInt(no, 10)), html: sp.html, task: U.sanitize(task) };
          items.push(cur);
        } else if (cur && (txt(content) || txt(task))) {
          cur.html += U.sanitize(content); cur.task += U.sanitize(task);
        }
      });
    });
    return items;
  }
  async function parseWord(file) {
    if (!window.mammoth) throw new Error('A Word-olvasó nem töltődött be.');
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) });
    return parseTables(res.value);
  }
  function normSample(items) {
    const toH = t => '<p>' + U.esc(t || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    return items.map(it => {
      const lines = (it.content || '').split('\n'); const rest = lines[0] && it.title && lines[0].startsWith(it.title.slice(0, 40)) && lines[0].length <= 100 ? lines.slice(1).join('\n').trim() : it.content;
      return { no: String(it.no), time: it.time || '', to: it.to || '', mode: it.mode || '', title: it.title, html: rest ? toH(rest) : '', task: it.task && it.task !== '-' ? toH(it.task) : '' };
    });
  }
  function leadScript(L, root) {
    root.innerHTML = `<div class="pane"><div class="ph"><h2>Forgatókönyv</h2><span class="muted" id="sm"></span>
      <label>Csoport <select id="sg">${S.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>
      <label class="chk alm"><input type="checkbox" id="sal"> 🚨 Kiemelten (sziréna)</label><a class="btn" href="${TEMPLATE}" download>Sablon letöltése (Word)</a><label class="btn pri up">Word feltöltése<input type="file" id="wf" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label></div><div id="sc" class="scl"><p class="muted">Betöltés…</p></div></div>`;
    let sample = null, sig = '';
    const cur = () => (S.cfg.scenario && S.cfg.scenario.items) ? S.cfg.scenario.items : sample;
    sample = []; draw(true);
    function draw(force) {
      const items = cur(); if (!items) return;
      const sent = {}; S.events.filter(e => e.type === 'inject').forEach(e => { const k = e.data && e.data.no; (sent[k] = sent[k] || []).push(e); });
      const s2 = JSON.stringify([items.length, items.map(i => i.no + i.title), Object.keys(sent).map(k => k + sent[k].length)]);
      if (!force && s2 === sig) return; sig = s2;
      const sc = S.cfg.scenario;
      $('#sm').textContent = sc && sc.items ? `Feltöltött forgatókönyv: ${sc.source || 'Word'} · ${items.length} esemény · ${fmtTime(sc.updated)}` : 'Nincs feltöltött forgatókönyv – tölts fel Word-sablont (vagy használd a JEMM generátort).';
      $('#sc').innerHTML = items.length ? items.map((it, ix) => `<details class="si"><summary><span class="no">${esc(it.no)}.</span><span class="tm">${esc(it.time)}</span><b>${esc(it.title)}</b>${sent[it.no] ? `<span class="badge ok">bejátszva ×${sent[it.no].length}</span>` : ''}</summary>
        <div class="sb"><p class="muted">Kinek: ${esc(it.to || '–')} · Mód: ${esc(it.mode || '–')}</p><div class="sx">${U.sanitize(it.html || '')}</div>${it.task ? `<h5>Feladat / tevékenység</h5><div class="sx">${U.sanitize(it.task)}</div>` : ''}
        <div class="sa"><button class="btn pri" data-ix="${ix}" data-to="cop">Bejátszás a COP-ra</button><button class="btn" data-ix="${ix}" data-to="grp">Küldés a kijelölt csoportnak</button><button class="btn" data-ix="${ix}" data-to="all">Küldés minden csoportnak</button>${sc && sc.items ? `<button class="btn sm warn" data-del="${ix}">Törlés a listából</button>` : ''}</div></div></details>`).join('') : '<p class="muted">Nincs esemény. Töltsd le a sablont, töltsd ki, majd töltsd fel.</p>';
    }
    async function save(items, source) { await LWP.setCfg('scenario', { items, source, updated: new Date().toISOString() }); }
    $('#wf').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      let items; try { items = await parseWord(f); } catch (err) { return U.toast('A fájl nem olvasható: ' + (err.message || err)); }
      if (!items.length) return U.toast('Nem található esemény. Ellenőrizd, hogy a táblázat első oszlopában van sorszám.');
      const have = S.cfg.scenario && S.cfg.scenario.items ? S.cfg.scenario.items : null;
      const m = U.modal(`<h3>${items.length} esemény található</h3><p class="muted">${esc(f.name)}</p><div class="imp">${items.slice(0, 8).map(i => `<div><b>${esc(i.no)}.</b> ${esc(i.title)} <span class="muted">${esc(i.time)}</span></div>`).join('')}${items.length > 8 ? `<div class="muted">… és még ${items.length - 8}</div>` : ''}</div>
        <div class="sa"><button class="btn pri" data-m="rep">${have ? 'Felváltja a meglévő forgatókönyvet' : 'Betöltés'}</button>${have ? '<button class="btn" data-m="add">Hozzáadás a meglévőhöz</button>' : ''}<button class="btn" data-close>Mégse</button></div>`);
      m.onclick = async ev => {
        const b = ev.target.closest('[data-m]'); if (!b) return;
        try {
          let out = items;
          if (b.dataset.m === 'add') { const used = new Set(have.map(x => x.no)), mx = Math.max(0, ...have.map(x => parseInt(x.no, 10) || 0)); const clash = items.some(x => used.has(x.no)); out = have.concat(items.map(x => { if (clash) x.no = String((parseInt(x.no, 10) || 0) + mx); return x; })); }
          await save(out, f.name); m.remove(); U.toast(out.length + ' esemény mentve.');
        } catch (err) { U.toast(err.message); }
      };
    };
    $('#sc').onclick = async e => {
      const del = e.target.closest('[data-del]');
      if (del) { if (!confirm('Törlöd ezt az eseményt a listából?')) return; const items = cur().slice(); items.splice(+del.dataset.del, 1); try { await save(items, S.cfg.scenario.source); } catch (err) { U.toast(err.message); } return; }
      const b = e.target.closest('[data-ix]'); if (!b) return;
      const it = cur()[+b.dataset.ix];
      const html = `<h3>${U.esc(it.title)}</h3>` + (it.html || '') + (it.task ? `<p><b>Feladat:</b></p>` + it.task : '');
      b.disabled = true;
      try {
        const al = $('#sal').checked;
        if (b.dataset.to === 'cop') await post({ channel: 'cop', type: 'lead', id: 'lead', html, kind: 'event', pinned: al });
        else { const ids = b.dataset.to === 'all' ? S.groups.map(g => g.id) : [$('#sg').value]; for (const id of ids) await post({ channel: 'lead:' + id, type: 'lead', id: 'lead', html, kind: 'event', pinned: al }); }
        await LWP.logEvent(null, 'inject', { no: it.no, to: b.dataset.to });
        U.toast('Bejátszva: ' + it.title.slice(0, 50));
      } catch (err) { U.toast(err.message); }
      b.disabled = false;
    };
    return () => draw(false);
  }
  function leadSettings(L, root) {
    root.innerHTML = `<div class="pane scroll"><div class="ph"><h2>Beállítások és export</h2></div>
      <form id="fs" class="fcard glass-in"><h4>Gyakorlat</h4><label>Megnevezés <input name="n" value="${esc(S.cfg.name)}"></label><label>Sárga jelzés (perc) <input name="y" type="number" min="1" value="${S.cfg.yellow}"></label><label>Piros jelzés (perc) <input name="r" type="number" min="2" value="${S.cfg.red}"></label><button class="btn pri">Mentés</button></form>
      <form id="fp" class="fcard glass-in"><h4>Belépési kódok (szerveroldalon ellenőrzött)</h4><label>Új gyakorlatvezetői kód (min. 8 karakter) <input name="p" type="password" autocomplete="new-password"></label><label>Új COP-kód a kivetítőhöz (min. 6 karakter) <input name="c" type="password" autocomplete="new-password"></label><button class="btn">Kódok módosítása</button><p class="muted">A kódokat a szerver titkosítva tárolja; a kliens soha nem kapja meg. Tárolt hash-ük nem olvasható ki.</p></form>
      <form id="fo" class="fcard glass-in"><h4>Szervezeti elemek belépése</h4><label class="chk"><input type="checkbox" name="o" ${S.cfg.openLogin !== false ? 'checked' : ''}> Belépés kód nélkül is (csak a szervezeti elem kiválasztásával) – <b>zárt próbán elég, éles használatnál kapcsold ki</b></label><div class="row"><button class="btn">Mentés</button><button type="button" class="btn warn" id="rg">Új egységkódok és QR-ek generálása</button></div><p class="muted">Kikapcsolt állapotban a szervezeti elemek csak a QR-lapon lévő egyedi kóddal léphetnek be.</p></form>
      <div class="fcard glass-in"><h4>Adatexport (kiértékeléshez)</h4><div class="row"><button class="btn" id="x1">Üzenetek CSV</button><button class="btn" id="x2">Összesítő CSV</button><button class="btn" id="x3">Teljes export JSON</button></div></div>
      <div class="fcard glass-in"><h4>Szervezeti elemek belépő hivatkozásai</h4><div class="row"><button class="btn" id="aq">Összes QR megjelenítése / nyomtatása</button></div><table class="lt">${S.groups.map(g => `<tr><td><i class="sw" style="background:${BR[g.branch].color}"></i>${esc(g.name)}</td><td><b>${esc(g.token || '')}</b></td><td><code>${esc(U.groupUrl(g))}</code></td><td><button class="btn sm" data-cp="${esc(U.groupUrl(g))}">Másol</button></td></tr>`).join('')}</table></div></div>`;
    $('#fs').onsubmit = async e => { e.preventDefault(); const f = e.target; try { await LWP.setCfg('exercise', { name: f.n.value.trim() || 'Gyakorlat', yellow_min: +f.y.value || 5, red_min: Math.max(+f.r.value || 15, (+f.y.value || 5) + 1) }); U.toast('Mentve.'); } catch (er) { U.toast(er.message); } };
    $('#fp').onsubmit = async e => { e.preventDefault(); const l = e.target.p.value, c = e.target.c.value; if (!l && !c) return U.toast('Adj meg legalább egy új kódot.'); if (l && l.length < 8) return U.toast('A gyakorlatvezetői kód legalább 8 karakter legyen.'); if (c && c.length < 6) return U.toast('A COP-kód legalább 6 karakter legyen.'); try { await LWP.setCodes(l, c); e.target.reset(); U.toast('Kód(ok) módosítva.'); } catch (er) { U.toast(er.message); } };
    $('#fo').onsubmit = async e => { e.preventDefault(); try { await LWP.setOpenLogin(e.target.o.checked); U.toast('Mentve.'); } catch (er) { U.toast(er.message); } };
    $('#rg').onclick = async () => { if (!confirm('Új egységkódot kap minden szervezeti elem; a régi QR-kódok érvénytelenek lesznek. Folytatod?')) return; try { await LWP.regenCodes(); U.toast('Új kódok generálva – nyomtasd ki újra a QR-lapot.'); } catch (er) { U.toast(er.message); } };
    $('#x1').onclick = exportMessages; $('#x2').onclick = exportSummary; $('#x3').onclick = exportJSON; $('#aq').onclick = allQr;
    root.onclick = e => { const c = e.target.closest('[data-cp]'); if (c) navigator.clipboard.writeText(c.dataset.cp).then(() => U.toast('Hivatkozás másolva.'), () => U.toast('A másolás nem sikerült.')); };
    return null;
  }

  /* ---------- csoportfelület ---------- */
  function groupLogin(msg) {
    app.innerHTML = `<main class="home">${brand}<form class="card glass login" id="tk"><h3>Csoport belépése</h3><p class="muted">${esc(msg || 'Add meg a QR-lapon lévő egységkódot, vagy olvasd be a QR-kódot. Kód nélkül a belépő oldalon a szervezeti elem kiválasztásával léphetsz be (ha a gyakorlatvezető engedélyezte).')}</p><input name="t" placeholder="egységkód" autocomplete="off"><button class="btn pri">Belépés</button><a href="#/">← belépő oldal</a></form></main>`;
    $('#tk').onsubmit = e => { e.preventDefault(); location.hash = '#/g/' + encodeURIComponent(e.target.t.value.trim()); };
  }
  async function viewGroup(token, my) {
    if (token) {
      try { await LWP.signIn('group', { token: decodeURIComponent(token) }); if (my !== routing) return; history.replaceState(null, '', location.pathname + location.search + '#/g'); }
      catch (er) { if (my === routing) mount(() => groupLogin(er.message)); return; }
    }
    const ok = await LWP.activate('group'); if (my !== routing) return;
    if (!ok) { mount(() => groupLogin()); return; }
    mount(() => {
      const gid = LWP.gid, me = () => LWP.group(gid);
      const G = { tab: 'cop', other: null };
      // aktivitásmérés: csak valódi használat (érintés, kattintás, gépelés) számít, látható lapon
      let lastIn = Date.now();
      ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'].forEach(ev => document.addEventListener(ev, () => { lastIn = Date.now(); }, { passive: true }));
      const beat = () => { if (document.visibilityState === 'visible' && Date.now() - lastIn < 120000) LWP.beat(gid).catch(() => { }); };
      const iv = setInterval(beat, 20000); cleanup.push(() => clearInterval(iv)); beat();

      const chan = () => G.tab === 'map' ? 'map' : G.tab === 'cop' ? 'cop' : G.tab === 'lead' ? 'lead:' + gid : 'dm:' + [gid, G.other].sort().join('~');
      const rk = c => 'tdw-gr:' + gid + ':' + c;
      const unread = c => S.msgs.filter(m => m.channel === c && !m.deleted && m.author_id !== gid && m.created_at > (localStorage.getItem(rk(c)) || '1970')).length;
      app.innerHTML = `<div class="grp"><header class="gh glass"><div id="gh" class="ghi"></div><span id="gsnd"></span></header><nav class="gt glass" id="gt"></nav><div class="gb"><aside class="gside glass" id="gs" hidden></aside><div class="gmain glass"><div id="f"></div><div id="c"></div></div></div></div>`;
      let curKey = '', feed, mapCtl = null, mapComp = null;
      const vis = inc => inc.targets === 'all' || (Array.isArray(inc.targets) && inc.targets.includes(gid));
      U.notifStart({ relevant: m => m.channel === 'cop' || m.channel === 'lead:' + gid || (m.channel.startsWith('dm:') && m.channel.slice(3).split('~').includes(gid)), mine: m => m.author_type === 'group' && m.author_id === gid });
      U.soundBtn($('#gsnd'));
      function mountChan() {
        const c = chan(); if (c === curKey) return; curKey = c;
        if (mapCtl) { mapCtl.destroy(); mapCtl = null; }
        $('#f').innerHTML = ''; $('#f').className = ''; $('#c').innerHTML = '';
        if (G.tab === 'map') {
          feed = null;
          mapCtl = window.TDWMap.create($('#f'), { visible: vis, msgFilter: m => m.channel === 'cop' || m.channel === 'lead:' + gid || (m.channel.startsWith('dm:') && m.channel.slice(3).split('~').includes(gid)), onReply: id => { mapComp.setIncident(id); mapComp.focus(); }, initialFocus: G.pendingFocus }); G.pendingFocus = null;
          mapComp = U.Composer($('#c'), { placeholder: 'Közlés a COP-ra a kiválasztott incidenshez…', incidents: () => S.incidents.filter(vis), keepIncident: true, onSend: async ({ body, file, incident }) => { await post({ channel: 'cop', type: 'group', id: gid, html: body, file, incident }); beat(); } });
          return;
        }
        if (G.tab === 'dm' && !G.other) { $('#f').innerHTML = '<div class="empty">Válassz egy csoportot a bal oldali listából.</div>'; feed = null; return; }
        feed = U.Feed($('#f'), { channel: c, actor: gid, reader: gid, collapse: c === 'cop' || c === 'lead:' + gid, canDel: m => m.author_type === 'group' && m.author_id === gid, emptyText: G.tab === 'cop' ? 'A COP-on még nincs közlés.' : 'Még nincs üzenet. Írj elsőként!' });
        U.Composer($('#c'), { placeholder: G.tab === 'cop' ? 'Közlés a COP-ra (mindenki látja)…' : G.tab === 'lead' ? 'Üzenet a gyakorlatvezetőnek…' : 'Üzenet a másik csoportnak…', incidents: () => S.incidents.filter(vis), onSend: async ({ body, file, incident }) => { await post({ channel: c, type: 'group', id: gid, html: body, file, incident }); feed.forceBottom(); beat(); } });
      }
      function sync() {
        const g = me(), s = LWP.status(g), c = chan();
        $('#gh').innerHTML = `<span class="ava" style="--c:${BR[g.branch].color}">${ORG.avatar(g.id)}</span><div class="gtitle"><h2>${esc(g.name)}</h2><span class="muted">${esc(BR[g.branch].name)} · ${esc(S.cfg.name)}</span></div><div class="gha"><button class="btn${g.help ? ' warn' : ''}" id="hp"><span>🆘</span><span class="lg"> ${g.help ? 'Segítséget kértél – visszavonás' : 'Segítséget kérek'}</span></button><span class="st">${dot(s.key)}</span></div>`;
        $('#hp').onclick = () => { if (!g.help && !confirm('Jelzed a gyakorlatvezetőnek és a COP-nak, hogy segítséget kér a csoport?')) return; LWP.setHelp(gid, !g.help); };
        const t = (k, l, n) => { const i = l.indexOf(' '); return `<button data-t="${k}" class="${G.tab === k ? 'on' : ''}"><i>${l.slice(0, i)}</i><span>${l.slice(i + 1)}</span>${n ? `<em>${n}</em>` : ''}</button>`; };
        const dmUn = S.groups.filter(x => x.id !== gid).reduce((a, x) => a + unread('dm:' + [gid, x.id].sort().join('~')), 0);
        $('#gt').innerHTML = t('cop', '🖥 COP', G.tab === 'cop' ? 0 : unread('cop')) + t('map', '🗺 Térkép', 0) + t('lead', '🎛 Gyakorlatvezető', G.tab === 'lead' ? 0 : unread('lead:' + gid)) + t('dm', '👥 Csoportok', G.tab === 'dm' ? 0 : dmUn);
        $('#gs').hidden = G.tab !== 'dm';
        if (G.tab === 'dm') $('#gs').innerHTML = BKEYS.map(b => `<h4 style="color:${BR[b].color}">${BR[b].name}</h4>` + groupsOf(b).filter(x => x.id !== gid).map(x => { const un = G.other === x.id ? 0 : unread('dm:' + [gid, x.id].sort().join('~')); return `<button class="gr${G.other === x.id ? ' on' : ''}" data-o="${x.id}" style="--c:${BR[b].color}">${dot(LWP.status(x).key)}<span>${esc(x.name)}</span>${un ? `<em>${un}</em>` : ''}</button>`; }).join('')).join('');
        mountChan();
        if (feed) { feed.sync(); localStorage.setItem(rk(c), new Date().toISOString()); }
      }
      $('#gt').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { G.tab = b.dataset.t; sync(); } };
      $('#gs').onclick = e => { const b = e.target.closest('[data-o]'); if (b) { G.other = b.dataset.o; sync(); } };
      cleanup.push(LWP.on(sync));
      cleanup.push(U.onIncidentFocus(id => { G.pendingFocus = id; if (G.tab !== 'map') { G.tab = 'map'; sync(); } }));
      cleanup.push(() => { if (mapCtl) mapCtl.destroy(); });
      onSync(sync, 30000);
    });
  }

  /* ---------- útválasztó ---------- */
  let routing = 0;
  async function route() {
    const my = ++routing;
    if (S.error && !LWP.role) { app.innerHTML = `<main class="home">${brand}<div class="card glass"><h3>Kapcsolódási hiba</h3><p class="err">${esc(S.error)}</p><p class="muted">Ellenőrizd a hálózatot, majd töltsd újra az oldalt. Kipróbálhatod a helyi demót is: <a href="?local=1">?local=1</a></p></div></main>`; return; }
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'cop') { const ok = await LWP.activate('copview'); if (my !== routing) return; if (!ok) { mount(() => copLogin()); return; } return p[1] === 'dashboard' ? viewDash() : viewCOP(); }
    if (p[0] === 'lead') { const ok = await LWP.activate('lead'); if (my !== routing) return; if (!ok) { mount(() => leadLogin()); return; } return viewLead(); }
    if (p[0] === 'g') return viewGroup(p[1], my);
    return viewHome();
  }
  window.addEventListener('hashchange', route);
  LWP.init().then(() => { document.getElementById('boot').remove(); LWP.onAuthLost(() => route()); route(); });
})();
