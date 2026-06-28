from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Connection
from app.schemas import ConnectionCreate, ConnectionUpdate, ConnectionRead

router = APIRouter(tags=["connections"])


@router.get("/projects/{project_id}/connections", response_model=list[ConnectionRead])
def list_connections(project_id: UUID, db: Session = Depends(get_db)):
    return db.query(Connection).filter(Connection.project_id == project_id).all()


@router.post("/projects/{project_id}/connections", response_model=ConnectionRead, status_code=201)
def create_connection(project_id: UUID, body: ConnectionCreate, db: Session = Depends(get_db)):
    conn = Connection(project_id=project_id, **body.model_dump())
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.patch("/connections/{conn_id}", response_model=ConnectionRead)
def update_connection(conn_id: UUID, body: ConnectionUpdate, db: Session = Depends(get_db)):
    conn = db.query(Connection).filter(Connection.id == conn_id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(conn, field, value)
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/connections/{conn_id}", status_code=204)
def delete_connection(conn_id: UUID, db: Session = Depends(get_db)):
    conn = db.query(Connection).filter(Connection.id == conn_id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    db.delete(conn)
    db.commit()
