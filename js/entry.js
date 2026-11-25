/* TERDEF wargaming platform – belépő (gránát) és szerepválasztás */
(function () {
  'use strict';
  const LWP = window.LWP, ORG = window.ORG, U = window.UI, S = LWP.S;
  const { esc, $ } = U;
  const stage = () => document.getElementById('stage'), box = () => document.getElementById('login');
  let grenLoaded = false;
  const seen = () => { try { return sessionStorage.getItem('tdw-gren') === '1'; } catch (_) { return false; } };

  function card() {
    const eze = ORG.list.filter(o => o.level === 'ezred');
    const opts = '<option value="">— válassz szervezeti elemet —</option>' + ORG.list.filter(o => o.level === 'thp').map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('') +
      eze.map(e => `<optgroup label="${esc(e.name)}"><option value="${e.id}">${esc(e.name)} (törzs)</option>${ORG.list.filter(z => z.parent === e.id).map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('')}</optgroup>`).join('');
    box().innerHTML = `<div class="gcard" role="document">
      <div class="gbadge"><svg viewBox="0 0 48 48" width="30" height="30" fill="none"><path d="M24 3 42 10v14c0 10-8 18-18 21C14 42 6 34 6 24V10z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 15 35 33H13z" fill="currentColor"/></svg></div>
      <h2 id="login-title">TERDEF wargaming platform</h2><p class="gsub">MH Területvédelmi és Hadkiegészítő Parancsnokság és alárendeltjei</p>
      <div class="gtabs" role="tablist"><button data-m="unit" class="on">Szervezeti elem</button><button data-m="lead">Gyakorlatvezető</button></div>
      <form id="f-unit" class="gform"><label>Szervezeti elem<select name="u">${opts}</select></label><label>Egységkód (ha a gyakorlatvezető kéri)<input name="c" autocomplete="off" placeholder="pl. QR-lapon szereplő kód"></label><button class="gpri" type="submit">Belépés a gyakorlatra</button></form>
      <form id="f-lead" class="gform" hidden><label>Belépési kód<input type="password" name="p" autocomplete="current-password" placeholder="Gyakorlatvezetői kód"></label><button class="gpri" type="submit">Belépés gyakorlatvezetőként</button></form>
      <p class="gerr" id="gerr" role="alert"></p>
      <a class="glink" href="#/cop">🖥 Közös operatív kép (COP) megtekintése</a>
      <small class="gver">v${esc(window.LWP_CONFIG.version)} · ${esc(window.LWP_CONFIG.date)}</small></div>`;
    const err = m => { $('#gerr').textContent = m || ''; const c = $('.gcard'); c.classList.remove('shake'); void c.offsetWidth; if (m) c.classList.add('shake'); };
    box().querySelector('.gtabs').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; box().querySelectorAll('.gtabs button').forEach(x => x.classList.toggle('on', x === b)); $('#f-unit').hidden = b.dataset.m !== 'unit'; $('#f-lead').hidden = b.dataset.m !== 'lead'; err(''); const i = box().querySelector(b.dataset.m === 'lead' ? '[name=p]' : '[name=u]'); i && i.focus(); };
    $('#f-unit').onsubmit = async e => {
      e.preventDefault(); const id = e.target.u.value, code = (e.target.c.value || '').trim();
      if (!id && !code) return err('Válassz szervezeti elemet, vagy add meg az egységkódot.');
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await LWP.signIn('group', code ? { token: code } : { group: id }); if (location.hash === '#/g') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '#/g'; }
      catch (er) { err(er.message); } finally { btn.disabled = false; }
    };
    $('#f-lead').onsubmit = async e => {
      e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await LWP.signIn('lead', e.target.p.value); if (location.hash === '#/lead') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '#/lead'; } catch (er) { err(er.message); } finally { btn.disabled = false; }
    };
  }
  function openCard() { card(); const b = box(); b.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('open'))); }

  const TDW = window.TDW = {
    onGrenadeReleased() { try { sessionStorage.setItem('tdw-gren', '1'); } catch (_) { } card(); },
    showEntry() {
      document.body.classList.add('entry'); document.getElementById('app').hidden = true;
      if (seen() || /[?&]nogren/.test(location.search)) { stage().hidden = true; document.body.classList.add('plain'); openCard(); return; }
      stage().hidden = false; document.body.classList.remove('plain'); window.__sgStop = false;
      if (grenLoaded) { location.reload(); return; } grenLoaded = true; card();
      const s = document.createElement('script'); s.src = 'js/grenade.js?v=' + window.LWP_CONFIG.version;
      s.onload = () => { const v = document.getElementById('version'); if (v) v.textContent = 'v' + window.LWP_CONFIG.version + ' · ' + window.LWP_CONFIG.date; };
      s.onerror = () => { stage().hidden = true; document.body.classList.add('plain'); openCard(); };
      document.body.appendChild(s);
    },
    hideEntry() { document.body.classList.remove('entry', 'plain', 'login-open'); window.__sgStop = true; const st = stage(), b = box(); if (st) st.hidden = true; if (b) { b.hidden = true; b.classList.remove('open'); } document.getElementById('app').hidden = false; }
  };
})();
