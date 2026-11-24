/* TERDEF wargaming platform – Nyomkövetés (ki kapta, látta, nyitotta meg, válaszolt, reagált, lépett be) */
(function () {
  'use strict';
  const LWP = window.LWP, ORG = window.ORG, U = window.UI, S = LWP.S, CFG = window.LWP_CONFIG;
  const { esc, $ } = U;
  const p2 = n => String(n).padStart(2, '0');
  const ts = t => { if (!t) return ''; const d = new Date(t); return `${p2(d.getMonth() + 1)}.${p2(d.getDate())}. ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  const plain = h => { const d = document.createElement('div'); d.innerHTML = U.sanitize(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };

  function rowsFor(inc) {
    const ids = inc.targets === 'all' || !Array.isArray(inc.targets) ? S.groups.map(g => g.id) : inc.targets;
    const copMsg = S.msgs.find(m => m.incident === inc.id && m.channel === 'cop' && !m.deleted);
    const rows = ids.map(id => {
      const g = LWP.group(id); if (!g) return null;
      const own = S.msgs.find(m => m.incident === inc.id && m.channel === 'lead:' + id && m.author_type === 'lead' && !m.deleted);
      const msgs = [own, copMsg].filter(Boolean);
      const mine = msgs.map(m => S.reads.find(r => r.message_id === m.id && r.group_id === id)).filter(Boolean);
      const seen = mine.map(r => r.seen_at).filter(Boolean).sort()[0] || '', opened = mine.map(r => r.opened_at).filter(Boolean).sort()[0] || '';
      const replies = S.msgs.filter(m => m.incident === inc.id && m.author_type === 'group' && m.author_id === id && !m.deleted).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
      const reacts = S.reacts.filter(r => r.actor === id && msgs.some(m => m.id === r.message_id)).sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
      const logins = S.events.filter(e => e.type === 'login' && e.group_id === id).map(e => e.ts || e.created_at).filter(Boolean).sort();
      return { id, name: (ORG.get(id) || { name: g.name }).name, short: (ORG.get(id) || { short: id }).short, got: own ? own.created_at : (copMsg ? copMsg.created_at : ''), via: own ? 'célzott' : (copMsg ? 'COP' : ''), seen, opened, replies, reacts, first: logins[0] || '', last: logins[logins.length - 1] || g.last_login || '' };
    }).filter(Boolean);
    const order = ORG.list.map(o => o.id); rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return rows;
  }
  const sec = (a, b) => a && b ? Math.round((new Date(b) - new Date(a)) / 1000) : null;
  const dur = s => s == null ? '' : s < 60 ? s + ' mp' : Math.floor(s / 60) + ' p ' + (s % 60) + ' mp';

  function leadAudit(L, root) {
    const A = L.audit = L.audit || { sel: '' };
    root.innerHTML = `<div class="audit"><div class="ph"><h2>Nyomkövetés</h2><span class="muted">Ki, mikor kapta, látta, nyitotta meg, válaszolt, reagált</span><span class="jm-tools"><select id="au-sel"></select><button class="btn sm" id="au-csv">Export (CSV)</button></span></div><div class="au-sum" id="au-sum"></div><div class="au-tb"><div id="au-tab"></div></div></div>`;
    $('#au-sel', root).onchange = e => { A.sel = e.target.value; sig = ''; sync(); };
    $('#au-csv', root).onclick = () => { const inc = LWP.incident(A.sel); if (!inc) return; const rows = rowsFor(inc); const head = ['szervezeti elem', 'csatorna', 'kapta', 'látta', 'megnyitotta', 'látás–megnyitás (mp)', 'első válasz', 'válaszok (db)', 'válasz szövege', 'reakciók', 'első belépés', 'utolsó belépés'];
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const lines = [head.map(q).join(';')].concat(rows.map(r => [r.name, r.via, ts(r.got), ts(r.seen), ts(r.opened), sec(r.seen, r.opened), r.replies[0] ? ts(r.replies[0].created_at) : '', r.replies.length, r.replies.map(m => plain(m.body)).join(' | '), r.reacts.map(x => x.emoji + ' ' + ts(x.created_at)).join(' | '), ts(r.first), ts(r.last)].map(q).join(';')));
      U.download(`nyomkovetes_${LWP.incCode(inc)}_v${CFG.version}_${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8'); };
    let sig = '';
    function sync() {
      const incs = S.incidents.slice().sort((a, b) => b.seq - a.seq);
      const selEl = $('#au-sel', root), key = incs.map(i => i.id).join();
      if (selEl.dataset.k !== key) { selEl.dataset.k = key; selEl.innerHTML = incs.length ? incs.map(i => `<option value="${esc(i.id)}">${esc(LWP.incCode(i))} – ${esc(i.title.slice(0, 60))}</option>`).join('') : '<option value="">Nincs incidens</option>'; }
      if (!A.sel || !incs.some(i => i.id === A.sel)) A.sel = incs[0] ? incs[0].id : ''; selEl.value = A.sel;
      const inc = LWP.incident(A.sel);
      if (!inc) { $('#au-sum', root).innerHTML = ''; $('#au-tab', root).innerHTML = '<div class="empty">Még nincs bejátszott incidens.</div>'; return; }
      const rows = rowsFor(inc);
      const s2 = JSON.stringify([inc.id, rows.map(r => [r.got, r.seen, r.opened, r.replies.length, r.reacts.length, r.last])]); if (s2 === sig) return; sig = s2;
      const n = rows.length, seen = rows.filter(r => r.seen).length, op = rows.filter(r => r.opened).length, rep = rows.filter(r => r.replies.length).length, rea = rows.filter(r => r.reacts.length).length;
      const miss = ORG.list.filter(o => !rows.some(r => r.id === o.id));
      $('#au-sum', root).innerHTML = `<div class="kpi"><b>${n}</b><span>címzett</span></div><div class="kpi"><b>${seen}</b><span>látta</span></div><div class="kpi"><b>${op}</b><span>megnyitotta</span></div><div class="kpi"><b>${rep}</b><span>válaszolt</span></div><div class="kpi"><b>${rea}</b><span>reagált</span></div>${miss.length ? `<div class="au-miss"><b>Nem kapta (${miss.length}):</b> ${esc(miss.map(o => o.short).join(', '))}</div>` : ''}`;
      $('#au-tab', root).innerHTML = `<table class="au-t"><thead><tr><th>Szervezeti elem</th><th>Kapta</th><th>Látta</th><th>Megnyitotta</th><th>Válasz</th><th>Reakció</th><th>Belépés</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.short)}</b><small>${esc(r.name.replace(/^MH /, ''))}</small></td><td>${ts(r.got) || '–'}<small>${esc(r.via)}</small></td><td>${r.seen ? ts(r.seen) : '<span class="au-no">nem látta</span>'}${r.got && r.seen ? `<small>+${dur(sec(r.got, r.seen))}</small>` : ''}</td><td>${r.opened ? ts(r.opened) : '<span class="au-no">–</span>'}</td><td>${r.replies.length ? `${ts(r.replies[0].created_at)}<small>${r.replies.length} db · ${esc(plain(r.replies[0].body).slice(0, 70))}</small>` : '<span class="au-no">nincs</span>'}</td><td>${r.reacts.length ? r.reacts.map(x => `${esc(x.emoji)} <small style="display:inline">${ts(x.created_at)}</small>`).join('<br>') : '<span class="au-no">–</span>'}</td><td>${r.first ? `első: ${ts(r.first)}<small>utolsó: ${ts(r.last)}</small>` : '<span class="au-no">nem lépett be</span>'}</td></tr>`).join('')}</tbody></table>`;
    }
    sync(); return sync;
  }
  window.TDWAudit = { leadAudit, rowsFor };
})();
