import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const token=randomUUID();const root=resolve('.vision-loop/runs/two-projects-20260912/artifacts/renders');await mkdir(root,{recursive:true});
const script=`document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(e.target))});const result=await r.json();document.body.textContent=result.path||result.error;});`;
const server=createServer(async(req,res)=>{try{
 const host=req.headers.host;if(host!=='127.0.0.1:3212')throw Error('Invalid host');
 if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:3212')throw Error('Invalid origin');
 if(req.headers['sec-fetch-site']==='cross-site')throw Error('Invalid site');
 const pathname=new URL(req.url,'http://127.0.0.1:3212').pathname;
 if(!pathname.startsWith('/'+token+'/'))throw Error('Invalid capture path');
 const name=pathname.split('/').at(-1);res.setHeader('Cache-Control','no-store');
 if(name==='bridge.js'&&req.method==='GET'){res.setHeader('Content-Type','text/javascript');return res.end(script);}
 if(!/^[a-z][a-z0-9-]{2,80}$/.test(name))throw Error('Invalid name');
 if(req.method==='GET'){res.setHeader('Content-Type','text/html');return res.end(`<html lang="en"><title>Save browser evidence</title><h1>Save ${name}</h1><form><label>Screenshot data<textarea name="screenshot" autocomplete="off"></textarea></label><button>Save screenshot</button></form><script src="/${token}/bridge.js"></script></html>`);}
 if(req.method!=='POST')throw Error('Invalid method');
 let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>20*1024*1024)throw Error('Too large');chunks.push(c);}
 const encoded=new URLSearchParams(Buffer.concat(chunks).toString()).get('screenshot');
 if(!encoded||!/^[A-Za-z0-9+/=]+$/.test(encoded))throw Error('Invalid encoding');
 const image=Buffer.from(encoded,'base64');const png=image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=image[0]===255&&image[1]===216;if(!png&&!jpeg)throw Error('Expected browser screenshot');
 const path=resolve(root,name+(png?'.png':'.jpg'));await writeFile(path,image,{flag:'wx'});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path}));
}catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message}));}});
server.listen(3212,'127.0.0.1',()=>console.log('Capture bridge: http://127.0.0.1:3212/'+token+'/'));
