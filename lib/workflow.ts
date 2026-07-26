import path from 'node:path';
import { DATA_DIR } from './config';
import { safeJson } from './util';
import type { AssistantMode, WorkflowPlan, WorkflowStep } from './types';

export async function loadWorkflowBlueprint(): Promise<WorkflowStep[]> {
  const data = await safeJson<any[]>(path.join(DATA_DIR, 'runtime/blueprint.json'), []);
  return data.map((item, index) => ({
    id: String(item.id || `step_${index + 1}`),
    title: String(item.title || `Tahap ${index + 1}`),
    objective: String(item.objective || ''),
    outputs: Array.isArray(item.outputs) ? item.outputs.map(String) : [],
    checklist: Array.isArray(item.checklist) ? item.checklist.map(String) : [],
    metrics: Array.isArray(item.metrics) ? item.metrics.map(String) : [],
    tools: Array.isArray(item.tools) ? item.tools.map(String) : [],
  }));
}

function detectTargetMode(text: string): AssistantMode | 'hybrid' {
  const lowered = text.toLowerCase();
  if (/(al-quran|alquran|quran|surah|ayat|tafsir)/.test(lowered)) return 'quran';
  if (/(coding|debug|next|node|api|laravel|react|typescript|javascript)/.test(lowered)) return 'coding';
  if (/(temani|curhat|emosi|santai)/.test(lowered)) return 'companion';
  if (/(universal|umum|general)/.test(lowered)) return 'universal';
  return 'hybrid';
}

export async function buildWorkflowPlan(projectName: string, userGoal: string): Promise<WorkflowPlan> {
  const steps = await loadWorkflowBlueprint();
  const targetMode = detectTargetMode(userGoal);

  const filteredSteps = steps.map((step) => {
    let checklist = [...step.checklist];
    let outputs = [...step.outputs];

    if (step.id === 'step_1') {
      checklist = checklist.concat([
        `Rumuskan use case utama: ${userGoal}`,
        `Tetapkan target mode dominan: ${targetMode}`,
      ]);
    }

    if (step.id === 'step_2') {
      outputs = outputs.concat([
        'Dataset dibagi menjadi Quran, Universal, dan Workflow playbook.',
        'Format metadata seragam untuk RAG dan evaluasi.',
      ]);
    }

    if (step.id === 'step_5') {
      checklist = checklist.concat([
        'Pastikan alur jawaban: intent → memory → retrieval → prompt assembly → LLM → validator → output.',
      ]);
    }

    return { ...step, checklist, outputs };
  });

  return {
    projectName,
    targetMode,
    summary: `Roadmap pengembangan untuk ${projectName} difokuskan ke mode ${targetMode} dengan alur jelas: tentukan masalah → siapkan data → bangun knowledge base → jalankan mesin AI lokal → validasi jawaban → backend integration → evaluasi → monitoring & improvement.`,
    steps: filteredSteps,
    nextActions: [
      'Jalankan evaluasi awal pada 20-50 pertanyaan per mode.',
      'Aktifkan monitoring interaksi, error, dan kualitas jawaban.',
      'Perbaiki dataset, prompt, retrieval, atau model berdasarkan hasil evaluasi.',
      'Deploy bertahap mulai local dev → staging → production.',
    ],
  };
}
