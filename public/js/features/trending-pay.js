// Trending Pay reads balances, quotes, history and status only from /api/pay.
// No timer or browser-storage record is ever financial evidence.
const TPAY = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const fmtDate = n => new Date(n).toLocaleString();
  const who = r => r?.merchant?.name || r?.displayName || 'Recipient';
  const btn = (a,t,cls='') => `<button type="button" data-action="${a}" class="${cls}">${t}</button>`;
  const input = (id,label,value='',extra='') => `<label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${extra}>`;
  const person = r => `<div class="tp-person"><b>${esc(who(r))}</b><span>${esc(r?.handle ? '@'+r.handle : '')}${r?.payId ? ' · Pay ID '+esc(r.payId) : ''}</span>${r?.xb ? `<span>${esc(r.xb.methodLabel)} · ${esc(r.xb.countryName)} · ${esc(r.xb.label)}</span>` : ''}${r?.merchant ? `<span>${r.merchant.verified ? 'Practice merchant' : 'Business identity not verified'}</span>` : ''}</div>`;
  let S = null, dialog, timer, stream, cameraTimer, scanBusy = false, focusBefore, generation = 0;
  const css = document.createElement('link'); css.rel='stylesheet'; css.href='/css/trending-pay.css?v=tp2'; document.head.appendChild(css);
  async function api(path, body, key) {
    const epoch = generation;
    const headers = typeof window.authHeaders === 'function' ? await window.authHeaders() : {};
    if (body !== undefined) headers['Content-Type']='application/json';
    if (key) headers['Idempotency-Key']=key;
    let r;
    try { r = await fetch('/api/pay'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)}); }
    catch { throw new Error('Connection interrupted. The payment outcome is unknown. Check History or retry this same payment; do not create another one.'); }
    let data; try { data=await r.json(); } catch { throw new Error('The payment service returned an unreadable response. Check History before trying again.'); }
    if (epoch !== generation) throw new Error('Payment view closed.');
    if (!r.ok) { const e=new Error(data.message || 'The payment service is unavailable.'); e.code=data.error; e.status=r.status; throw e; }
    return data;
  }
  /* A payment link can open the app before Firebase has said who is signed
     in; asking too early would show "Sign in" to someone who is. */
  async function authReady(){const t0=Date.now();while(!window.firebaseAuth&&performance.now()<15000&&Date.now()-t0<6000)await new Promise(r=>setTimeout(r,100));
    const a=window.firebaseAuth;if(a&&typeof a.authStateReady==='function'){try{await Promise.race([a.authStateReady(),new Promise(r=>setTimeout(r,5000))]);}catch{}}}
  function stopCamera(){ clearInterval(cameraTimer); cameraTimer=null; stream?.getTracks().forEach(t=>t.stop()); stream=null; }
  function close(){ generation++; clearTimeout(timer); stopCamera(); dialog?.close(); dialog?.remove(); dialog=null; S=null; focusBefore?.focus?.(); }
  function shell(){
    if (dialog) return;
    focusBefore=document.activeElement;
    dialog=document.createElement('dialog'); dialog.className='tpay'; dialog.setAttribute('aria-labelledby','tp-title');
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)act(b.dataset.action,b);});
    dialog.addEventListener('submit',e=>{e.preventDefault();act(e.target.dataset.submit);});
    dialog.addEventListener('change',e=>{if(e.target.id==='tp-country')refreshMethods();if(e.target.id==='tp-file')readImage(e.target.files?.[0]);});
    document.body.appendChild(dialog);dialog.showModal();
  }
  async function open(screen='home',prefill={}) {
    close(); shell(); const epoch=generation;
    S={screen:'loading',me:null,history:[],requests:[],recipients:[],prefill,quote:null,transfer:null,error:'',busy:false}; paint();
    try {
      S.status=await api('/status');
      if(epoch!==generation)return;
      if(!S.status.available)throw new Error('Trending Pay is unavailable on this server. Live payment services have not been connected.');
      await authReady();if(epoch!==generation)return;
      if(!(await window.authHeaders?.())?.Authorization){
        // Scanning a wallet address needs no account, as it never did; paying a Trending Pay code does.
        if(screen==='scan'){S.guest=true;S.screen='scan';paint();if(prefill.payload){S.scanText=prefill.payload;try{await validateScan();}catch(e){showError(e);}}return;}
        S.screen='signin';paint();return;}
      const [me,hist,reqs,corridors,recs]=await Promise.all([api('/me'),api('/transfers'),api('/requests'),api('/corridors'),api('/recipients')]);
      if(epoch!==generation)return;
      Object.assign(S,{me,history:hist.transfers,requests:reqs.requests,corridors,recipients:recs.recipients,screen});
      if(screen==='receive')S.code=me.code;
      paint();
      if(prefill.payload){S.scanText=prefill.payload;await validateScan();}
    }catch(e){if(epoch!==generation)return;S.screen=e.status===401?'signin':'unavailable';S.error=e.message;paint();}
  }
  function navigate(screen){clearTimeout(timer);stopCamera();S.screen=screen;S.error='';if(screen==='receive')S.code=S.me.code;paint();}
  function assets(selected='USDT',limit){return `<select id="tp-asset">${Object.keys(S.me.assets).filter(a=>!limit||limit.includes(a)).map(a=>`<option ${a===selected?'selected':''}>${esc(a)}</option>`).join('')}</select>`;}
  function heading(){return {home:'Your payments',send:'Send money',amount:'Payment details',scan:'Scan & review',review:'Review payment',receive:'Receive money',request:'Request a payment',merchant:'Merchant payments',cross:'Send across borders',recipient:'Add a recipient',history:'Payment history',track:'Track payment',receipt:'Payment receipt',signin:'Sign in to Trending Pay',loading:'Connecting…',unavailable:'Payments unavailable'}[S.screen]||'Trending Pay';}
  function steps(){const at={send:0,scan:0,amount:1,review:2,track:3}[S.screen];if(at===undefined||S.guest)return '';return `<div class="tp-step">${['Recipient','Amount','Review & authenticate','Track'].map((l,i)=>i===at?`<b aria-current="step">${l}</b>`:esc(l)).join(' &nbsp;/&nbsp; ')}</div>`;}
  function historyRows(){return S.history.length?`<div class="tp-list">${S.history.map(t=>`<button data-action="track" data-id="${esc(t.id)}"><span><b>${esc(t.role==='recipient'?who(t.sender):who(t.recipient))}</b><small>${esc(fmtDate(t.createdAt))} · ${esc(t.id)}</small></span><span>${esc(t.send.amount)} ${esc(t.send.asset)}<small>${esc(t.statusLabel)}</small></span></button>`).join('')}</div>`:'<p class="tp-empty">No payments yet. Your payments will appear here once submitted.</p>';}
  function requestRows(){return S.requests.length?`<h3>Your requests</h3><div class="tp-list">${S.requests.map(r=>`<button data-action="show-code" data-id="${esc(r.id)}"><span>${esc(r.amount||'Any amount')} ${esc(r.asset)}<small>${esc(r.note||r.kind)} · ${esc(r.status)}</small></span><span>View</span></button>`).join('')}</div>`:'';}
  function codeView(){const c=S.code;if(!c)return '<p>No code available.</p>';let qr='';try{qr=window.QRGEN.svg(window.QRGEN.make(c.token),230);}catch{}return `<div class="tp-qr">${qr}<h3>${esc(S.me.profile.displayName)}</h3><div>${esc(c.amount||'Choose amount when paying')} ${esc(c.asset||'')}</div><code>${esc(c.token)}</code><small>${c.expiresAt?'Expires '+esc(fmtDate(c.expiresAt)):'Reusable receive code'} · ${esc(c.status)}</small></div><div class="tp-actions">${btn('copy','Copy payment link')}${btn('save-qr','Save QR')}${c.status==='open'&&c.kind!=='code'?btn('cancel-request','Cancel request'):''}</div><p class="tp-muted">The sender must review your identity, amount and fees before confirming. Sharing this code does not move money.</p>`;}
  function amountView(){const r=S.scan?.request;return `${person(S.recipient)}<form data-submit="quote">${input('tp-amount','You send',r?.amount||S.prefill.amount||'','inputmode="decimal" autocomplete="off" class="tp-money" required '+(r?.amount?'readonly':''))}<label for="tp-asset">Asset · Trending Pay balance</label>${r?.asset?`<input id="tp-asset" value="${esc(r.asset)}" readonly>`:assets(S.prefill.asset)}${input('tp-note','Note (optional)',r?.note||S.prefill.note||'','maxlength="80" '+(r?'readonly':''))}<p><small>Your available balances: ${Object.entries(S.me.balances).map(([a,b])=>esc(b.available)+' '+esc(a)).join(' · ')}</small></p><button class="tp-primary tp-wide">Review payment</button></form>`;}
  function reviewView(){const q=S.quote;return `${person(q.recipient)}<small>Payment rail: ${esc(q.railLabel)}</small><div class="tp-card" style="margin-top:16px">${q.lines.map(l=>`<div class="tp-line ${esc(l.key)}"><span>${esc(l.label)}</span><b>${esc(l.value)} ${esc(l.unit||'')}</b></div>${l.note?`<div class="tp-line-note">${esc(l.note)}</div>`:''}`).join('')}</div>${q.rate?.legs?.map(l=>`<p><small>${esc(l.text)} · ${esc(l.source)}</small></p>`).join('')||''}${q.note?`<p>Note: ${esc(q.note)}</p>`:''}${q.orderRef?`<p>Order: ${esc(q.orderRef)}</p>`:''}${q.warnings.map(w=>w.ack?`<label class="tp-notice"><input type="checkbox" data-ack="${esc(w.code)}">${esc(w.text)}</label>`:`<p class="tp-notice">${esc(w.text)}</p>`).join('')}<p><small>Quote expires ${esc(fmtDate(q.expiresAt))}. Authentication is required before payment.</small></p>${btn('confirm',`Authenticate & pay ${esc(q.total)} ${esc(q.send.asset)}`,'tp-primary tp-wide')}${btn('requote','Get a new quote','tp-wide')}`;}
  function trackView(){const t=S.transfer;return `<span class="tp-status">${esc(t.statusLabel)}</span><div class="tp-success">${esc(t.send.amount)} ${esc(t.send.asset)}</div>${person(t.recipient)}<small>${esc(t.id)} · ${esc(fmtDate(t.createdAt))}</small>${t.reason?`<p class="tp-notice">${esc(t.reason)}</p>`:''}${t.action?`<div class="tp-card"><p>${esc(t.action.question)}</p>${t.action.answered?'<p>Answer submitted. Waiting for the partner.</p>':`<div class="tp-actions">${btn('respond-confirm','Confirm recipient')}${btn('respond-cancel','Request cancellation')}</div>`}</div>`:''}<ol class="tp-timeline">${t.timeline.map(x=>`<li><b>${esc(x.label)}</b><small>${esc(fmtDate(x.at))} · ${esc(x.note)}</small></li>`).join('')}</ol><div class="tp-actions">${btn('refresh-transfer','Refresh status')}${btn('receipt','View receipt')}${t.canCancel?btn('cancel-transfer','Cancel during review'):''}${t.canRefund?btn('refund','Refund payment'):''}</div><small>Last verified: ${esc(fmtDate(S.verifiedAt||Date.now()))}. Status is read from Trending’s server.</small>`;}
  function receiptView(){const r=S.receipt;const rows=[['Transaction ID',r.transactionId],['Date / time',fmtDate(r.createdAt)],['Sender',r.sender],['Recipient',r.recipient],['Amount',r.amount],['Exchange rate',r.exchangeRate],...r.fees.map(f=>[f.label,f.value]),['Total',r.total],['Expected recipient amount',r.amountExpected],['Amount received',r.amountReceived||'Not confirmed'],['Status',r.statusLabel],['Payment rail',r.rail]];return `<p class="tp-notice">${esc(r.mode)}</p>${rows.map(([l,v])=>`<div class="tp-line"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}<p><small>${esc(r.receiptNote)}</small></p>${btn('download-receipt','Download receipt','tp-primary tp-wide')}`;}
  function crossView(){return `<p class="tp-notice">Test local-currency payouts through the sandbox partner. Live bank and mobile-wallet payouts are unavailable.</p><form data-submit="cross-quote"><label for="tp-recipient">Recipient</label><select id="tp-recipient" required><option value="">Choose a recipient</option>${S.recipients.map(r=>`<option value="${esc(r._id)}">${esc(r.name)} · ${esc(r.country)} · ${esc(r.label||S.corridors.methods[r.method])}</option>`).join('')}</select>${btn('add-recipient','Add recipient','tp-wide')}${input('tp-amount','You send','','inputmode="decimal" required class="tp-money"')}<label for="tp-asset">Payment balance</label>${assets('USDT',S.corridors.fundingAssets)}<button class="tp-primary tp-wide">See rate & fees</button></form>`;}
  function content(){switch(S.screen){
    case 'loading':return '<p role="status">Reading the payment service…</p>';
    case 'signin':return `<p>Sign in to use your server-held Pay balance, create verified payment requests and track transfers.</p>${btn('signin','Sign in','tp-primary tp-wide')}`;
    case 'unavailable':return `<p>Payments cannot start until the payment service is available.</p>${btn('reload','Try again','tp-primary')}`;
    case 'home':return `<div class="tp-actions">${btn('send','<span class="material-symbols-rounded" aria-hidden="true">north_east</span>Send','tp-primary')}${btn('receive','<span class="material-symbols-rounded" aria-hidden="true">south_west</span>Receive')}${btn('scan','<span class="material-symbols-rounded" aria-hidden="true">qr_code_scanner</span>QR Pay')}${btn('request','<span class="material-symbols-rounded" aria-hidden="true">request_quote</span>Request')}</div><div class="tp-grid">${Object.entries(S.me.balances).map(([a,b])=>`<div class="tp-card"><small>${esc(S.me.assets[a].name)}</small><div class="tp-balance">${esc(b.available)} <small>${esc(a)}</small></div>${b.locked!=='0'?`<small>${esc(b.locked)} reserved</small>`:''}</div>`).join('')}</div><div class="tp-actions">${btn('merchant','<span class="material-symbols-rounded" aria-hidden="true">storefront</span>Merchant Pay')}${btn('cross','<span class="material-symbols-rounded" aria-hidden="true">public</span>Cross-border')}${btn('wallet','<span class="material-symbols-rounded" aria-hidden="true">account_balance_wallet</span>Crypto wallet')}</div><h3>Recent payments</h3>${historyRows()}${btn('history','All payment history','tp-wide')}`;
    case 'send':return `<form data-submit="resolve">${input('tp-to','Recipient @handle or Pay ID',S.prefill.handle||'','autocomplete="off" autocapitalize="none" spellcheck="false" required')}<p><small>We look up the account before you enter an amount.</small></p><button class="tp-primary tp-wide">Find recipient</button></form>${btn('scan','Scan or paste a payment code','tp-wide')}`;
    case 'amount':return amountView();
    case 'scan':return `<p>Scan a Trending Pay QR or paste its link. Scanning only checks the code; payment requires your confirmation.</p><video id="tp-video" playsinline muted hidden></video><div class="tp-actions">${btn('camera','Use camera')}${btn('pick-image','Upload QR image')}</div><input type="file" id="tp-file" accept="image/*" hidden><form data-submit="scan-code"><label for="tp-code">Payment link or signed code</label><textarea id="tp-code" rows="3" required autocomplete="off">${esc(S.scanText||'')}</textarea><button class="tp-primary tp-wide">Validate code</button></form>${S.guest?btn('signin','Sign in to pay Trending Pay codes','tp-wide'):''}`;
    case 'review':return reviewView();
    case 'receive':return codeView();
    case 'request':return `<form data-submit="create-request">${input('tp-amount','Amount (leave blank for sender to choose)',S.prefill.amount||'','inputmode="decimal"')}<label for="tp-asset">Asset</label>${assets(S.prefill.asset)}${input('tp-note','What is it for?',S.prefill.note||'','maxlength="80"')}<label for="tp-hours">Expires in</label><select id="tp-hours"><option value="1">1 hour</option><option value="24" selected>24 hours</option><option value="168">7 days</option></select><button class="tp-primary tp-wide">Create signed request</button></form>${requestRows()}`;
    case 'merchant':return S.me.profile.merchant?`<p>Business: <b>${esc(S.me.profile.merchant.name)}</b></p><form data-submit="create-merchant">${input('tp-amount','Customer pays','','required inputmode="decimal"')}<label for="tp-asset">Asset</label>${assets()}${input('tp-note','Description','','maxlength="80"')}${input('tp-order','Order reference','','maxlength="32"')}<p><small>The full customer charge and merchant fee are shown before payment. Charges expire after 15 minutes.</small></p><button class="tp-primary tp-wide">Create merchant QR</button></form>${requestRows()}`:`<form data-submit="become-merchant">${input('tp-business','Business name','','required minlength="2" maxlength="40"')}<p><small>A business name is self-declared and will not be shown as verified.</small></p><button class="tp-primary tp-wide">Set up practice merchant</button></form>`;
    case 'cross':return crossView();
    case 'recipient':return `<form data-submit="save-recipient">${input('tp-name','Recipient full name','','required maxlength="60"')}<label for="tp-country">Destination country</label><select id="tp-country">${S.corridors.corridors.map(c=>`<option value="${esc(c.country)}">${esc(c.name)} · ${esc(c.currency)}</option>`).join('')}</select><label for="tp-method">Receive by</label><select id="tp-method"></select>${input('tp-label','Label (optional)','','maxlength="30"')}<p><small>Practice recipient only. Do not enter bank account, card or identity numbers.</small></p><button class="tp-primary tp-wide">Save recipient</button></form>`;
    case 'history':return historyRows();case 'track':return trackView();case 'receipt':return receiptView();default:return '';
  }}
  function paint(){if(!S||!dialog)return;dialog.innerHTML=`<header><span class="tp-logo" aria-hidden="true">T</span><h1 id="tp-title">Trending Pay</h1><span class="tp-mode">Practice</span>${btn('close','<span class="material-symbols-rounded" aria-hidden="true">close</span>','tp-icon')}</header><main>${!['home','loading','signin','unavailable'].includes(S.screen)?btn('home','<span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Payments'):''}<h2 style="margin-top:16px">${heading()}</h2>${steps()}${S.screen==='home'?'<p class="tp-notice">Practice balances · no real money moves. Live payment services are not connected.</p>':''}${content()}<div id="tp-error" role="alert" class="${S.error?'tp-error':''}">${esc(S.error)}</div><div class="tp-footer"><span>Practice money · server-verified status</span>${btn('support','Help & support')}</div></main>`;dialog.querySelector('[data-action="close"]').setAttribute('aria-label','Close Trending Pay');if(S.screen==='recipient')refreshMethods();}
  function refreshMethods(){const c=S.corridors.corridors.find(c=>c.country===$('tp-country')?.value);if(c&&$('tp-method'))$('tp-method').innerHTML=c.methods.map(m=>`<option value="${esc(m)}">${esc(S.corridors.methods[m])}</option>`).join('');}
  const value=id=>$(id)?.value?.trim()||'';
  function showError(e){if(!S)return;S.error=e.message||String(e);const el=$('tp-error');if(el){el.className='tp-error';el.textContent=S.error;el.scrollIntoView({block:'nearest'});}}
  async function validateScan(){const text=S.scanText||value('tp-code');
    // A typed 9-digit Pay ID is a person, not a code: look them up as Send does.
    if(S.guest){const p=window.WAD?.parseScan?.(text);if(p&&window.WAD.fromScan){close();window.WAD.fromScan(p,{origin:'chat'});return;}throw new Error('Sign in to pay a Trending Pay code. A wallet address can be scanned without signing in.');}
    const pid=/^\s*(?:TP-?)?(\d{9})\s*$/i.exec(text);if(pid){S.scan=null;S.recipient=(await api('/resolve',{to:pid[1]})).recipient;S.quote=null;S.prefill={};navigate('amount');return;}
    const out=await api('/scan',{payload:text});
    // An on-chain address goes to the wallet send flow, which checks the address,
    // network and look-alikes first - as the scanner always did. Pay never pays one.
    if(!out.ok&&out.code==='wallet_address'){const p=window.WAD?.parseScan?.(text);if(p&&window.WAD.fromScan){close();window.WAD.fromScan(p,{origin:'chat'});return;}}
    if(!out.ok)throw new Error(out.message);S.scan=out;S.recipient=out.recipient;S.quote=null;S.prefill={};navigate('amount');}
  async function makeQuote(body){S.quoteBody=body;S.quote=await api('/quotes',body);S.key=crypto.randomUUID();navigate('review');}
  async function authenticate(){const user=window.firebaseAuth?.currentUser;if(!user)throw new Error('Sign in before paying.');let claims=await user.getIdTokenResult(true);if(Date.now()-Number(claims.claims.auth_time)*1000<240000)return;
    const sdk=await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');const providers=user.providerData.map(p=>p.providerId);
    if(providers.includes('password')){const pw=await window.appPrompt?.('Enter your password to authorize this payment.','',{title:'Confirm it is you',ok:'Authenticate',password:true});if(!pw)throw new Error('Authentication cancelled. No payment submitted.');await sdk.reauthenticateWithCredential(user,sdk.EmailAuthProvider.credential(user.email,pw));}
    else if(providers.includes('google.com'))await sdk.reauthenticateWithPopup(user,new sdk.GoogleAuthProvider());
    else if(providers.includes('apple.com'))await sdk.reauthenticateWithPopup(user,new sdk.OAuthProvider('apple.com'));
    else throw new Error('Sign in again to authorize this payment.');await user.getIdToken(true);
  }
  async function track(id){S.transfer=await api('/transfers/'+encodeURIComponent(id));S.verifiedAt=Date.now();navigate('track');schedulePoll();}
  function schedulePoll(){clearTimeout(timer);const epoch=generation;if(S?.screen!=='track'||['completed','failed','refunded'].includes(S.transfer.status))return;timer=setTimeout(async()=>{try{const t=await api('/transfers/'+encodeURIComponent(S.transfer.id));if(epoch!==generation||S?.screen!=='track')return;S.transfer=t;S.verifiedAt=Date.now();paint();}catch(e){if(epoch===generation)showError(e);}if(epoch===generation)schedulePoll();},4000);}
  function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function decode(source,w,h){const c=document.createElement('canvas');const scale=Math.min(1,1000/w);c.width=Math.round(w*scale);c.height=Math.round(h*scale);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,c.width,c.height);if(window.BarcodeDetector){try{return(await new BarcodeDetector({formats:['qr_code']}).detect(c))[0]?.rawValue;}catch{}}
    if(!window.jsQR)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/jsQR.js';s.onload=resolve;s.onerror=()=>reject(new Error('QR reader unavailable. Paste the signed code instead.'));document.head.appendChild(s);});const img=ctx.getImageData(0,0,c.width,c.height);return window.jsQR(img.data,img.width,img.height)?.data;
  }
  async function readImage(file){if(!file)return;if(file.size>10000000)return showError(new Error('Choose an image under 10 MB.'));try{const bitmap=await createImageBitmap(file);let text;try{text=await decode(bitmap,bitmap.width,bitmap.height);}finally{bitmap.close();}if(!text)throw new Error('No QR code found. Try a clearer image.');if(!S)return;S.scanText=text;await validateScan();}catch(e){showError(e);}}
  async function camera(){if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera unavailable. Upload a QR image or paste the code.');const epoch=generation;stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(epoch!==generation||S?.screen!=='scan'){stopCamera();return;}const v=$('tp-video');v.hidden=false;v.srcObject=stream;await v.play();cameraTimer=setInterval(async()=>{if(scanBusy||v.readyState<2)return;scanBusy=true;try{const text=await decode(v,v.videoWidth,v.videoHeight);if(text&&S?.screen==='scan'){stopCamera();S.scanText=text;await validateScan();}}catch(e){stopCamera();showError(e);}finally{scanBusy=false;}},350);}
  async function act(action,el){if(action==='close')return close();if(!S||S.busy)return;const epoch=generation;S.busy=true;dialog.querySelectorAll('button:not([data-action="close"])').forEach(b=>b.disabled=true);
    try{
      if(action==='home'&&S.guest){S.screen='signin';S.error='';paint();}
      else if(['home','send','receive','scan','request','merchant','cross'].includes(action)){if(action==='home'){S.me=await api('/me');S.history=(await api('/transfers')).transfers;}S.scan=null;S.prefill={};navigate(action);}
      else if(action==='reload')await open();
      else if(action==='signin'){close();window.openAuthModal?.();}
      else if(action==='resolve'){S.recipient=(await api('/resolve',{to:value('tp-to')})).recipient;S.prefill={};S.scan=null;navigate('amount');}
      else if(action==='quote')await makeQuote({to:S.recipient.payId,token:S.scan?.request.token,asset:value('tp-asset'),amount:value('tp-amount'),note:value('tp-note')});
      else if(action==='requote')await makeQuote(S.quoteBody);
      else if(action==='scan-code'){S.scanText=value('tp-code');await validateScan();}
      else if(action==='confirm'){
        const ack={};dialog.querySelectorAll('[data-ack]').forEach(e=>ack[e.dataset.ack]=e.checked);
        if(S.quote.ack.some(a=>!ack[a]))throw new Error('Read and acknowledge the payment warning before continuing.');
        if(Date.now()>=S.quote.expiresAt)throw new Error('This quote expired. Get a new quote and review the price.');
        await authenticate();if(epoch!==generation)return;
        const t=await api('/transfers',{quoteId:S.quote.id,acknowledge:ack},S.key);if(epoch!==generation)return;
        await track(t.id);
      }
      else if(action==='create-request'||action==='create-merchant'){S.code=await api('/requests',{asset:value('tp-asset'),amount:value('tp-amount'),note:value('tp-note'),hours:Number(value('tp-hours')||24),merchant:action==='create-merchant',orderRef:value('tp-order')});S.requests=(await api('/requests')).requests;S.screen='receive';paint();}
      else if(action==='become-merchant'){S.me.profile=(await api('/merchant',{name:value('tp-business')})).profile;navigate('merchant');}
      else if(action==='show-code'){S.code=S.requests.find(r=>r.id===el.dataset.id);S.screen='receive';paint();}
      else if(action==='cancel-request'){S.code=await api('/requests/'+S.code.id+'/cancel',{});S.requests=(await api('/requests')).requests;paint();}
      else if(action==='copy'){await navigator.clipboard.writeText(location.origin+'/#tpay='+S.code.token);el.textContent='Link copied';}
      else if(action==='save-qr'){download('trending-pay-qr.svg',window.QRGEN.svg(window.QRGEN.make(S.code.token),600),'image/svg+xml');}
      else if(action==='add-recipient')navigate('recipient');
      else if(action==='save-recipient'){await api('/recipients',{name:value('tp-name'),country:value('tp-country'),method:value('tp-method'),label:value('tp-label')});S.recipients=(await api('/recipients')).recipients;navigate('cross');}
      else if(action==='cross-quote'){const r=S.recipients.find(r=>r._id===value('tp-recipient'));if(!r)throw new Error('Choose a recipient.');await makeQuote({kind:'xb',recipientId:r._id,corridor:r.country,asset:value('tp-asset'),amount:value('tp-amount')});}
      else if(action==='history'){S.history=(await api('/transfers')).transfers;navigate('history');}
      else if(action==='track')await track(el.dataset.id);
      else if(action==='refresh-transfer')await track(S.transfer.id);
      else if(action==='respond-confirm'||action==='respond-cancel'){await authenticate();await api('/transfers/'+S.transfer.id+'/respond',{answer:action==='respond-confirm'?'confirm':'cancel'},crypto.randomUUID());await track(S.transfer.id);}
      else if(action==='cancel-transfer'||action==='refund'){if(!await window.appConfirm?.(action==='refund'?'Refund this payment in full?':'Cancel this payment during review?',{title:'Confirm',ok:'Confirm'}))return;await authenticate();await api('/transfers/'+S.transfer.id+(action==='refund'?'/refund':'/cancel'),{},crypto.randomUUID());await track(S.transfer.id);}
      else if(action==='receipt'){S.receipt=await api('/transfers/'+S.transfer.id+'/receipt');navigate('receipt');}
      else if(action==='download-receipt')download(S.receipt.transactionId+'-receipt.json',JSON.stringify(S.receipt,null,2),'application/json');
      else if(action==='wallet'){close();window.WD?.open();}
      else if(action==='camera')await camera();else if(action==='pick-image')$('tp-file').click();
      else if(action==='support')showError(new Error('For payment support, open Settings → Help and support. Include '+(S.transfer?.id||'the transaction ID from History')+'. Never share a password, one-time code or recovery phrase.'));
    }catch(e){if(epoch===generation)showError(e);}finally{if(epoch===generation&&S){S.busy=false;dialog?.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  }
  function deepLink(){const h=location.hash;if(!h.startsWith('#tpay=')&&!h.startsWith('#pay?'))return;try{history.replaceState(null,'',location.pathname+location.search);}catch{}open('scan',{payload:location.origin+'/'+h});}
  window.addEventListener('hashchange',deepLink);setTimeout(deepLink,0);
  return {open,close};
})();
window.TPAY=TPAY;
