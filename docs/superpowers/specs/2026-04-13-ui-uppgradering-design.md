# FiskeApp — UI-uppgradering & pålitlig lagring

**Datum:** 2026-04-13
**Status:** Godkänd design

## Sammanfattning

Uppgradera FiskeApp från en kartcentrerad PWA till en fullständig fiskeloggbok med dashboard-hem, steg-för-steg loggning, utökad statistik (drag- och platsanalys), och pålitlig lagring via IndexedDB. Koden omstruktureras från en monolitisk `app.js` till separata moduler per vy.

## Mål

1. **App-känsla** — dashboard-startsida inspirerad av sportfiskeappar (Fishbrain-stil)
2. **Snabb loggning** — steg-för-steg formulär optimerat för användning med en hand vid vattnet
3. **Djupare analys** — drag-analys och plats-analys för att hitta mönster
4. **Pålitlig lagring** — IndexedDB istället för localStorage, med backup-påminnelse
5. **Renare kod** — modulstruktur som är lättare att förstå och underhålla

## Filstruktur

```
Fiskeapp/
├── index.html
├── manifest.json
├── sw.js
├── images/
│   └── icon.svg
├── css/
│   └── style.css
├── docs/
│   └── superpowers/
│       └── specs/
└── js/
    ├── app.js          — Startar appen, binder ihop modulerna
    ├── db.js           — IndexedDB-hantering (spara/läsa/ta bort)
    ├── router.js       — Hanterar flikbyte mellan vyer
    ├── home.js         — Dashboard-vyn
    ├── map.js          — Kartvyn (Leaflet)
    ├── catch-form.js   — Steg-för-steg loggningsflödet
    ├── catches.js      — Fångstlistan
    ├── stats.js        — Statistik (drag- & platsanalys)
    ├── spots.js        — Platser-vyn
    └── utils.js        — Delade hjälpfunktioner (formatDate, haversine, esc)
```

## Datalagring (db.js)

### IndexedDB

- **Databas:** `fiskeapp`
- **Version:** 1
- **Object stores:**
  - `catches` — keyPath: `id`
  - `spots` — keyPath: `id`
- **Datamodell:** Samma fält som nuvarande localStorage-modell. Ingen schemaändring.

### API (asynkrona funktioner)

```
db.getAllCatches() → Promise<Array>
db.saveCatch(entry) → Promise
db.deleteCatch(id) → Promise
db.getAllSpots() → Promise<Array>
db.saveSpot(entry) → Promise
db.updateSpot(entry) → Promise
db.deleteSpot(id) → Promise
db.exportAll() → Promise<{catches, spots}>
db.importAll({catches, spots}) → Promise
```

### Migrering från localStorage

Vid första start kontrollerar `db.js` om det finns data i `localStorage` under nycklarna `fiskeapp_catches` och `fiskeapp_spots`. Om ja:
1. Läs och parsa datan
2. Skriv till IndexedDB
3. Ta bort localStorage-nycklarna
4. Visa en toast: "Data migrerad till ny lagring"

### Backup-påminnelse

Efter varje 10:e sparad fångst visas en toast-notis: "Dags att exportera en backup?" med en knapp som leder till statistikvyns exportfunktion.

## Navigation (router.js)

### Bottomnav — 5 flikar

```
Hem (🏠) | Karta (🌍) | Statistik (📊) | Fångster (🐟) | Platser (📍)
```

