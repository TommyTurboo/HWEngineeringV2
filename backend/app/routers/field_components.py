from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import FieldComponent
from app.schemas import FieldComponentCreate, FieldComponentUpdate, FieldComponentRead

router = APIRouter(tags=["field_components"])


@router.get("/projects/{project_id}/field-components", response_model=list[FieldComponentRead])
def list_field_components(project_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(FieldComponent)
        .options(joinedload(FieldComponent.typical))
        .filter(FieldComponent.project_id == project_id)
        .all()
    )


@router.post("/projects/{project_id}/field-components", response_model=FieldComponentRead, status_code=201)
def create_field_component(project_id: UUID, body: FieldComponentCreate, db: Session = Depends(get_db)):
    fc = FieldComponent(project_id=project_id, **body.model_dump())
    db.add(fc)
    db.commit()
    db.refresh(fc)
    return db.query(FieldComponent).options(joinedload(FieldComponent.typical)).filter(FieldComponent.id == fc.id).first()


@router.put("/field-components/{fc_id}", response_model=FieldComponentRead)
def update_field_component(fc_id: UUID, body: FieldComponentUpdate, db: Session = Depends(get_db)):
    fc = db.query(FieldComponent).filter(FieldComponent.id == fc_id).first()
    if not fc:
        raise HTTPException(404, "Field component not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(fc, field, value)
    db.commit()
    return db.query(FieldComponent).options(joinedload(FieldComponent.typical)).filter(FieldComponent.id == fc_id).first()


@router.delete("/field-components/{fc_id}", status_code=204)
def delete_field_component(fc_id: UUID, db: Session = Depends(get_db)):
    fc = db.query(FieldComponent).filter(FieldComponent.id == fc_id).first()
    if not fc:
        raise HTTPException(404, "Field component not found")
    db.delete(fc)
    db.commit()
