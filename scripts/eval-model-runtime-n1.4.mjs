import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const json=(p)=>JSON.parse(read(p));
const pkg=json('package.json');
const route=read('app/api/chat/route.ts');
const jsonRoute=read('app/api/chat-json/route.ts');
const model=read('lib/model.ts');
const config=read('lib/config.ts');
const env=read('.env.example');
const routing=json('data/runtime/model-routing.json');
const prompts=json('data/runtime/prompt-registry.json');
const tests={
 release:pkg.version==='1.4.0',
 qwen3Main:String(routing.mainModel).startsWith('qwen3:'),
 coderConfigured:Boolean(routing.coderModel),
 fallbackConfigured:Boolean(routing.fallbackModel),
 heavyCoderOptIn:routing.heavyCoderEnabledByDefault===false,
 thinkingPolicy:['off','auto','on'].includes(routing.thinkingPolicy),
 thinkingSeparated:model.includes('resolveThinking')&&model.includes('think,'),
 installedProbe:model.includes('/api/tags')&&model.includes('probeCache'),
 fallbackRouter:model.includes('fallbackUsed')&&model.includes('candidates.find'),
 routeUsesRuntime:route.includes('resolveModelRuntime')&&jsonRoute.includes('resolveModelRuntime'),
 providerOptions:route.includes('modelRuntime.providerOptions')&&jsonRoute.includes('modelRuntime.providerOptions'),
 modelHeaders:route.includes('x-nusamind-model')&&route.includes('x-nusamind-thinking'),
 qwen3PromptCompat:prompts.every((x)=>x.model_compatibility.includes('qwen3')),
 envComplete:['OLLAMA_FALLBACK_MODEL','OLLAMA_THINKING_MODE','OLLAMA_NUM_CTX','NUSAMIND_HEAVY_CODER_ENABLED'].every((k)=>env.includes(k+'=')),
 configComplete:['ollamaFallbackModel','ollamaThinkingMode','ollamaContextWindow','heavyCoderEnabled'].every((k)=>config.includes(k)),
 noAutoHeavyPull:!read('ollama.bat').includes('ollama pull qwen3-coder:30b'),
};
const passed=Object.values(tests).filter(Boolean).length;
const result={release:'N1.4',edition:routing.edition,passed,total:Object.keys(tests).length,ok:passed===Object.keys(tests).length,tests};
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exit(1);
