import {Data,today} from './model';
export function emptyWorkspace():Data {
  return {projects:[
    {id:'pacsr',name:'PACSR / TKDE',color:'blue',venue:'IEEE TKDE'},
    {id:'iotj',name:'IoTJ',color:'teal',venue:'IEEE Internet of Things Journal'},
    {id:'wm',name:'World Model + RL',color:'purple',venue:''},
    {id:'bwtac',name:'BWTAC',color:'orange',venue:''},
  ].map(p=>({...p,color:p.color as 'blue'|'teal'|'purple'|'orange',subtitle:'',status:'待记录',updated:today(),source:'空白模板；请手动填写或导入备份',next:'添加当前项目的任务与证据。'})),items:[],summaries:[],audit:[]};
}
