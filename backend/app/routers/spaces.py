from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Space
from app.schemas import SpaceCreate, SpaceUpdate, SpaceRead, SpaceTree

router = APIRouter(tags=["spaces"])

LEVEL_DESIGNATION_PREFIX = {
    "gebouw": "+B",
    "verdieping": "+F",
    "ruimte": "+R",
    "zone": "+Z",
}


def _to_tree(spaces: list[Space], parent_id=None) -> list[SpaceTree]:
    result = []
    for s in spaces:
        if s.parent_id == parent_id:
            node = SpaceTree(
                id=s.id,
                project_id=s.project_id,
                parent_id=s.parent_id,
                name=s.name,
                designation=s.designation,
                level_type=s.level_type,
                created_at=s.created_at,
                updated_at=s.updated_at,
                children=_to_tree(spaces, s.id),
            )
            result.append(node)
    return result


@router.get("/projects/{project_id}/spaces/tree", response_model=list[SpaceTree])
def get_spaces_tree(project_id: UUID, db: Session = Depends(get_db)):
    spaces = db.query(Space).filter(Space.project_id == project_id).all()
    return _to_tree(spaces)


@router.get("/projects/{project_id}/spaces", response_model=list[SpaceRead])
def list_spaces(project_id: UUID, db: Session = Depends(get_db)):
    return db.query(Space).filter(Space.project_id == project_id).all()


@router.post("/projects/{project_id}/spaces", response_model=SpaceRead, status_code=201)
def create_space(project_id: UUID, body: SpaceCreate, db: Session = Depends(get_db)):
    designation = body.designation
    if not designation and body.level_type:
        prefix = LEVEL_DESIGNATION_PREFIX.get(body.level_type, "+X")
        sibling_count = db.query(Space).filter(
            Space.project_id == project_id,
            Space.parent_id == body.parent_id,
            Space.level_type == body.level_type,
        ).count()
        designation = f"{prefix}{str(sibling_count + 1).zfill(2)}"
    space = Space(
        project_id=project_id,
        parent_id=body.parent_id,
        name=body.name,
        designation=designation,
        level_type=body.level_type,
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.put("/spaces/{space_id}", response_model=SpaceRead)
def update_space(space_id: UUID, body: SpaceUpdate, db: Session = Depends(get_db)):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(space, field, value)
    db.commit()
    db.refresh(space)
    return space


@router.delete("/spaces/{space_id}", status_code=204)
def delete_space(space_id: UUID, db: Session = Depends(get_db)):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")
    db.delete(space)
    db.commit()
