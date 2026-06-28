# HW Engineering v2 — Elektrisch Blokschema

Webapplicatie voor het visualiseren en beheren van elektrische blokschema's op basis van IEC 81346. Kasten, veldcomponenten en kabels worden via een interactief canvas weergegeven per ruimte/zone.

## Starten

```bash
docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5176       |
| Backend  | http://localhost:8004       |
| DB       | localhost:5436 (PostgreSQL) |

## Lokale ontwikkeling (zonder Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://hw:hw@localhost:5436/hw_engineering alembic upgrade head
DATABASE_URL=postgresql://hw:hw@localhost:5436/hw_engineering uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Architectuur

```
Project
 ├── Space (ruimte/zone — IEC 81346 locatie-aanduiding)
 ├── Cabinet (kast — hoofdverdeler, onderverdeler, besturingskast, ...)
 │    └── FieldComponent (veldcomponent gekoppeld aan kast)
 └── Connection (kabel tussen twee kasten of kast ↔ veldcomponent)
      └── kabelreferentie, type, sectie, lengte
```

## Canvas & blokschema-layout

Het canvas toont alle kasten en veldcomponenten per zone als interactief blokschema (`@xyflow/react`).

### Blokschema-knop

Herbereken de automatische lay-out op basis van de elektrische hiërarchie:

- **Boomstructuur per zone**: kasten worden van boven naar beneden gerangschikt op type (hoofdverdeler → onderverdeler → besturingskast → ...). Nodes krijgen een variabele breedte op basis van hun subtree.
- **DAG → boom**: als een node meerdere ouders heeft (DAG-structuur), wordt één primaire ouder gekozen zodat nodes nooit op dezelfde positie eindigen.
- **Crossing minimization**: volgorde van kinderen per niveau wordt geoptimaliseerd via het barycenter-algoritme (3 passes) om kabelkruisingen te minimaliseren.
- **Per-edge handles**: elke kabel krijgt een eigen aansluitpunt op de node, gepositioneerd op basis van de canvas-coördinaat van de tegenoverliggende node.
- **Uniforme routing**: alle kabels (binnen en tussen zones) worden gelijk behandeld. Parallelle kabels vanuit dezelfde bronnode krijgen gestaggerde horizontale busbanen zodat ze visueel gescheiden zijn.

### Schematische edges

Kabels worden getekend als orthogonale lijnen (verticaal → horizontaal → verticaal) met:
- Brugbogen (`arc`) op kruispunten met andere kabels
- Roterend kabelreferentielabel op verticale segmenten
- Kleurcodering per kabel-ID

## API docs

http://localhost:8004/docs

## Technische stack

| Laag     | Technologie                              |
|----------|------------------------------------------|
| Frontend | React 18, TypeScript, Vite, MUI, @xyflow/react v12 |
| Backend  | FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Infra    | Docker Compose                           |
