import React, {useEffect, useState} from 'react';
import {CheckCircle2, Download, LockKeyhole, X} from 'lucide-react';
import {today} from './lib/model';

export default function ChangePassphraseDialog({onChange,onClose}:{
  onChange:(currentPassword:string,newPassword:string)=>Promise<string>;
  onClose:()=>void;
}) {
  const [current,setCurrent]=useState(''), [next,setNext]=useState(''), [repeat,setRepeat]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [backup,setBackup]=useState<string|null>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const handle=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onClose();};
    document.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('keydown',handle);previous?.focus();};
  },[busy,onClose]);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');
    if(next!==repeat){setError('两次输入的新口令不一致。');return;}
    if(next.length<10){setError('新口令至少需要 10 个字符。');return;}
    setBusy(true);
    try {
      const encrypted=await onChange(current,next);
      setCurrent('');setNext('');setRepeat('');setBackup(encrypted);
    }catch(err){setError(err instanceof Error?err.message:'口令修改失败，原记录保持不变。');}
    finally{setBusy(false);}
  }
  function downloadBackup() {
    if(!backup)return;
    const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;
    anchor.download='research-vault-'+today()+'.json';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section className="modal passphrase-modal" role="dialog" aria-modal="true" aria-labelledby="passphrase-title">
      <header><div><span className="eyebrow">YOUR PRIVATE WORKSPACE</span><h2 id="passphrase-title">修改口令</h2></div>
        <button className="icon-button" aria-label="关闭修改口令" disabled={busy} onClick={onClose}><X size={21}/></button></header>
      {backup?<><div className="passphrase-success" role="status"><CheckCircle2 size={32}/><h3>口令已修改，记录完整保留。</h3>
        <p>本机记录已用新口令重新加密。下次解锁请使用新口令。</p>
        <p>请下载一份新备份；之前导出的备份仍需使用当时的旧口令。</p></div>
        <div className="modal-footer"><button className="button" onClick={onClose}>完成</button><span/>
          <button className="button primary" onClick={downloadBackup}><Download size={15}/>下载新备份</button></div></>:
      <form onSubmit={submit}><div className="form-grid"><p className="full passphrase-intro">验证当前口令后，在本机重新加密现有记录。口令不会上传。</p>
        <label className="full" htmlFor="current-passphrase">当前口令<input id="current-passphrase" name="currentPassphrase" type="password" autoComplete="current-password" autoFocus required value={current} onChange={e=>setCurrent(e.target.value)} disabled={busy}/></label>
        <label className="full" htmlFor="new-passphrase">新口令<input id="new-passphrase" name="newPassphrase" type="password" autoComplete="new-password" minLength={10} required value={next} onChange={e=>setNext(e.target.value)} disabled={busy}/><small>至少 10 个字符，建议使用较长且独有的口令。</small></label>
        <label className="full" htmlFor="repeat-passphrase">再次输入新口令<input id="repeat-passphrase" name="repeatPassphrase" type="password" autoComplete="new-password" minLength={10} required value={repeat} onChange={e=>setRepeat(e.target.value)} disabled={busy}/></label>
        <p className="form-note full">修改仅影响当前浏览器中的记录。其他设备和旧备份保留原口令；换设备时请导入修改后导出的新备份。</p>
      </div>{error&&<div className="form-error" role="alert">{error}</div>}
        <div className="modal-footer"><button type="button" className="button" disabled={busy} onClick={onClose}>取消</button><span/>
          <button className="button primary" disabled={busy}><LockKeyhole size={15}/>{busy?'正在重新加密…':'保存新口令'}</button></div></form>}
    </section>
  </div>;
}
