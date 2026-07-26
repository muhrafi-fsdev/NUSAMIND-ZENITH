'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'auto' | 'quran' | 'universal' | 'coding' | 'companion' | 'workflow';
type IntelligenceLevel = 'instant' | 'ordinary' | 'medium' | 'high' | 'thinking';
type Edition = 'swift' | 'zenith' | 'apex';
type Panel = 'chat' | 'history' | 'pinned' | 'upload' | 'settings' | 'status';
type SavedSessionSummary = { sessionId: string; title: string; pinned: boolean; updatedAt: string; messages: Message[]; mode: Mode; intelligenceLevel: IntelligenceLevel };
type Message = { role: 'user' | 'assistant'; content: string; meta?: string };
type FileAnalysisResponse = { ok: boolean; analysis?: { fileName: string; extension: string; kind: string; parser: string; summary: string; warnings: string[]; preview: string; recommendedMode?: Mode }; promptContext?: string; error?: string };

type Status = {
  version?: string;
  provider?: string;
  ollama?: { ok: boolean; message: string; models?: string[] };
  datasets?: { quranTrainingRecords?: number; quranKnowledgeChunks?: number; universalKnowledgeItems?: number; workflowStages?: number; knowledgeExpansionV12?: number; domainPlaybooksV12?: number };
  monitoring?: { totalSessions?: number; totalMemoryFiles?: number; totalInteractionLogs?: number };
  feedback?: { totalFeedback?: number; averageRating?: number | null };
  vectorIndex?: { indexedDocs?: number };
};

type WorkflowStep = {
  id: string;
  title: string;
  objective: string;
  checklist: string[];
  outputs: string[];
  metrics: string[];
  tools: string[];
};

type ChatShellProps = {
  edition: Edition;
  editionLabel: string;
  version: string;
  tagline: string;
};

const promptCards = [
  { icon: 'chat', label: 'Tanya Umum', text: 'Bantu saya merangkum artikel ini dalam 3 poin utama yang mudah dipahami.', tone: 'primary' },
  { icon: 'code', label: 'Coding', text: 'Buatkan contoh API login Next.js yang aman dan jelaskan struktur filenya.', tone: 'warning' },
  { icon: 'file', label: 'Analisis Dokumen', text: 'Ekstrak entitas penting dan ringkas isi dokumen yang saya unggah.', tone: 'secondary' },
  { icon: 'shield', label: 'Asuransi', text: 'Bandingkan polis A dan polis B berdasarkan cakupan rawat inap.', tone: 'danger' },
];

const modes: Array<{ value: Mode; label: string; description: string }> = [
  { value: 'auto', label: 'Auto Router', description: 'Memilih mode paling sesuai secara otomatis.' },
  { value: 'quran', label: 'Agama & Al-Qur’an', description: 'Ayat, tafsir, konteks, dan sumber keagamaan.' },
  { value: 'universal', label: 'Universal', description: 'Pengetahuan umum, akademik, dan riset.' },
  { value: 'coding', label: 'Coding & Debug', description: 'Pemrograman, arsitektur, dan pemecahan error.' },
  { value: 'companion', label: 'Companion', description: 'Percakapan santai dan pendampingan.' },
  { value: 'workflow', label: 'Workflow', description: 'Perencanaan dan tahapan pekerjaan terstruktur.' },
];

const levels: Array<{ value: IntelligenceLevel; label: string; description: string }> = [
  { value: 'instant', label: 'Instant', description: 'Paling cepat dan langsung.' },
  { value: 'ordinary', label: 'Ordinary', description: 'Ringan untuk kebutuhan sehari-hari.' },
  { value: 'medium', label: 'Medium', description: 'Seimbang antara kecepatan dan kedalaman.' },
  { value: 'high', label: 'High', description: 'Analisis lebih detail.' },
  { value: 'thinking', label: 'Thinking', description: 'Penalaran paling mendalam.' },
];

function readSavedSessions(): SavedSessionSummary[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('nusamind_saved_sessions_v13_9') || '[]'); }
  catch { return []; }
}

function writeSavedSessions(sessions: SavedSessionSummary[]) {
  if (typeof window === 'undefined') return;
  const sorted = [...sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 40);
  localStorage.setItem('nusamind_saved_sessions_v13_9', JSON.stringify(sorted));
}

