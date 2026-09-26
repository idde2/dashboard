from pathlib import Path
import sys
from typing import List
import json
from datetime import datetime


def get_json_files(root_dir: str) -> List[Path]:
    try:
        root_path = Path(root_dir).resolve(strict=True)
    except FileNotFoundError:
        print(f"Error: Directory '{root_dir}' does not exist.", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error accessing '{root_dir}': {e}", file=sys.stderr)
        return []

    if not root_path.is_dir():
        print(f"Error: '{root_dir}' is not a directory.", file=sys.stderr)
        return []

    try:
        return [str(f) for f in root_path.rglob("*.json") if f.is_file()]

    except PermissionError as e:
        print(f"Permission denied during search: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Unexpected error during search: {e}", file=sys.stderr)
        return []

def get_file(file,ID):
    with open(file,'r', encoding='utf-8') as f:
        raw = json.load(f)
        datum_objekt = datetime.fromisoformat(raw["date"])
        datum = datum_objekt.strftime("%d.%m.%Y um %H:%M Uhr")
        return ID, raw["name"], raw["email"],raw["msg"], datum