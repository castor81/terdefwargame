/* TERDEF wargaming platform – szervezeti struktúra: MH THP, területvédelmi ezredek, zászlóaljak
   Forrás: a honvédelemről szóló kormányrendelet (Ezred–Zászlóalj–HTI–vármegye táblázat). Ellenőrizd a hatályos állapotot! */
(function () {
  'use strict';
  // vármegye -> székhely (megyeszékhely) koordináták [lat, lon]
  const SEAT = {
    'Budapest': [47.4979, 19.0402], 'Pest': [47.4400, 19.3000], 'Hajdú-Bihar': [47.5316, 21.6273],
    'Borsod-Abaúj-Zemplén': [48.1035, 20.7784], 'Szabolcs-Szatmár-Bereg': [47.9554, 21.7167],
    'Jász-Nagykun-Szolnok': [47.1621, 20.1825], 'Heves': [47.9025, 20.3772], 'Nógrád': [48.0936, 19.8003],
    'Csongrád-Csanád': [46.2530, 20.1414], 'Bács-Kiskun': [46.8964, 19.6897], 'Békés': [46.6847, 21.0877],
    'Somogy': [46.3594, 17.7968], 'Baranya': [46.0727, 18.2323], 'Zala': [46.8417, 16.8416],
    'Fejér': [47.1860, 18.4221], 'Komárom-Esztergom': [47.5849, 18.3948], 'Tolna': [46.3474, 18.7062],
    'Veszprém': [47.0933, 17.9093], 'Győr-Moson-Sopron': [47.6875, 17.6504], 'Vas': [47.2307, 16.6218]
  };
  // ezredek: [sorszám, névadó, [[vármegye, zászlóalj száma], ...], szín]
  const REG = [
    [1, 'vitéz Reviczky László', [['Budapest', 1], ['Pest', 30]], '#6c87ac'],
    [2, 'vitéz Vattay Antal', [['Hajdú-Bihar', 3], ['Borsod-Abaúj-Zemplén', 10], ['Szabolcs-Szatmár-Bereg', 5]], '#a43b26'],
    [3, 'Krause Lajos', [['Jász-Nagykun-Szolnok', 68], ['Heves', 60], ['Nógrád', 25]], '#b5850f'],
    [4, 'Dombay Miksa', [['Csongrád-Csanád', 46], ['Bács-Kiskun', 38], ['Békés', 101]], '#585f35'],
    [5, 'Bauer Gyula', [['Somogy', 44], ['Baranya', 52], ['Zala', 48]], '#918867'],
    [6, 'Sipos Gyula', [['Fejér', 17], ['Komárom-Esztergom', 12], ['Tolna', 69]], '#262a3d'],
    [7, 'Klempa Kálmán', [['Veszprém', 31], ['Győr-Moson-Sopron', 19], ['Vas', 83]], '#878787']
  ];
  const list = [{ id: 'thp', level: 'thp', section: 'thp', num: 'THP', short: 'THP', avatar: 'THP', name: 'MH Területvédelmi és Hadkiegészítő Parancsnokság', lat: 47.515, lon: 19.092, counties: [], color: '#262a3d' }];
  const sections = { thp: { name: 'MH THP – Parancsnokság', short: 'THP', color: '#262a3d' } };
  const countyEzred = {};
  REG.forEach(([n, nm, bs, col]) => {
    const eid = 'e' + n;
    sections[eid] = { name: n + '. TVE – ' + nm, short: n + '.TVE', color: col };
    list.push({ id: eid, level: 'ezred', section: eid, num: String(n), short: n + '.TVE', avatar: n + '.E', name: 'MH ' + nm + ' ' + n + '. Területvédelmi Ezred', counties: bs.map(b => b[0]), color: col, parent: 'thp' });
    bs.forEach(([c, z]) => {
      countyEzred[c] = eid;
      list.push({ id: 'z' + z, level: 'zaszlo', section: eid, num: String(z), short: z + '.TVZ', avatar: z + '.Z', name: 'MH ' + z + '. Területvédelmi Zászlóalj (' + c + ')', county: c, counties: [c], lat: SEAT[c][0], lon: SEAT[c][1], color: col, parent: eid });
    });
  });
  const byId = {}; list.forEach(o => byId[o.id] = o);
  window.ORG = {
    list, byId, sections, SEAT, countyEzred, REG,
    get: id => byId[id],
    sectionOf: id => (byId[id] || { section: 'thp' }).section,
    avatar: id => (byId[id] || { avatar: '?' }).avatar,
    ringLabel: id => (byId[id] || { num: '?' }).num,
    level: id => (byId[id] || {}).level,
    // zászlóalj/ezred azonosítók, amelyek az adott vármegyéért felelnek
    unitsOfCounty(c) { const e = countyEzred[c]; const z = list.find(o => o.level === 'zaszlo' && o.county === c); return { ezred: e, zaszlo: z && z.id }; }
  };
})();
