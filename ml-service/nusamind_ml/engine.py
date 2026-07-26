from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import statistics
import time
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

TOKEN_RE = re.compile(r"[a-zA-Z0-9_+#.-]+", re.UNICODE)

DOMAIN_TERMS: dict[str, tuple[str, ...]] = {
    "coding": ("code", "kode", "coding", "debug", "error", "typescript", "javascript", "python", "next.js", "react", "api", "database", "npm", "git", "docker", "program"),
    "ai_ml": ("machine learning", "ml", "artificial intelligence", "ai", "model", "training", "fine tuning", "lora", "embedding", "rag", "dataset", "classifier"),
    "insurance": ("asuransi", "polis", "klaim", "premi", "tertanggung", "underwriting", "reasuransi", "ibnr", "endorsement"),
    "finance": ("keuangan", "saham", "obligasi", "investasi", "inflasi", "suku bunga", "crypto", "bitcoin", "profit", "kerugian", "cash flow"),
    "religion": ("quran", "al-qur'an", "ayat", "surah", "tafsir", "hadis", "fiqih", "islam", "shalat", "zakat", "halal", "haram"),
    "health": ("kesehatan", "penyakit", "gejala", "obat", "diagnosis", "dokter", "medis", "terapi", "pengobatan"),
    "telecom": ("telekomunikasi", "fiber", "gpon", "ftth", "rf", "modulasi", "qpsk", "bandwidth", "sinyal", "antena"),
    "networking": ("jaringan", "router", "switch", "ip address", "dns", "wifi", "lan", "wan", "firewall", "tcp", "udp"),
    "data": ("data", "csv", "excel", "sql", "etl", "pipeline", "snowflake", "airflow", "database", "analytics"),
    "customer_service": ("pelanggan", "customer service", "komplain", "keluhan", "tiket", "eskalasi", "layanan", "cs"),
    "education": ("kuliah", "tugas", "quiz", "belajar", "materi", "dosen", "mahasiswa", "laporan", "skripsi"),
    "career": ("kerja", "karier", "cv", "lamaran", "interview", "magang", "pekerjaan", "helpdesk"),
    "legal": ("hukum", "undang-undang", "kontrak", "legal", "pasal", "peraturan", "pengadilan"),
    "companion": ("sedih", "capek", "cemas", "takut", "curhat", "kesal", "marah", "mood", "temani", "introvert"),
    "general": (),
}

NEGATIVE = {"buruk", "gagal", "marah", "kesal", "kecewa", "lambat", "error", "masalah", "rusak", "takut", "cemas", "sedih", "rugi", "parah", "susah"}
POSITIVE = {"bagus", "baik", "senang", "berhasil", "mantap", "puas", "cepat", "mudah", "terima kasih", "hebat", "suka"}
URGENT = {"segera", "darurat", "urgent", "sekarang", "cepat", "gawat", "kritis", "hari ini", "deadline", "tidak bisa akses"}
HIGH_RISK_DOMAINS = {"health", "legal", "finance", "insurance"}

PII_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "phone": re.compile(r"(?<!\d)(?:\+62|62|0)8\d{8,12}(?!\d)"),
    "nik_like": re.compile(r"(?<!\d)\d{16}(?!\d)"),
    "card_like": re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"),
    "ip": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _tokens(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text)]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return _clamp(dot / (na * nb), -1.0, 1.0)


