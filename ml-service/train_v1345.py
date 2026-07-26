from __future__ import annotations
import csv,json,time,hashlib
from collections import Counter
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score,f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import FeatureUnion,Pipeline
from calibration_v1345 import save_calibration
from ood_v1345 import fit_threshold,save_ood
BASE=Path(__file__).resolve().parent
rows=list(csv.DictReader((BASE/'datasets/intent-v1345.csv').open(encoding='utf-8')))
texts=[r['text'] for r in rows];labels=[r['label'] for r in rows];groups=[r['group_id'] for r in rows]
assert len(rows)==len(set((r['text'],r['label']) for r in rows)),'duplicate text-label rows'
split=GroupShuffleSplit(n_splits=1,test_size=.22,random_state=1345);train_idx,test_idx=next(split.split(texts,labels,groups))
assert not(set(groups[i] for i in train_idx)&set(groups[i] for i in test_idx)),'semantic group leakage'
x_train=[texts[i] for i in train_idx];y_train=[labels[i] for i in train_idx];x_test=[texts[i] for i in test_idx];y_test=[labels[i] for i in test_idx]
features=FeatureUnion([('word',TfidfVectorizer(ngram_range=(1,2),sublinear_tf=True,max_features=16000)),('char',TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),sublinear_tf=True,max_features=16000))])
model=Pipeline([('features',features),('classifier',LogisticRegression(max_iter=900,class_weight='balanced',C=3.0,random_state=1345))])
started=time.perf_counter();model.fit(x_train,y_train);pred=model.predict(x_test);proba=model.predict_proba(x_test);maxp=proba.max(axis=1).tolist()
metrics={'accuracy':round(float(accuracy_score(y_test,pred)),4),'macro_f1':round(float(f1_score(y_test,pred,average='macro',zero_division=0)),4),'rows':len(rows),'groups':len(set(groups)),'labels':len(set(labels)),'group_leakage':0,'train_seconds':round(time.perf_counter()-started,3)}
model_dir=BASE/'models';model_dir.mkdir(exist_ok=True);temp=model_dir/'intent.joblib.tmp';joblib.dump(model,temp);temp.replace(model_dir/'intent.joblib')
threshold=fit_threshold(maxp,.05);save_calibration(str(model_dir/'calibration.json'),1.0,metrics);save_ood(str(model_dir/'ood.json'),threshold,metrics)
h=hashlib.sha256((model_dir/'intent.joblib').read_bytes()).hexdigest();manifest={'format':'nusamind-model-registry-v2','release':'R13.45','edition':json.loads((BASE/'ml-config.json').read_text())['edition'],'model':'intent.joblib','checksum':h,'metrics':metrics,'ood_threshold':threshold,'status':'active','trained_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};(model_dir/'models.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'ok':metrics['macro_f1']>=.8,'manifest':manifest},indent=2));raise SystemExit(0 if metrics['macro_f1']>=.8 else 1)
