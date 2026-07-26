const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api';
const root = base.replace(/\/api\/?$/, '');
try {
  const res = await fetch(`${root}/api/tags`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  console.log('Ollama aktif. Model tersedia:');
  for (const model of json.models || []) console.log(`- ${model.name}`);
} catch (error) {
  console.error('Ollama belum aktif:', error.message);
  console.error('Jalankan: ollama serve');
  process.exit(1);
}
