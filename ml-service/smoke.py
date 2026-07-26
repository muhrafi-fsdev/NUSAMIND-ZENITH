from __future__ import annotations

import json
from nusamind_ml.engine import MLEngine


def main() -> None:
    engine = MLEngine()
    coding = engine.analyze("Tolong debug error TypeScript pada Next.js dan jalankan npm build")
    insurance = engine.analyze("Saya marah karena klaim asuransi belum selesai, ini sangat urgent")
    religion = engine.analyze("Jelaskan konteks tafsir ayat Al-Qur'an tentang kesabaran")
    similarity = engine.similarity("prosedur klaim mobil", "cara mengajukan klaim kendaraan")
    anomaly = engine.anomaly([[10.0, 11.0], [10.5, 10.8], [9.8, 11.2], [900.0, 850.0]])
    evaluation = engine.evaluate("Bagaimana prosedur klaim?", "Prosedur klaim dimulai dengan laporan, verifikasi polis, dan dokumen pendukung.", ["panduan polis"])
    assert coding["domain"] in {"coding", "ai_ml"}
    assert insurance["domain"] == "insurance"
    assert insurance["urgency"] in {"medium", "high"}
    assert religion["domain"] == "religion"
    assert similarity["score"] > 0
    assert len(anomaly["labels"]) == 4
    assert 0 <= evaluation["score"] <= 1
    print(json.dumps({"ok": True, "coding": coding, "insurance": insurance, "religion": religion, "similarity": similarity, "anomaly": anomaly, "evaluation": evaluation, "capabilities": engine.capabilities()}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
