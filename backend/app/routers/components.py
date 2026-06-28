from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Component
from app.schemas import ComponentCreate, ComponentUpdate, ComponentRead

router = APIRouter(tags=["components"])


@router.get("/cabinets/{cabinet_id}/components", response_model=list[ComponentRead])
def list_components(cabinet_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(Component)
        .options(joinedload(Component.typical))
        .filter(Component.cabinet_id == cabinet_id)
        .order_by(Component.position_order)
        .all()
    )


@router.post("/cabinets/{cabinet_id}/components", response_model=ComponentRead, status_code=201)
def create_component(cabinet_id: UUID, body: ComponentCreate, db: Session = Depends(get_db)):
    component = Component(cabinet_id=cabinet_id, **body.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return db.query(Component).options(joinedload(Component.typical)).filter(Component.id == component.id).first()


@router.put("/components/{component_id}", response_model=ComponentRead)
def update_component(component_id: UUID, body: ComponentUpdate, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(component, field, value)
    db.commit()
    return db.query(Component).options(joinedload(Component.typical)).filter(Component.id == component_id).first()


@router.delete("/components/{component_id}", status_code=204)
def delete_component(component_id: UUID, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")
    db.delete(component)
    db.commit()