class MLEngine:
    def __init__(self, config_path: str | Path | None = None) -> None:
        base = Path(__file__).resolve().parents[1]
        self.base_dir = base
        path = Path(config_path) if config_path else base / "ml-config.json"
        self.config = json.loads(path.read_text(encoding="utf-8"))
        self.edition = str(self.config.get("edition", "swift"))
        self.hash_dim = int(self.config.get("hash_dim", 256))
        self.max_text = int(self.config.get("max_text", 20000))
        self.max_batch = int(self.config.get("max_batch", 32))
        self.model_dir = base / "models"
        self.dataset_dir = base / "datasets"
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self._intent_model: Any = None
        self._semantic_model: Any = None
        self._model_loaded = False
        self._semantic_attempted = False
        self._load_intent_model()

    def capabilities(self) -> dict[str, Any]:
        optional: dict[str, bool] = {}
        for module in ("numpy", "sklearn", "joblib", "sentence_transformers", "transformers", "torch", "pandas"):
            try:
                __import__(module)
                optional[module] = True
            except Exception:
                optional[module] = False
        return {
            "edition": self.edition,
            "core": True,
            "intent_model_loaded": self._model_loaded,
            "semantic_model_loaded": self._semantic_model is not None,
            "hash_embeddings": True,
            "training": optional.get("sklearn", False) and optional.get("joblib", False),
            "transformer_embeddings": optional.get("sentence_transformers", False),
            "gpu_visible": self._gpu_visible(optional),
            "optional": optional,
        }

    @staticmethod
    def _gpu_visible(optional: dict[str, bool]) -> bool:
        if not optional.get("torch"):
            return False
        try:
            import torch
            return bool(torch.cuda.is_available())
        except Exception:
            return False

    def _load_intent_model(self) -> None:
        path = self.model_dir / "intent.joblib"
        if not path.exists():
            return
        try:
            import joblib
            self._intent_model = joblib.load(path)
            self._model_loaded = True
        except Exception:
            self._intent_model = None
            self._model_loaded = False

    def reload(self) -> dict[str, Any]:
        self._intent_model = None
        self._model_loaded = False
        self._semantic_model = None
        self._semantic_attempted = False
        self._load_intent_model()
        return self.capabilities()

    def _rule_domain(self, text: str) -> tuple[str, float, dict[str, float]]:
        normalized = " ".join(text.lower().split())
        scores: dict[str, float] = {}
        for domain, terms in DOMAIN_TERMS.items():
            if domain == "general":
                continue
            score = 0.0
            for term in terms:
                if term in normalized:
                    score += 2.0 if " " in term else 1.0
            scores[domain] = score
        best = max(scores, key=scores.get) if scores else "general"
        best_score = scores.get(best, 0.0)
        if best_score <= 0:
            return "general", 0.56, scores
        total = sum(scores.values()) or 1.0
        confidence = _clamp(0.58 + (best_score / total) * 0.34 + min(best_score, 5.0) * 0.015, 0.58, 0.94)
        return best, confidence, scores

    def _model_domain(self, text: str) -> tuple[str | None, float]:
        if self._intent_model is None:
            return None, 0.0
        try:
            if hasattr(self._intent_model, "predict_proba"):
                probabilities = self._intent_model.predict_proba([text])[0]
                classes = list(self._intent_model.classes_)
                index = max(range(len(probabilities)), key=lambda i: float(probabilities[i]))
                return str(classes[index]), float(probabilities[index])
            prediction = self._intent_model.predict([text])[0]
            return str(prediction), 0.75
        except Exception:
            return None, 0.0

    def _sentiment(self, text: str) -> tuple[str, float, str]:
        normalized = text.lower()
        tokens = set(_tokens(text))
        pos = sum(1 for word in POSITIVE if word in normalized or word in tokens)
        neg = sum(1 for word in NEGATIVE if word in normalized or word in tokens)
        if neg > pos:
            label = "negative"
            score = _clamp(0.58 + 0.08 * (neg - pos), 0.58, 0.96)
            emotion = "frustrated" if any(word in normalized for word in ("marah", "kesal", "kecewa", "lambat")) else "concerned"
        elif pos > neg:
            label = "positive"
            score = _clamp(0.58 + 0.08 * (pos - neg), 0.58, 0.96)
            emotion = "satisfied"
        else:
            label = "neutral"
            score = 0.68
            emotion = "neutral"
        return label, score, emotion

    def _urgency(self, text: str) -> tuple[str, float]:
        normalized = text.lower()
        hits = sum(1 for word in URGENT if word in normalized)
        exclamations = min(text.count("!"), 3)
        score = _clamp(0.18 + hits * 0.23 + exclamations * 0.08)
        return ("high" if score >= 0.68 else "medium" if score >= 0.38 else "low"), score

    def _language(self, text: str) -> str:
        low = f" {text.lower()} "
        id_markers = (" yang ", " dan ", " untuk ", " saya ", " kamu ", " dengan ", " tidak ", " bisa ", " dari ")
        en_markers = (" the ", " and ", " for ", " with ", " this ", " that ", " can ", " from ")
        id_score = sum(low.count(marker) for marker in id_markers)
        en_score = sum(low.count(marker) for marker in en_markers)
        return "id" if id_score >= en_score else "en"

    def _pii(self, text: str) -> list[str]:
        return [name for name, pattern in PII_PATTERNS.items() if pattern.search(text)]

    def _complexity(self, text: str) -> dict[str, Any]:
        tokens = _tokens(text)
        sentences = max(1, len(re.findall(r"[.!?]+", text)))
        unique_ratio = len(set(tokens)) / max(1, len(tokens))
        score = _clamp((len(tokens) / 180.0) + (sentences / 24.0) + (unique_ratio * 0.24))
        return {
            "label": "high" if score >= 0.7 else "medium" if score >= 0.38 else "low",
            "score": round(score, 4),
            "tokens": len(tokens),
            "sentences": sentences,
        }

    def analyze(self, text: str) -> dict[str, Any]:
        started = time.perf_counter()
        text = str(text or "").strip()[: self.max_text]
        if not text:
            raise ValueError("text is required")
        rule_domain, rule_conf, rule_scores = self._rule_domain(text)
        model_domain, model_conf = self._model_domain(text)
        if model_domain and model_conf >= 0.52:
            if model_domain == rule_domain:
                domain = model_domain
                confidence = _clamp(model_conf * 0.7 + rule_conf * 0.3 + 0.04)
                source = "ensemble"
            elif model_conf >= 0.78:
                domain = model_domain
                confidence = _clamp(model_conf * 0.75 + rule_conf * 0.25)
                source = "trained_model"
            else:
                domain = rule_domain
                confidence = _clamp(rule_conf * 0.65 + model_conf * 0.35)
                source = "rules_with_model"
        else:
            domain, confidence, source = rule_domain, rule_conf, "rules"

        sentiment, sentiment_score, emotion = self._sentiment(text)
        urgency, urgency_score = self._urgency(text)
        pii = self._pii(text)
        risk = "high" if domain in HIGH_RISK_DOMAINS and (urgency != "low" or pii) else "medium" if domain in HIGH_RISK_DOMAINS or pii else "low"
        intent = {
            "coding": "technical_help", "ai_ml": "ai_workflow", "insurance": "insurance_support",
            "finance": "financial_analysis", "religion": "religious_question", "health": "health_information",
            "telecom": "telecom_analysis", "networking": "network_troubleshooting", "data": "data_analysis",
            "customer_service": "customer_support", "education": "learning_support", "career": "career_guidance",
            "legal": "legal_information", "companion": "companion_support", "general": "general_question",
        }.get(domain, "general_question")
        return {
            "domain": domain,
            "intent": intent,
            "confidence": round(confidence, 4),
            "sentiment": sentiment,
            "sentiment_score": round(sentiment_score, 4),
            "emotion": emotion,
            "urgency": urgency,
            "urgency_score": round(urgency_score, 4),
            "risk": risk,
            "language": self._language(text),
            "pii_types": pii,
            "complexity": self._complexity(text),
            "backend": source,
            "rule_scores": {key: round(value, 3) for key, value in sorted(rule_scores.items(), key=lambda item: item[1], reverse=True)[:6]},
            "latency_ms": round((time.perf_counter() - started) * 1000, 3),
        }

    def _hash_embed(self, text: str) -> list[float]:
        vector = [0.0] * self.hash_dim
        words = _tokens(text)
        features: list[str] = list(words)
        compact = " ".join(words)
        features.extend(compact[i:i + 3] for i in range(max(0, len(compact) - 2)))
        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            raw = int.from_bytes(digest, "big")
            index = raw % self.hash_dim
            sign = 1.0 if raw & 1 else -1.0
            vector[index] += sign
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [round(value / norm, 8) for value in vector]

    def _load_semantic_model(self) -> Any:
        if self._semantic_attempted:
            return self._semantic_model
        self._semantic_attempted = True
        enabled = str(os.getenv("ML_USE_TRANSFORMERS", self.config.get("use_transformers", False))).lower() in {"1", "true", "yes"}
        if not enabled:
            return None
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.getenv("ML_EMBED_MODEL", str(self.config.get("embed_model")))
            self._semantic_model = SentenceTransformer(model_name)
        except Exception:
            self._semantic_model = None
        return self._semantic_model

    def embed(self, texts: Iterable[str]) -> dict[str, Any]:
        items = [str(item)[: self.max_text] for item in texts]
        if not items or len(items) > self.max_batch:
            raise ValueError(f"texts must contain 1..{self.max_batch} items")
        model = self._load_semantic_model()
        if model is not None:
            vectors = model.encode(items, normalize_embeddings=True).tolist()
            return {"backend": "sentence_transformers", "model": str(self.config.get("embed_model")), "vectors": vectors, "dimension": len(vectors[0]) if vectors else 0}
        vectors = [self._hash_embed(item) for item in items]
        return {"backend": "hashing", "model": "blake2b-feature-hash", "vectors": vectors, "dimension": self.hash_dim}

    def similarity(self, left: str, right: str) -> dict[str, Any]:
        embedded = self.embed([left, right])
        score = _cosine(embedded["vectors"][0], embedded["vectors"][1])
        return {"score": round(score, 6), "backend": embedded["backend"], "dimension": embedded["dimension"]}

    def anomaly(self, rows: list[list[float]], contamination: float = 0.05) -> dict[str, Any]:
        if len(rows) < 3:
            raise ValueError("at least three rows are required")
        width = len(rows[0])
        if width == 0 or any(len(row) != width for row in rows):
            raise ValueError("rows must have equal non-zero width")
        try:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=_clamp(contamination, 0.001, 0.49), random_state=43)
            labels = model.fit_predict(rows).tolist()
            scores = (-model.score_samples(rows)).tolist()
            return {"backend": "isolation_forest", "labels": labels, "scores": [round(float(x), 6) for x in scores], "anomalies": [i for i, label in enumerate(labels) if label == -1]}
        except Exception:
            columns = list(zip(*rows))
            means = [statistics.fmean(column) for column in columns]
            deviations = [statistics.pstdev(column) or 1.0 for column in columns]
            scores = []
            for row in rows:
                scores.append(max(abs((value - mean) / deviation) for value, mean, deviation in zip(row, means, deviations)))
            labels = [-1 if score >= 3.0 else 1 for score in scores]
            return {"backend": "zscore_fallback", "labels": labels, "scores": [round(score, 6) for score in scores], "anomalies": [i for i, label in enumerate(labels) if label == -1]}

    def evaluate(self, question: str, answer: str, evidence: list[str] | None = None) -> dict[str, Any]:
        evidence = evidence or []
        similarity = self.similarity(question, answer)["score"]
        answer_tokens = _tokens(answer)
        question_tokens = set(_tokens(question))
        overlap = len(question_tokens.intersection(answer_tokens)) / max(1, len(question_tokens))
        length_score = _clamp(len(answer_tokens) / 120.0)
        evidence_score = _clamp((len(evidence) / 3.0) + (0.2 if any(marker in answer.lower() for marker in ("sumber", "berdasarkan", "evidence", "referensi")) else 0.0))
        structure_score = _clamp(0.35 + 0.12 * min(answer.count("\n"), 4) + (0.15 if any(char.isdigit() for char in answer) else 0.0))
        unsafe_markers = sum(answer.lower().count(marker) for marker in ("pasti sembuh", "dijamin untung", "100% diterima", "abaikan dokter", "bypass keamanan"))
        safety_score = _clamp(1.0 - unsafe_markers * 0.35)
        total = _clamp(0.31 * max(similarity, 0.0) + 0.24 * overlap + 0.15 * length_score + 0.12 * evidence_score + 0.08 * structure_score + 0.10 * safety_score)
        return {
            "score": round(total, 4),
            "relevance": round(max(similarity, 0.0), 4),
            "keyword_coverage": round(overlap, 4),
            "completeness": round(length_score, 4),
            "evidence": round(evidence_score, 4),
            "structure": round(structure_score, 4),
            "safety": round(safety_score, 4),
            "needs_revision": total < float(self.config.get("quality_threshold", 0.58)),
            "backend": "deterministic_ml_evaluator",
        }

    def train_intent(self, dataset_name: str = "intent-seed.csv") -> dict[str, Any]:
        safe_name = Path(dataset_name).name
        dataset = (self.dataset_dir / safe_name).resolve()
        if self.dataset_dir.resolve() not in dataset.parents or not dataset.exists():
            raise ValueError("dataset not found inside ml-service/datasets")
        texts: list[str] = []
        labels: list[str] = []
        with dataset.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                text = str(row.get("text", "")).strip()
                label = str(row.get("label", "")).strip()
                if text and label:
                    texts.append(text)
                    labels.append(label)
        if len(texts) < 20 or len(set(labels)) < 2:
            raise ValueError("dataset requires at least 20 rows and two labels")
        try:
            import joblib
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            from sklearn.metrics import accuracy_score, f1_score
            from sklearn.model_selection import train_test_split
            from sklearn.pipeline import FeatureUnion, Pipeline
        except Exception as exc:
            raise RuntimeError("install requirements.txt before training") from exc

        counts = Counter(labels)
        can_split = min(counts.values()) >= 2 and len(texts) >= 40
        if can_split:
            x_train, x_test, y_train, y_test = train_test_split(texts, labels, test_size=0.22, random_state=43, stratify=labels)
        else:
            x_train, y_train, x_test, y_test = texts, labels, texts, labels
        features = FeatureUnion([
            ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True, max_features=18000)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True, max_features=18000)),
        ])
        pipeline = Pipeline([
            ("features", features),
            ("classifier", LogisticRegression(max_iter=1200, class_weight="balanced", C=3.0, random_state=43)),
        ])
        started = time.perf_counter()
        pipeline.fit(x_train, y_train)
        predictions = pipeline.predict(x_test)
        metrics = {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "macro_f1": round(float(f1_score(y_test, predictions, average="macro", zero_division=0)), 4),
            "rows": len(texts),
            "labels": sorted(set(labels)),
            "train_seconds": round(time.perf_counter() - started, 3),
            "validation_mode": "holdout" if can_split else "training_set",
        }
        temp = self.model_dir / "intent.joblib.tmp"
        final = self.model_dir / "intent.joblib"
        joblib.dump(pipeline, temp)
        temp.replace(final)
        manifest = {
            "model": "intent.joblib",
            "dataset": safe_name,
            "edition": self.edition,
            "metrics": metrics,
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        (self.model_dir / "models.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self._load_intent_model()
        return manifest
