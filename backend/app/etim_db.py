import os
import sqlite3
from contextlib import contextmanager

ETIM_DB_PATH = os.environ.get("ETIM_DB_PATH", "/data/ETIM.db")


@contextmanager
def get_etim_db():
    conn = sqlite3.connect(ETIM_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def search_classes(q: str, limit: int = 25) -> list[dict]:
    with get_etim_db() as conn:
        pattern = f"%{q}%"
        rows = conn.execute(
            """
            SELECT DISTINCT ac.ARTCLASSID, ac.ARTCLASSDESC, ag.GROUPDESC
            FROM ETIM_ART_CLASS ac
            LEFT JOIN ETIM_ART_GROUP ag ON ac.ARTGROUPID = ag.ARTGROUPID
            WHERE ac.ARTCLASSDESC LIKE ? OR ac.ARTCLASSID LIKE ?
            ORDER BY ac.ARTCLASSID
            LIMIT ?
            """,
            (pattern, pattern, limit),
        ).fetchall()
        return [{"id": r["ARTCLASSID"], "desc": r["ARTCLASSDESC"], "group": r["GROUPDESC"]} for r in rows]


def search_classes_with_synonyms(q: str, limit: int = 25) -> list[dict]:
    """Search by class ID, description, and synonyms."""
    with get_etim_db() as conn:
        pattern = f"%{q}%"
        rows = conn.execute(
            """
            SELECT DISTINCT ac.ARTCLASSID, ac.ARTCLASSDESC, ag.GROUPDESC
            FROM ETIM_ART_CLASS ac
            LEFT JOIN ETIM_ART_GROUP ag ON ac.ARTGROUPID = ag.ARTGROUPID
            LEFT JOIN ETIM_ART_CLASS_SYNONYM_MAP syn ON syn.ARTCLASSID = ac.ARTCLASSID
            WHERE ac.ARTCLASSDESC LIKE ? OR ac.ARTCLASSID LIKE ? OR syn.CLASSSYNONYM LIKE ?
            ORDER BY ac.ARTCLASSID
            LIMIT ?
            """,
            (pattern, pattern, pattern, limit),
        ).fetchall()
        return [{"id": r["ARTCLASSID"], "desc": r["ARTCLASSDESC"], "group": r["GROUPDESC"]} for r in rows]
