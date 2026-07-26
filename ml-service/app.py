from __future__ import annotations
import os,time
from typing import Any
from fastapi import FastAPI,Header,HTTPException
from pydantic import BaseModel,Field
from nusamind_ml.engine import MLEngine
from nusamind_ml.v1345 import MLV1345
from nusamind_ml.health import analyze_health
from nusamind_ml.neural import benchmark as neural_benchmark

app=FastAPI(title="NusaMind ML Service",version="13.45.0",docs_url="/docs",redoc_url=None)
engine=MLEngine();advanced=MLV1345(engine.edition,float(os.getenv("NUSAMIND_ML_MIN_CONFIDENCE","0.68")));started_at=time.time()
NEURAL_ENABLED=engine.edition in {"zenith","apex"} and os.getenv("NUSAMIND_NEURAL_ENABLED","true").lower() in {"1","true","yes"}
class TextRequest(BaseModel): text:str=Field(min_length=1,max_length=20000)
class EmbedRequest(BaseModel): texts:list[str]=Field(min_length=1)
class SimilarityRequest(BaseModel): left:str=Field(min_length=1,max_length=20000);right:str=Field(min_length=1,max_length=20000)
class AnomalyRequest(BaseModel): rows:list[list[float]]=Field(min_length=3);contamination:float=Field(default=.05,gt=0,lt=.5)
class EvaluateRequest(BaseModel): question:str=Field(min_length=1,max_length=20000);answer:str=Field(min_length=1,max_length=50000);evidence:list[str]=Field(default_factory=list)
class BatchRequest(BaseModel): texts:list[str]=Field(min_length=1)
class TrainRequest(BaseModel): dataset:str="intent-v1345.csv";confirmed:bool=False

def require_write_token(token:str|None)->None:
 expected=os.getenv("NUSAMIND_ML_TOKEN","").strip()
 if not expected:
  if os.getenv("NUSAMIND_ML_ALLOW_UNAUTH_WRITE","false").lower() not in {"1","true","yes"}:raise HTTPException(status_code=403,detail="ML write operations require NUSAMIND_ML_TOKEN")
  return
 if token!=expected:raise HTTPException(status_code=403,detail="invalid ML token")
@app.get("/health")
def health()->dict[str,Any]:return{"ok":True,"status":"ready","release":"R13.45","uptime_seconds":round(time.time()-started_at,3),"capabilities":{**engine.capabilities(),"v1345":advanced.status(),"neural_configured":NEURAL_ENABLED}}
@app.get("/v1/capabilities")
def capabilities()->dict[str,Any]:return{"ok":True,"capabilities":engine.capabilities(),"neural_enabled":NEURAL_ENABLED}
@app.post("/v1/analyze")
def analyze(request:TextRequest)->dict[str,Any]:return{"ok":True,"analysis":advanced.enrich(engine.analyze(request.text),request.text)}
@app.post("/v1/batch")
def batch(request:BatchRequest)->dict[str,Any]:
 if len(request.texts)>engine.max_batch:raise HTTPException(status_code=400,detail=f"max batch is {engine.max_batch}")
 return{"ok":True,"items":[advanced.enrich(engine.analyze(text),text) for text in request.texts]}
@app.post("/v1/embed")
def embed(request:EmbedRequest)->dict[str,Any]:return{"ok":True,**engine.embed(request.texts)}
@app.post("/v1/similarity")
def similarity(request:SimilarityRequest)->dict[str,Any]:return{"ok":True,**engine.similarity(request.left,request.right)}
@app.post("/v1/anomaly")
def anomaly(request:AnomalyRequest)->dict[str,Any]:return{"ok":True,**engine.anomaly(request.rows,request.contamination)}
@app.post("/v1/evaluate")
def evaluate(request:EvaluateRequest)->dict[str,Any]:return{"ok":True,"evaluation":engine.evaluate(request.question,request.answer,request.evidence)}
@app.post("/v1/train-intent")
def train_intent(request:TrainRequest,x_ml_token:str|None=Header(default=None))->dict[str,Any]:
 require_write_token(x_ml_token)
 if not request.confirmed:raise HTTPException(status_code=400,detail="confirmed=true is required")
 return{"ok":True,"model":engine.train_intent(request.dataset)}
@app.post("/v1/reload")
def reload_models(x_ml_token:str|None=Header(default=None))->dict[str,Any]:require_write_token(x_ml_token);return{"ok":True,"capabilities":engine.reload()}
@app.post("/v1/health-analyze")
def health_analyze(request:TextRequest)->dict[str,Any]:return{"ok":True,"analysis":analyze_health(request.text),"release":"R13.45"}
@app.post("/v1/neural-benchmark")
def neural_bench()->dict[str,Any]:
 if not NEURAL_ENABLED:raise HTTPException(status_code=403,detail="Neural Lab is disabled for this edition")
 return neural_benchmark()
@app.post("/v1/neural-predict")
def neural_predict(request:TextRequest)->dict[str,Any]:
 if not NEURAL_ENABLED:raise HTTPException(status_code=403,detail="Neural Lab is disabled for this edition")
 result=advanced.enrich(engine.analyze(request.text),request.text);return{"ok":True,"prediction":result,"note":"Custom neural routing is auxiliary and calibrated; it does not replace the main language model."}