- Aktiv flik markeras med `--accent` färg (#00b4d8)
- `router.js` hanterar flikbyte: döljer/visar vyer, uppdaterar aktiv-status
- Vid byte till kartvyn: anropar `map.invalidateSize()`

## Dashboard — Hem-vyn (home.js)

Startsidan som visas när appen öppnas.

### Innehåll (uppifrån och ner)

1. **Header**
   - Vänster: hälsningsfras ("God morgon/eftermiddag/kväll") + "FiskeApp"
   - Höger: aktuellt väder (temperatur, vind) — hämtas via GPS-position

2. **Snabbknappar** — rad med tre knappar
   - "Logga fångst" (accent-färg, primär) — öppnar steg-för-steg formuläret med GPS-position
   - "Spara plats" — öppnar platsformuläret med GPS-position
   - "Visa karta" — byter till kartfliken

3. **Sammanfattning** — tre nyckeltal
   - Antal fångster
   - Antal platser
   - Bästa drag (det med flest fångster)

4. **Senaste fångster** — de 5 senaste, klickbara
   - Visar: art, längd (om ifyllt), bete, relativ tid ("igår", "3 dagar sedan")
   - Klick öppnar fångstdetalj-modalen

5. **Mini-karta** — en liten Leaflet-karta (ej interaktiv)
   - Visar markörer för senaste fångster
   - Klick byter till kartfliken

## Steg-för-steg loggning (catch-form.js)

Fullskärmsmodal med ett fält per steg.

### Flöde

**Steg 1 — Art (obligatoriskt)**
- Textfält med autocomplete baserat på tidigare inmatade arter
- Knapp: "Nästa →"

**Steg 2 — Bete/Metod (obligatoriskt)**
- Textfält med autocomplete baserat på tidigare inmatade beten
- Förvalda förslag i datalist: jerk, jigg, pig shad, wobbler, drop shot
- Knapp: "Nästa →"

**Steg 3 — Datum & tid (obligatoriskt)**
- datetime-local fält, förifyllt med aktuell tid
- Redigerbart
- Knapp: "Nästa →"

**Steg 4 — Valfritt**
- Alla valfria fält samlade på en sida:
  - Längd (cm) — number input
  - Vikt (kg) — number input
  - Foto — kameraknapp (file input med capture="environment")
  - Anteckning — textarea
- Knapp: "Spara fångst" (sparar direkt, valfria fält kan vara tomma)

### UI-detaljer

- Tillbaka-pil uppe till vänster på varje steg
- Progressindikator i toppen: 4 prickar, aktiv markerad
- GPS-position hämtas i bakgrunden vid steg 1
- Väder hämtas automatiskt baserat på position
- Om formuläret öppnades via kartklick: använd den klickade positionen istället för GPS

## Kartvyn (map.js)

Samma som nuvarande implementation med följande ändring:

- Klick på kartan öppnar det nya steg-för-steg formuläret (catch-form.js) istället för det gamla formuläret
- Långtryck/högerklick öppnar platsformuläret (oförändrat)
- Positionsknappen (oförändrad)
- Satellitbild via Esri (oförändrad)
- MarkerCluster (oförändrat)

## Fångstlistan (catches.js)

Ingen förändring i funktionalitet. Samma listvy med filter (art, månad, plats). Koden flyttas ut ur `app.js` till en egen modul.

## Statistik (stats.js)

### Tidsfilter

Dropdown i toppen: "Alla tider", "Denna månad", "Senaste 3 mån", "I år". Filtret gäller hela vyn.

### Sammanfattningskort (2x2 grid)

- Totala fångster (antal)
- Vanligaste art (med antal)
- Bästa drag (med antal)
- Bästa plats (med antal)

### Drag-analys

Lista sorterad på antal fångster (mest först). Varje rad visar:
- Drag-namn
- Antal fångster
- Genomsnittlig längd (om längd finns)

Expanderbar: klick visar vilka arter som fångats med det draget, med antal och snitt-storlek per art.

### Plats-analys

Lista sorterad på antal fångster (mest först). Varje rad visar:
- Platsnamn
- Antal fångster

Expanderbar: klick visar:
- Vanligaste art (med antal)
- Bästa drag (med antal)
- Bästa månad (med antal)

### Export

Knapp "Exportera data (JSON)" — samma funktionalitet som nu, men använder db.exportAll().

## Platser (spots.js)

Ingen förändring i funktionalitet. Samma listvy med klickbara platser. Koden flyttas ut ur `app.js` till en egen modul.

## Service Worker (sw.js)

- Uppdatera `CACHE_NAME` till `fiskeapp-v2`
- Lägg till alla nya JS-filer i `APP_SHELL`:
  - `./js/db.js`
  - `./js/router.js`
  - `./js/home.js`
  - `./js/map.js`
  - `./js/catch-form.js`
  - `./js/catches.js`
  - `./js/stats.js`
  - `./js/spots.js`
  - `./js/utils.js`

## CSS-ändringar (style.css)

### Nya sektioner att lägga till

- **Dashboard** — header, snabbknappar, sammanfattningskort, senaste-lista, mini-karta
- **Steg-formulär** — fullskärmsmodal, progressprickar, autocomplete-lista
- **Statistik** — expanderbara rader, tidsfilter
- **Toast-notis** — backup-påminnelse

### Befintliga sektioner

Behålls i stort sett oförändrade. Bottomnav uppdateras för 5 flikar (flex: 1 på varje fungerar redan).

## Modulkommunikation

Modulerna kommunicerar genom:
1. **Import/export** — varje modul exporterar sina publika funktioner
2. **app.js som orkestrator** — importerar alla moduler, initierar dem i rätt ordning, skickar delade beroenden (t.ex. db-instansen)
3. **Händelser** — moduler kan dispatcha custom events på `document` för lösa kopplingar (t.ex. `catch-saved` → dashboard uppdateras)

Eftersom appen inte använder ES-moduler (ingen bundler), laddas filerna som vanliga `<script>`-taggar i rätt ordning. Varje modul registrerar sig på ett globalt `window.FiskeApp`-objekt.

```html
<script src="js/utils.js"></script>
<script src="js/db.js"></script>
<script src="js/router.js"></script>
<script src="js/home.js"></script>
<script src="js/map.js"></script>
<script src="js/catch-form.js"></script>
<script src="js/catches.js"></script>
<script src="js/stats.js"></script>
<script src="js/spots.js"></script>
<script src="js/app.js"></script>
```

## Utanför scope

Följande ingår INTE i denna uppgradering:
- Molnlagring / backend / användarinloggning
- Social funktionalitet (dela fångster)
- Väder-analys (data sparas men analyseras inte)
- Import av backup-fil (bara export)
- Kartstil-byte (bara satellitbild)
- Notifikationer / push
