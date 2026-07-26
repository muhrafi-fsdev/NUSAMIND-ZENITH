export function chooseExecution(prompt:string){return /^\s*\d+(?:\.\d+)?\s*[+\-*/]\s*\d+(?:\.\d+)?\s*$/.test(prompt)||/jumlah karakter/i.test(prompt)?{kind:'tool',name:'deterministic'}:{kind:'model',name:'qwen-main'};}
export function modelProfile(){return{main:'Qwen',status:'CONFIGURED',liveBenchmarkRequired:true,embedding:{status:'CONFIGURED'},vision:{status:'PROTOTYPE'}};}
