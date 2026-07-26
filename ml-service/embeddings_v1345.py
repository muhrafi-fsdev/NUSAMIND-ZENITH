from __future__ import annotations
import hashlib,math,re
TOKEN=re.compile(r'[\w+#.-]+',re.UNICODE)
def embed(text:str,dimension:int=384)->list[float]:
 v=[0.0]*dimension
 for token in TOKEN.findall(text.lower()):
  raw=int.from_bytes(hashlib.blake2b(token.encode(),digest_size=8).digest(),'big');v[raw%dimension]+=1 if raw&1 else -1
 n=math.sqrt(sum(x*x for x in v))or 1;return[x/n for x in v]
