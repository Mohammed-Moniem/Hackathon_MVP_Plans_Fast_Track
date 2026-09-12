import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import OpenAI from 'openai';
import {EcosystemService} from '../src/ecosystem.js';
import type {CouncilDecision,CouncilInput} from '../src/ecosystem-types.js';
const decision:CouncilDecision={title:'Start free',summary:'Preserve savings',conflicts:[{topic:'Cost',positions:'Health wants a gym; Finance protects savings.',resolution:'Try home training first.'}],alternatives:[{title:'Home workout',estimatedCost:0,cadence:'monthly',rationale:'No membership required.',sourceIds:[]}],recommendation:'Try free home exercise for two weeks.',cautions:['Prices and availability need confirmation.']};
function fixture(t:{after:(fn:()=>void)=>void},opts:ConstructorParameters<typeof EcosystemService>[0]={}){const dir=mkdtempSync(join(tmpdir(),'ecosystem-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const statePath=join(dir,'state.json');return{statePath,service:new EcosystemService({statePath,providerStatus:()=>({agents:true,voice:true,search:true}),council:async()=>decision,...opts})};}
test('custom domains persist, are editable, and have validated tool and color values',t=>{const{service,statePath}=fixture(t);const template=service.getState().mentors[0]!;const input={...template,id:'',name:'Roam',domain:'Slow travel',goals:['Accessible holidays'],color:'#7366DD'};const saved=service.saveMentor(input);assert.equal(saved.mentors.length,4);const custom=saved.mentors.at(-1)!;assert.notEqual(custom.id,'');service.saveMentor({...custom,name:'Roam Plus'});assert.equal(service.getState().mentors.at(-1)!.name,'Roam Plus');assert.throws(()=>service.saveMentor({...custom,tools:['shell']}));assert.throws(()=>service.saveMentor({...custom,color:'red;url(bad)'}));assert.equal(statSync(statePath).mode&0o777,0o600);const restarted=new EcosystemService({statePath});assert.equal(restarted.getState().mentors.at(-1)!.domain,'Slow travel');service.deleteMentor(custom.id);assert.equal(service.getState().mentors.length,3);});
test('council gets shared profile and prior approved memory; approval is exact and idempotent',async t=>{let captured:CouncilInput|undefined;const{service}=fixture(t,{council:async(input,hooks)=>{captured=input;hooks.message({id:'msg',mentorId:'finance',mentorName:'Penny',to:'Mira',phase:'review',text:'Protect savings.',at:new Date().toISOString()});return decision;}});const result=await service.council({prompt:'Should I buy this membership?',mentorIds:['health','finance']});assert.equal(result.run!.status,'pending');assert.equal(result.memory.length,0);assert.equal(captured!.profile.wellnessBudget,250);assert.equal(result.run!.messages[0]!.to,'Mira');assert.throws(()=>service.decide('wrong','approve'));service.decide(result.run!.id,'approve');service.decide(result.run!.id,'approve');assert.equal(service.getState().memory.length,1);await service.council({prompt:'What about next month?',mentorIds:['health','finance']});assert.equal(captured!.memory.length,1);});
test('profile or mentor changes invalidate a pending decision; rejected suggestions are not memory',async t=>{const{service}=fixture(t);let r=await service.council({prompt:'Review my fitness spending',mentorIds:['health','finance']});service.saveProfile({...r.profile,monthlyIncome:0});assert.equal(service.getState().run!.status,'failed');assert.throws(()=>service.decide(r.run!.id,'approve'));r=await service.council({prompt:'Review my fitness spending',mentorIds:['health','finance']});service.decide(r.run!.id,'reject');assert.equal(service.getState().memory.length,0);assert.throws(()=>service.decide(r.run!.id,'approve'));});
test('active review cannot be duplicated or have its context changed',async t=>{let finish!:(value:CouncilDecision)=>void;const{service}=fixture(t,{council:()=>new Promise(r=>{finish=r;})});const run=service.council({prompt:'Review my fitness spending',mentorIds:['health','finance']});await assert.rejects(service.council({prompt:'Another review',mentorIds:['health','finance']}),/running/);assert.throws(()=>service.saveProfile(service.getState().profile),/running/);assert.throws(()=>service.deleteMentor('career'),/running/);finish(decision);await run;});
test('failed or interrupted runs never gain approval; saved failure survives restart',async t=>{const{service,statePath}=fixture(t,{council:async()=>{throw new Error('Synthetic provider outage');}});await assert.rejects(service.council({prompt:'Review gym spending',mentorIds:['health','finance']}),/outage/);assert.equal(service.getState().run!.status,'failed');assert.throws(()=>service.decide(service.getState().run!.id,'approve'));const value=JSON.parse(readFileSync(statePath,'utf8'));value.run.status='running';writeFileSync(statePath,JSON.stringify(value));const recovered=new EcosystemService({statePath});assert.equal(recovered.getState().run!.status,'failed');assert.match(recovered.getState().run!.error!,/interrupted/);});
test('missing and duplicate mentors, malformed profile and unknown fields are rejected before model calls',async t=>{const{service}=fixture(t);await assert.rejects(service.council({prompt:'Review gym spending',mentorIds:['health','health']}),/once/);await assert.rejects(service.council({prompt:'Review gym spending',mentorIds:['health','missing']}),/no longer/);assert.throws(()=>service.saveProfile({...service.getState().profile,monthlyIncome:NaN}));assert.throws(()=>service.saveProfile({...service.getState().profile,apiKey:'secret'}));assert.equal(service.getState().run,null);});

const draftedMentor = {name:'Roam',domain:'Accessible holidays',description:'Plan thoughtful trips within a budget.',instructions:'Discuss spending with Finance and activity needs with Health before proposing a trip.',goals:['Save toward an accessible holiday'],tools:['search','search'],voice:'career',color:'#6655DD'};
function draftResponse(value:unknown=draftedMentor,status='completed',refusal=false) {
  return Response.json({id:'resp_draft_fixture',object:'response',status,output:[{id:'msg_draft_fixture',type:'message',role:'assistant',status:'completed',content:refusal?[{type:'refusal',refusal:'private provider detail'}]:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}]});
}
test('AI mentor drafting returns an editable custom domain and never persists until explicitly saved',async t=>{
  let calls=0;
  const client=new OpenAI({apiKey:'test-no-network',maxRetries:0,fetch:async(_url,init)=>{
    calls++;const body=JSON.parse(String(init?.body));
    assert.equal(body.store,false);assert.equal(body.input,'Plan an accessible holiday with my other mentors.');
    assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);
    return draftResponse();
  }});
  const{service,statePath}=fixture(t,{client});const before=readFileSync(statePath,'utf8');
  const draft=await service.draftMentor('Plan an accessible holiday with my other mentors.');
  assert.equal(calls,1);assert.equal(draft.id,'');assert.equal(draft.domain,'Accessible holidays');
  assert.deepEqual(draft.tools,['search']);assert.equal(readFileSync(statePath,'utf8'),before);
  const saved=service.saveMentor({...draft,name:'Roam, edited by me'}).mentors.at(-1)!;
  assert.equal(saved.name,'Roam, edited by me');assert.ok(saved.id);assert.notEqual(readFileSync(statePath,'utf8'),before);
});
test('invalid, refused and unfinished AI mentor drafts do not alter the saved team',async t=>{
  for(const [value,status,refusal] of [[{...draftedMentor,tools:['shell']},'completed',false],[{...draftedMentor,domain:''},'completed',false],[draftedMentor,'completed',true],[draftedMentor,'incomplete',false]] as const){
    let calls=0;const client=new OpenAI({apiKey:'test-no-network',maxRetries:0,fetch:async()=>{calls++;return draftResponse(value,status,refusal);}});
    const{service,statePath}=fixture(t,{client});const before=readFileSync(statePath,'utf8');
    await assert.rejects(service.draftMentor('Create an accessible travel mentor'),/draft.*(incomplete|finish)/i);
    assert.equal(calls,1);assert.equal(readFileSync(statePath,'utf8'),before);
  }
});
test('AI mentor quota and timeout failures preserve the draft workspace and never retry',async t=>{
  for(const failure of ['quota','timeout']){
    let calls=0;const client=new OpenAI({apiKey:'test-no-network',maxRetries:0,fetch:async()=>{
      calls++;if(failure==='timeout')throw new OpenAI.APIConnectionTimeoutError();
      return Response.json({error:{code:'credit_balance_exhausted',type:'insufficient_quota',message:'private provider detail test-no-network'}},{status:429});
    }});
    const{service,statePath}=fixture(t,{client});const before=readFileSync(statePath,'utf8');
    await assert.rejects(service.draftMentor('Create an accessible travel mentor'),error=>{
      assert.ok(error instanceof Error);assert.doesNotMatch(error.message,/private provider detail|test-no-network/);return true;
    });
    assert.equal(calls,1);assert.equal(readFileSync(statePath,'utf8'),before);
  }
});
