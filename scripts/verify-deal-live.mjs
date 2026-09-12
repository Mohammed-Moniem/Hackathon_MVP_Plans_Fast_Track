import OpenAI from 'openai';
import {config} from 'dotenv';
import {writeFileSync} from 'node:fs';
import {Store} from '../dist/store.js';
import {Engine} from '../dist/engine.js';
import {DealAgent} from '../dist/agent.js';
import {firstMessage,secondMessage} from '../dist/fixtures.js';
config({path:['.env.local','.env']});
const store=new Store('artifacts/live-deal-check.json');
const engine=new Engine(store,{CFO:['LOCAL-CHECK'],'Procurement Director':['LOCAL-CHECK']});
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
const agent=new DealAgent(engine,client,process.env.OPENAI_MODEL||'gpt-6-astra',120000);
const thread=engine.receive({id:crypto.randomUUID(),channel:'ISOLATED-CHECK',threadTs:'review',user:'synthetic-supplier',text:firstMessage});
const started=Date.now();
const report={observedAt:new Date().toISOString(),status:'running',externalMessages:0,turns:[]};
const save=()=>writeFileSync('docs/DEAL_LIVE_VERIFICATION.md','# DealGuard live verification\n\nSynthetic commercial records. Actual OpenAI Agents API and application validation. No external messages.\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
save();
try{
const p=await agent.run(thread.key,thread.version,async message=>console.log(message));
report.turns.push({kind:'Initial offer',elapsedMs:Date.now()-started,sessionId:engine.thread(thread.key).sessionId,status:p.status,referenceCount:p.evidenceRefs.length,annualized:p.proposedMetrics?.annualizedCost,policy:p.policy,proposalId:p.id});
report.status='passed';save();console.log(JSON.stringify(report));
}catch(error){report.status='failed';report.error=error.message;save();console.log(JSON.stringify(report));process.exitCode=1;}
