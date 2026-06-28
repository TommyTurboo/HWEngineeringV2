from uuid import UUID

from app.database import SessionLocal
from app.models import Cabinet, CanvasPosition, Connection, FieldComponent, Space


PROJECT_ID = UUID("dce44186-5a5d-41e4-8c96-aa91276b74e2")


def space_by_designation(db, designation: str) -> Space:
    space = (
        db.query(Space)
        .filter(Space.project_id == PROJECT_ID, Space.designation == designation)
        .one()
    )
    return space


def ensure_cabinet(db, *, description: str, name: str, cabinet_type: str, space: Space, function: str, tag: str) -> Cabinet:
    cabinet = (
        db.query(Cabinet)
        .filter(Cabinet.project_id == PROJECT_ID, Cabinet.description == description)
        .first()
    )
    if not cabinet:
        cabinet = Cabinet(project_id=PROJECT_ID)
        db.add(cabinet)
    cabinet.name = name
    cabinet.cabinet_type = cabinet_type
    cabinet.space_id = space.id
    cabinet.function_designation = function
    cabinet.description = description
    cabinet.tag = tag
    return cabinet


def node_by_description(db, description: str):
    return (
        db.query(Cabinet)
        .filter(Cabinet.project_id == PROJECT_ID, Cabinet.description == description)
        .first()
        or db.query(FieldComponent)
        .filter(FieldComponent.project_id == PROJECT_ID, FieldComponent.description == description)
        .first()
    )


def node_type(node) -> str:
    return "cabinet" if isinstance(node, Cabinet) else "field_component"


def ensure_connection(db, *, source_desc: str, target_desc: str, cable_ref: str, label: str, cable_type: str) -> None:
    source = node_by_description(db, source_desc)
    target = node_by_description(db, target_desc)
    if not source or not target:
        raise RuntimeError(f"Missing node for {cable_ref}: {source_desc} -> {target_desc}")

    conn = (
        db.query(Connection)
        .filter(Connection.project_id == PROJECT_ID, Connection.cable_ref == cable_ref)
        .first()
    )
    if not conn:
        conn = Connection(project_id=PROJECT_ID)
        db.add(conn)
    conn.source_type = node_type(source)
    conn.source_id = source.id
    conn.target_type = node_type(target)
    conn.target_id = target.id
    conn.label = label
    conn.cable_ref = cable_ref
    conn.cable_type = cable_type
    conn.cable_section = None
    conn.cable_length = None


def set_position(db, node, *, x: float, y: float, width: float | None = None, height: float | None = None) -> None:
    pos = (
        db.query(CanvasPosition)
        .filter(CanvasPosition.entity_id == node.id, CanvasPosition.canvas_type == "overview")
        .first()
    )
    if not pos:
        pos = CanvasPosition(
            entity_type="space" if isinstance(node, Space) else node_type(node),
            entity_id=node.id,
            canvas_type="overview",
        )
        db.add(pos)
    pos.x = x
    pos.y = y
    if width is not None:
        pos.width = width
    if height is not None:
        pos.height = height


