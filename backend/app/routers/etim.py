from fastapi import APIRouter, Query
from app.etim_db import search_classes_with_synonyms

router = APIRouter(tags=["etim"])


@router.get("/etim/search")
def search_etim(q: str = Query(default="", min_length=0), limit: int = Query(default=25, le=100)):
    if not q or len(q.strip()) < 2:
        return []
    return search_classes_with_synonyms(q.strip(), limit)
