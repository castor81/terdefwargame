# TERDEF wargaming platform

MH Területvédelmi és Hadkiegészítő Parancsnokság (MH THP) és alárendelt ezredei/zászlóaljai számára készült gyakorlatvezetési (wargaming) platform. A Ludovika wargaming platform (v0.3.2) és a JEMM generátor összevonása.

## Funkciók
- **Belépő**: gránátos oldal → szerepválasztás (gyakorlatvezető kóddal; szervezeti elemek kód nélkül).
- **COP**: teljes magyarországi közigazgatási térkép az ezredek működési területeivel, háromszög-incidensekkel, nagyítással/húzással, popuppal (leírás + kapcsolódó közlések); hagyományos hírfolyam; a közlések incidenshez köthetők, térkép-ikonnal.
- **Gyakorlatvezető**: COP-közlés, Térkép/incidensek, **JEMM generátor** (Event → Storyline → Inject, bejátszás kattintással mindenkinek vagy kijelölt szervezeti elemeknek), Nyomkövetés (kapta/látta/megnyitotta/válaszolt/reagált/belépett, CSV), Szervezeti elemek, Forgatókönyv (Word), Beállítások.
- Minden Ludovika-funkció megmaradt (reakciók, média, riasztás, QR-kódok, dashboard, exportok), három ág helyett egyetlen „Területvédelem és Hadkiegészítés” struktúrában.

## Futtatás
Statikus oldal, build nélkül. Helyi demó (Supabase nélkül): `index.html?local=1`. Gránát nélkül: `?nogren=1`.

## Konfiguráció
`js/config.js` – Supabase URL/kulcs, JEMM webhook, gyakorlatvezetői kód SHA-256 hash-e. Adatbázis: `tdw_*` táblák (a Ludovika `lwp_*` táblák érintetlenek).

## Biztonsági megjegyzés
A gyakorlatvezetői kód ellenőrzése kliensoldali (gyakorlati szintű védelem, nem éles hitelesítés). Az egység- és szervezeti adatok jogszabályi forrásból készültek, élesítés előtt ellenőrizendők.

## Verzió
Lásd `CHANGELOG.md`.
