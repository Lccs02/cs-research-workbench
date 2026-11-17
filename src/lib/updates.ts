import { z } from 'zod';
import { Data, itemSchema, projectSchema, summarySchema, validateData } from './model';

const updateSchema = z.object({
  format: z.literal('research-update-v1'),
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  projectId: z.string().min(1).max(80),
  projectChanges: projectSchema.omit({ id: true }).partial().strict(),
  items: z.array(itemSchema).max(200),
  itemChanges: z.array(z.object({
    id: z.string().min(1).max(100),
    changes: itemSchema.omit({ id: true, project: true, createdAt: true }).partial().strict(),
  }).strict()).max(100).default([]),
  summaries: z.array(summarySchema).max(20).default([]),
}).strict();

export function mergeUpdate(current: Data, input: unknown) {
  const update = updateSchema.parse(input);
  const next = validateData(structuredClone(current));
  const project = next.projects.find(p => p.id === update.projectId);
  if (!project) throw Error('更新对应的项目不存在，请先恢复原工作台备份。');
  if (update.items.some(i => i.project !== update.projectId) ||
      update.summaries.some(s => s.project !== update.projectId)) throw Error('更新包含其他项目的记录。');
  if (new Set(update.items.map(i => i.id)).size !== update.items.length ||
      new Set(update.summaries.map(s => s.id)).size !== update.summaries.length) throw Error('更新包中的记录编号重复。');
  const marker = `增量导入：${update.id}`;
  if (next.audit.some(a => a.action === marker)) return { data: next, title: update.title, alreadyApplied: true, added: 0, changed: 0, skipped: 0 };
  if (update.projectChanges.updated && project.updated > update.projectChanges.updated) throw Error('现有项目状态比更新包更新，请人工核对后录入。');
  for (const item of update.items) {
    const existing = next.items.find(i => i.id === item.id);
    if (existing && existing.project !== update.projectId) throw Error('记录编号与其他项目冲突。');
  }
  for (const summary of update.summaries) {
    const existing = next.summaries.find(s => s.id === summary.id);
    if (existing && existing.project !== update.projectId) throw Error('摘要编号与其他项目冲突。');
  }
  Object.assign(project, update.projectChanges);
  let changed = 0, skipped = 0;
  for (const patch of update.itemChanges) {
    const item = next.items.find(i => i.id === patch.id);
    if (!item) { skipped++; continue; }
    if (item.project !== update.projectId) throw Error('更新不能修改其他项目的记录。');
    if (patch.changes.updatedAt && item.updatedAt > patch.changes.updatedAt) { skipped++; continue; }
    Object.assign(item, patch.changes); changed++;
  }
  const additions = update.items.filter(i => !next.items.some(old => old.id === i.id));
  next.items.unshift(...additions);
  const summaries = update.summaries.filter(s => !next.summaries.some(old => old.id === s.id));
  if (next.summaries.length + summaries.length > 100) throw Error('摘要数量已达上限，请先整理摘要后再导入。');
  next.summaries.unshift(...summaries);
  next.audit = [{ at: new Date().toISOString(), action: marker }, ...next.audit].slice(0, 100);
  return { data: validateData(next), title: update.title, alreadyApplied: false, added: additions.length, changed, skipped };
}
