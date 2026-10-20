import Link from 'next/link';
import { headers } from 'next/headers';
async function getStatus() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const incoming = await headers();
    const res = await fetch(`${base}/api/status`, { cache: 'no-store', headers: { authorization: incoming.get('authorization') || '' } });
    return res.json();
  } catch {
    return null;
  }
}

function LeafMark() {
  return (
    <svg className="leaf-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M23.8 39V22.8" />
      <path d="M23.8 24.5C15.5 24.5 9 18 9 9.7c8.3 0 14.8 6.5 14.8 14.8Z" />
      <path d="M24.2 29.4c8.3 0 14.8-6.5 14.8-14.8-8.3 0-14.8 6.5-14.8 14.8Z" />
    </svg>
  );
}

export default async function DashboardPage() {
  const status = await getStatus();
  const metrics = [
    ['Dataset', status?.datasets?.quranTrainingRecords ?? 0, 'Quran training records'],
    ['RAG', status?.datasets?.quranKnowledgeChunks ?? 0, 'Quran knowledge chunks'],
    ['Universal', status?.datasets?.universalKnowledgeItems ?? 0, 'Universal knowledge items'],
    ['Vector', status?.vectorIndex?.indexedDocs ?? 0, 'Indexed documents'],
    ['Knowledge', status?.datasets?.knowledgeExpansionV12 ?? 0, 'Knowledge cards'],
    ['Playbooks', status?.datasets?.domainPlaybooksV12 ?? 0, 'Domain playbooks'],
    ['Sessions', status?.monitoring?.totalSessions ?? 0, 'Saved sessions'],
    ['Logs', status?.monitoring?.totalInteractionLogs ?? 0, 'Interaction logs'],
    ['Feedback', status?.feedback?.totalFeedback ?? 0, 'User feedback'],
    ['Ollama', status?.ollama?.ok ? 'Aktif' : 'Tidak aktif', status?.ollama?.message || 'Menunggu status'],
  ];

  return (
    <main className="dashboard-shell edition-zenith">
      <div className="dashboard-inner">
        <div className="dashboard-topbar">
          <div className="dashboard-brand">
            <div className="brand-mark"><LeafMark /></div>
            <div><strong>NusaMind AI</strong><span>Edisi Zenith • N1.4.1</span></div>
          </div>
          <Link className="dashboard-back" href="/">← Kembali ke Chat</Link>
        </div>

        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">Dashboard Lokal</span>
            <h1>Status NusaMind Zenith</h1>
            <p>Performa tinggi untuk pekerjaan kompleks. Semua angka di halaman ini berasal dari endpoint status yang sudah ada.</p>
          </div>
          <div className="health-card">
            <span>Health</span>
            <strong>{status?.version || 'Menunggu data sistem...'}</strong>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head"><div><h2>Metrik Sistem</h2><p>Pantau dataset, retrieval, session, feedback, dan runtime lokal.</p></div></div>
          <div className="dashboard-metrics">
            {metrics.map(([label, value, description]) => (
              <article className="dashboard-metric" key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
