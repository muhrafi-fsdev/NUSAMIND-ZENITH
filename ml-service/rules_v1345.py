from __future__ import annotations
import re
def phrase_match(text:str,phrases:list[str])->list[str]:
 normalized=' '.join(text.lower().split());hits=[]
 for phrase in phrases:
  escaped=re.escape(phrase.lower()).replace(r'\ ',r'\s+')
  if re.search(rf'(?<!\w){escaped}(?!\w)',normalized,re.UNICODE):hits.append(phrase)
 return hits
