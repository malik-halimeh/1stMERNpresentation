import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = 'C:/Users/malik/Desktop/DigitalHub/OptiCart';
const src = join(repo, 'presentation');

const files = [
  { id: 'progress',  icon: '\u{1F9ED}', title: 'Progress & Findings',   path: 'PROGRESS.md' },
  { id: 'repo-map',  icon: '\u{1F5C2}ï¸', title: 'Repository Map',  path: '00_ANALYSIS/REPO_MAP.md' },
  { id: 'fixes',     icon: '✅', title: 'Fixes Applied',         path: '00_ANALYSIS/FIXES_APPLIED.md' },
  { id: 'features',  icon: 'âš™ï¸', title: 'Feature Inventory',  path: '00_ANALYSIS/FEATURE_INVENTORY.md' },
  { id: 'arch',      icon: '\u{1F3DB}ï¸', title: 'Architecture Report', path: '00_ANALYSIS/ARCHITECTURE_REPORT.md' },
  { id: 'tech',      icon: '\u{1F9F0}', title: 'Tech Decisions',        path: '00_ANALYSIS/TECH_DECISIONS.md' },
  { id: 'security',  icon: '\u{1F510}', title: 'Security Review',       path: '00_ANALYSIS/SECURITY_REVIEW.md' },
  { id: 'audit',     icon: '\u{1F4CA}', title: 'Project Audit',         path: '00_ANALYSIS/PROJECT_AUDIT.md' },
  { id: 'mapping',   icon: '\u{1F3AF}', title: 'Evaluation Mapping',    path: '00_ANALYSIS/EVALUATION_MAPPING.md' },
  { id: 'planning',  icon: '\u{1F4C5}', title: 'Planning Phase',        path: '00_ANALYSIS/PLANNING_PHASE.md' },
  { id: 'future',    icon: '\u{1F4A1}', title: 'Future Feature',        path: '00_ANALYSIS/FUTURE_FEATURE.md' },
];

const docs = files.map(f => ({
  id: f.id, icon: f.icon, title: f.title,
  md: readFileSync(join(src, f.path), 'utf8'),
}));

const template = readFileSync(join(here, 'template.html'), 'utf8');
const payload = JSON.stringify(docs)
  .replace(/</g, '\\u003c');
const html = template.replace('/*__DOCS__*/[]', payload);

const out = join(src, 'OptiCart_Analysis.html');
writeFileSync(out, html, 'utf8');
console.log('Wrote', out, '-', (html.length / 1024).toFixed(1), 'KB');
