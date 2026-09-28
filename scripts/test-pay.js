'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { FileStore, open } = require('../services/pay/store');
const { build, makeRouters } = require('../routes/pay');
const { sign } = require('../services/pay/partner-sandbox');
const { makeDirectory } = require('../services/pay/directory');
const CONFIG = require('../config/pay.json');

async function fixture(options={}) {
  let now=Date.now();
  const people={alice:{uid:'alice',handle:'alice',displayName:'Alice'},bob:{uid:'bob',handle:'bob',displayName:'Bob'}};
  const directory={profileOf:async id=>people[id]||null,byHandle:async h=>people[h]||null};
  const config=structuredClone(CONFIG);
  if(options.daily)config.assets.USDT.daily=options.daily;
  const store=new FileStore({file:options.file});
  const fx={rates:async()=>({ok:true,stale:false,fetchedAt:now,date:new Date(now).toISOString().slice(0,10),source:'Test FX',rates:{INR:85,PHP:56,GBP:0.75}})};
  const deps={store,directory,config,fx,now:()=>now,env:{}};
  const {pay,partners}=build(deps);await pay.init();
  await pay.me('alice');await pay.me('bob');
  const q=(amount='10',more={})=>pay.quote('alice',{to:'bob',asset:'USDT',amount,...more});
  const confirm=(quote,more={})=>pay.confirm('alice',quote.id,{authTime:now,...more});
  const cross=async(name='Bob Test')=>{const r=await pay.saveRecipient('alice',{country:'IN',method:'bank',name});return pay.quote('alice',{kind:'xb',recipientId:r._id,corridor:'IN',asset:'USDT',amount:'10'});};
  const event=async(t,type,extra={})=>{
    const raw=JSON.stringify({id:'evt_'+require('node:crypto').randomBytes(8).toString('hex'),type,ref:t.partner.ref,transferId:t.id,amount:t.receive.amount,currency:t.receive.code,...extra});
    return pay.webhook('sandbox',raw,{'trending-signature':sign(await pay.hookSecret(),raw,Math.floor(now/1000))});
  };
  return {pay,store,partners,people,directory,deps,q,confirm,cross,event,advance:ms=>now+=ms,now:()=>now};
}
const rejects=(promise,code)=>assert.rejects(promise,e=>e.code===code);

