from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Cabinet, Component, Space
from app.schemas import CabinetCreate, CabinetUpdate, CabinetRead

router = APIRouter(tags=["cabinets"])

_TYPE_PREFIX = {
    "hoofdverdeler": "HV",
    "onderverdeler": "OV",
    "besturingskast": "BK",
    "netwerkkast": "NK",
    "klemmenkast": "KK",
}


def _generate_tag(db: Session, project_id: UUID, cabinet_type: str, space: Space | None) -> str:
    prefix = _TYPE_PREFIX.get(cabinet_type, "XX")
    count = db.query(Cabinet).filter(
        Cabinet.project_id == project_id,
        Cabinet.cabinet_type == cabinet_type,
    ).count()
    seq = str(count + 1).zfill(2)
    fn = f"={prefix}{seq}"
    if space and space.designation:
        return f"{space.designation}{fn}"
    return fn


def _read(cab: Cabinet, db: Session) -> CabinetRead:
    count = db.query(Component).filter(Component.cabinet_id == cab.id).count()
    return CabinetRead(
        id=cab.id,
        project_id=cab.project_id,
        name=cab.name,
        tag=cab.tag,
        cabinet_type=cab.cabinet_type,
        space_id=cab.space_id,
        function_designation=cab.function_designation,
        description=cab.description,
        component_count=count,
        created_at=cab.created_at,
        updated_at=cab.updated_at,
    )


@router.get("/projects/{project_id}/cabinets", response_model=list[CabinetRead])
def list_cabinets(project_id: UUID, db: Session = Depends(get_db)):
    return [_read(c, db) for c in db.query(Cabinet).filter(Cabinet.project_id == project_id).all()]


@router.post("/projects/{project_id}/cabinets", response_model=CabinetRead, status_code=201)
def create_cabinet(project_id: UUID, body: CabinetCreate, db: Session = Depends(get_db)):
    space = db.query(Space).filter(Space.id == body.space_id).first() if body.space_id else None
    tag = _generate_tag(db, project_id, body.cabinet_type, space)
    cabinet = Cabinet(
        project_id=project_id,
        name=body.name,
        cabinet_type=body.cabinet_type,
        description=body.description,
        space_id=body.space_id,
        function_designation=body.function_designation,
        tag=tag,
    )
    db.add(cabinet)
    db.commit()
    db.refresh(cabinet)
    return _read(cabinet, db)


@router.put("/cabinets/{cabinet_id}", response_model=CabinetRead)
def update_cabinet(cabinet_id: UUID, body: CabinetUpdate, db: Session = Depends(get_db)):
    cabinet = db.query(Cabinet).filter(Cabinet.id == cabinet_id).first()
    if not cabinet:
        raise HTTPException(404, "Cabinet not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cabinet, field, value)
    db.commit()
    db.refresh(cabinet)
    return _read(cabinet, db)


@router.delete("/cabinets/{cabinet_id}", status_code=204)
def delete_cabinet(cabinet_id: UUID, db: Session = Depends(get_db)):
    cabinet = db.query(Cabinet).filter(Cabinet.id == cabinet_id).first()
    if not cabinet:
        raise HTTPException(404, "Cabinet not found")
    db.delete(cabinet)
    db.commit()
