/* TERDEF wargaming platform – térkép: Magyarország közigazgatási térképe, ezredek működési területe, incidensek (háromszögek) */
(function () {
  'use strict';
  const LWP = window.LWP, U = window.UI, ORG = window.ORG, S = LWP.S;
  const { esc } = U;
  const SEV = {
    'alacsony': { c: '#585f35', l: 'alacsony' },
    'közepes': { c: '#b5850f', l: 'közepes' },
    'magas': { c: '#a43b26', l: 'magas' },
    'kritikus': { c: '#7a1f12', l: 'kritikus' }
  };
  const sev = k => SEV[k] || SEV['közepes'];

  /* ---------- megyehatárok betöltése + segédfüggvények ---------- */
  let geoP = null, GEO = null;
  function loadGeo() {
    if (!geoP) geoP = fetch('assets/hu-counties.json').then(r => r.json()).then(j => { GEO = j; return j; });
    return geoP;
  }
  function rings(f) { const g = f.geometry; return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; }
  function inRing(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function countyAt(lat, lon) {
    if (!GEO) return null;
    for (const f of GEO.features) for (const poly of rings(f)) if (inRing(lon, lat, poly[0]) && !poly.slice(1).some(h => inRing(lon, lat, h))) return f.properties.name;
    return null;
  }
  function centroid(name) {
    if (!GEO) return ORG.SEAT[name] || null;
    const f = GEO.features.find(x => x.properties.name === name); if (!f) return ORG.SEAT[name] || null;
    let a = 0, cx = 0, cy = 0;
    rings(f).forEach(poly => { const r = poly[0]; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const k = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += k; cx += (r[j][0] + r[i][0]) * k; cy += (r[j][1] + r[i][1]) * k; } });
    a *= 3; return a ? [cy / a, cx / a] : (ORG.SEAT[name] || null);
  }

  /* ---------- incidens megjelenítés ---------- */
  const triIcon = (inc, fresh) => L.divIcon({
    className: 'incmk' + (fresh ? ' fresh' : '') + (inc.severity === 'kritikus' ? ' crit' : ''),
    html: `<svg viewBox="0 0 24 22" width="26" height="24"><path d="M12 1.5 L23 20.5 H1 Z" fill="${sev(inc.severity).c}" stroke="#262a3d" stroke-width="1.7" stroke-linejoin="round"/><rect x="11" y="8" width="2" height="6" fill="#fff"/><rect x="11" y="15.5" width="2" height="2" fill="#fff"/></svg>`,
    iconSize: [26, 24], iconAnchor: [13, 20], popupAnchor: [0, -18], tooltipAnchor: [12, -12]
  });
  const plainText = h => { const d = document.createElement('div'); d.innerHTML = U.sanitize(h || '').replace(/<\/(h\d|p|li|div)>|<br\s*\/?>/gi, '$& '); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  const unitName = id => (LWP.group(id) || ORG.get(id) || { name: id }).name;

  function popupHTML(inc, o) {
    const raw = S.msgs.filter(m => m.incident === inc.id && !m.deleted && (!o.msgFilter || o.msgFilter(m))), seenK = new Map(), msgs = [];
    raw.forEach(m => { const k = m.author_type + '|' + m.author_id + '|' + m.kind + '|' + (m.body || ''); const e = seenK.get(k); if (e) { e.n++; } else { const x = { m, n: 1 }; seenK.set(k, x); msgs.push(x); } });
    const tg = inc.targets === 'all' || !inc.targets ? 'minden szervezeti elem' : (Array.isArray(inc.targets) ? (inc.targets.length > 6 ? inc.targets.length + ' szervezeti elem' : inc.targets.map(t => (ORG.get(t) || { short: t }).short).join(', ')) : '');
    /* válaszok: a reply_to alapján az eredeti közlés (vagy bármely másolata) alá kerülnek */
    const idsOf = new Map(); raw.forEach(m => { const k = m.author_type + '|' + m.author_id + '|' + m.kind + '|' + (m.body || ''); (idsOf.get(k) || idsOf.set(k, new Set()).get(k)).add(m.id); });
    const replyIds = new Set(), all = S.msgs.filter(m => !m.deleted && (!o.msgFilter || o.msgFilter(m) || m.incident === inc.id));
    const repsOf = k => { const ids = idsOf.get(k) || new Set(), seenR = new Set(); return all.filter(r => r.reply_to && ids.has(r.reply_to)).filter(r => { const kk = r.author_type + '|' + r.author_id + '|' + (r.body || ''); if (seenR.has(kk)) return false; seenR.add(kk); return true; }); };
    const medOf = m => { const mt = U.mediaType(m); return mt === 'image' ? `<img class="pm" src="${esc(U.safeUrl(m.media_url))}" alt="" data-zoom>` : mt ? `<a href="${esc(U.safeUrl(m.media_url))}" target="_blank" rel="noopener">📎 ${esc(m.media_name || 'melléklet')}</a>` : ''; };
    const cut = (t, n) => t.length > n ? t.slice(0, n - 2).replace(/\s+\S*$/, '') + '…' : t;
    const keyOf = m => m.author_type + '|' + m.author_id + '|' + m.kind + '|' + (m.body || '');
    const reps = new Map(msgs.map(x => [x.m.id, repsOf(keyOf(x.m))])); reps.forEach(rs => rs.forEach(r => replyIds.add(r.id)));
    const shown = msgs.filter(x => !replyIds.has(x.m.id)), nrep = [...reps.values()].reduce((n, r) => n + r.length, 0);
    const list = shown.length ? shown.map(({ m, n }) => {
      const a = U.author(m), full = plainText(m.body), body = full ? esc(cut(full, 170)) : '', rs = reps.get(m.id) || [];
      const rh = rs.length ? `<div class="ip-reps"><div class="ip-rt">↩ ${rs.length} válasz</div>${rs.map(r => { const ra = U.author(r), rf = plainText(r.body); return `<div class="ip-rep" style="--c:${ra.color}"><div class="ip-mh"><b>${esc(ra.name)}</b><time>${U.fmtTime(r.created_at)}</time></div><div class="ip-mb">${esc(cut(rf, 220))}</div>${medOf(r)}</div>`; }).join('')}</div>` : '';
      return `<div class="ip-msg${m.kind === 'event' ? ' ev' : ''}" style="--c:${a.color}"><div class="ip-mh"><b>${esc(a.name)}</b><time>${U.fmtTime(m.created_at)}</time>${n > 1 && m.author_type === 'lead' ? `<span class="muted">· ${n} csatornán</span>` : ''}</div><div class="ip-mb">${body}</div>${medOf(m)}${rh}</div>`;
    }).join('') : '<p class="muted">Ehhez az incidenshez még nem kapcsolódik közlés.</p>';
    return `<div class="ip" data-id="${esc(inc.id)}">
      <div class="ip-h"><span class="ip-code" style="background:${sev(inc.severity).c}">${esc(LWP.incCode(inc))}</span><b>${esc(inc.title)}</b></div>
      <div class="ip-meta"><span>🕒 ${U.fmtTime(inc.created_at)}</span><span>📍 ${esc(inc.place || inc.county || '–')}${inc.county && inc.place ? ' (' + esc(inc.county) + ')' : ''}</span><span>⚠ ${esc(sev(inc.severity).l)}</span></div>
      <div class="ip-meta"><span>🎯 ${esc(tg)}</span>${inc.unit_id ? `<span>🛡 ${esc(unitName(inc.unit_id))}</span>` : ''}</div>
      <div class="ip-desc">${U.sanitize(inc.body || '')}</div>
      <h5>Releváns és kapcsolódó közlések (${shown.length}${nrep ? ', ' + nrep + ' válasz' : ''})</h5>
      <div class="ip-list">${list}</div>
      <div class="ip-act">${o.onReply ? '<button class="btn pri sm" data-reply>💬 Közlés ehhez az incidenshez</button>' : ''}${o.canMod ? '<button class="btn warn sm" data-rm>🗑 Eltávolítás a térképről</button>' : ''}</div>
    </div>`;
  }

  /* ---------- fő térkép ---------- */
  function create(host, o) {
    o = o || {};
    host.classList.add('tdwmap');
    host.innerHTML = '<div class="tdwmap-c"></div><div class="tdwmap-msg">Térkép betöltése…</div>';
    const el = host.querySelector('.tdwmap-c');
    const map = L.map(el, { center: [47.17, 19.5], zoom: 7, minZoom: 6, maxZoom: 17, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, worldCopyJump: false, attributionControl: true, maxBounds: [[43.5, 12.5], [50.7, 26.5]], maxBoundsViscosity: 0.6 });
    map.attributionControl.setPrefix(false);
    const blank = L.layerGroup(), osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    blank.addTo(map);
    const countyLayer = L.layerGroup().addTo(map), seatLayer = L.layerGroup(), incLayer = L.layerGroup().addTo(map), labelLayer = L.layerGroup().addTo(map);
    L.control.layers({ 'Közigazgatási (csak határok)': blank, 'Utcatérkép (OSM)': osm }, { 'Ezredek működési területe': countyLayer, 'Ezred-feliratok': labelLayer, 'Zászlóalj-székhelyek': seatLayer, 'Incidensek': incLayer }, { collapsed: true, position: 'topright' }).addTo(map);
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
    // jelmagyarázat
    const lg = L.control({ position: 'bottomright' });
    lg.onAdd = () => {
      const d = L.DomUtil.create('div', 'maplg');
      d.innerHTML = '<b>Működési területek</b>' + ORG.REG.map(r => `<div><i style="background:${r[3]}"></i>${r[0]}. TVE</div>`).join('') + '<hr><b>Incidens</b>' + Object.keys(SEV).map(k => `<div><svg viewBox="0 0 24 22" width="14" height="13"><path d="M12 1.5 L23 20.5 H1 Z" fill="${SEV[k].c}" stroke="#262a3d" stroke-width="1.5"/></svg>${k}</div>`).join('');
      L.DomEvent.disableClickPropagation(d); return d;
    };
    lg.addTo(map);
    const resetBtn = L.control({ position: 'topleft' });
    resetBtn.onAdd = () => { const b = L.DomUtil.create('a', 'leaflet-bar maprst'); b.href = '#'; b.title = 'Teljes ország'; b.textContent = '⌂'; L.DomEvent.on(b, 'click', e => { L.DomEvent.stop(e); map.flyTo([47.17, 19.5], 7, { duration: .6 }); }); return b; };
    resetBtn.addTo(map);

    const markers = new Map(); let seenIds = new Set(); let first = true, destroyed = false;
    function visible(inc) { return !inc.deleted && (!o.visible || o.visible(inc)); }
    let openId = null, panel = null, psig = '';
    function closePanel() { openId = null; psig = ''; if (panel) { panel.remove(); panel = null; } }
    function positionPanel() {
      if (!panel || !openId) return; const mk = markers.get(openId); if (!mk) return closePanel();
      const hr = host.getBoundingClientRect(), pt = map.latLngToContainerPoint(mk.getLatLng()), x = hr.left + pt.x, y = hr.top + pt.y;
      const w = panel.offsetWidth, hh = panel.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 20;
      let left = x + gap; if (left + w > vw - 8) left = x - gap - w; if (left < 8) left = Math.max(8, Math.min(vw - w - 8, x - w / 2));
      let top = y - hh / 2; top = Math.max(8, Math.min(vh - hh - 8, top));
      panel.style.left = left + 'px'; panel.style.top = top + 'px';
    }
    function renderPanel() {
      const inc = LWP.incident(openId); if (!inc) return closePanel();
      const sig = JSON.stringify([inc.title, inc.body, o._expand, S.msgs.filter(m => (m.incident === inc.id || m.reply_to) && !m.deleted).length]);
      if (panel && sig === psig) { positionPanel(); return; } psig = sig;
      if (!panel) { panel = document.createElement('div'); panel.className = 'ippop2'; document.body.appendChild(panel); }
      panel.innerHTML = '<button class="ip-x" data-close aria-label="Bezár">×</button>' + popupHTML(inc, o); positionPanel();
    }
    function openPanel(id) { o._expand = false; openId = id; psig = ''; renderPanel(); if (panel) panel.onclick = panelClick; }
    function panelClick(e) {
      const inc = LWP.incident(openId); if (!inc) return;
      if (e.target.matches('[data-zoom]')) { U.lightbox(e.target.src); return; }
      if (e.target.closest('[data-close]')) { closePanel(); return; }
      if (e.target.closest('[data-more]')) { o._expand = true; psig = ''; renderPanel(); return; }
      if (e.target.closest('[data-reply]')) { closePanel(); o.onReply && o.onReply(inc.id); return; }
      if (e.target.closest('[data-rm]')) { if (confirm('Eltávolítod az incidenst a térképről? (A kapcsolódó közlések megmaradnak.)')) { closePanel(); LWP.patchIncident(inc.id, { deleted: true }).catch(err => U.toast(err.message)); } }
    }
    map.on('move zoom resize', positionPanel); map.on('click', closePanel);
    const onKey = e => { if (e.key === 'Escape') closePanel(); }; document.addEventListener('keydown', onKey);
    addEventListener('resize', positionPanel);

    function drawStatic() {
      countyLayer.clearLayers(); labelLayer.clearLayers(); seatLayer.clearLayers();
      L.geoJSON(GEO, {
        style: f => { const e = ORG.countyEzred[f.properties.name], col = e ? ORG.byId[e].color : '#999'; return { color: '#3a3d33', weight: 1.1, fillColor: col, fillOpacity: 0.3 }; },
        onEachFeature: (f, ly) => {
          const n = f.properties.name, e = ORG.countyEzred[n], u = ORG.unitsOfCounty(n);
          const lbl = n === 'Budapest' ? 'Budapest főváros' : n + ' vármegye';
          ly.bindTooltip(`<b>${esc(lbl)}</b><br>${e ? esc(ORG.byId[e].name) : ''}<br>${u.zaszlo ? esc(ORG.byId[u.zaszlo].short) : ''}`, { sticky: true, className: 'cotip' });
          ly.on('mouseover', () => ly.setStyle({ fillOpacity: .5, weight: 2 })); ly.on('mouseout', () => ly.setStyle({ fillOpacity: .3, weight: 1.1 }));
        }
      }).addTo(countyLayer);
      ORG.REG.forEach(r => {
        const pts = r[2].map(b => centroid(b[0])).filter(Boolean); if (!pts.length) return;
        const lat = pts.reduce((a, p) => a + p[0], 0) / pts.length, lon = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: 'regl', html: `<span style="border-color:${r[3]}">${r[0]}. TVE</span>`, iconSize: [60, 22], iconAnchor: [30, 11] }) }).addTo(labelLayer);
      });
      ORG.list.filter(x => x.level === 'zaszlo').forEach(z => {
        L.circleMarker([z.lat, z.lon], { radius: 4, color: '#262a3d', weight: 1.5, fillColor: '#e4dfca', fillOpacity: 1 }).bindTooltip(esc(z.short) + ' · ' + esc(z.county), { direction: 'top' }).addTo(seatLayer);
      });
      L.circleMarker([ORG.byId.thp.lat, ORG.byId.thp.lon], { radius: 6, color: '#262a3d', weight: 2, fillColor: '#b5850f', fillOpacity: 1 }).bindTooltip('MH THP – Budapest', { direction: 'top' }).addTo(seatLayer);
      host.querySelector('.tdwmap-msg').remove();
      map.invalidateSize();
    }

    function refresh() {
      if (destroyed) return;
      const list = S.incidents.filter(visible);
      const ids = new Set(list.map(x => x.id));
      markers.forEach((m, id) => { if (!ids.has(id)) { incLayer.removeLayer(m); markers.delete(id); } });
      // azonos koordináták szétnyitása
      const groups = {};
      list.forEach(inc => { const k = inc.lat.toFixed(3) + ',' + inc.lon.toFixed(3); (groups[k] = groups[k] || []).push(inc); });
      list.forEach(inc => {
        const g = groups[inc.lat.toFixed(3) + ',' + inc.lon.toFixed(3)], idx = g.indexOf(inc);
        let lat = inc.lat, lon = inc.lon;
        if (g.length > 1) { const ang = idx / g.length * Math.PI * 2, r = 0.035; lat += Math.sin(ang) * r * 0.7; lon += Math.cos(ang) * r; }
        const fresh = !first && !seenIds.has(inc.id) && (Date.now() - new Date(inc.created_at) < 60000);
        let mk = markers.get(inc.id);
        if (!mk) {
          mk = L.marker([lat, lon], { icon: triIcon(inc, fresh), riseOnHover: true, title: '' });
          mk.bindTooltip(`<b>${esc(LWP.incCode(inc))}</b> ${esc(inc.title)}`, { direction: 'top' });
          mk.on('click', () => openPanel(inc.id));
          mk.addTo(incLayer); markers.set(inc.id, mk);
          if (fresh && o.autoFlash) setTimeout(() => { mk.getElement() && mk.getElement().classList.remove('fresh'); }, 8000);
        } else {
          mk.setLatLng([lat, lon]); mk.setIcon(triIcon(inc, false));
          if (openId === inc.id) renderPanel();
        }
      });
      list.forEach(x => seenIds.add(x.id)); first = false;
    }
    function focusIncident(id) {
      const mk = markers.get(id);
      if (!mk) { U.toast('Ez az incidens nem látható ezen a térképen.'); return false; }
      const ll = mk.getLatLng(), z = Math.max(map.getZoom(), 9);
      map.once('moveend', () => openPanel(id));
      if (map.getCenter().distanceTo(ll) < 500 && map.getZoom() >= 9) openPanel(id); else map.flyTo(ll, z, { duration: .8 });
      return true;
    }
    const offs = [LWP.on(refresh), U.onIncidentFocus(focusIncident)];
    const ro = window.ResizeObserver ? new ResizeObserver(() => map.invalidateSize()) : null; if (ro) ro.observe(host);
    loadGeo().then(() => { if (destroyed) return; drawStatic(); refresh(); if (o.initialFocus) focusIncident(o.initialFocus); });
    return {
      map, refresh, focusIncident, invalidate: () => map.invalidateSize(),
      destroy() { destroyed = true; closePanel(); document.removeEventListener('keydown', onKey); removeEventListener('resize', positionPanel); offs.forEach(f => f()); if (ro) ro.disconnect(); map.remove(); }
    };
  }

  /* ---------- helykiválasztó (JEMM injectek elhelyezéséhez) ---------- */
  function pick(cur, cb, title) {
    const m = U.modal(`<h3>${esc(title || 'Helyszín kijelölése')}</h3><p class="muted">Kattints a térképre a pont kijelöléséhez; a vármegye automatikusan felismerésre kerül.</p><div class="pickmap tdwmap"><div class="tdwmap-c"></div></div><div class="pk-row"><label>Település / helymegnevezés <input id="pkp" placeholder="pl. Paks, M0 híd"></label><span id="pkc" class="muted"></span><button class="btn pri" id="pkok" disabled>Kijelölés</button></div>`, 'wide');
    const host = m.querySelector('.pickmap'), el = host.firstElementChild;
    const map = L.map(el, { center: cur && cur.lat ? [cur.lat, cur.lon] : [47.17, 19.5], zoom: cur && cur.lat ? 9 : 7, minZoom: 6, zoomSnap: .25 });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    let sel = cur && cur.lat ? { lat: cur.lat, lon: cur.lon } : null, mk = null;
    if (cur && cur.place) m.querySelector('#pkp').value = cur.place;
    loadGeo().then(() => {
      L.geoJSON(GEO, { style: f => ({ color: '#3a3d33', weight: 1, fillColor: (ORG.byId[ORG.countyEzred[f.properties.name]] || {}).color || '#999', fillOpacity: .18 }), interactive: false }).addTo(map);
      set(sel);
    });
    function set(p) {
      if (!p) return; sel = p;
      if (mk) mk.setLatLng([p.lat, p.lon]); else mk = L.marker([p.lat, p.lon], { icon: triIcon({ severity: 'közepes' }) }).addTo(map);
      const c = countyAt(p.lat, p.lon); sel.county = c;
      m.querySelector('#pkc').textContent = `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)} · ${c || 'országhatáron kívül'}`;
      m.querySelector('#pkok').disabled = false;
    }
    map.on('click', e => set({ lat: e.latlng.lat, lon: e.latlng.lng }));
    setTimeout(() => map.invalidateSize(), 200);
    m.querySelector('#pkok').onclick = () => { cb({ lat: sel.lat, lon: sel.lon, county: sel.county, place: m.querySelector('#pkp').value.trim() }); map.remove(); m.remove(); };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) map.remove(); });
  }

  window.TDWMap = { create, pick, loadGeo, countyAt, centroid, SEV, sev };
})();
