import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { analyzeUploadedBuffer } from '../../lib/file-analyzer';
test('patched SheetJS still parses an actual XLSX workbook through the upload analyzer', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Produk', 'Jumlah'], ['Kopi', 2], ['Teh', 3]]), 'Penjualan');
  const bytes: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await analyzeUploadedBuffer({ name: 'fixture.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: bytes.length }, bytes);
  assert.equal(result.parser, 'xlsx');
  assert.equal(result.security.blocked, false);
  assert.match(result.extractedText, /Kopi \| 2/);
  assert.match(result.extractedText, /Teh \| 3/);
});
test('secrets found after spreadsheet decompression are quarantined and masked', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Catatan'], ['token=fixture-secret-value']]), 'Privat');
  const bytes: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
  const result = await analyzeUploadedBuffer({ name: 'fixture.xlsx', type: 'application/octet-stream', size: bytes.length }, bytes);
  assert.equal(result.security.quarantine, true);
  assert.doesNotMatch(result.extractedText, /fixture-secret-value/);
  assert.doesNotMatch(result.evidenceSnippets.join(' '), /fixture-secret-value/);
});
