import {Data,Submission,validateData} from './model';

export const projectNames:Record<string,string>={pacsr:'跨粒度协调预测',iotj:'LEO 多业务流量预测',wm:'World Model 驱动的 RL 研究',bwtac:'屏摄文档泄漏追踪'};
export function organizeWorkspace(input:Data,force=false){
 if(input.structureVersion===2&&!force)return {data:input,changed:false};
 const d=structuredClone(input);const now=new Date().toISOString();
 d.projects=d.projects.map(p=>({...p,name:projectNames[p.id]||p.name,githubUrl:p.githubUrl||'',githubBranch:p.githubBranch||''}));
 d.submissions=d.submissions||[];
 function ensure(id:string,project:string,venue:string,venueType:Submission['venueType'],status:Submission['status'],source:string,note=''){
  if(!d.projects.some(p=>p.id===project))return;
  if(!d.submissions!.some(s=>s.id===id))d.submissions!.push({id,project,venue,venueType,status,title:'',manuscriptId:'',submittedAt:'',decisionAt:'',round:'',versionUrl:'',source,note,createdAt:now,updatedAt:now});
 }
 const pacsrReviews=d.items.filter(i=>i.project==='pacsr'&&i.kind==='review'&&/AAAI/i.test(i.source+' '+i.title));
 if(pacsrReviews.length)ensure('pacsr-aaai27','pacsr','AAAI-27','会议','已拒稿',pacsrReviews[0].source,'由既有 AAAI 历史意见归属；日期与稿号可补充。');
 const leo=d.projects.find(p=>p.id==='iotj');
 if(leo&&(/拒稿|审稿|已投稿/.test(leo.status)||d.items.some(i=>i.id.startsWith('iotj-20261117-')))){
  ensure('leo-iotj-2026','iotj','IEEE Internet of Things Journal','期刊',leo.status.includes('拒稿')?'已拒稿':'审稿中',leo.source);
  const s=d.submissions.find(s=>s.id==='leo-iotj-2026')!;if(!s.submittedAt)s.submittedAt=d.items.find(i=>i.id==='i-t1')?.due||'';
 }
 const b=d.projects.find(p=>p.id==='bwtac');if(b?.status.includes('录用'))ensure('bwtac-2026','bwtac','BWTAC 2026','会议','已录用',b.source);
 for(const i of d.items.filter(i=>i.kind==='review'&&!i.submissionId)){
  if(i.project==='pacsr'&&/AAAI/i.test(i.title+' '+i.source))i.submissionId='pacsr-aaai27';
  if(i.project==='iotj'&&(/IoTJ|20261117/i.test(i.id+' '+i.source)||d.submissions.some(s=>s.id==='leo-iotj-2026')))i.submissionId='leo-iotj-2026';
  if(i.submissionId==='leo-iotj-2026'){i.reviewer=i.reviewer||(/-r1-/.test(i.id)?'Reviewer 1':/-r2-/.test(i.id)?'Reviewer 2':'Associate Editor');i.reviewRound=i.reviewRound||'首轮';}
 }
 const archived=d.archivedItems||[];
 for(const i of d.items.filter(i=>i.kind==='experiment'))if(!archived.some(a=>a.id===i.id))archived.push(i);
 d.archivedItems=archived;d.items=d.items.filter(i=>i.kind!=='experiment');d.structureVersion=2;
 d.audit=[{at:now,action:'按研究项目与投稿批次组织；实验图表留空，原条目保留在备份历史中'},...d.audit].slice(0,100);
 return {data:validateData(d),changed:true};
}
