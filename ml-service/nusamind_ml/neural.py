from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np

class Dense:
    def __init__(self, in_features:int, out_features:int, seed:int=42):
        rng=np.random.default_rng(seed); limit=math.sqrt(6/(in_features+out_features)); self.w=rng.uniform(-limit,limit,(in_features,out_features)); self.b=np.zeros((1,out_features)); self.x=None; self.dw=None; self.db=None
    def forward(self,x): self.x=np.asarray(x,dtype=np.float64); return self.x@self.w+self.b
    def backward(self,grad): grad=np.asarray(grad,dtype=np.float64); self.dw=self.x.T@grad/max(1,len(self.x)); self.db=grad.mean(axis=0,keepdims=True); return grad@self.w.T
class ReLU:
    def forward(self,x): self.x=np.asarray(x); return np.maximum(0,self.x)
    def backward(self,g): return np.asarray(g)*(self.x>0)
class Tanh:
    def forward(self,x): self.y=np.tanh(x); return self.y
    def backward(self,g): return np.asarray(g)*(1-self.y**2)
def softmax(x): x=np.asarray(x,dtype=np.float64); z=x-x.max(axis=1,keepdims=True); e=np.exp(z); return e/e.sum(axis=1,keepdims=True)
def cross_entropy(logits,y):
    p=softmax(logits); y=np.asarray(y,dtype=int); loss=-np.log(np.clip(p[np.arange(len(y)),y],1e-12,1)).mean(); g=p; g[np.arange(len(y)),y]-=1; return float(loss),g/max(1,len(y))
class Adam:
    def __init__(self,lr=1e-3,b1=.9,b2=.999,eps=1e-8): self.lr=lr;self.b1=b1;self.b2=b2;self.eps=eps;self.t=0;self.state={}
    def step(self,layers):
        self.t+=1
        for layer in layers:
            if not isinstance(layer,Dense): continue
            for name,grad in (("w",layer.dw),("b",layer.db)):
                key=(id(layer),name); m,v=self.state.get(key,(np.zeros_like(grad),np.zeros_like(grad))); m=self.b1*m+(1-self.b1)*grad; v=self.b2*v+(1-self.b2)*(grad*grad); mh=m/(1-self.b1**self.t); vh=v/(1-self.b2**self.t); setattr(layer,name,getattr(layer,name)-self.lr*mh/(np.sqrt(vh)+self.eps)); self.state[key]=(m,v)
class MLP:
    def __init__(self,input_dim:int,hidden:int,classes:int,seed:int=42): self.layers=[Dense(input_dim,hidden,seed),ReLU(),Dense(hidden,classes,seed+1)]
    def forward(self,x):
        for l in self.layers:x=l.forward(x)
        return x
    def train(self,x,y,epochs=50,lr=1e-2):
        opt=Adam(lr); hist=[]
        for _ in range(int(epochs)):
            logits=self.forward(x); loss,g=cross_entropy(logits,y); hist.append(loss)
            for l in reversed(self.layers):g=l.backward(g)
            opt.step(self.layers)
        return {"loss_start":round(hist[0],6),"loss_end":round(hist[-1],6),"epochs":len(hist)}
    def predict(self,x): return softmax(self.forward(x))
    def save(self,path):
        obj={"format":"nusamind-neural-v1","layers":[{"w":l.w.tolist(),"b":l.b.tolist()} for l in self.layers if isinstance(l,Dense)]}; Path(path).write_text(json.dumps(obj),encoding="utf-8")
def benchmark():
    x=np.array([[0,0],[0,1],[1,0],[1,1]],dtype=float); y=np.array([0,1,1,0]); m=MLP(2,8,2); h=m.train(x,y,epochs=400,lr=.03); pred=m.predict(x).argmax(axis=1); return {"ok":True,"accuracy":float((pred==y).mean()),"history":h,"predictions":pred.tolist()}
