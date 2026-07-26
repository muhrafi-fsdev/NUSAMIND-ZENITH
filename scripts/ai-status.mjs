const url = process.env.APP_URL || 'http://localhost:3000/api/status';
try {
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
} catch (error) {
  console.error('Tidak bisa cek status app:', error.message);
  process.exit(1);
}
