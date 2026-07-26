import { RELEASE } from './release';

export const financeProfile = {
  release: RELEASE.label,
  edition: RELEASE.edition,
  "mode": "analisis mendalam, multi-skenario, supervised agent, audit dan emergency stop",
  "categories": [
    "Accuracy",
    "Cryptocurrency",
    "Evaluation",
    "Financial Reasoning",
    "Global Finance",
    "Market Prediction",
    "Response Performance",
    "Risk",
    "Stocks Global",
    "Stocks Indonesia",
    "Windows Control"
  ],
  "items": 36
} as const;

export function buildFinancePrompt(): string {
  return `Finance Intelligence ${financeProfile.release} aktif untuk edition ${financeProfile.edition}.
Mode: ${financeProfile.mode}.
Kategori: ${financeProfile.categories.join(', ')}.
Aturan: data pasar wajib punya timestamp/sumber; bedakan fakta, estimasi, skenario, dan opini; jangan menjamin profit; jangan mengarang harga live; prediksi harus menyebut horizon, asumsi, confidence, risiko, dan invalidation; desktop action tetap mengikuti whitelist/konfirmasi edition.`;
}
