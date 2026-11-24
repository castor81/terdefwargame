/* TERDEF wargaming platform – közös UI elemek: hírfolyam (Feed), üzenetszerkesztő (Composer), segédek */
(function () {
  'use strict';
  const { S, BR } = window.LWP;
  const EMOJI = ['👍', '❤️', '😂', '😮', '👏', '🔥', '✅', '❓'];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html, tag) => { const t = document.createElement(tag || 'div'); t.innerHTML = html; return t; };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = ts => { const d = new Date(ts); return `${d.getMonth() + 1}.${d.getDate()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtHM = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDur = sec => { sec = Math.round(sec); if (sec < 60) return sec + ' mp'; const m = Math.floor(sec / 60); return m < 60 ? m + ' perc' : Math.floor(m / 60) + ' ó ' + (m % 60) + ' p'; };

  /* HTML-tisztító: csak egyszerű formázás maradhat (a vezetői közlések szövege formázott) */
  const OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P', 'H3', 'H4', 'DIV', 'SPAN']);
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    (function walk(n) {
      Array.from(n.childNodes).forEach(c => {
        if (c.nodeType === 8) c.remove();
        else if (c.nodeType === 1) {
          walk(c);
          if (!OK.has(c.tagName)) { if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(c.tagName)) c.remove(); else c.replaceWith(...Array.from(c.childNodes)); }
          else Array.from(c.attributes).forEach(a => c.removeAttribute(a.name));
        }
      });
    })(doc.body);
    return doc.body.innerHTML;
  }
  const plainHTML = t => esc(t).replace(/\n/g, '<br>');

  function mediaType(m) {
    if (!m.media_url) return null;
    if (m.media_type) return m.media_type;
    if (['image', 'audio', 'video'].includes(m.kind)) return m.kind;
    const n = (m.media_name || m.media_url).toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(n) || m.media_url.startsWith('data:image')) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac|weba|webm_audio)(\?|$)/.test(n) || m.media_url.startsWith('data:audio')) return 'audio';
    if (/\.(mp4|mov|webm|mkv|avi|m4v)(\?|$)/.test(n) || m.media_url.startsWith('data:video')) return 'video';
    return 'file';
  }
  const kindOfFile = f => f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : 'file';

  function author(m) {
    if (m.author_type === 'lead') return { name: 'Gyakorlatvezető', short: 'GV', color: '#d8b45a', badge: 'Gyakorlatvezető' };
    if (m.author_type === 'system') return { name: 'Rendszer', short: '⚙', color: '#7b8794' };
    const g = window.LWP.group(m.author_id);
    if (!g) return { name: m.author_id, short: '?', color: '#7b8794' };
    return { name: g.name, short: window.ORG.avatar(g.id), color: BR[g.branch].color, branch: BR[g.branch].name };
  }
  const actorName = a => a === 'lead' ? 'Gyakorlatvezető' : (window.LWP.group(a) || { name: a }).name;

  /* ---------- hang (sziréna) ---------- */
  const AU = { ctx: null, on: (() => { try { return localStorage.getItem('tdw-snd') !== '0'; } catch (_) { return true; } })() };
  function initAudio() {
    try { if (!AU.ctx) AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (AU.ctx.state === 'suspended') AU.ctx.resume(); } catch (_) { }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, initAudio, { passive: true }));
  function siren(sec) {
    if (!AU.on || !AU.ctx || AU.ctx.state !== 'running') return false;
    const c = AU.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'sawtooth';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.2, t + .12);
    g.gain.setValueAtTime(.2, t + sec - .35); g.gain.exponentialRampToValueAtTime(.0001, t + sec);
    o.frequency.setValueAtTime(650, t);
    for (let k = 0; k < Math.ceil(sec / .9); k++) { o.frequency.linearRampToValueAtTime(980, t + k * .9 + .45); o.frequency.linearRampToValueAtTime(650, t + k * .9 + .9); }
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + sec + .05);
    return true;
  }
  function beep() {
    if (!AU.ctx || AU.ctx.state !== 'running') return;
    const c = AU.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.frequency.value = 880; g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .3);
  }
  /* hangkapcsoló gomb: a böngésző csak felhasználói kattintás után engedi a hangot */
  function soundBtn(host) {
    const b = document.createElement('button'); b.className = 'btn snd'; host.appendChild(b);
    const paint = () => {
      const run = AU.ctx && AU.ctx.state === 'running';
      b.textContent = !AU.on ? '🔕 Hang ki' : run ? '🔔 Hang be' : '🔇 Hang engedélyezése';
      b.classList.toggle('need', AU.on && !run);
    };
    b.onclick = () => { AU.on = !(AU.on && AU.ctx && AU.ctx.state === 'running') ? true : false; try { localStorage.setItem('tdw-snd', AU.on ? '1' : '0'); } catch (_) { } initAudio(); setTimeout(() => { if (AU.on) beep(); paint(); }, 120); paint(); };
    const iv = setInterval(() => { if (!b.isConnected) clearInterval(iv); else paint(); }, 800); paint();
    return b;
  }

  /* ---------- értesítő: új közlés előbb nagy pop-up, majd beágyazódik a hírfolyamba ---------- */
  const Notif = { seen: new Set(), holding: new Set(), released: new Map(), queue: [], busy: false, cfg: null, off: null };
  function notifStop() {
    if (Notif.off) Notif.off(); Notif.off = null; Notif.queue = []; Notif.holding.clear(); Notif.busy = false;
    document.querySelectorAll('.alertpop').forEach(e => e.remove());
  }
  function notifStart(cfg) {
    notifStop(); Notif.cfg = cfg; Notif.seen = new Set(S.msgs.map(m => m.id));
    Notif.off = window.LWP.on(notifCheck);
  }
  function notifCheck() {
    const now = Date.now();
    S.msgs.forEach(m => {
      if (Notif.seen.has(m.id)) return; Notif.seen.add(m.id);
      if (m.deleted || now - new Date(m.created_at) > 300000) return;
      if (Notif.cfg.mine(m) || !Notif.cfg.relevant(m)) return;
      Notif.holding.add(m.id); Notif.queue.push(m);
    });
    notifRun();
  }
  function whereLabel(m) {
    if (m.channel === 'cop') return 'COP';
    if (m.channel.startsWith('lead:')) return m.author_type === 'lead' ? 'Üzenet a gyakorlatvezetőtől' : 'Üzenet a gyakorlatvezetőnek';
    return 'Csoportközi üzenet';
  }
  function notifRun() {
    if (Notif.busy || !Notif.queue.length) return;
    Notif.busy = true;
    const m = Notif.queue.shift(), rest = Notif.queue.length, a = author(m), mt = mediaType(m);
    const alarm = !!m.pinned && m.author_type === 'lead';
    const body = m.body ? `<div class="ap-b">${m.author_type === 'group' ? plainHTML(m.body) : sanitize(m.body)}</div>` : '';
    const media = mt === 'image' ? `<img class="ap-m" src="${esc(m.media_url)}" alt="">` : mt === 'video' ? `<video class="ap-m" src="${esc(m.media_url)}" muted autoplay loop playsinline></video>` : mt === 'audio' ? '<div class="ap-b">🎵 Hangüzenet</div>' : mt === 'file' ? `<div class="ap-b">📎 ${esc(m.media_name || 'fájl')}</div>` : '';
    const el = h(`<div class="ap-card" style="--c:${a.color}"><div class="ap-h"><span class="ava">${esc(a.short)}</span><div><b>${esc(a.name)}</b><small>${esc(whereLabel(m))} · ${fmtHM(m.created_at)}</small></div>${alarm ? '<span class="badge ev">KIEMELT KÖZLÉS</span>' : m.kind === 'event' ? '<span class="badge ev">ESEMÉNY</span>' : '<span class="badge">ÚJ KÖZLÉS</span>'}</div>${body}${media}${rest ? `<div class="ap-more">+${rest} további új közlés vár</div>` : ''}</div>`);
    const wrap = document.createElement('div'); wrap.className = 'alertpop' + (alarm ? ' alarm' : ''); wrap.appendChild(el);
    document.body.appendChild(wrap);
    if (alarm) siren(3.6); else beep();
    const dur = alarm ? 4500 : rest > 2 ? 1500 : 2800;
    let done = false;
    const finish = () => {
      if (done) return; done = true; wrap.classList.add('out');
      setTimeout(() => {
        wrap.remove(); Notif.holding.delete(m.id); Notif.released.set(m.id, alarm);
        setTimeout(() => Notif.released.delete(m.id), 8000);
        Notif.busy = false; window.LWP.touch(); notifRun();
      }, 350);
    };
    wrap.onclick = finish; setTimeout(finish, dur);
  }

  /* ---------- Feed ---------- */
  function Feed(root, o) {
    o = o || {};
    root.classList.add('feed');
    if (o.big) root.classList.add('big');
    const nodes = new Map();
    let stick = true;
    root.addEventListener('scroll', () => { stick = root.scrollHeight - root.scrollTop - root.clientHeight < 90; });
    root.addEventListener('load', () => { if (stick) root.scrollTop = root.scrollHeight; }, true);

    function rxByMsg() {
      const map = new Map();
      S.reacts.forEach(r => { let a = map.get(r.message_id); if (!a) map.set(r.message_id, a = []); a.push(r); });
      return map;
    }
    function rxHTML(m, list) {
      const by = {};
      (list || []).forEach(r => { (by[r.emoji] = by[r.emoji] || []).push(r.actor); });
      const chips = Object.keys(by).map(e => {
        const mine = o.actor && by[e].includes(o.actor);
        return `<button class="rxchip${mine ? ' mine' : ''}" data-rx="${e}" title="${esc(by[e].map(actorName).join(', '))}" ${o.actor ? '' : 'disabled'}>${e} <b>${by[e].length}</b></button>`;
      }).join('');
      const add = o.actor ? `<span class="rxadd"><button class="rxplus" data-rxopen title="Reagálok">☺＋</button><span class="picker">${EMOJI.map(e => `<button data-rx="${e}">${e}</button>`).join('')}</span></span>` : '';
      return chips + add;
    }
    function build(m) {
      const a = author(m), el = document.createElement('article');
      el.className = 'post' + (m.kind === 'event' ? ' event' : '') + (m.author_type === 'lead' ? ' fromlead' : '');
      if (Notif.released.has(m.id)) { el.classList.add('fresh'); if (Notif.released.get(m.id)) el.classList.add('alarm'); setTimeout(() => el.classList.remove('fresh', 'alarm'), 5000); }
      el.dataset.id = m.id;
      el.style.setProperty('--c', a.color);
      const body = m.body ? (m.author_type === 'group' ? plainHTML(m.body) : sanitize(m.body)) : '';
      const mt = mediaType(m);
      let media = '';
      if (mt === 'image') media = `<img class="pm" loading="lazy" src="${esc(m.media_url)}" alt="${esc(m.media_name || 'kép')}" data-zoom>`;
      else if (mt === 'video') media = `<video class="pm" controls preload="metadata" src="${esc(m.media_url)}"></video>`;
      else if (mt === 'audio') media = `<audio class="pa" controls preload="metadata" src="${esc(m.media_url)}"></audio>`;
      else if (mt === 'file') media = `<a class="pf" href="${esc(m.media_url)}" target="_blank" rel="noopener">📎 ${esc(m.media_name || 'fájl')}</a>`;
      el.innerHTML = `<header><span class="ava">${esc(a.short)}</span><div class="who"><b>${esc(a.name)}</b>${a.badge ? `<span class="badge">${esc(a.badge)}</span>` : ''}${m.kind === 'event' ? '<span class="badge ev">ESEMÉNY</span>' : ''}<span class="incslot"></span><time>${fmtTime(m.created_at)}</time></div>${(o.canMod || (o.canDel && o.canDel(m))) ? `<span class="mod">${o.canMod ? '<button data-pin title="Kiemelés a COP-on">📌 Kiemel</button>' : ''}<button data-del title="Közlés törlése">🗑 Törlés</button></span>` : ''}</header>${body ? `<div class="pb">${body}</div>` : ''}${media ? `<div class="pmedia">${media}</div>` : ''}<footer class="rx"></footer>`;
      el._sig = null;
      return el;
    }
    function update(el, m, list) {
      const incc = m.incident ? ((window.LWP.incident(m.incident) || {}).seq || '?') : '';
      const sig = JSON.stringify([m.pinned, (list || []).map(r => r.emoji + r.actor).sort(), o.actor, incc]);
      if (el._sig === sig) return;
      el._sig = sig;
      el.classList.toggle('pinned', !!m.pinned);
      const slot = el.querySelector('.incslot');
      if (slot) { const inc = m.incident && window.LWP.incident(m.incident); slot.innerHTML = m.incident ? `<button class="incchip" data-inc="${esc(m.incident)}" title="Ugrás a térképen">🗺 ${inc ? esc(window.LWP.incCode(inc)) : 'INC'}</button>` : ''; }
      const open = el.querySelector('.picker.open');
      if (!open) el.querySelector('.rx').innerHTML = rxHTML(m, list);
    }
    function sync() {
      const list = S.msgs.filter(m => !m.deleted && !Notif.holding.has(m.id) && (o.filter ? o.filter(m) : m.channel === o.channel));
      const by = rxByMsg(), keep = new Set();
      let prev = null;
      list.forEach(m => {
        keep.add(m.id);
        let el = nodes.get(m.id);
        if (!el) { el = build(m); nodes.set(m.id, el); }
        const want = prev ? prev.nextSibling : root.firstChild;
        if (want !== el) root.insertBefore(el, want);
        update(el, m, by.get(m.id));
        prev = el;
      });
      nodes.forEach((el, id) => { if (!keep.has(id)) { el.remove(); nodes.delete(id); } });
      let empty = root.querySelector('.empty');
      if (!list.length) { if (!empty) root.appendChild(h(o.emptyText || 'Még nincs közlés.', 'div')).className = 'empty'; }
      else if (empty) empty.remove();
      if (stick) root.scrollTop = root.scrollHeight;
      return list;
    }
    root.addEventListener('click', e => {
      const post = e.target.closest('.post'); if (!post) return;
      const id = post.dataset.id;
      const open = e.target.closest('[data-rxopen]');
      if (open) { const p = post.querySelector('.picker'); $$('.picker.open', root).forEach(x => x !== p && x.classList.remove('open')); p.classList.toggle('open'); return; }
      const rx = e.target.closest('[data-rx]');
      if (rx && o.actor) { post.querySelector('.picker') && post.querySelector('.picker').classList.remove('open'); window.LWP.react(id, o.actor, rx.dataset.rx).catch(err => toast(err.message)); return; }
      if (e.target.closest('[data-pin]')) { const m = S.msgs.find(x => x.id === id); window.LWP.patchMsg(id, { pinned: !m.pinned }); return; }
      if (e.target.closest('[data-del]')) {
        const m = S.msgs.find(x => x.id === id);
        if (!(o.canMod || (o.canDel && m && o.canDel(m)))) return;
        if (confirm('Biztosan törlöd ezt a közlést mindenki felületéről?')) window.LWP.patchMsg(id, { deleted: true }).catch(err => toast(err.message));
        return;
      }
      const ic = e.target.closest('[data-inc]'); if (ic) { focusIncident(ic.dataset.inc); return; }
      if (e.target.matches('[data-zoom]')) lightbox(e.target.src);
    });
    return { sync, el: root, forceBottom() { stick = true; root.scrollTop = root.scrollHeight; } };
  }

  /* ---------- Composer ---------- */
  function Composer(root, o) {
    o = o || {};
    const rich = !!o.rich;
    root.classList.add('composer', 'glass-in');
    root.innerHTML = `
      ${rich ? `<div class="rt"><button data-cmd="bold" title="Félkövér"><b>B</b></button><button data-cmd="italic" title="Dőlt"><i>I</i></button><button data-cmd="underline" title="Aláhúzott"><u>U</u></button><button data-cmd="insertUnorderedList" title="Felsorolás">•≡</button><button data-cmd="insertOrderedList" title="Számozott">1≡</button><button data-cmd="formatBlock" data-arg="H3" title="Címsor">H</button><button data-cmd="removeFormat" title="Formázás törlése">⌫</button></div>` : ''}
      ${(o.extra || o.incidents) ? `<div class="cx-extra">${o.extra || ''}${o.incidents ? '<label class="cx-inc">Kapcsolódó incidens <select data-inc></select></label>' : ''}</div>` : ''}
      <div class="cx-row">
        ${rich ? `<div class="cx-in rich" contenteditable="true" data-ph="${esc(o.placeholder || 'Közlés szövege…')}"></div>` : `<textarea class="cx-in" rows="1" placeholder="${esc(o.placeholder || 'Üzenet…')}"></textarea>`}
        <div class="cx-tools">
          <label class="ib" title="Kép"><input type="file" accept="image/*" hidden data-f>🖼</label>
          <label class="ib" title="Hang"><input type="file" accept="audio/*" hidden data-f>🎵</label>
          <label class="ib" title="Videó"><input type="file" accept="video/*" hidden data-f>🎬</label>
          <button class="ib rec" data-rec title="Hangfelvétel">🎙</button>
          <button class="send" data-send>Küldés</button>
        </div>
      </div>
      <div class="cx-att" hidden></div>`;
    const inp = $('.cx-in', root), att = $('.cx-att', root), sendBtn = $('[data-send]', root);
    let file = null, rec = null;
    const incSel = $('[data-inc]', root);
    function fillInc() {
      if (!incSel) return;
      if (!root.isConnected) { if (offInc) offInc(); return; }
      const cur = incSel.value, list = (o.incidents === true ? S.incidents : o.incidents()).slice().sort((a, b) => b.seq - a.seq);
      const sig = list.map(x => x.id + x.title).join('|'); if (incSel._sig === sig) return; incSel._sig = sig;
      incSel.innerHTML = '<option value="">— nincs —</option>' + list.map(x => `<option value="${esc(x.id)}">${esc(window.LWP.incCode(x))} · ${esc(x.title)}</option>`).join('');
      incSel.value = list.some(x => x.id === cur) ? cur : '';
    }
    const offInc = incSel ? window.LWP.on(fillInc) : null; fillInc();
    const max = (window.LWP_CONFIG.maxUploadMB || 50) * 1048576;
    function setFile(f) {
      if (f && f.size > max) { toast('A fájl túl nagy (max. ' + window.LWP_CONFIG.maxUploadMB + ' MB).'); return; }
      file = f;
      att.hidden = !f;
      att.innerHTML = f ? `<span>${{ image: '🖼', audio: '🎵', video: '🎬', file: '📎' }[kindOfFile(f)]} ${esc(f.name)} · ${(f.size / 1048576).toFixed(1)} MB</span><button data-clear>✕</button>` : '';
    }
    const val = () => rich ? inp.innerHTML.trim() : inp.value.trim();
    const textOnly = () => rich ? inp.textContent.trim() : inp.value.trim();
    async function send() {
      if (sendBtn.disabled) return;
      if (!textOnly() && !file) return;
      sendBtn.disabled = true; sendBtn.textContent = file ? 'Feltöltés…' : '…';
      try {
        await o.onSend({ body: textOnly() || (rich && /<img|<li/.test(val())) ? val() : '', file, root, incident: incSel && incSel.value || null });
        if (incSel && !o.keepIncident) incSel.value = '';
        if (rich) inp.innerHTML = ''; else inp.value = '';
        setFile(null);
      } catch (e) { toast(e.message || 'A küldés nem sikerült.'); }
      sendBtn.disabled = false; sendBtn.textContent = 'Küldés';
      inp.focus();
    }
    root.addEventListener('click', e => {
      if (e.target.closest('[data-send]')) return send();
      if (e.target.closest('[data-clear]')) return setFile(null);
      const c = e.target.closest('[data-cmd]');
      if (c) { e.preventDefault(); inp.focus(); document.execCommand(c.dataset.cmd, false, c.dataset.arg || null); return; }
      if (e.target.closest('[data-rec]')) toggleRec(e.target.closest('[data-rec]'));
    });
    root.addEventListener('mousedown', e => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });
    root.addEventListener('change', e => { if (e.target.matches('[data-f]')) { const f = e.target.files[0]; if (f) setFile(f); e.target.value = ''; } });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (rich ? e.ctrlKey : !e.shiftKey)) { e.preventDefault(); send(); } });
    if (!rich) inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 140) + 'px'; });
    inp.addEventListener('paste', e => { const f = e.clipboardData && Array.from(e.clipboardData.files)[0]; if (f) { e.preventDefault(); setFile(f); } else if (rich) { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); } });
    async function toggleRec(btn) {
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Ez a böngésző nem támogatja a hangfelvételt.'); return; }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = []; rec = new MediaRecorder(st);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
          st.getTracks().forEach(t => t.stop());
          const type = rec.mimeType || 'audio/webm';
          setFile(new File(chunks, 'hangfelvetel-' + Date.now() + (type.includes('mp4') ? '.m4a' : '.webm'), { type }));
          rec = null; btn.classList.remove('on'); btn.textContent = '🎙';
        };
        rec.start(); btn.classList.add('on'); btn.textContent = '⏹';
      } catch (_) { toast('A mikrofon használata nincs engedélyezve.'); rec = null; }
    }
    return { focus: () => inp.focus(), root, setFile, setIncident(id) { if (incSel) { fillInc(); incSel.value = id || ''; } } };
  }

  /* ---------- incidens-fókusz (hírfolyam -> térkép) ---------- */
  const incFocus = new Set();
  function onIncidentFocus(fn) { incFocus.add(fn); return () => incFocus.delete(fn); }
  function focusIncident(id) { incFocus.forEach(f => { try { f(id); } catch (e) { console.error(e); } }); }

  /* ---------- kisebb segédek ---------- */
  let toastT;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = h('', 'div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4200);
  }
  function lightbox(src) {
    const o = h(`<img src="${esc(src)}" alt="">`); o.className = 'lightbox';
    o.onclick = () => o.remove(); document.body.appendChild(o);
  }
  function modal(html, cls) {
    const m = h(`<div class="mbody glass ${cls || ''}"><button class="mx" data-close>✕</button>${html}</div>`);
    m.className = 'modal';
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
    document.body.appendChild(m); return m;
  }
  function qrSvg(url) {
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag(4, 2);
  }
  const groupUrl = g => location.origin + location.pathname + '#/g/' + g.token;
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  const csvCell = v => { v = v == null ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const toCSV = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');

  window.UI = { onIncidentFocus, focusIncident, Notif, notifStart, notifStop, soundBtn, siren, EMOJI, esc, h, $, $$, fmtTime, fmtHM, fmtDur, sanitize, plainHTML, mediaType, kindOfFile, author, actorName, Feed, Composer, toast, lightbox, modal, qrSvg, groupUrl, download, toCSV };
})();