function getStoredSessionId() {
  if (typeof window === 'undefined') return '';
  const current = localStorage.getItem('quran_next_ai_session');
  if (current) return current;
  const created = `session_${crypto.randomUUID()}`;
  localStorage.setItem('quran_next_ai_session', created);
  return created;
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'collapse': return <svg {...common}><path d="m15 6-6 6 6 6" /></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'history': return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>;
    case 'pin': return <svg {...common}><path d="m9 3 6 6M8 8l8-2-2 8 4 4-6 1-4 4 1-7-5-5 4-3Z" /></svg>;
    case 'upload': return <svg {...common}><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 15v4h14v-4" /></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H10v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V10h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3H14v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.37.37.7.6 1 .3.3.7.4 1.1.4H21V14h-.09a1.7 1.7 0 0 0-1.51 1Z" /></svg>;
    case 'status': return <svg {...common}><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></svg>;
    case 'chat': return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
    case 'code': return <svg {...common}><path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-9-2 12" /></svg>;
    case 'file': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>;
    case 'shield': return <svg {...common}><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" /><path d="M9 12h6M12 9v6" /></svg>;
    case 'paperclip': return <svg {...common}><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9" /></svg>;
    case 'send': return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'dashboard': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
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

export function ChatShell({ edition, editionLabel, version, tagline }: ChatShellProps) {
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [intelligenceLevel, setIntelligenceLevel] = useState<IntelligenceLevel>('medium');
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);
  const [pinnedCurrent, setPinnedCurrent] = useState(false);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileNotice, setFileNotice] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Halo, aku NusaMind ${editionLabel} ${version}. Ada yang bisa aku bantu?`, meta: 'ready' },
  ]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sid = getStoredSessionId();
    setSessionId(sid);
    const sessions = readSavedSessions();
    setSavedSessions(sessions);
    const restored = sessions.find((s) => s.sessionId === sid);
    if (restored?.messages?.length) {
      setMessages(restored.messages);
      setMode(restored.mode || 'auto');
      setIntelligenceLevel(restored.intelligenceLevel || 'medium');
      setPinnedCurrent(Boolean(restored.pinned));
      setFileNotice('Session terakhir berhasil dipulihkan setelah refresh.');
    }
    fetch('/api/status').then((res) => res.json()).then(setStatus).catch(() => setStatus(null));
    fetch('/api/workflow').then((res) => res.json()).then((json) => setWorkflow(json.steps || [])).catch(() => setWorkflow([]));
  }, []);

  useEffect(() => {
    if (activePanel === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activePanel]);

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const sessions = readSavedSessions();
    const firstUser = messages.find((m) => m.role === 'user')?.content || `Session NusaMind ${editionLabel}`;
    const item: SavedSessionSummary = { sessionId, title: firstUser.slice(0, 56), pinned: pinnedCurrent, updatedAt: new Date().toISOString(), messages, mode, intelligenceLevel };
    const next = [item, ...sessions.filter((s) => s.sessionId !== sessionId)];
    writeSavedSessions(next);
    setSavedSessions([...next].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 40));
  }, [messages, mode, intelligenceLevel, sessionId, pinnedCurrent, editionLabel]);

  const hasConversation = messages.some((item) => item.role === 'user');
  const activeMode = modes.find((item) => item.value === mode)?.label || 'Auto Router';
  const pinnedSessions = savedSessions.filter((item) => item.pinned);

  const statusText = useMemo(() => {
    if (!status) return 'Menunggu data sistem...';
    const ollama = status.ollama?.ok ? 'Ollama aktif' : 'Ollama tidak aktif';
    return `${status.version || version} • ${ollama}`;
  }, [status, version]);

  function choosePanel(panel: Panel) {
    setActivePanel(panel);
    setMobileSidebarOpen(false);
  }

  function preparePrompt(prompt: string) {
    setInput(prompt);
    setActivePanel('chat');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function analyzeSelectedFile(question: string) {
    if (!selectedFile) return { message: question, meta: mode };
    setUploadingFile(true);
    setFileNotice(`Menganalisis file ${selectedFile.name}...`);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('question', question || 'Jelaskan dan analisis file ini.');
      const json: FileAnalysisResponse = await fetch('/api/upload/analyze', { method: 'POST', body: form }).then((res) => res.json());
      if (!json.ok || !json.promptContext || !json.analysis) throw new Error(json.error || 'File gagal dianalisis.');
      const warn = json.analysis.warnings?.length ? ` Peringatan: ${json.analysis.warnings.join(' ')}` : '';
      setFileNotice(`${json.analysis.fileName} • ${json.analysis.kind} • ${json.analysis.parser}.${warn}`);
      return { message: json.promptContext, meta: `file:${json.analysis.extension || json.analysis.kind}` };
    } catch (error) {
      const text = error instanceof Error ? error.message : 'File gagal dianalisis.';
      setFileNotice(text);
      return { message: `${question}\n\n[Catatan file upload: ${text}]`, meta: 'file-error' };
    } finally {
      setUploadingFile(false);
    }
  }

  async function sendMessage(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const rawMessage = (override || input).trim();
    if ((!rawMessage && !selectedFile) || loading || uploadingFile) return;
    const displayMessage = rawMessage || `Analisis file: ${selectedFile?.name}`;
    const analyzed = await analyzeSelectedFile(displayMessage);
    const message = analyzed.message.trim();

    setInput('');
    setSelectedFile(null);
    setLoading(true);
    setActivePanel('chat');
    setMessages((prev: Message[]) => [...prev, { role: 'user', content: displayMessage, meta: analyzed.meta }, { role: 'assistant', content: '', meta: 'streaming' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, mode, intelligenceLevel }),
      });

      const returnedSession = res.headers.get('x-quran-ai-session-id');
      const returnedMode = res.headers.get('x-quran-ai-mode');
      if (returnedSession) {
        setSessionId(returnedSession);
        localStorage.setItem('quran_next_ai_session', returnedSession);
      }

      if (!res.ok || !res.body) {
        const json = await fetch('/api/chat-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId, mode, intelligenceLevel }),
        }).then((r) => r.json());
        setMessages((prev: Message[]) => prev.map((item: Message, idx: number) => idx === prev.length - 1 ? { role: 'assistant', content: json.answer || 'AI gagal menjawab.', meta: json.mode } : item));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((prev: Message[]) => prev.map((item: Message, idx: number) => idx === prev.length - 1 ? { role: 'assistant', content: answer, meta: returnedMode || mode } : item));
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Terjadi error tidak dikenal.';
      setMessages((prev: Message[]) => prev.map((item: Message, idx: number) => idx === prev.length - 1 ? { role: 'assistant', content: `AI error: ${text}\n\nCek apakah Ollama sudah menyala, dependency sudah terpasang, dan model sudah di-pull.`, meta: 'error' } : item));
    } finally {
      setLoading(false);
      fetch('/api/status').then((res) => res.json()).then(setStatus).catch(() => undefined);
    }
  }

  function resetSession() {
    const created = `session_${crypto.randomUUID()}`;
    localStorage.setItem('quran_next_ai_session', created);
    setSessionId(created);
    setPinnedCurrent(false);
    setMessages([{ role: 'assistant', content: `Session baru dibuat. Aku NusaMind ${editionLabel} dan siap membantu.`, meta: 'reset' }]);
    setInput('');
    setSelectedFile(null);
    setFileNotice('');
    setActivePanel('chat');
    setMobileSidebarOpen(false);
  }

  function togglePinCurrent() {
    const next = !pinnedCurrent;
    setPinnedCurrent(next);
    fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, pinned: next, defaultIntelligenceLevel: intelligenceLevel }) }).catch(() => undefined);
  }

  function restoreLocalSession(item: SavedSessionSummary) {
    localStorage.setItem('quran_next_ai_session', item.sessionId);
    setSessionId(item.sessionId);
    setMessages(item.messages?.length ? item.messages : [{ role: 'assistant', content: `Session ${item.title} dipulihkan.`, meta: 'restore' }]);
    setMode(item.mode || 'auto');
    setIntelligenceLevel(item.intelligenceLevel || 'medium');
    setPinnedCurrent(Boolean(item.pinned));
    setActivePanel('chat');
    setMobileSidebarOpen(false);
  }

  function onTextareaInput(event: React.FormEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 190)}px`;
  }

  const navItems: Array<{ id: Panel; label: string; icon: string }> = [
    { id: 'chat', label: 'Chat Baru', icon: 'plus' },
    { id: 'history', label: 'Riwayat', icon: 'history' },
    { id: 'pinned', label: 'Sesi Dipin', icon: 'pin' },
    { id: 'upload', label: 'Unggah File', icon: 'upload' },
  ];

  const secondaryNav: Array<{ id: Panel; label: string; icon: string }> = [
    { id: 'settings', label: 'Pengaturan', icon: 'settings' },
    { id: 'status', label: 'Status', icon: 'status' },
  ];

  function SessionList({ items, emptyText }: { items: SavedSessionSummary[]; emptyText: string }) {
    if (!items.length) return <div className="empty-list"><Icon name="history" size={24} /><p>{emptyText}</p></div>;
    return (
      <div className="session-grid">
        {items.map((item) => (
          <button className="session-card" key={item.sessionId} onClick={() => restoreLocalSession(item)} disabled={loading}>
            <span className="session-card-icon"><Icon name={item.pinned ? 'pin' : 'chat'} /></span>
            <span className="session-card-copy">
              <strong>{item.title || 'Session NusaMind'}</strong>
              <small>{new Date(item.updatedAt).toLocaleString('id-ID')}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`nm-app edition-${edition} ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {mobileSidebarOpen && <button className="sidebar-overlay" aria-label="Tutup navigasi" onClick={() => setMobileSidebarOpen(false)} />}

      <aside className={`nm-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><LeafMark /></div>
          <div className="brand-copy">
            <strong>NusaMind AI</strong>
            <span>Edisi {editionLabel} • {version}</span>
          </div>
          <button className="icon-button collapse-button" aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}>
            <Icon name="collapse" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activePanel === item.id ? 'active' : ''}`} onClick={() => item.id === 'chat' ? resetSession() : choosePanel(item.id)} title={sidebarCollapsed ? item.label : undefined}>
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="sidebar-sessions">
            <div className="sidebar-section-title"><span>Terbaru</span><span>{savedSessions.length}</span></div>
            <div className="sidebar-session-list">
              {savedSessions.slice(0, 5).map((item) => (
                <button key={item.sessionId} onClick={() => restoreLocalSession(item)} title={item.title}>
                  {item.pinned && <Icon name="pin" size={13} />}
                  <span>{item.title || 'Session NusaMind'}</span>
                </button>
              ))}
              {!savedSessions.length && <small>Belum ada riwayat.</small>}
            </div>
          </div>
        )}

        <div className="sidebar-bottom">
          {secondaryNav.map((item) => (
            <button key={item.id} className={`nav-item ${activePanel === item.id ? 'active' : ''}`} onClick={() => choosePanel(item.id)} title={sidebarCollapsed ? item.label : undefined}>
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
          {!sidebarCollapsed && (
            <div className={`system-mini-status ${status?.ollama?.ok ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              <span>{statusText}</span>
            </div>
          )}
        </div>
      </aside>

      <main className="nm-main">
        <header className="nm-header">
          <div className="header-left">
            <button className="icon-button mobile-menu" aria-label="Buka navigasi" onClick={() => setMobileSidebarOpen(true)}><Icon name="menu" /></button>
            <div>
              <strong>{activePanel === 'chat' ? (hasConversation ? 'Percakapan' : `NusaMind ${editionLabel}`) : ({ history: 'Riwayat Percakapan', pinned: 'Sesi Dipin', upload: 'Unggah dan Analisis File', settings: 'Pengaturan', status: 'Status Sistem' } as Record<string, string>)[activePanel]}</strong>
              <span>{activeMode} • {levels.find((item) => item.value === intelligenceLevel)?.label}</span>
            </div>
          </div>
          <div className="header-actions">
            <span className={`connection-badge ${status?.ollama?.ok ? 'connected' : 'disconnected'}`}><span className="status-dot" />{status?.ollama?.ok ? 'Local aktif' : 'Menunggu AI'}</span>
            <button className={`icon-button ${pinnedCurrent ? 'is-active' : ''}`} aria-label={pinnedCurrent ? 'Lepas pin session' : 'Pin session'} onClick={togglePinCurrent}><Icon name="pin" /></button>
          </div>
        </header>

        <div className="nm-content">
          {activePanel === 'chat' && (
            <section className={`chat-view ${hasConversation ? 'has-conversation' : 'is-empty'}`}>
              {!hasConversation ? (
                <div className="welcome-state">
                  <div className="welcome-mark"><LeafMark /></div>
                  <h1>Selamat datang di NusaMind <span>{editionLabel}</span></h1>
                  <p>{tagline}</p>
                  <div className="prompt-grid">
                    {promptCards.map((card) => (
                      <button key={card.label} className={`prompt-card tone-${card.tone}`} onClick={() => preparePrompt(card.text)}>
                        <span className="prompt-card-title"><Icon name={card.icon} />{card.label}</span>
                        <span className="prompt-card-text">“{card.text}”</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="message-list" aria-live="polite">
                  {messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={`message-row ${message.role}`}>
                      <div className="message-avatar">{message.role === 'assistant' ? <LeafMark /> : 'R'}</div>
                      <div className="message-body">
                        <div className="message-meta"><strong>{message.role === 'user' ? 'Kamu' : `NusaMind ${editionLabel}`}</strong>{message.meta && <span>{message.meta}</span>}</div>
                        <div className={`message-content ${message.meta === 'error' ? 'is-error' : ''}`}>{message.content || (message.role === 'assistant' && loading ? <span className="typing-indicator"><i /><i /><i /></span> : '')}</div>
                      </div>
                    </article>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </section>
          )}

          {activePanel === 'history' && <section className="panel-view"><div className="panel-heading"><div><span className="eyebrow">Session Lokal</span><h1>Riwayat Percakapan</h1><p>Pilih session untuk melanjutkan percakapan sebelumnya.</p></div><button className="primary-button" onClick={resetSession}><Icon name="plus" />Chat Baru</button></div><SessionList items={savedSessions} emptyText="Belum ada riwayat percakapan." /></section>}

          {activePanel === 'pinned' && <section className="panel-view"><div className="panel-heading"><div><span className="eyebrow">Favorit</span><h1>Sesi Dipin</h1><p>Session penting yang kamu tandai akan muncul di sini.</p></div></div><SessionList items={pinnedSessions} emptyText="Belum ada session yang dipin." /></section>}

          {activePanel === 'upload' && (
            <section className="panel-view narrow-panel">
              <div className="panel-heading"><div><span className="eyebrow">Analisis File</span><h1>Unggah dokumen atau gambar</h1><p>File akan diproses oleh fungsi upload NusaMind yang sudah tersedia.</p></div></div>
              <button className="upload-dropzone" onClick={() => fileRef.current?.click()}>
                <span className="upload-icon"><Icon name="upload" size={30} /></span>
                <strong>{selectedFile ? selectedFile.name : 'Pilih file untuk dianalisis'}</strong>
                <span>PDF, Word, Excel, CSV, TXT, gambar, kode, JSON, dan format lain yang didukung.</span>
              </button>
              {fileNotice && <div className="notice-card">{fileNotice}</div>}
              {selectedFile && <button className="primary-button wide-button" onClick={() => { setActivePanel('chat'); requestAnimationFrame(() => inputRef.current?.focus()); }}>Lanjutkan ke Chat <Icon name="send" /></button>}
            </section>
          )}

          {activePanel === 'settings' && (
            <section className="panel-view settings-view">
              <div className="panel-heading"><div><span className="eyebrow">Personalisasi</span><h1>Pengaturan Chat</h1><p>Pengaturan ini memakai state dan fungsi lama tanpa mengubah engine AI.</p></div></div>
              <div className="settings-grid">
                <article className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Icon name="chat" /></span><div><h2>Mode AI</h2><p>Pilih konteks kerja utama.</p></div></div><select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>{modes.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></article>
                <article className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Icon name="status" /></span><div><h2>Level Kecerdasan</h2><p>Atur kedalaman jawaban.</p></div></div><select value={intelligenceLevel} onChange={(event) => setIntelligenceLevel(event.target.value as IntelligenceLevel)}>{levels.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></article>
                <article className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Icon name="pin" /></span><div><h2>Session Saat Ini</h2><p>{sessionId || 'Memuat session...'}</p></div></div><button className="secondary-button" onClick={togglePinCurrent}>{pinnedCurrent ? 'Lepas Pin Session' : 'Pin Session Ini'}</button></article>
                <article className="settings-card"><div className="settings-card-head"><span className="settings-icon"><Icon name="dashboard" /></span><div><h2>Dashboard</h2><p>Lihat metrik yang berasal dari endpoint status.</p></div></div><a className="secondary-button" href="/dashboard">Buka Dashboard</a></article>
              </div>
              {!!workflow.length && <div className="workflow-section"><div className="section-title"><h2>Alur Sistem</h2><span>{workflow.length} tahap</span></div><div className="workflow-list">{workflow.map((step) => <article key={step.id}><span>{step.id.replace('step_', '')}</span><div><strong>{step.title}</strong><p>{step.objective}</p></div></article>)}</div></div>}
            </section>
          )}

          {activePanel === 'status' && (
            <section className="panel-view status-view">
              <div className="panel-heading"><div><span className="eyebrow">Runtime Lokal</span><h1>Status Sistem</h1><p>Semua nilai berikut berasal dari endpoint status NusaMind.</p></div><button className="secondary-button" onClick={() => fetch('/api/status').then((res) => res.json()).then(setStatus).catch(() => setStatus(null))}>Muat Ulang</button></div>
              <div className="metrics-grid">
                <article><span>Ollama</span><strong>{status?.ollama?.ok ? 'Aktif' : 'Tidak aktif'}</strong><small>{status?.ollama?.message || 'Menunggu data sistem...'}</small></article>
                <article><span>Versi</span><strong>{status?.version || version}</strong><small>NusaMind {editionLabel}</small></article>
                <article><span>Quran Index</span><strong>{status?.datasets?.quranKnowledgeChunks ?? 0}</strong><small>Knowledge chunks</small></article>
                <article><span>Universal</span><strong>{status?.datasets?.universalKnowledgeItems ?? 0}</strong><small>Knowledge items</small></article>
                <article><span>Vector Index</span><strong>{status?.vectorIndex?.indexedDocs ?? 0}</strong><small>Indexed documents</small></article>
                <article><span>Session</span><strong>{status?.monitoring?.totalSessions ?? savedSessions.length}</strong><small>Session tersimpan</small></article>
                <article><span>Interaction Log</span><strong>{status?.monitoring?.totalInteractionLogs ?? 0}</strong><small>Log runtime</small></article>
                <article><span>Feedback</span><strong>{status?.feedback?.totalFeedback ?? 0}</strong><small>Feedback tersimpan</small></article>
              </div>
              <div className="system-detail"><div><span className={`status-dot ${status?.ollama?.ok ? 'online' : ''}`} /><strong>{statusText}</strong></div><a href="/dashboard">Lihat dashboard lengkap <Icon name="send" size={16} /></a></div>
            </section>
          )}
        </div>

        <form className={`chat-composer ${activePanel !== 'chat' ? 'is-hidden' : ''}`} onSubmit={sendMessage}>
          <div className="composer-inner">
            {selectedFile && <div className="attachment-chip"><Icon name="file" /><span>{selectedFile.name}</span><button type="button" aria-label="Hapus file" onClick={() => { setSelectedFile(null); setFileNotice(''); if (fileRef.current) fileRef.current.value = ''; }}><Icon name="close" size={16} /></button></div>}
            <textarea ref={inputRef} value={input} onInput={onTextareaInput} onChange={(event) => setInput(event.target.value)} placeholder={`Kirim pesan ke NusaMind ${editionLabel}...`} rows={1} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
            <div className="composer-toolbar">
              <div className="composer-left">
                <button type="button" className="icon-button" aria-label="Lampirkan file" onClick={() => fileRef.current?.click()}><Icon name="paperclip" /></button>
                <span className="composer-status">{uploadingFile ? 'Memproses file...' : fileNotice || statusText}</span>
              </div>
              <button className="send-button" disabled={loading || uploadingFile || (!input.trim() && !selectedFile)}>{loading || uploadingFile ? <span className="button-spinner" /> : <><span>Kirim</span><Icon name="send" size={18} /></>}</button>
            </div>
          </div>
          <p className="composer-disclaimer">NusaMind AI dapat membuat kesalahan. Harap verifikasi informasi penting.</p>
        </form>

        <input ref={fileRef} className="hidden-file-input" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.xml,.html,.ppt,.pptx,.odt,.ods,.odp,.js,.ts,.tsx,.jsx,.css,.php,.py,.java,.rb,.sql,.log,.yml,.yaml" onChange={(event) => { const file = event.currentTarget.files?.[0] || null; setSelectedFile(file); setFileNotice(file ? `File siap dianalisis: ${file.name}` : ''); if (file) { setActivePanel('chat'); requestAnimationFrame(() => inputRef.current?.focus()); } }} />
      </main>
    </div>
  );
}
