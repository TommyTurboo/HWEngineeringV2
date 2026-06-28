# HW Engineering v2 — Elektrisch Blokschema

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
 ├── Cabinet (kast)
 │    └── Component (instantie van een typical)
 │         └── ElectricalTest
 └── FieldComponent (veld component)
      └── ElectricalTest

Connection: Cabinet ↔ Cabinet | Cabinet ↔ FieldComponent
```

## API docs

http://localhost:8004/docs
