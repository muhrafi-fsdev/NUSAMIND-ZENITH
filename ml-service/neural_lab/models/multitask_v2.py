from __future__ import annotations
from nusamind_ml.neural import MLP
class MultiTaskV2:
 def __init__(self,input_dim:int,heads:dict[str,int],hidden=64):self.heads={name:MLP(input_dim,hidden,classes,seed=1345+i) for i,(name,classes) in enumerate(heads.items())}
 def predict(self,x):return{name:model.predict(x) for name,model in self.heads.items()}
