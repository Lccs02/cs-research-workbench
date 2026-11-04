import { Data, today } from './model';
const escape = (s:string) => s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const utf8 = new TextEncoder();
function fold(line:string) {
  let out = '', part = '', size = 0;
  for (const ch of line) {
    const len = utf8.encode(ch).length;
    if (size + len > 73) { out += part + '\r\n'; part = ' '; size = 1; }
    part += ch; size += len;
  }
  return out + part;
}
export function calendar(d:Data) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Research Workbench//CN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const i of d.items.filter(i=>i.due && i.due>=today() && i.stage!=='已完成' && i.dateKind!=='待核对')) {
    lines.push('BEGIN:VEVENT', 'UID:'+escape(i.id)+'@cs-research-workbench',
      'DTSTAMP:'+new Date(i.updatedAt).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z'),
      'DTSTART;VALUE=DATE:'+i.due.replaceAll('-',''),
      'SUMMARY:'+escape((d.projects.find(p=>p.id===i.project)?.name||'')+' · '+i.title),
      'DESCRIPTION:'+escape(i.dateKind+'；'+i.detail+'\n来源：'+i.source),
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:科研节点提醒','TRIGGER:-P1D','END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
