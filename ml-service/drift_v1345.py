from __future__ import annotations
from collections import Counter
def distribution(labels:list[str])->dict[str,float]:
 c=Counter(labels);n=max(1,sum(c.values()));return{k:v/n for k,v in c.items()}
def total_variation(base:dict[str,float],current:dict[str,float])->float:return round(.5*sum(abs(base.get(k,0)-current.get(k,0)) for k in set(base)|set(current)),6)
def drift_status(score:float,threshold:float=.18)->dict:return{'metric':'total_variation','value':score,'threshold':threshold,'status':'alert' if score>=threshold else 'ok'}
