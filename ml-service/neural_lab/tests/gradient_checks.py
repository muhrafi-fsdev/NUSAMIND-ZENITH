from __future__ import annotations
import numpy as np
from nusamind_ml.neural import Dense

def run():
 layer=Dense(3,2,seed=7);x=np.array([[.2,-.4,.8],[-.1,.3,.5]],dtype=float);up=np.array([[.7,-.2],[.1,.5]],dtype=float);layer.forward(x);layer.backward(up);analytic=layer.dw.copy();numeric=np.zeros_like(layer.w);eps=1e-5
 for i in range(layer.w.shape[0]):
  for j in range(layer.w.shape[1]):
   old=layer.w[i,j];layer.w[i,j]=old+eps;plus=float((layer.forward(x)*up).sum()/len(x));layer.w[i,j]=old-eps;minus=float((layer.forward(x)*up).sum()/len(x));layer.w[i,j]=old;numeric[i,j]=(plus-minus)/(2*eps)
 error=float(np.max(np.abs(analytic-numeric)));return{'ok':error<1e-5,'max_error':error}
if __name__=='__main__':
 result=run();print(result);raise SystemExit(0 if result['ok'] else 1)
