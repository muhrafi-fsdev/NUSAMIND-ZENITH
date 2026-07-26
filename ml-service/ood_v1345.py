from __future__ import annotations
import json
from pathlib import Path
def fit_threshold(max_probabilities:list[float],quantile:float=.08)->float:
 values=sorted(max(0.0,min(1.0,float(x))) for x in max_probabilities);return round(values[max(0,min(len(values)-1,int(len(values)*quantile)))] if values else .55,4)
def abstain(max_probability:float,threshold:float)->bool:return float(max_probability)<float(threshold)
def save_ood(path:str,threshold:float,metrics:dict)->Path:
 p=Path(path);p.write_text(json.dumps({'format':'nusamind-ood-v1','threshold':threshold,'metrics':metrics},indent=2),encoding='utf-8');return p
