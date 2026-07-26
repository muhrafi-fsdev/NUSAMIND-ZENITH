from __future__ import annotations
import hashlib,json
from pathlib import Path
def checksum(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def register(model:Path,manifest:Path,metadata:dict)->dict:
 row={**metadata,'model':model.name,'checksum':checksum(model),'status':'active'};manifest.write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8');return row
