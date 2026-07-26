from __future__ import annotations
import hashlib,math,re
TOKEN=re.compile(r'[\w+#.-]+',re.UNICODE)
def transform(texts:list[str],dimension:int=256):
 out=[]
 for text in texts:
  row=[0.0]*dimension
  for token in TOKEN.findall(text.lower()):
   raw=int.from_bytes(hashlib.blake2b(token.encode(),digest_size=8).digest(),'big');row[raw%dimension]+=1 if raw&1 else -1
  norm=math.sqrt(sum(x*x for x in row))or 1;out.append([x/norm for x in row])
 return out
