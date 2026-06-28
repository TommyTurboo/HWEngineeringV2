from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import projects, typicals, cabinets, components, field_components, connections, tests, canvas, spaces, etim

app = FastAPI(title="HW Engineering API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"

app.include_router(projects.router, prefix=PREFIX)
app.include_router(typicals.router, prefix=PREFIX)
app.include_router(cabinets.router, prefix=PREFIX)
app.include_router(components.router, prefix=PREFIX)
app.include_router(field_components.router, prefix=PREFIX)
app.include_router(connections.router, prefix=PREFIX)
app.include_router(tests.router, prefix=PREFIX)
app.include_router(canvas.router, prefix=PREFIX)
app.include_router(spaces.router, prefix=PREFIX)
app.include_router(etim.router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
