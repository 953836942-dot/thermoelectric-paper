from pathlib import Path
import sys


def import_te_radar():
    root = Path(__file__).resolve().parents[2]
    scripts = root / "te-literature-radar" / "scripts"
    value = str(scripts)
    if value not in sys.path:
        sys.path.insert(0, value)
    import te_radar
    return te_radar
