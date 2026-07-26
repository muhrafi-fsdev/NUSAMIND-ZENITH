from __future__ import annotations
import numpy as np
from nusamind_ml.neural import MLP,cross_entropy
class MiniBatchTrainer:
 def __init__(self,batch_size=32,patience=8,min_delta=1e-4,seed=1345):self.batch_size=batch_size;self.patience=patience;self.min_delta=min_delta;self.rng=np.random.default_rng(seed)
 def fit(self,model:MLP,x,y,x_val,y_val,epochs=120,lr=.01):
  best=float('inf');wait=0;history=[]
  for epoch in range(epochs):
   order=self.rng.permutation(len(x))
   for start in range(0,len(x),self.batch_size):model.train(x[order[start:start+self.batch_size]],y[order[start:start+self.batch_size]],epochs=1,lr=lr)
   loss,_=cross_entropy(model.forward(x_val),y_val);history.append(float(loss))
   if loss<best-self.min_delta:best=loss;wait=0
   else:
    wait+=1
    if wait>=self.patience:break
  return{'epochs':len(history),'best_val_loss':best,'early_stopped':len(history)<epochs}
