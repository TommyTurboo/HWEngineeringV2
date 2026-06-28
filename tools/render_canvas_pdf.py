#!/usr/bin/env python3
"""
Render een HWEngineering DXF-bestand naar PDF en PNG.

Gebruik:
    python render_canvas_pdf.py output/<project_id>.dxf
    python render_canvas_pdf.py output/<project_id>.dxf --out renders/
    python render_canvas_pdf.py output/<project_id>.dxf --paper A1   # A0 / A1 / A2 / A3 / custom
    python render_canvas_pdf.py output/<project_id>.dxf --width 59.4 --height 42.0  # cm, liggend A1

Vereisten:
    pip install ezdxf matplotlib
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

# ezdxf gebruikt intern matplotlib en heeft een schrijfbare cache nodig
_CACHE = Path(__file__).parent / ".cache"
_CACHE.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_CACHE.resolve()))
os.environ.setdefault("EZDXF_CACHE_DIR", str(_CACHE.resolve()))

import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.config import ColorPolicy, Configuration, LinePolicy, LineweightPolicy
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib.pyplot as plt

# Papierformaten in inch (breedte × hoogte, liggend)
PAPER_SIZES_INCH: dict[str, tuple[float, float]] = {
    "A0": (46.81, 33.11),
    "A1": (33.11, 23.39),
    "A2": (23.39, 16.54),
    "A3": (16.54, 11.69),
}


def render(dxf_path: Path, out_dir: Path, fig_w: float, fig_h: float, dpi: int) -> None:
    print(f"DXF lezen: {dxf_path}")
    doc = ezdxf.readfile(str(dxf_path))

    config = Configuration(
        color_policy=ColorPolicy.COLOR,
        line_policy=LinePolicy.ACCURATE,
        lineweight_policy=LineweightPolicy.ABSOLUTE,
        min_lineweight=0.05,
    )

    fig = plt.figure(figsize=(fig_w, fig_h))
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("white")

    Frontend(RenderContext(doc), MatplotlibBackend(ax), config=config).draw_layout(
        doc.modelspace(), finalize=True
    )

    ax.set_aspect("equal", adjustable="box")
    ax.autoscale()
    ax.margins(0.02)
    ax.axis("off")

    stem = dxf_path.stem
    out_pdf = out_dir / f"{stem}.pdf"
    out_png = out_dir / f"{stem}.png"

    print(f"PDF opslaan: {out_pdf}")
    fig.savefig(str(out_pdf), facecolor="white", pad_inches=0.08, bbox_inches="tight")

    print(f"PNG opslaan: {out_png}  (dpi={dpi})")
    fig.savefig(str(out_png), dpi=dpi, facecolor="white", pad_inches=0.08, bbox_inches="tight")

    plt.close(fig)
    print("Klaar.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render HWEngineering DXF naar PDF/PNG")
    parser.add_argument("dxf", help="Pad naar het DXF-bestand")
    parser.add_argument("--out", default=None,
                        help="Uitvoermap (standaard: zelfde map als het DXF-bestand)")
    parser.add_argument("--paper", default="A1", choices=list(PAPER_SIZES_INCH),
                        help="Papierformaat, liggend (standaard: A1)")
    parser.add_argument("--width",  type=float, default=None,
                        help="Breedte in inch (overschrijft --paper)")
    parser.add_argument("--height", type=float, default=None,
                        help="Hoogte in inch (overschrijft --paper)")
    parser.add_argument("--dpi", type=int, default=150,
                        help="DPI voor PNG-uitvoer (standaard: 150)")
    args = parser.parse_args()

    dxf_path = Path(args.dxf)
    if not dxf_path.exists():
        parser.error(f"DXF-bestand niet gevonden: {dxf_path}")

    out_dir = Path(args.out) if args.out else dxf_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.width and args.height:
        fig_w, fig_h = args.width, args.height
    else:
        fig_w, fig_h = PAPER_SIZES_INCH[args.paper]

    print(f"Papierformaat: {fig_w:.2f}\" × {fig_h:.2f}\"  ({args.paper if not (args.width and args.height) else 'aangepast'})")
    render(dxf_path, out_dir, fig_w, fig_h, args.dpi)


if __name__ == "__main__":
    main()
