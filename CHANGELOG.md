# Változásnapló
## v0.2.4 – 2026-11-24
- Térképi incidens-popup: az eredeti közlések alatt megjelennek a rájuk adott válaszok is (reply_to alapján); a lista az ablakon belül görgethető.

## v0.2.3 – 2026-11-24
- COP: a térképes felület neve „Közös operatív kép”, a hírfolyamé „JCHAT”.
- Mindkét panel jobb felső sarkában teljes képernyő ikon (⛶), kiterjesztve bezárás ikon (✕, Esc is).

## v0.2.2 – 2026-11-24
- Javítva: a csoportok hírfolyama (COP / Gyakorlatvezető / Csoportok) sok közlésnél nem görgethető – a görgetés mobilon és asztali nézetben is működik.

## v0.2.1 – 2026-11-24
- Hírfolyam: válasz adott közlésre (↩ gomb), messenger-szerű idézett előnézettel a válaszban; az idézetre kattintva a hírfolyam az eredeti közlésre ugrik. Új `tdw_messages.reply_to` oszlop.

## v0.2.0 – 2026-11-24
- Terheléses ellenőrző teszt alapján: olvasási nyugta (`tdw_reads`: mikor látta / nyitotta meg az üzenetet a szervezeti elem) és időbélyeges emoji-reakció (`tdw_reactions.created_at`).
- Új gyakorlatvezetői fül: **Nyomkövetés** – incidensenként kinek szólt, ki mikor kapta, látta, nyitotta meg, válaszolt (szöveggel), reagált, lépett be; „nem kapta” lista; CSV-export.

## v0.1.2 – 2026-11-24
- Mobilbarát csoportfelület: kompakt fejléc, négyoszlopos ikonos fülsor, áttekinthetőbb (rövidített) hírfolyam a COP és a gyakorlatvezetői csatornán, kompakt üzenetíró.

## v0.1.1 – 2026-11-24
- Javítva: a JEMM többszörös választó legördülői (megnyitás, kiválasztás, saját elem hozzáadása).
- Javítva: az `anon` szerepkör jogosultságai a `tdw_*` táblákon (kapcsolódási hiba az éles oldalon).
- Incidens-popup: lebegő, kompakt kártya, amely kiléphet a térképből; görgetődoboz nélkül.
- COP hírfolyam: rövidített bejegyzések (cím / első mondat), kattintásra kibomlanak.

## v0.1.0 – 2026-11-24
- Első kiadás: Ludovika v0.3.2 + JEMM generátor + gránátos belépő; MH THP szervezeti struktúra (THP, 7 TVE, zászlóaljak).
- Leaflet térkép (ezredterületek, incidens-háromszögek, popup, közlés↔incidens kapcsolat, térképi helykijelölő).
- Új arculat: MH-címer pattern háttér, új színpaletta, Playfair Display + Montserrat.
