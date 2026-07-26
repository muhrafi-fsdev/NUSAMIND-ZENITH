from __future__ import annotations
import json
from pathlib import Path
def calibrate(confidence:float,temperature:float=1.0)->float:
 import math
 p=max(1e-6,min(1-1e-6,float(confidence)));logit=math.log(p/(1-p));return round(1/(1+math.exp(-logit/max(.25,temperature))),6)
def save_calibration(path:str,temperature:float,metrics:dict)->Path:
 p=Path(path);p.write_text(json.dumps({'format':'nusamind-calibration-v1','temperature':temperature,'metrics':metrics},indent=2),encoding='utf-8');return p
