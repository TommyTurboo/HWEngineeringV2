#!/usr/bin/env python3
"""
Export een HWEngineering canvas naar DXF (en optioneel .dwg via ODA File Converter).

Gebruik:
    python export_canvas_to_dxf.py <project_id>
    python export_canvas_to_dxf.py <project_id> --paper A1
    python export_canvas_to_dxf.py <project_id> --paper A0 --margin 20
    python export_canvas_to_dxf.py <project_id> --oda "C:/Program Files/ODA/ODAFileConverter.exe"

Vereisten:
    pip install requests ezdxf
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import requests
import ezdxf
from ezdxf import colors

# ─── papierformaten (mm, liggend) ────────────────────────────────────────────

PAPER_MM: dict[str, tuple[float, float]] = {
    "A0": (1189, 841),
    "A1": ( 841, 594),
    "A2": ( 594, 420),
    "A3": ( 420, 297),
}

API_BASE = "http://localhost:8004/api/v1"

# Knooppunt-afmetingen in canvas pixels (overeenkomend met de frontend)
CAB_W, CAB_H = 220, 80
FC_W,  FC_H  = 220, 80
HEADER_H_PX  = 32

# Laagnamen
L_ZONE    = "HW_RUIMTE"
L_KAST    = "HW_KAST"
L_KAST_H  = "HW_KAST_HEADER"
L_FC      = "HW_VELDCOMPONENT"
L_FC_H    = "HW_VELDCOMPONENT_HEADER"
L_TEKST   = "HW_TEKST"
L_CONN    = "HW_VERBINDING"

# Kabinettype → headerkleur (van CabinetNode.tsx)
CABINET_COLORS: dict[str, tuple[int, int, int]] = {
    "hoofdverdeler":  ( 21, 101, 192),
    "onderverdeler":  ( 25, 118, 210),
    "besturingskast": (106,  27, 154),
    "netwerkkast":    (  0, 105,  92),
    "klemmenkast":    (230,  81,   0),
}
FC_COLOR   = ( 46, 125,  50)
ZONE_COLOR = (160, 160, 160)
CONN_COLOR = ( 80,  80,  80)
BLACK      = (  0,   0,   0)
WHITE      = (255, 255, 255)


# ─── transform: canvas pixels → DXF mm ───────────────────────────────────────
# Wordt ingesteld door compute_transform() vóór het tekenen.

_scale  = 0.5
_off_cx = 0.0   # canvas-x offset (canvas-min_x, zodat inhoud bij 0 start)
_off_cy = 0.0   # canvas-y offset


def _cx(canvas_x: float) -> float:
    return (canvas_x - _off_cx) * _scale


def _cy(canvas_y: float) -> float:
    return -(canvas_y - _off_cy) * _scale    # Y omdraaien


def _sc(v: float) -> float:
    """Schaal een afstand (geen Y-omdraaien)."""
    return v * _scale


def compute_transform(canvas: dict, paper_w: float, paper_h: float, margin: float) -> None:
    """Bereken schaal en offset zodat alle canvas-inhoud in het papierformaat past."""
    global _scale, _off_cx, _off_cy

    xs, ys = [], []
    for node in canvas["nodes"]:
        px, py = node["position"]["x"], node["position"]["y"]
        style  = node.get("style", {})
        nw = style.get("width",  CAB_W if node["type"] != "spaceZone" else 320)
        nh = style.get("height", CAB_H if node["type"] != "spaceZone" else 220)
        xs += [px, px + nw]
        ys += [py, py + nh]

    if not xs:
        _scale, _off_cx, _off_cy = 0.5, 0.0, 0.0
        return

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    content_w = max_x - min_x or 1
    content_h = max_y - min_y or 1

    usable_w = paper_w - 2 * margin
    usable_h = paper_h - 2 * margin
    _scale  = min(usable_w / content_w, usable_h / content_h)

    # Offset: verschuif inhoud zodat linksboven op (margin, -margin) landt
    _off_cx = min_x - margin / _scale
    _off_cy = min_y - margin / _scale

    print(f"  Canvas: {content_w:.0f}x{content_h:.0f} px  =>  schaal: {_scale:.4f}  "
          f"(uitvoer: {content_w*_scale:.0f}x{content_h*_scale:.0f} mm)")


# ─── labelhulp ────────────────────────────────────────────────────────────────

def build_ref(data: dict) -> str:
    desc = data.get("description", "") or ""
    if desc.startswith("=="):
        return desc
    parts: list[str] = []
    if data.get("function_designation"):
        parts.append(f"={data['function_designation']}")
    if data.get("space_designation"):
        parts.append(data["space_designation"])
    if data.get("tag"):
        parts.append(f"-{data['tag']}")
    return "".join(parts)


# ─── geometrie ────────────────────────────────────────────────────────────────

def node_bounds(node: dict, dw: float, dh: float) -> tuple[float, float, float, float]:
    """(dxf_x, dxf_y_top, dxf_w, dxf_h)"""
    style = node.get("style", {})
    pw = style.get("width",  dw)
    ph = style.get("height", dh)
    return _cx(node["position"]["x"]), _cy(node["position"]["y"]), _sc(pw), _sc(ph)


def center_bottom(node: dict, dw: float, dh: float) -> tuple[float, float]:
    x, y, w, h = node_bounds(node, dw, dh)
    return x + w / 2, y - h


def center_top(node: dict, dw: float, dh: float) -> tuple[float, float]:
    x, y, w, h = node_bounds(node, dw, dh)
    return x + w / 2, y


# ─── teken-hulpfuncties ───────────────────────────────────────────────────────

def add_rect(msp, x, y, w, h, layer, rgb=None, linetype=None):
    pts = [(x, y), (x + w, y), (x + w, y - h), (x, y - h)]
    attrs: dict = {"layer": layer, "closed": True}
    if linetype:
        attrs["linetype"] = linetype
    pl = msp.add_lwpolyline(pts, dxfattribs=attrs)
    if rgb:
        pl.dxf.true_color = colors.rgb2int(rgb)


def add_text(msp, text, x, y, height, layer, rgb=None):
    t = msp.add_text(text, dxfattribs={"height": height, "layer": layer})
    t.dxf.insert = (x, y)
    if rgb:
        t.dxf.true_color = colors.rgb2int(rgb)


# ─── teken-functies per entiteitstype ────────────────────────────────────────

def draw_space_zone(msp, node: dict) -> None:
    x, y, w, h = node_bounds(node, 320, 220)
    data = node["data"]
    add_rect(msp, x, y, w, h, L_ZONE, rgb=ZONE_COLOR, linetype="DASHED")
    label = f"{data.get('designation', '')}  {data.get('name', '')}".strip()
    add_text(msp, label, x + _sc(4), y - _sc(6), _sc(10), L_TEKST, rgb=ZONE_COLOR)


def draw_cabinet(msp, node: dict) -> None:
    x, y, w, h = node_bounds(node, CAB_W, CAB_H)
    data = node["data"]
    cab_type = data.get("cabinet_type", "")
    hdr_rgb = CABINET_COLORS.get(cab_type, (21, 101, 192))
    hh = _sc(HEADER_H_PX)

    add_rect(msp, x, y, w, h, L_KAST, rgb=BLACK)
    add_rect(msp, x, y, w, hh, L_KAST_H, rgb=hdr_rgb)

    type_label = {"hoofdverdeler": "HV", "onderverdeler": "OV", "besturingskast": "BK",
                  "netwerkkast": "NK", "klemmenkast": "KK"}.get(cab_type, "")
    ref = build_ref(data) or data.get("name", "")
    header_text = f"{type_label}  {ref}".strip() if type_label else ref
    add_text(msp, header_text, x + _sc(3), y - hh + _sc(3), _sc(9), L_TEKST, rgb=WHITE)

    name = data.get("name", "")
    add_text(msp, name, x + _sc(3), y - hh - _sc(4), _sc(8), L_TEKST, rgb=BLACK)


def draw_field_component(msp, node: dict) -> None:
    x, y, w, h = node_bounds(node, FC_W, FC_H)
    data = node["data"]
    hh = _sc(HEADER_H_PX)

    add_rect(msp, x, y, w, h, L_FC, rgb=BLACK)
    add_rect(msp, x, y, w, hh, L_FC_H, rgb=FC_COLOR)

    ref = build_ref(data) or data.get("name", "")
    add_text(msp, ref, x + _sc(3), y - hh + _sc(3), _sc(9), L_TEKST, rgb=WHITE)

    name = data.get("name", "")
    add_text(msp, name, x + _sc(3), y - hh - _sc(4), _sc(8), L_TEKST, rgb=BLACK)


def draw_connection(msp, edge: dict, node_map: dict) -> None:
    src = node_map.get(edge["source"])
    tgt = node_map.get(edge["target"])
    if not src or not tgt:
        return
    if src["type"] == "spaceZone" or tgt["type"] == "spaceZone":
        return

    sw, sh = (CAB_W, CAB_H) if src["type"] == "cabinet" else (FC_W, FC_H)
    tw, th = (CAB_W, CAB_H) if tgt["type"] == "cabinet" else (FC_W, FC_H)

    x1, y1 = center_bottom(src, sw, sh)
    x2, y2 = center_top(tgt, tw, th)
    mid_y = (y1 + y2) / 2

    pts = [(x1, y1), (x1, mid_y), (x2, mid_y), (x2, y2)]
    pl = msp.add_lwpolyline(pts, dxfattribs={"layer": L_CONN})
    pl.dxf.true_color = colors.rgb2int(CONN_COLOR)
    pl.dxf.lineweight = 18

    conn_data = edge.get("data", {})
    parts = [s for s in [
        conn_data.get("cable_ref"),
        conn_data.get("cable_type"),
        f"{conn_data['cable_section']}mm²" if conn_data.get("cable_section") else None,
        f"{conn_data['cable_length']}m"    if conn_data.get("cable_length")   else None,
    ] if s]
    if parts:
        # Annotatie naast het horizontale middensegment, verticaal gecentreerd
        lx = min(x1, x2) + abs(x2 - x1) / 2 + _sc(3)
        add_text(msp, " ".join(parts), lx, mid_y + _sc(3), _sc(7), L_TEKST, rgb=(60, 60, 60))


# ─── DXF opbouwen ─────────────────────────────────────────────────────────────

def build_dxf(canvas: dict) -> object:
    doc = ezdxf.new("R2018")
    doc.header["$INSUNITS"] = 4   # mm

    if "DASHED" not in doc.linetypes:
        doc.linetypes.add("DASHED", pattern=[2.0, -1.0])

    for name, rgb in [
        (L_ZONE,   ZONE_COLOR),
        (L_KAST,   BLACK),
        (L_KAST_H, (21, 101, 192)),
        (L_FC,     BLACK),
        (L_FC_H,   FC_COLOR),
        (L_TEKST,  BLACK),
        (L_CONN,   CONN_COLOR),
    ]:
        layer = doc.layers.new(name)
        layer.dxf.true_color = colors.rgb2int(rgb)

    msp = doc.modelspace()
    nodes = canvas["nodes"]
    edges = canvas["edges"]
    node_map = {n["id"]: n for n in nodes}

    for node in nodes:
        if node["type"] == "spaceZone":
            draw_space_zone(msp, node)
    for node in nodes:
        if node["type"] == "cabinet":
            draw_cabinet(msp, node)
        elif node["type"] == "fieldComponent":
            draw_field_component(msp, node)
    for edge in edges:
        draw_connection(msp, edge, node_map)

    return doc


# ─── API & ODA ────────────────────────────────────────────────────────────────

def fetch_canvas(api_base: str, project_id: str) -> dict:
    url = f"{api_base.rstrip('/')}/projects/{project_id}/canvas/overview"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return resp.json()


def convert_to_dwg(oda_exe: str, dxf_path: Path) -> Path | None:
    out_dir = dxf_path.parent
    try:
        subprocess.run([
            oda_exe,
            str(dxf_path.parent),
            str(out_dir),
            "ACAD2018",
            "DWG",
            "0",
            "1",
            str(dxf_path.name),
        ], check=True, timeout=60)
        dwg = out_dir / dxf_path.with_suffix(".dwg").name
        return dwg if dwg.exists() else None
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"  ODA-conversie mislukt: {exc}")
        return None


# ─── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Exporteer HWEngineering canvas naar DXF/DWG")
    parser.add_argument("project_id", help="UUID van het project")
    parser.add_argument("--api",    default=API_BASE)
    parser.add_argument("--out",    default="output")
    parser.add_argument("--paper",  default="A1", choices=list(PAPER_MM),
                        help="Doelpapierformaat, liggend (standaard: A1)")
    parser.add_argument("--margin", type=float, default=15.0,
                        help="Marge in mm rondom de inhoud (standaard: 15)")
    parser.add_argument("--oda",    default=None,
                        help="Pad naar ODAFileConverter.exe voor .dwg-export")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_dxf = out_dir / f"{args.project_id}.dxf"

    print(f"Canvas ophalen van {args.api} ...")
    canvas = fetch_canvas(args.api, args.project_id)
    print(f"  {len(canvas['nodes'])} knooppunten, {len(canvas['edges'])} verbindingen")

    paper_w, paper_h = PAPER_MM[args.paper]
    print(f"Schaal berekenen voor {args.paper} ({paper_w}×{paper_h} mm) ...")
    compute_transform(canvas, paper_w, paper_h, args.margin)

    print("DXF opbouwen ...")
    doc = build_dxf(canvas)
    doc.saveas(str(out_dxf))
    print(f"  DXF opgeslagen: {out_dxf}")

    if args.oda:
        print("DWG-conversie via ODA ...")
        dwg = convert_to_dwg(args.oda, out_dxf)
        print(f"  DWG opgeslagen: {dwg}" if dwg else "  DWG niet aangemaakt.")


if __name__ == "__main__":
    main()
