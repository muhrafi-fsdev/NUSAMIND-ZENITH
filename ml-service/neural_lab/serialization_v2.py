from __future__ import annotations
import json
from pathlib import Path
ALLOWED={'nusamind-neural-v1','nusamind-intent-mlp-v2','nusamind-multitask-v2'}
def safe_load(path:str,max_bytes=50_000_000):
 p=Path(path)
 if p.stat().st_size>max_bytes:raise ValueError('neural artifact too large')
 obj=json.loads(p.read_text(encoding='utf-8'))
 if obj.get('format') not in ALLOWED:raise ValueError('untrusted neural format')
 return obj
