import { z } from 'zod';
import {organizeWorkspace} from './structure';
function newer(a:string,b:string){return Date.parse(a)>Date.parse(b);}
import { Data, itemSchema, projectSchema, summarySchema, submissionSchema, validateData } from './model';

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
  submissions:z.array(submissionSchema).max(100).optional(),
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
  if (update.projectChanges.updated && project.updated > update.projectChanges.updated && project.status!=='待记录') throw Error('现有项目状态比更新包更新，请人工核对后录入。');
  for (const item of update.items) {
    const existing = next.items.find(i => i.id === item.id);
    if (existing && existing.project !== update.projectId) throw Error('记录编号与其他项目冲突。');
  }
  for (const summary of update.summaries) {
    const existing = next.summaries.find(s => s.id === summary.id);
    if (existing && existing.project !== update.projectId) throw Error('摘要编号与其他项目冲突。');
  }
  for(const sub of update.submissions||[]){if(sub.project!==update.projectId)throw Error('投稿归属不一致');const old=(next.submissions||[]).find(s=>s.id===sub.id);if(old&&old.project!==sub.project)throw Error('投稿编号与其他项目冲突');if(!next.submissions)next.submissions=[];if(!old)next.submissions.push(sub);else if(!newer(old.updatedAt,sub.updatedAt))Object.assign(old,sub);}
  Object.assign(project, update.projectChanges);
  let changed = 0, skipped = 0;
  for (const patch of update.itemChanges) {
    const item = next.items.find(i => i.id === patch.id);
    if (!item) { skipped++; continue; }
    if (item.project !== update.projectId) throw Error('更新不能修改其他项目的记录。');
    if (patch.changes.updatedAt && newer(item.updatedAt,patch.changes.updatedAt)) { skipped++; continue; }
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

const batchSchema=z.object({format:z.literal('research-update-batch-v1'),title:z.string().min(1).max(200),structureVersion:z.literal(2).optional(),archiveExperiments:z.boolean().optional(),archivedItems:z.array(itemSchema).max(2000).optional(),updates:z.array(updateSchema).min(1).max(30)}).strict();
export function mergeUpdates(current:Data,input:unknown){
 const batch=batchSchema.parse(input);
 if(new Set(batch.updates.map(u=>u.projectId)).size!==batch.updates.length)throw Error('批量更新中项目重复。');
 let data=current,added=0,changed=0,skipped=0,alreadyApplied=true;
 for(const update of batch.updates){const r=mergeUpdate(data,update);data=r.data;added+=r.added;changed+=r.changed;skipped+=r.skipped;alreadyApplied=alreadyApplied&&r.alreadyApplied;}
 if(batch.archivedItems&&!alreadyApplied){data=structuredClone(data);data.archivedItems=data.archivedItems||[];for(const i of batch.archivedItems)if(!data.archivedItems.some(a=>a.id===i.id))data.archivedItems.push(i);const archived=new Map(batch.archivedItems.map(i=>[i.id,i]));data.items=data.items.filter(i=>!archived.has(i.id)||newer(i.updatedAt,archived.get(i.id)!.updatedAt));}
 if(batch.archiveExperiments&&!alreadyApplied)data=organizeWorkspace(data,true).data;
 return {data,title:batch.title,added,changed,skipped,alreadyApplied};
}
