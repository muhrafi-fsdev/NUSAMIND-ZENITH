const url = (process.env.NUSAMIND_ML_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
try {
  const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(JSON.stringify({ ok: false, status: 'unavailable', error: String(error?.message || error) }, null, 2));
  process.exit(1);
}
