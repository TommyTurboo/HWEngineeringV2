from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ComponentTypical
from app.schemas import TypicalCreate, TypicalRead

router = APIRouter(prefix="/typicals", tags=["typicals"])


@router.get("", response_model=list[TypicalRead])
def list_typicals(db: Session = Depends(get_db)):
    return db.query(ComponentTypical).order_by(ComponentTypical.family, ComponentTypical.name).all()


@router.post("", response_model=TypicalRead, status_code=201)
def create_typical(body: TypicalCreate, db: Session = Depends(get_db)):
    typical = ComponentTypical(**body.model_dump())
    db.add(typical)
    db.commit()
    db.refresh(typical)
    return typical


@router.delete("/{typical_id}", status_code=204)
def delete_typical(typical_id: UUID, db: Session = Depends(get_db)):
    typical = db.query(ComponentTypical).filter(ComponentTypical.id == typical_id).first()
    if not typical:
        raise HTTPException(404, "Typical not found")
    db.delete(typical)
    db.commit()