def main() -> None:
    db = SessionLocal()
    try:
        qe = space_by_designation(db, "++QE")
        qp = space_by_designation(db, "++QP")

        extra_cabinets = [
            ("==12=006++QE+G01", "Gemaal JS Lichtverdeler", "onderverdeler", qe, "12=006", "G01"),
            ("==06=031++QE+U01", "JS1 Gemaalpomp M+R Kast Aandrijfsysteem", "besturingskast", qe, "06=031", "U01"),
            ("==06=031++QP+R01", "JS1 Pompenruimte M+R Kast Rioolschuiven", "besturingskast", qp, "06=031", "R01"),
            ("==06=031++QP+R02", "JS1 M+R Kast Aandrijfsysteem Gemaalpomp JS", "besturingskast", qp, "06=031", "R02"),
            ("==07=031++QP+N02", "JS2 M+R Kast Aandrijfsysteem Gemaalpomp JS", "klemmenkast", qp, "07=031", "N02"),
        ]
        for description, name, cabinet_type, space, function, tag in extra_cabinets:
            ensure_cabinet(
                db,
                description=description,
                name=name,
                cabinet_type=cabinet_type,
                space=space,
                function=function,
                tag=tag,
            )
        db.flush()

        connections = [
            ("==12=006++QE+G01", "==07=031++QE+U01", "==12=006-W4631", "JS1 lichtverdeler naar JS2 drive", "voeding"),
            ("==06=031++QE+U01", "==07=031++QE+U01", "==12=006-W4632", "JS1 M+R naar JS2 drive", "voeding"),
            ("==01=002++QE+E02", "==07=031++QE+U01", "==07=031-W2201", "Voeding E02 naar drive", "voeding"),
            ("==07=031++QE+E03", "==07=031++QE+U01", "==07=031-W2202", "Voeding vitaal naar drive", "voeding"),
            ("==01=002++QE+F01", "==07=031++QE+U01", "==07=031-W2210", "Onderverdeler naar drive", "voeding"),
            ("==07=023++QE+R01", "==07=031++QP+R02", "==07=009-W6007", "Niveaumeting naar R02", "signaal"),
            ("==07=031++QE+U01", "==07=031++QP+S01", "==07=009-W6009", "Drive naar CBX", "signaal"),
            ("==07=031++QE+U01", "==07=031++QP+R02", "==07=031-W2203", "Drive naar R02", "voeding"),
            ("==07=031++QE+U01", "==07=031++QP+N01", "==07=031-W2204", "Drive naar N01", "voeding"),
            ("==07=031++QE+U01", "==07=031++QP+N01", "==07=031-W2205", "Drive naar N01 reserve", "voeding"),
            ("==07=031++QE+U01", "==07=031++QP-M0001", "==07=031-W9201", "Vermogenskabel motor", "voeding"),
            ("==07=031++QP+N01", "==07=031++QP-M0001", "==07=031-W2206", "Motor signalen", "voeding"),
            ("==07=031++QP+N01", "==07=031++QP-B1001", "==07=031-W2207", "Encoder voeding", "voeding"),
            ("==07=031++QP-B1001", "==07=031++QP+N01", "==07=031-W5208", "Encoder", "signaal"),
            ("==07=031++QP+N01", "==07=031++QP+R02", "==07=031-W5207", "Signaalkabels N01-R02", "signaal"),
            ("==07=031++QP-S0001", "==07=031++QP+R02", "==07=031-W5215", "Werkschakelaar", "signaal"),
            ("==06=031++QP+R01", "==07=031++QP+R02", "==12=006-W4653", "JS1 R01 naar JS2 R02", "signaal"),
            ("==06=031++QP+R02", "==07=031++QP+R02", "==12=006-W4654", "JS1 R02 naar JS2 R02", "signaal"),
            ("==07=031++QP+S01", "==07=031++QP+R02", "==07=009-W6008", "CBX naar R02", "signaal"),
            ("==07=031++QP+R02", "==07=031++QP+N02", "==07=031-W5209", "R02 naar N02", "signaal"),
            ("==07=031++QP+R02", "==07=031++QP+N02", "==07=031-W5210", "R02 naar N02", "signaal"),
            ("==07=031++QP+R02", "==07=031++QP+N02", "==07=031-W5211", "R02 naar N02", "signaal"),
            ("==07=031++QP+R02", "==07=031++QP-B1004", "==07=031-W5212", "Niveausensor", "signaal"),
            ("==07=031++QP-R1002", "==07=031++QP+R02", "==07=031-W2209", "Niveau MK", "voeding"),
            ("==07=031++QP-B1002", "==07=031++QP+N02", "==07=031-W5220", "PT100 Lager ZZ", "signaal"),
            ("==07=031++QP-B1005", "==07=031++QP+N02", "==07=031-W5021", "PT100 Lager KZ", "signaal"),
            ("==07=031++QP-B1006", "==07=031++QP+N02", "==07=031-W5222", "PT100 Stator L1a", "signaal"),
            ("==07=031++QP-B1007", "==07=031++QP+N02", "==07=031-W5023", "PT100 Stator L1b", "signaal"),
            ("==07=031++QP-B1008", "==07=031++QP+N02", "==07=031-W5224", "PT100 Stator L2", "signaal"),
            ("==07=031++QP-B1009", "==07=031++QP+N02", "==07=031-W5025", "PT100 Stator L3a", "signaal"),
            ("==07=031++QP-B1010", "==07=031++QP+N02", "==07=031-W5226", "PT100 Stator L3b", "signaal"),
            ("==07=031++QP-B1011", "==07=031++QP+N02", "==07=031-W5027", "PT100 Stator L3c", "signaal"),
            ("==07=031++QP-B1003", "==07=031++QP+N02", "==07=031-W5228", "Vochtdetectie Stator", "signaal"),
            ("==07=031++QP-B1012", "==07=031++QP+N02", "==07=031-W5029", "Vochtdetectie L1", "signaal"),
            ("==07=031++QP-B1013", "==07=031++QP+N02", "==07=031-W5230", "Vochtdetectie L2", "signaal"),
            ("==07=031++QP-B1014", "==07=031++QP+N02", "==07=031-W5031", "TK Olietemp 1", "signaal"),
            ("==07=031++QP-B1015", "==07=031++QP+N02", "==07=031-W5232", "TK Olietemp 2", "signaal"),
            ("==07=031++QP-B1016", "==07=031++QP+N02", "==07=031-W5033", "TK Water", "signaal"),
            ("==07=031++QP-B1017", "==07=031++QP+N02", "==07=031-W5234", "TK Olieniveau Min", "signaal"),
            ("==07=031++QP-B1018", "==07=031++QP+N02", "==07=031-W5035", "TK Olieniveau Laag", "signaal"),
        ]
        for source_desc, target_desc, cable_ref, label, cable_type in connections:
            ensure_connection(
                db,
                source_desc=source_desc,
                target_desc=target_desc,
                cable_ref=cable_ref,
                label=label,
                cable_type=cable_type,
            )

        db.flush()

        positions = {
            "==12=006++QE+G01": (120, 120),
            "==06=031++QE+U01": (370, 120),
            "==01=002++QE+E02": (620, 120),
            "==07=031++QE+E03": (870, 120),
            "==07=023++QE+R01": (1120, 120),
            "==01=002++QE+F01": (1370, 120),
            "==07=031++QE+U01": (620, 350),
            "==07=031++QP+S01": (520, 760),
            "==06=031++QP+R01": (960, 760),
            "==06=031++QP+R02": (1210, 760),
            "==07=031++QP-S0001": (1710, 760),
            "==07=031++QP+R02": (1080, 980),
            "==07=031++QP+N01": (220, 1160),
            "==07=031++QP+N02": (1080, 1340),
            "==07=031++QP-M0001": (220, 1520),
            "==07=031++QP-B1001": (510, 1520),
            "==07=031++QP-B1004": (1690, 1520),
            "==07=031++QP-R1002": (1980, 1520),
            "==07=031++QP-B1002": (120, 1700),
            "==07=031++QP-B1005": (410, 1700),
            "==07=031++QP-B1006": (700, 1700),
            "==07=031++QP-B1007": (990, 1700),
            "==07=031++QP-B1008": (1280, 1700),
            "==07=031++QP-B1009": (1570, 1700),
            "==07=031++QP-B1010": (1860, 1700),
            "==07=031++QP-B1011": (2150, 1700),
            "==07=031++QP-B1003": (120, 1880),
            "==07=031++QP-B1012": (410, 1880),
            "==07=031++QP-B1013": (700, 1880),
            "==07=031++QP-B1014": (990, 1880),
            "==07=031++QP-B1015": (1280, 1880),
            "==07=031++QP-B1016": (1570, 1880),
            "==07=031++QP-B1017": (1860, 1880),
            "==07=031++QP-B1018": (2150, 1880),
        }
        for desc, (x, y) in positions.items():
            node = node_by_description(db, desc)
            if node:
                set_position(db, node, x=x, y=y)

        set_position(db, qe, x=40, y=40, width=1600, height=560)
        set_position(db, qp, x=40, y=680, width=2400, height=1440)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
