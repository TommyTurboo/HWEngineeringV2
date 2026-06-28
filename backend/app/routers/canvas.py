from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Cabinet, FieldComponent, Connection, Component, CanvasPosition, Space
from app.schemas import CanvasPositionUpdate

router = APIRouter(tags=["canvas"])

_DEFAULT_ZONE_W = 320.0
_DEFAULT_ZONE_H = 220.0


@router.get("/projects/{project_id}/canvas/overview")
def get_overview_canvas(project_id: UUID, db: Session = Depends(get_db)):
    cabinets = db.query(Cabinet).filter(Cabinet.project_id == project_id).all()
    field_components = db.query(FieldComponent).filter(FieldComponent.project_id == project_id).all()
    connections = db.query(Connection).filter(Connection.project_id == project_id).all()
    spaces = db.query(Space).filter(Space.project_id == project_id).all()

    positions: dict[str, CanvasPosition] = {}
    for pos in db.query(CanvasPosition).filter(CanvasPosition.canvas_type == "overview").all():
        positions[str(pos.entity_id)] = pos

    nodes = []

    # Space zones rendered first (behind other nodes)
    for i, space in enumerate(spaces):
        pos = positions.get(str(space.id))
        nodes.append({
            "id": str(space.id),
            "type": "spaceZone",
            "position": {"x": pos.x if pos else 40 + i * 360, "y": pos.y if pos else 40},
            "style": {
                "width": pos.width if pos and pos.width else _DEFAULT_ZONE_W,
                "height": pos.height if pos and pos.height else _DEFAULT_ZONE_H,
            },
            "zIndex": -1,
            "data": {
                "id": str(space.id),
                "name": space.name,
                "designation": space.designation,
                "level_type": space.level_type,
            },
        })

    space_map: dict[str, Space] = {str(s.id): s for s in spaces}

    for i, cab in enumerate(cabinets):
        pos = positions.get(str(cab.id))
        count = db.query(Component).filter(Component.cabinet_id == cab.id).count()
        space = space_map.get(str(cab.space_id)) if cab.space_id else None
        nodes.append({
            "id": str(cab.id),
            "type": "cabinet",
            "position": {"x": pos.x if pos else 100 + i * 280, "y": pos.y if pos else 120},
            "data": {
                "id": str(cab.id),
                "name": cab.name,
                "tag": cab.tag,
                "function_designation": cab.function_designation,
                "cabinet_type": cab.cabinet_type,
                "space_id": str(cab.space_id) if cab.space_id else None,
                "space_designation": space.designation if space else None,
                "description": cab.description,
                "component_count": count,
            },
        })

    for i, fc in enumerate(field_components):
        pos = positions.get(str(fc.id))
        space = space_map.get(str(fc.space_id)) if fc.space_id else None
        nodes.append({
            "id": str(fc.id),
            "type": "fieldComponent",
            "position": {"x": pos.x if pos else 100 + i * 280, "y": pos.y if pos else 400},
            "data": {
                "id": str(fc.id),
                "name": fc.name,
                "tag": fc.tag,
                "function_designation": fc.function_designation,
                "space_id": str(fc.space_id) if fc.space_id else None,
                "space_designation": space.designation if space else None,
                "description": fc.description,
                "typical": {"name": fc.typical.name, "family": fc.typical.family} if fc.typical else None,
            },
        })

    edges = []
    for conn in connections:
        edges.append({
            "id": str(conn.id),
            "source": str(conn.source_id),
            "target": str(conn.target_id),
            "label": conn.cable_ref or conn.label or "",
            "data": {
                "id": str(conn.id),
                "label": conn.label,
                "cable_ref": conn.cable_ref,
                "cable_type": conn.cable_type,
                "cable_section": conn.cable_section,
                "cable_length": conn.cable_length,
            },
        })

    return {"nodes": nodes, "edges": edges}


@router.put("/projects/{project_id}/canvas/positions", status_code=204)
def save_positions(project_id: UUID, positions: list[CanvasPositionUpdate], db: Session = Depends(get_db)):
    for p in positions:
        existing = (
            db.query(CanvasPosition)
            .filter(CanvasPosition.entity_id == p.entity_id, CanvasPosition.canvas_type == p.canvas_type)
            .first()
        )
        if existing:
            existing.x = p.x
            existing.y = p.y
            if p.width is not None:
                existing.width = p.width
            if p.height is not None:
                existing.height = p.height
        else:
            db.add(CanvasPosition(
                entity_type=p.entity_type,
                entity_id=p.entity_id,
                canvas_type=p.canvas_type,
                x=p.x,
                y=p.y,
                width=p.width,
                height=p.height,
            ))
    db.commit()