test('live mode cannot enable the practice book or sandbox provider',()=>{
  assert.equal(open({PAY_MODE:'live'}),null);
  assert.equal(open({NODE_ENV:'production',MONGO_URI:'mongodb://unused'}),null);
  assert.equal(open({NODE_ENV:'production',PAY_MODE:'practice'}),null);
});
test('same-asset payment commits both ledger legs, one receipt, exact decimal amounts',async()=>{
  const f=await fixture();const t=await f.confirm(await f.q('10.000001'));
  assert.equal(t.status,'completed');
  assert.equal((await f.pay.me('alice')).balances.USDT.available,'989.999999');
  assert.equal((await f.pay.me('bob')).balances.USDT.available,'1010.000001');
  assert.equal((await f.pay.receipt('alice',t.id)).amountReceived,'10.000001 USDT');
  assert.equal((await f.pay.reconcile()).ok,true);
});
test('signed QR validation never pays, rejects changed signatures, hidden characters, phishing origins and old codes',async()=>{
  const f=await fixture();const r=await f.pay.createRequest('bob',{asset:'USDT',amount:'4',note:'Coffee'});
  assert.equal((await f.pay.scan('alice',r.token,'https://trending.test')).ok,true);
  assert.equal((await f.pay.transfers('alice')).length,0);
  for(const text of [r.token.slice(0,-1)+(r.token.endsWith('A')?'B':'A'),r.token+'\u200b','https://evil.test/#tpay='+r.token,'http://trending.test/#tpay='+r.token,'https://u:p@trending.test/#tpay='+r.token,'#pay?to=Bob'])assert.equal((await f.pay.scan('alice',text,'https://trending.test')).ok,false);
  assert.equal((await f.pay.scan('alice','https://trending.test/#tpay='+r.token,'https://trending.test')).ok,true);
});
test('expired or modified payment requests fail at confirmation with no debit',async()=>{
  const f=await fixture();let r=await f.pay.createRequest('bob',{asset:'USDT',amount:'4',hours:1});
  let q=await f.q('4',{token:r.token});
  await f.store.tx(u=>u.update('requests',r.id,{note:'Changed order'}));
  await rejects(f.confirm(q),'request_invalid');
  assert.equal((await f.pay.scan('alice',r.token)).code,'tampered');
  r=await f.pay.createRequest('bob',{asset:'USDT',amount:'5',hours:0.001});q=await f.q('5',{token:r.token});f.advance(4000);
  await rejects(f.confirm(q),'request_invalid');assert.equal((await f.pay.me('alice')).balances.USDT.available,'1000');
});
test('quote expiry, wrong owner, changed economics, stale and future authentication fail closed',async()=>{
  const f=await fixture();const q=await f.q();
  await rejects(f.pay.confirm('bob',q.id,{authTime:f.now()}),'not_found');
  await rejects(f.confirm(q,{authTime:f.now()-301000}),'reauth_required');
  await rejects(f.confirm(q,{authTime:f.now()+60000}),'reauth_required');
  await f.store.tx(u=>u.update('quotes',q.id,{totalUnits:'1'}));await rejects(f.confirm(q),'quote_modified');
  const q2=await f.q();f.advance(60000);await rejects(f.confirm(q2),'quote_expired');
});
test('fresh recipient lookup detects substitution and blocks directory outages',async()=>{
  const f=await fixture();const q=await f.q();let fresh=false;
  f.directory.byHandle=async(h,t,o)=>{fresh=o.fresh;return {uid:'mallory'};};
  await rejects(f.confirm(q),'recipient_changed');assert.equal(fresh,true);
  f.directory.byHandle=async()=>{throw Error('offline');};await rejects(f.confirm(q),'directory_unavailable');await rejects(f.pay.resolve('alice','bob'),'directory_unavailable');
});
test('concurrent retries and subsequent restart return one persisted transfer',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trending-pay-test-'));
  try {const file=path.join(dir,'book.json');const f=await fixture({file});const q=await f.q();
    const out=await Promise.all(Array.from({length:5},()=>f.confirm(q,{key:'retry-key-one'})));
    assert.equal(new Set(out.map(t=>t.id)).size,1);assert.equal((await f.pay.transfers('alice')).length,1);
    const restarted=build({...f.deps,store:new FileStore({file})}).pay;await restarted.init();
    const again=await restarted.confirm('alice',q.id,{key:'retry-key-one',authTime:f.now()});assert.equal(again.id,out[0].id);
    await rejects(f.confirm(await f.q('11'),{key:'retry-key-one'}),'bad_request');assert.equal((await restarted.reconcile()).ok,true);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('parallel distinct quotes cannot bypass daily limits',async()=>{
  const f=await fixture({daily:'15'});const quotes=await Promise.all([f.q('9'),f.q('8')]);
  const out=await Promise.allSettled(quotes.map(q=>f.confirm(q)));
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(out.find(r=>r.status==='rejected').reason.code,'over_limit');
  assert.equal((await f.pay.reconcile()).ok,true);
});
test('parallel duplicate payments require a new warning-bound quote',async()=>{
  const f=await fixture();const quotes=await Promise.all([f.q(),f.q()]);
  const out=await Promise.allSettled(quotes.map(q=>f.confirm(q)));
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(out.find(r=>r.status==='rejected').reason.code,'confirm_repeat');
  const q=await f.q();assert.ok(q.ack.includes('repeat'));await rejects(f.confirm(q),'confirm_repeat');
  assert.equal((await f.confirm(q,{acknowledge:{repeat:true}})).status,'completed');
});
test('single-use request cannot be replayed across payers',async()=>{
  const f=await fixture();await f.pay.me('charlie');const r=await f.pay.createRequest('bob',{asset:'USDT',amount:'8'});
  const q1=await f.q('8',{token:r.token});const q2=await f.pay.quote('charlie',{token:r.token});
  await f.confirm(q1);await rejects(f.pay.confirm('charlie',q2.id,{authTime:f.now()}),'request_invalid');
  assert.equal((await f.pay.scan('charlie',r.token)).code,'paid');assert.equal((await f.pay.reconcile()).ok,true);
});
test('cross-border economics disclose every fee; pending receipt never claims received',async()=>{
  const f=await fixture();const q=await f.cross();assert.equal(q.total,'11.24');assert.equal(q.receive.amount,'850');assert.equal(q.rate.markup,'0');
  for(const k of ['send','rate','trending','provider','total','receive','eta'])assert.ok(q.lines.some(l=>l.key===k));
  const t=await f.confirm(q);assert.equal(t.status,'processing');assert.equal((await f.pay.receipt('alice',t.id)).amountReceived,null);
});
test('forged, stale, wrong-value and duplicate webhooks cannot credit or settle funds',async()=>{
  const f=await fixture();const t=await f.confirm(await f.cross());
  await rejects(f.pay.webhook('sandbox','{}',{}),'bad_signature');
  await rejects(f.event(t,'payout.completed',{amount:'999'}),'bad_request');
  const raw=JSON.stringify({id:'evt_abcdef123456',type:'payout.completed',ref:t.partner.ref,transferId:t.id,amount:t.receive.amount,currency:t.receive.code});
  const headers={'trending-signature':sign(await f.pay.hookSecret(),raw,Math.floor(f.now()/1000))};
  assert.equal((await f.pay.webhook('sandbox',raw,headers)).status,'completed');
  assert.equal((await f.pay.webhook('sandbox',raw,headers)).duplicate,true);
  f.advance(301000);await rejects(f.pay.webhook('sandbox',raw,headers),'bad_signature');assert.equal((await f.pay.reconcile()).ok,true);
});
test('out-of-order failure cannot refund a settled payout',async()=>{
  const f=await fixture();const t=await f.confirm(await f.cross());await f.event(t,'payout.completed');
  await f.event(t,'payout.failed');assert.equal((await f.pay.transfer('alice',t.id)).status,'completed');assert.equal((await f.pay.reconcile()).ok,true);
});
test('ambiguous provider timeout reserves funds and reconciles without resubmission',async()=>{
  const f=await fixture();const orig=f.partners.sandbox.createPayout;let calls=0;
  f.partners.sandbox.createPayout=async o=>{calls++;await orig(o);throw Error('lost response');};
  const t=await f.confirm(await f.cross());assert.equal(t.status,'under_review');assert.equal(t.canCancel,false);
  assert.equal((await f.pay.me('alice')).balances.USDT.locked,'11.24');f.advance(6000);await f.pay.tick();
  assert.equal(calls,1);assert.ok((await f.pay.transfer('alice',t.id)).partner.ref);assert.equal((await f.pay.reconcile()).ok,true);
});
test('payout worker progresses from provider evidence through action required and refund',async()=>{
  const f=await fixture();const t=await f.confirm(await f.cross('Bob Check'));
  f.advance(5000);await f.pay.tick();assert.equal((await f.pay.transfer('alice',t.id)).status,'sent');
  f.advance(6000);await f.pay.tick();assert.equal((await f.pay.transfer('alice',t.id)).status,'action_required');
  await f.pay.respond('alice',t.id,'cancel');assert.equal((await f.pay.transfer('alice',t.id)).status,'action_required');
  await f.pay.tick();assert.equal((await f.pay.transfer('alice',t.id)).status,'refunded');
  assert.equal((await f.pay.me('alice')).balances.USDT.available,'1000');assert.equal((await f.pay.reconcile()).ok,true);
});
test('merchant refund requires the recipient and cannot refund twice',async()=>{
  const f=await fixture();await f.pay.becomeMerchant('bob',{name:'Bob Shop'});const r=await f.pay.createRequest('bob',{asset:'USDT',amount:'20',merchant:true});
  const q=await f.q('20',{token:r.token});assert.equal(q.fees.merchant,'0.1');const t=await f.confirm(q);
  await rejects(f.pay.refund('alice',t.id),'not_found');assert.equal((await f.pay.refund('bob',t.id)).status,'refunded');
  await rejects(f.pay.refund('bob',t.id),'bad_request');assert.equal((await f.pay.me('alice')).balances.USDT.available,'1000');assert.equal((await f.pay.reconcile()).ok,true);
});
test('unauthorized history, receipt and recipient IDs expose no other account',async()=>{
  const f=await fixture();const t=await f.confirm(await f.q());await rejects(f.pay.transfer('mallory',t.id),'not_found');await rejects(f.pay.receipt('mallory',t.id),'not_found');
  assert.equal((await f.pay.transfers('mallory')).length,0);
  const r=await f.pay.saveRecipient('bob',{name:'Bob Smith',country:'IN',method:'bank'});
  await rejects(f.pay.quote('alice',{kind:'xb',recipientId:r._id,corridor:'IN',amount:'10',asset:'USDT'}),'bad_request');
});
test('directory fresh lookup bypasses a previously cached handle owner',async()=>{
  let owner='alice';const d=makeDirectory({projectId:'test',fetch:async url=>({ok:true,json:async()=>({fields:url.includes('/handles/')?{uid:{stringValue:owner}}:{name:{stringValue:'bob'},displayName:{stringValue:owner}}})})});
  assert.equal((await d.byHandle('bob')).uid,'alice');owner='mallory';assert.equal((await d.byHandle('bob')).uid,'alice');assert.equal((await d.byHandle('bob',null,{fresh:true})).uid,'mallory');
});
test('HTTP routes mount raw webhooks, require auth and retry keys, and ignore client financial state',async t=>{
  const f=await fixture();const auth=(req,res,next)=>{if(req.headers.authorization!=='Bearer fixture')return res.status(401).json({error:'unauthorized'});req.user={id:'alice',authTime:f.now()};next();};
  const r=makeRouters({...f.deps,auth,worker:false});const app=express();app.use('/api/pay/webhooks',r.webhooks);app.use(express.json());app.use('/api/pay',r.router);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port+'/api/pay';
  assert.equal((await fetch(base+'/me')).status,401);
  const headers={Authorization:'Bearer fixture','Content-Type':'application/json'};
  let res=await fetch(base+'/quotes',{method:'POST',headers,body:JSON.stringify({to:'bob',asset:'USDT',amount:'10'})});assert.equal(res.status,200);const q=await res.json();
  res=await fetch(base+'/transfers',{method:'POST',headers,body:JSON.stringify({quoteId:q.id})});assert.equal(res.status,400);
  res=await fetch(base+'/transfers',{method:'POST',headers:{...headers,'Idempotency-Key':'http-retry-1'},body:JSON.stringify({quoteId:q.id,amount:'999',recipient:'mallory',status:'refunded'})});assert.equal(res.status,200);const paid=await res.json();assert.equal(paid.status,'completed');assert.equal(paid.send.amount,'10');assert.equal(paid.recipient.uid,'bob');
  res=await fetch(base+'/webhooks/sandbox',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,401);
});

// ── Added after Codex's handover: whitespace around codes, and payouts the
// partner never received (resend once, then an operator decides).
test('a scanned or pasted code may carry a line break around it, never a hidden character inside',async()=>{
  const f=await fixture();const r=await f.pay.createRequest('bob',{asset:'USDT',amount:'4'});
  assert.equal((await f.pay.scan('alice','  '+r.token+'\r\n','https://trending.test')).ok,true);
  assert.equal((await f.pay.scan('alice','https://trending.test/#tpay='+r.token+'\n','https://trending.test')).ok,true);
  const inside=r.token.slice(0,8)+'\u200d'+r.token.slice(8);
  const out=await f.pay.scan('alice',inside,'https://trending.test');assert.equal(out.ok,false);assert.equal(out.code,'tampered');
});
test('a payout the partner never received is sent again once, under the same reference',async()=>{
  const f=await fixture();const orig=f.partners.sandbox.createPayout;let calls=0;
  f.partners.sandbox.createPayout=async o=>{calls++;if(calls===1)throw Error('never arrived');return orig(o);};
  const t=await f.confirm(await f.cross());assert.equal(t.status,'under_review');
  f.advance(6000);await f.pay.tick();
  const after=await f.pay.transfer('alice',t.id);
  assert.equal(calls,2);assert.ok(after.partner.ref);assert.equal(after.status,'processing');
  assert.ok(after.timeline.some(x=>/sent again under the same reference/.test(x.note)));
  f.advance(6000);await f.pay.tick();f.advance(12000);await f.pay.tick();f.advance(20000);await f.pay.tick();
  const done=await f.pay.transfer('alice',t.id);assert.equal(done.status,'completed');
  assert.equal((await f.store.read(u=>u.find('sandbox_payouts',{},{}))).length,1);assert.equal((await f.pay.reconcile()).ok,true);
});
test('after five unconfirmed submissions an operator decides, and can stop it only once the partner confirms none exists',async()=>{
  const f=await fixture();let calls=0;f.partners.sandbox.createPayout=async()=>{calls++;throw Error('down');};
  const t=await f.confirm(await f.cross());
  for(let i=0;i<8;i++){f.advance(6000);await f.pay.tick();}
  assert.equal(calls,5);const held=await f.pay.transfer('alice',t.id);assert.equal(held.status,'under_review');assert.equal(held.canCancel,false);
  assert.equal((await f.pay.me('alice')).balances.USDT.locked,'11.24');
  const stopped=await f.pay.decideReview(t.id,'reject','admin');assert.equal(stopped.status,'failed');
  const me=await f.pay.me('alice');assert.equal(me.balances.USDT.locked,'0');assert.equal(me.balances.USDT.available,'1000');
  assert.equal((await f.pay.reconcile()).ok,true);
});
test('an operator cannot stop a payout the partner did receive; tracking resumes instead',async()=>{
  const f=await fixture();const orig=f.partners.sandbox.createPayout;
  f.partners.sandbox.createPayout=async o=>{await orig(o);throw Error('lost response');};
  const t=await f.confirm(await f.cross());
  const r=await f.pay.decideReview(t.id,'reject','admin');assert.equal(r.status,'processing');assert.ok(r.partner.ref);
  assert.equal((await f.pay.me('alice')).balances.USDT.locked,'11.24');
});
