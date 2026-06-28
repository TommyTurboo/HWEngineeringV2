from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ElectricalTest
from app.schemas import TestCreate, TestUpdate, TestRead

router = APIRouter(prefix="/tests", tags=["tests"])


@router.get("/by-component/{component_id}", response_model=list[TestRead])
def list_tests_for_component(component_id: UUID, db: Session = Depends(get_db)):
    return db.query(ElectricalTest).filter(ElectricalTest.component_id == component_id).all()


@router.get("/by-field-component/{fc_id}", response_model=list[TestRead])
def list_tests_for_field_component(fc_id: UUID, db: Session = Depends(get_db)):
    return db.query(ElectricalTest).filter(ElectricalTest.field_component_id == fc_id).all()


@router.post("", response_model=TestRead, status_code=201)
def create_test(body: TestCreate, db: Session = Depends(get_db)):
    test = ElectricalTest(**body.model_dump())
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.put("/{test_id}", response_model=TestRead)
def update_test(test_id: UUID, body: TestUpdate, db: Session = Depends(get_db)):
    test = db.query(ElectricalTest).filter(ElectricalTest.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(test, field, value)
    db.commit()
    db.refresh(test)
    return test


@router.delete("/{test_id}", status_code=204)
def delete_test(test_id: UUID, db: Session = Depends(get_db)):
    test = db.query(ElectricalTest).filter(ElectricalTest.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    db.delete(test)
    db.commit()
