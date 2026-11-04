import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Layers, LockKeyhole, ArrowRight, ShieldCheck, Upload} from 'lucide-react';
import Workbench from './Workbench';
import ChangePassphraseDialog from './ChangePassphraseDialog';
import {Data} from './lib/model';
import {Envelope, Snapshot, STORAGE_KEY, openEnvelope, seal, parseEnvelope, deriveKey, salt, ITERATIONS, rekeyEnvelope} from './lib/vault';
import {emptyWorkspace} from './lib/template';
import './style.css';

function App() {
  const [session, setSession] = useState<{snapshot:Snapshot;key:CryptoKey;envelope:Envelope;raw:string|null}|null>(null);
  const [password,setPassword] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [restore,setRestore] = useState<Envelope|null>(null);
  const [changeOpen,setChangeOpen] = useState(false);
  const writeLock = useRef(false);
  const upload = useRef<HTMLInputElement>(null);
  const [hasLocal,setHasLocal] = useState(()=>{try{return !!localStorage.getItem(STORAGE_KEY);}catch{return false;}});
  const lock = () => { if(writeLock.current)return; setChangeOpen(false); setSession(null); setPassword(''); };
  async function unlock(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let envelope: Envelope;
      if (restore) envelope = restore;
      else if (raw) envelope = parseEnvelope(JSON.parse(raw));
      else {
        if(password.length<10)throw Error('新工作台口令至少需要 10 个字符，请妥善保管。');
        const template={salt:salt(),iterations:ITERATIONS};
        const key=await deriveKey(password,template.salt);
        envelope=await seal({schemaVersion:1,data:emptyWorkspace(),revision:0,updatedAt:new Date().toISOString()},key,template);
      }
      const opened = await openEnvelope(envelope,password);
      if(restore && raw && !confirm('用选中的备份替换本机记录？请先确认已有最新备份。')) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      setHasLocal(true); setSession({...opened, raw:JSON.stringify(envelope)}); setPassword(''); setRestore(null);
    } catch(err) { setError(err instanceof Error ? err.message : '解锁失败。请检查浏览器存储是否可用。'); }
    finally { setBusy(false); }
  }
  async function persist(data:Data, revision:number, action:string):Promise<Snapshot> {
    if (!session) throw Error('请先解锁工作台。');
    if(writeLock.current) throw Error('工作台正在保存或修改口令，请稍后重试。');
    writeLock.current=true;
    try {
    if(localStorage.getItem(STORAGE_KEY)!==session.raw) throw Error('另一标签页更新了数据。请刷新并重新解锁后再编辑。');
    const next:Snapshot = {schemaVersion:1, data:{...data, audit:[{at:new Date().toISOString(),action},...data.audit].slice(0,100)},
      revision:revision+1, updatedAt:new Date().toISOString()};
    const envelope = await seal(next, session.key, session.envelope);
    const raw = JSON.stringify(envelope);
    // Check again after asynchronous encryption to reject changes from another tab.
    if(localStorage.getItem(STORAGE_KEY)!==session.raw) throw Error('数据已在其他标签页更新，请重新解锁。');
    localStorage.setItem(STORAGE_KEY, raw);
    setSession({...session, snapshot:next, envelope, raw});
    return next;
    } finally { writeLock.current=false; }
  }
  async function changePassphrase(currentPassword:string,newPassword:string):Promise<string> {
    if(!session)throw Error('请先解锁工作台。');
    if(writeLock.current)throw Error('记录正在保存，请稍后再修改口令。');
    writeLock.current=true;
    try {
      if(localStorage.getItem(STORAGE_KEY)!==session.raw)throw Error('另一标签页已更新记录，请重新解锁后再修改口令。');
      const replacement=await rekeyEnvelope(session.envelope,currentPassword,newPassword);
      const raw=JSON.stringify(replacement.envelope);
      if(localStorage.getItem(STORAGE_KEY)!==session.raw)throw Error('修改期间记录已在另一标签页更新，原口令保持不变。请重新解锁。');
      localStorage.setItem(STORAGE_KEY,raw);
      setSession({...replacement,raw});
      return JSON.stringify(replacement.envelope,null,2);
    }finally{writeLock.current=false;}
  }
  if(session) return <><Workbench initial={session.snapshot} persist={persist} onLock={lock}
    onChangePassphrase={()=>setChangeOpen(true)} exportVault={()=>JSON.stringify(session.envelope,null,2)} />
    {changeOpen&&<ChangePassphraseDialog onChange={changePassphrase} onClose={()=>setChangeOpen(false)}/>}</>;
  return <div className="vault-screen"><div className="vault-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="orbit-core"><Layers size={72}/></div><span className="orbit-label l1">IDEA</span><span className="orbit-label l2">EVIDENCE</span><span className="orbit-label l3">PROGRESS</span><div className="vault-quote">让研究有序<br/><em>让结论有据。</em></div></div><main className="vault-panel"><div className="brand"><div className="brand-symbol"><Layers size={24}/></div><div><strong>研序<span> / </span></strong><small>RESEARCH WORKSPACE</small></div></div><div className="vault-intro"><span className="eyebrow">A SPACE FOR YOUR RESEARCH</span><h1>回到你的研究。<span className="heading-dot"/></h1><p>项目、证据与下一步，在这里清楚相连。<br/>{hasLocal?'输入口令，解锁本机科研记录。':restore?'输入迁移口令，恢复所选科研备份。':'首次使用请先选择下方的科研备份，或设置口令创建空白工作台。'}</p></div><form className="vault-form" onSubmit={unlock}><label htmlFor="vault-password"><LockKeyhole size={15}/>工作台口令</label><input id="vault-password" type="password" autoComplete={hasLocal||restore?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} required autoFocus placeholder={hasLocal||restore?'输入备份或本机口令':'新口令，至少 10 个字符'}/><button className="button primary" disabled={busy}>{busy?'正在处理…':hasLocal||restore?'解锁工作台':'创建空白工作台'}<ArrowRight size={17}/></button>{error&&<div role="alert" className="vault-error">{error}</div>}</form><div className="vault-security"><ShieldCheck size={19}/><p>科研记录在浏览器中解密，口令不会上传。<br/>修改加密保存在本机；换设备时，请导入最新备份。</p></div><button className="text-button" onClick={()=>upload.current?.click()}><Upload size={15}/>{restore?'已选加密备份，输入对应口令解锁':'选择科研备份并恢复'}</button><input ref={upload} type="file" hidden accept="application/json,.json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>12000000)throw Error('备份文件过大');setRestore(parseEnvelope(JSON.parse(await f.text())));setError('');}catch(err){setError(err instanceof Error?err.message:'备份格式错误');}e.target.value='';}}/><a className="vault-repo" href="https://github.com/Lccs02/cs-research-workbench" target="_blank" rel="noreferrer">GitHub Pages · 开源界面 · 加密记录</a></main></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
