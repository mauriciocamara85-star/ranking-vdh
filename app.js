const DATA_ENDPOINT='https://script.google.com/macros/s/AKfycbyuS6K8oq2KWJ6BMSayHXHHSf0v2jr70OoSD4UfwX77cD3OobN1OrzFsTTXC6JI9Yo/exec';
const MONTH_ORDER=['Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero'];
const TOP_PUBLIC=15;
const USER_KEY='vdhRankingUser';
const GUEST_KEY='vdhRankingGuest';
const SUPERVISOR_KEY='vdhRankingSupervisor';
// PIN de acceso a Supervisión. Es un portón de UX, no seguridad real: la app es un sitio
// estático sin backend, así que cualquiera que abra el código fuente puede verlo. Para
// cambiarlo, editá este valor y volvé a publicar.
const SUPERVISOR_PIN='1958';
const MAIN_POINTS=[25,18,15,12,10,8,6,4,2,1];
const SPRINT_POINTS=[8,7,6,5,4,3,2,1];
const SPRINT_FIELDS={ticket:'TP',perfumes:'Perfumes',boxer:'Boxer',pxt:'PxT'};
const state={tables:{},local:'all',scope:'home',category:'liga',storeCategory:'constructores',user:null,guest:false,supervisor:false};
const THEME_KEY='vdhRankingTheme';
const $=id=>document.getElementById(id);const qa=sel=>[...document.querySelectorAll(sel)];
function applyTheme(theme){
  const selected=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=selected;
  localStorage.setItem(THEME_KEY,selected);
  qa('.theme-btn').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.themeChoice===selected)));
}

function parseNumber(value){if(typeof value==='number')return Number.isFinite(value)?value:0;if(value===null||value===undefined||value==='')return 0;const text=String(value).trim().replace(/[^\d,.-]/g,'');if(!text)return 0;const normalized=text.includes(',')?text.replace(/\./g,'').replace(',','.'):text.replace(/\./g,'');const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:0}
const cleanKey=value=>String(value??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function fieldValue(row,key){if(!row)return undefined;const entries=Object.entries(row);const exact=entries.find(([name,value])=>name===key&&value!==''&&value!==null&&value!==undefined);if(exact)return exact[1];const normalized=cleanKey(key);const match=entries.find(([name,value])=>cleanKey(name)===normalized&&value!==''&&value!==null&&value!==undefined);return match?match[1]:undefined}
const num=(row,key)=>parseNumber(fieldValue(row,key));
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(parseNumber(value));
// Versión compacta ($4,3M) para el "real / objetivo" de las tarjetas de Locales — con los dos
// montos completos ("$4.260.000 / $3.721.860", 24 caracteres) el renglón se cortaba contra el
// borde en un teléfono angosto (390px), confirmado con dump-dom antes de aplicar este fix.
function moneyShort(value){
  const n=parseNumber(value),abs=Math.abs(n),sign=n<0?'-':'';
  if(abs>=1e6)return`${sign}$${(abs/1e6).toFixed(1).replace('.0','').replace('.',',')}M`;
  if(abs>=1e3)return`${sign}$${(abs/1e3).toFixed(0)}K`;
  return money(n);
}
const number=value=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(parseNumber(value));
const decimal=value=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(parseNumber(value));
const percent=value=>`${parseNumber(value).toFixed(1).replace('.',',')}%`;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function normalizeLocalName(value){const text=String(value??'').trim();return text?text.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()):text}
function normalizeLocalNames(tables){Object.keys(tables).forEach(name=>{(tables[name]||[]).forEach(row=>{if(row&&typeof row==='object'&&'Local'in row)row.Local=normalizeLocalName(row.Local)})})}
// Normaliza Mes/Semana antes de armar la clave de semana: un espacio de más en la celda del
// Sheet (ej. "Septiembre " en vez de "Septiembre") rompía la comparación por igualdad estricta
// de strings y hacía que esa semana quedara silenciosamente afuera de "el mes actual" en el
// Campeonato — no tiraba error, simplemente sumaba de menos.
function weekKeyOf(row){return `${String(row?.Mes??'').trim()}|${String(row?.Semana??'').trim()}`}
function weekKeyOrder(key){const [mes,semana]=key.split('|');return MONTH_ORDER.indexOf(mes)*10+Number(semana)}
// SVG + clase de tono en vez de 🥇🥈🥉 — un solo helper compartido por rankRow/famaPodiumCard/
// famaStoreCard, así que el fix se propaga solo a las 3 sin tocarlas una por una.
function medalFor(i){if(i>2)return'';const tier=i===0?'gold':i===1?'silver':'bronze';return icon('medal',`svg-icon medal-${tier}`)}
function rankRowClass(i){return i===0?'top1':i===1?'top2':i===2?'top3':''}
function capForDisplay(list){return state.supervisor?list:list.slice(0,TOP_PUBLIC)}

// Iconos SVG (estilo Lucide) para el barrido total de emojis de esta vuelta. "store"/"award" ya
// venían de la vuelta anterior; "users"/"shieldAlert" son EXACTAMENTE los mismos paths que el
// drawer ya usa a mano para "Vendedores"/"Sanciones y Criterios" — se centralizan acá para poder
// reusarlos también en bottom-nav/reglas sin mantener 2 copias del mismo dibujo.
const ICONS={
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  store:'<path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M4 9v10h16V9"/><path d="M9 21v-6h6v6"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  menu:'<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  banknote:'<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  scale:'<path d="M16 16h6"/><path d="M2 16h6"/><path d="M12 2v4"/><path d="M4 6h16"/><path d="m8 6 4 12 4-12"/><path d="M2 16c0 2 1.5 3 3 3s3-1 3-3-1.5-4-3-4-3 2-3 4Z"/><path d="M16 16c0 2 1.5 3 3 3s3-1 3-3-1.5-4-3-4-3 2-3 4Z"/>',
  clipboardList:'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  shieldAlert:'<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  medal:'<circle cx="12" cy="15" r="6"/><path d="M9 10.5 6 3h4l2 5"/><path d="M15 10.5 18 3h-4l-2 5"/>',
  crown:'<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z"/><path d="M5 20h14"/>',
  sparkles:'<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
  shirt:'<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  rocket:'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'
};
function icon(name,cls){return`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`}

/* ── IDENTIDAD DE VENDEDOR (localStorage, sin usuario ni clave) ─ */
function loadUser(){try{const raw=localStorage.getItem(USER_KEY);const parsed=raw?JSON.parse(raw):null;return(parsed&&parsed.local&&parsed.vendedor)?parsed:null}catch{return null}}
function saveUser(user){try{localStorage.setItem(USER_KEY,JSON.stringify(user));localStorage.removeItem(GUEST_KEY)}catch{}}
function saveGuest(){try{localStorage.setItem(GUEST_KEY,'1')}catch{}}
function isGuest(){try{return localStorage.getItem(GUEST_KEY)==='1'}catch{return false}}
state.user=loadUser();
state.guest=!state.user&&isGuest();

function allLocals(){return[...new Set((state.tables.VENDEDOR_SEMANAL||[]).map(r=>r.Local).filter(Boolean))].sort()}
function vendorsForLocal(local){return[...new Set((state.tables.VENDEDOR_SEMANAL||[]).filter(r=>r.Local===local).map(r=>r.Vendedor).filter(Boolean))].sort()}

function renderIdentityChip(){
  const chip=$('identityChip');
  if(state.user){
    $('identityText').textContent=`${state.user.vendedor} · ${state.user.local}`;
    chip.classList.add('identified');
  }else{
    $('identityText').textContent='Identificarme';
    chip.classList.remove('identified');
  }
}

function openIdentityModal(mode){
  const modal=$('identityModal');
  modal.dataset.mode=mode;
  $('identityClose').hidden=mode!=='change';
  const localSelect=$('identityLocal'),vendorSelect=$('identityVendor');
  const locals=allLocals();
  localSelect.innerHTML=`<option value="">Elegí tu local…</option>${locals.map(l=>`<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('')}`;
  const presetLocal=state.user?state.user.local:'';
  localSelect.value=locals.includes(presetLocal)?presetLocal:'';
  fillIdentityVendors();
  if(state.user&&locals.includes(presetLocal)){
    const vendors=vendorsForLocal(presetLocal);
    vendorSelect.value=vendors.includes(state.user.vendedor)?state.user.vendedor:'';
  }
  updateIdentityConfirm();
  modal.hidden=false;
}
function closeIdentityModal(){$('identityModal').hidden=true}
function fillIdentityVendors(){
  const local=$('identityLocal').value;
  const vendorSelect=$('identityVendor');
  if(!local){
    vendorSelect.innerHTML='<option value="">Elegí primero tu local…</option>';
    vendorSelect.disabled=true;
    return;
  }
  const vendors=vendorsForLocal(local);
  vendorSelect.innerHTML=`<option value="">Elegí tu nombre…</option>${vendors.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}`;
  vendorSelect.disabled=false;
}
function updateIdentityConfirm(){
  $('identityConfirm').disabled=!($('identityLocal').value&&$('identityVendor').value);
}

$('identityChip').addEventListener('click',()=>openIdentityModal(state.user?'change':'onboard'));
$('identityClose').addEventListener('click',closeIdentityModal);
$('identityLocal').addEventListener('change',()=>{fillIdentityVendors();updateIdentityConfirm()});
$('identityVendor').addEventListener('change',updateIdentityConfirm);
$('identityConfirm').addEventListener('click',()=>{
  const local=$('identityLocal').value,vendedor=$('identityVendor').value;
  if(!local||!vendedor)return;
  state.user={local,vendedor};
  state.guest=false;
  saveUser(state.user);
  renderIdentityChip();
  closeIdentityModal();
  render();
});
$('identitySkip').addEventListener('click',()=>{
  state.guest=true;
  saveGuest();
  closeIdentityModal();
});
$('privateChangeBtn').addEventListener('click',()=>openIdentityModal('change'));

function maybeShowIdentityOnboarding(){
  if(!state.user&&!state.guest)openIdentityModal('onboard');
}

/* ── MODO SUPERVISIÓN (PIN de acceso, sin recorte de Top 15) ─── */
function loadSupervisor(){try{return sessionStorage.getItem(SUPERVISOR_KEY)==='1'}catch{return false}}
function setSupervisorFlag(v){try{if(v)sessionStorage.setItem(SUPERVISOR_KEY,'1');else sessionStorage.removeItem(SUPERVISOR_KEY)}catch{}}
state.supervisor=loadSupervisor();

function renderSupervisorChip(){
  const chip=$('supervisorChip');
  chip.classList.toggle('active',state.supervisor);
  $('supervisorText').textContent=state.supervisor?'Supervisión ON':'Supervisión';
  $('supervisorBadge').hidden=!state.supervisor;
}
$('supervisorChip').addEventListener('click',()=>{
  if(state.supervisor){
    state.supervisor=false;
    setSupervisorFlag(false);
    renderSupervisorChip();
    render();
  }else{
    $('pinInput').value='';
    $('pinError').hidden=true;
    $('pinModal').hidden=false;
    $('pinInput').focus();
  }
});
$('pinCancel').addEventListener('click',()=>{$('pinModal').hidden=true});
$('pinConfirm').addEventListener('click',()=>{
  if($('pinInput').value===SUPERVISOR_PIN){
    state.supervisor=true;
    setSupervisorFlag(true);
    $('pinModal').hidden=true;
    renderSupervisorChip();
    render();
  }else{
    $('pinError').hidden=false;
    $('pinInput').value='';
    $('pinInput').focus();
  }
});
$('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('pinConfirm').click()});
$('supervisorExit').addEventListener('click',()=>{
  state.supervisor=false;
  setSupervisorFlag(false);
  renderSupervisorChip();
  render();
});

/* ── CATEGORÍAS DE PRODUCTO (ranking por % de cumplimiento) ──── */
const RANK_CATEGORIES={
  liga:{label:'Liga',field:null,fmt:money,heading:'Cumplimiento del objetivo',progressLabel:'del objetivo semanal alcanzado'},
  ticket:{label:'Ticket',field:'TP',fmt:money,heading:'Ticket promedio'},
  perfumes:{label:'Perfumes',field:'Perfumes',fmt:number,unit:'u',heading:'Perfumes vendidos'},
  boxer:{label:'Boxer',field:'Boxer',fmt:number,unit:'u',heading:'Boxers vendidos'},
  pxt:{label:'PxT',field:'PxT',fmt:decimal,heading:'Prendas por ticket'}
};

// Sub-pills de "Locales" — Copa Constructores ordena por % de cumplimiento crudo de la semana
// (la pregunta "quién va ganando"); Sprint Semanal ordena por mejora vs. la semana anterior (la
// pregunta "quién viene subiendo más rápido", ya existía como única vista de Locales antes de
// esta vuelta). Ticket/PxT/Perfumes/Bóxer reusan el mismo campo real/obj que ya usan los Sprints
// de vendedores, agregado por local en vez de por persona.
// fmt define cómo se lee "real / objetivo" en la tarjeta — Perfumes/Bóxer son UNIDADES (8 / 3, no
// $8 / $3), PxT es un promedio decimal sin signo — solo Venta/Ticket son montos en $. Sin esto se
// mostraba "$8 / $3" en Perfumes, un bug real encontrado al verificar con captura.
const STORE_CATEGORIES={
  // sort:'puntos' es un caso aparte (ver renderStores/renderStorePoints): no agrega real/obj por
  // Local como las demás — suma los puntos GP VDH que ya sacó cada vendedor del local ese mes.
  // kicker es texto propio (no cfg.label.toUpperCase()) — antes el kicker repetía el título de
  // abajo tal cual, ahora describe la métrica en vez del nombre de la pestaña.
  constructores:{label:'Copa Constructores',field:null,sort:'puntos',fmt:moneyShort,kicker:'RANKING POR LOCAL'},
  sprint:{label:'Sprint Semanal',field:null,sort:'mejora',fmt:moneyShort,kicker:'RANKING SEMANAL'},
  ticket:{label:'Ticket Promedio',field:'TP',sort:'ratio',fmt:moneyShort,kicker:'PROMEDIO POR VENTA'},
  pxt:{label:'PxT',field:'PxT',sort:'ratio',fmt:decimal,kicker:'PRENDAS POR TICKET'},
  perfumes:{label:'Perfumes',field:'Perfumes',sort:'ratio',fmt:number,unit:'u',kicker:'VENTA CRUZADA'},
  boxer:{label:'Bóxer',field:'Boxer',sort:'ratio',fmt:number,unit:'u',kicker:'VENTA CRUZADA'}
};

function allWeekKeys(){
  const rows=state.tables.VENDEDOR_SEMANAL||[];
  return[...new Set(rows.map(weekKeyOf))].sort((a,b)=>weekKeyOrder(a)-weekKeyOrder(b));
}
function weekRows(weekKey){return(state.tables.VENDEDOR_SEMANAL||[]).filter(r=>weekKeyOf(r)===weekKey)}
// Empates: si dos personas quedan exactamente igual en % de cumplimiento, la posición (y por lo
// tanto los puntos F1/Sprint que reparte esa posición) se define por mayor venta/unidad absoluta
// real y, si también empatan ahí, alfabético — determinístico siempre, nunca "quien cargó primero
// en la planilla" (que es lo que pasaba antes, porque Array.sort es estable pero el orden de
// origen no tiene ningún criterio de negocio detrás).
function ratioStandings(weekKey,field){
  const realKey=field?`${field} real`:'Venta real',objKey=field?`${field} obj`:'Venta obj';
  const list=weekRows(weekKey).map(row=>{
    const real=num(row,realKey),obj=num(row,objKey);
    return{local:row.Local,name:row.Vendedor,real,obj,ratio:obj?real/obj*100:null};
  }).filter(p=>p.ratio!==null);
  list.sort((a,b)=>(b.ratio-a.ratio)||(b.real-a.real)||String(a.name).localeCompare(String(b.name),'es'));
  return list;
}

async function loadData(spinning){
  const btn=$('refreshBtn');
  if(spinning)btn.classList.add('spin');
  // Timeout explícito: el Apps Script puede tardar por cold start o red lenta. Sin esto, un
  // fetch colgado deja "Cargando…" en pantalla indefinidamente sin ningún mensaje de error.
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(DATA_ENDPOINT,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    state.tables=Array.isArray(data)?{LOCAL_DIARIO:data}:{...data};
    normalizeLocalNames(state.tables);
    fillLocalFilter();
    renderIdentityChip();
    renderSupervisorChip();
    render();
    maybeShowIdentityOnboarding();
    const stamp=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
    $('updatedLabel').textContent=`Actualizado ${stamp}`;
  }catch(error){
    const timedOut=error.name==='AbortError';
    $('updatedLabel').textContent='Sin conexión con el consolidado';
    $('rankList').innerHTML=`<div class="state-msg"><strong>No se pudo cargar</strong>${escapeHtml(timedOut?'El consolidador tardó demasiado en responder (más de 20s). Probá actualizar de nuevo.':error.message)}</div>`;
  }finally{
    clearTimeout(timeoutId);
    btn.classList.remove('spin');
  }
}
function fillLocalFilter(){
  const locals=allLocals();
  const previous=$('localFilter').value;
  $('localFilter').innerHTML=`<option value="all">Todos los locales</option>${locals.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}`;
  $('localFilter').value=locals.includes(previous)?previous:'all';
  state.local=$('localFilter').value;
}

// nameSuffixHtml (ej. el trofeo del líder de Locales) va SIN escapar, a propósito, pegado
// después del nombre ya escapado — antes iba concatenado adentro de "name" y escapeHtml() lo
// convertía en texto crudo ("<svg class=..."), en vez de renderizar el ícono.
function rankRow(i,name,local,valueHtml,subHtml,extraHtml,nameSuffixHtml){
  return `<div class="rank-row ${rankRowClass(i)}"><div class="rank-medal-pos">${medalFor(i)||(i+1)}</div><div class="rank-info"><div class="rank-name">${escapeHtml(name)}${nameSuffixHtml||''}</div>${local?`<div class="rank-local">${escapeHtml(local)}</div>`:''}${extraHtml?`<div class="rank-extra">${extraHtml}</div>`:''}</div><div class="rank-metric"><div class="rank-value">${valueHtml}</div><div class="rank-sub">${subHtml}</div></div></div>`;
}

function render(){
  qa('#scopeTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.scope===state.scope));
  // Bottom-nav mobile: solo 3 de los 4 scopes tienen botón propio (home/stores/sellers) — "reglas"
  // y "fama" se llega por el drawer, así que ninguno de los 3 botones queda marcado activo ahí
  // (no hay dónde resaltarlos sin inventar un 5º botón que el pedido no pidió).
  qa('.bottom-nav-item[data-scope]').forEach(btn=>btn.classList.toggle('active',btn.dataset.scope===state.scope));
  $('reglasPanel').hidden=state.scope!=='reglas';
  if(state.scope==='reglas'){
    $('catTabs').hidden=true;
    $('storeCatTabs').hidden=true;
    $('rankHeader').hidden=true;
    $('rankList').hidden=true;
    $('privateCard').hidden=true;
    document.body.classList.remove('has-private-card');
    return;
  }
  $('rankHeader').hidden=false;
  $('rankList').hidden=false;
  $('catTabs').hidden=state.scope!=='sellers';
  $('storeCatTabs').hidden=state.scope!=='stores';
  // Salón de la Fama e Inicio son vistas fijas/consolidadas de toda la empresa — el selector de
  // Local no aplica a ninguna de las dos, se oculta igual que ya se ocultaba para Fama.
  $('localFilter').hidden=state.scope==='fama'||state.scope==='home';
  if(state.scope==='home'){renderHome();return}
  if(state.scope==='fama'){renderFama();return}
  if(state.scope==='stores'){renderStores();return}
  qa('#catTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===state.category));
  if(state.category==='campeonato'){$('rankKicker').textContent='ACUMULADO DEL MES';$('rankHeading').textContent='Campeonato del mes';renderChampionship();return}
  if(state.category==='mejora'){$('rankKicker').textContent='VS. SEMANA ANTERIOR';$('rankHeading').textContent='Todos los vendedores';renderSellersMejora();return}
  const cfg=RANK_CATEGORIES[state.category];
  $('rankKicker').textContent=state.category==='liga'?'OBJETIVO SEMANAL':'SPRINT SEMANAL';
  $('rankHeading').textContent=cfg.heading;
  renderSellersCategory(state.category);
}

/* ── CAMPEONATO MENSUAL (puntos estilo F1: carrera principal + sprints) ─ */
function currentMonth(){const weeks=allWeekKeys();return weeks.length?weeks[weeks.length-1].split('|')[0]:null}
function weeksOfMonth(month){return allWeekKeys().filter(k=>k.split('|')[0]===month)}
function buildChampionship(){
  const month=currentMonth();
  if(!month)return{list:[],month:null,weeks:[]};
  const weeks=weeksOfMonth(month);
  const totals={};
  const ensure=(local,name)=>{const key=`${local}|${name}`;if(!totals[key])totals[key]={local,name,main:0,sprint:0,breakdown:{ticket:0,perfumes:0,boxer:0,pxt:0}};return totals[key]};
  weeks.forEach(weekKey=>{
    ratioStandings(weekKey,null).slice(0,10).forEach((p,i)=>{ensure(p.local,p.name).main+=MAIN_POINTS[i]});
    Object.entries(SPRINT_FIELDS).forEach(([cat,field])=>{
      ratioStandings(weekKey,field).slice(0,8).forEach((p,i)=>{
        const e=ensure(p.local,p.name);
        e.sprint+=SPRINT_POINTS[i];
        e.breakdown[cat]+=SPRINT_POINTS[i];
      });
    });
  });
  const list=Object.values(totals).map(e=>({...e,total:e.main+e.sprint}));
  list.sort((a,b)=>(b.total-a.total)||(b.main-a.main)||String(a.name).localeCompare(String(b.name),'es'));
  return{list,month,weeks};
}
// Copa Constructores = versión F1 de "Constructores": la suma de los puntos GP VDH (Carrera
// Principal + Sprints) de TODOS los vendedores de un local, mismo mes. Reusa buildChampionship()
// (ya calculado por vendedor) en vez de recalcular puntos de cero — agrega ese mismo resultado por
// Local. Coincide con el Reglamento ("quita de los puntos aportados al local en la Copa de
// Constructores"), que ya asumía este sistema aunque todavía no estuviera implementado acá.
function buildStorePointsList(){
  const{list:sellerList,month,weeks}=buildChampionship();
  if(!month)return{list:[],month:null,weeks:[]};
  const totals={};
  const ensure=local=>{if(!totals[local])totals[local]={local,main:0,sprint:0,total:0,breakdown:{ticket:0,perfumes:0,boxer:0,pxt:0}};return totals[local]};
  sellerList.forEach(p=>{
    const e=ensure(p.local);
    e.main+=p.main;e.sprint+=p.sprint;e.total+=p.total;
    e.breakdown.ticket+=p.breakdown.ticket;e.breakdown.perfumes+=p.breakdown.perfumes;e.breakdown.boxer+=p.breakdown.boxer;e.breakdown.pxt+=p.breakdown.pxt;
  });
  const list=Object.values(totals);
  list.sort((a,b)=>(b.total-a.total)||(b.main-a.main)||String(a.local).localeCompare(String(b.local),'es'));
  return{list,month,weeks};
}
function renderChampionship(){
  const{list,month,weeks}=buildChampionship();
  if(!month){showEmpty('Sin fecha cargada todavía.');return}
  $('rankPeriod').textContent=`${month} · ${weeks.length} fecha${weeks.length===1?'':'s'} corrida${weeks.length===1?'':'s'}`;
  if(!list.length){showEmpty('Sin puntos cargados este mes todavía.');return}

  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const value=`<span class="rank-value-main">${number(p.total)} pts</span>`;
    const b=p.breakdown;
    const sub=state.supervisor
      ?`Principal ${p.main} · Sprints: Tk ${b.ticket} · Pf ${b.perfumes} · Bx ${b.boxer} · PxT ${b.pxt}`
      :`Principal ${p.main} pts · Sprints ${p.sprint} pts`;
    return rankRow(i,p.name,p.local,value,sub);
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local&&p.name===state.user.vendedor,
    progressText:p=>`${number(p.total)} pts acumulados este mes`,
    leaderText:'¡Vas primero en el Gran Premio del mes!',
    microText:(p,above)=>{
      const gap=above.total-p.total;
      return gap>0?`Estás a ${number(gap)} pts de subir al puesto`:'Estás empatado con el puesto';
    }
  });
}

/* ── MEJORA SEMANAL (vendedores) ───────────────────────────── */
// Parametrizada por semana (no siempre "la última cargada") para poder reusarla desde el Salón de
// la Fama, que mira "Mayor Aceleración" de la semana YA CERRADA contra la anterior a esa — no la
// semana en curso, que es lo que usa la pestaña normal de Mejora vía buildMejoraList() más abajo.
function buildMejoraListFor(currentKey,prevKey){
  const rows=state.tables.VENDEDOR_SEMANAL||[];
  const byPerson={};
  rows.forEach(row=>{
    const key=`${row.Local}|${row.Vendedor}`,weekKey=weekKeyOf(row);
    if(!byPerson[key])byPerson[key]={local:row.Local,name:row.Vendedor};
    if(weekKey===currentKey)byPerson[key].actual=row;
    if(prevKey&&weekKey===prevKey)byPerson[key].previo=row;
  });
  const ratioOf=row=>{if(!row)return null;const target=num(row,'Venta obj');return target?num(row,'Venta real')/target*100:null};
  const list=Object.values(byPerson).filter(p=>p.actual).map(p=>{
    const actualRatio=ratioOf(p.actual),prevRatio=p.previo?ratioOf(p.previo):null;
    const mejora=(actualRatio!==null&&prevRatio!==null)?actualRatio-prevRatio:null;
    return{...p,actualRatio,prevRatio,mejora};
  });
  list.sort((a,b)=>{
    if(a.mejora!==null&&b.mejora!==null){if(b.mejora!==a.mejora)return b.mejora-a.mejora}
    else if(a.mejora!==null)return -1;
    else if(b.mejora!==null)return 1;
    const ar=a.actualRatio??-Infinity,br=b.actualRatio??-Infinity;
    if(br!==ar)return br-ar;
    return String(a.name).localeCompare(String(b.name),'es');
  });
  return list;
}
function buildMejoraList(){
  const weekKeys=allWeekKeys();
  if(!weekKeys.length)return{list:[],currentKey:null};
  const currentKey=weekKeys[weekKeys.length-1],prevKey=weekKeys.length>1?weekKeys[weekKeys.length-2]:null;
  return{list:buildMejoraListFor(currentKey,prevKey),currentKey};
}
function renderSellersMejora(){
  const{list,currentKey}=buildMejoraList();
  if(!currentKey){showEmpty('Sin fecha cargada todavía.');return}
  const[mes,semana]=currentKey.split('|');
  $('rankPeriod').textContent=`Fecha ${semana} de ${mes}`;
  if(!list.length){showEmpty('Sin vendedores para este filtro.');return}

  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const trend=p.mejora===null?'':p.mejora>0?' <span class="trend positive">▲</span>':p.mejora<0?' <span class="trend negative">▼</span>':' <span class="trend">■</span>';
    const value=p.mejora!==null?`<span class="${p.mejora>=0?'positive':'negative'}">${p.mejora>=0?'+':''}${p.mejora.toFixed(1)} pts</span>${trend}`:'<span style="color:var(--muted)">1ª semana</span>';
    const sub=p.actualRatio!==null?`${percent(p.actualRatio)} esta semana`:'sin objetivo';
    return rankRow(i,p.name,p.local,value,sub);
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local&&p.name===state.user.vendedor,
    progressText:p=>p.actualRatio!==null?`${percent(p.actualRatio)} del objetivo semanal alcanzado`:'Sin objetivo cargado',
    microText:(p,above)=>{
      if(p.mejora===null||above.mejora===null)return null;
      const gap=above.mejora-p.mejora;
      return`Estás a ${gap.toFixed(1)} pts de mejora de subir al puesto`;
    }
  });
}

/* ── CATEGORÍAS DE PRODUCTO (ticket/perfumes/boxer/pxt) ──────── */
function buildCategoryList(category){
  const cfg=RANK_CATEGORIES[category];
  const weekKeys=allWeekKeys();
  if(!weekKeys.length)return{list:[],currentKey:null,cfg};
  const currentKey=weekKeys[weekKeys.length-1];
  const list=ratioStandings(currentKey,cfg.field);
  return{list,currentKey,cfg};
}
function formatCategoryValue(cfg,p){
  const unit=cfg.unit?` ${cfg.unit}`:'';
  return`<span class="rank-value-main">${percent(p.ratio)}</span> <span class="rank-value-ctx">(${cfg.fmt(p.real)}/${cfg.fmt(p.obj)}${unit})</span>`;
}
function renderSellersCategory(category){
  const{list,currentKey,cfg}=buildCategoryList(category);
  if(!currentKey){showEmpty('Sin fecha cargada todavía.');return}
  const[mes,semana]=currentKey.split('|');
  $('rankPeriod').textContent=`Fecha ${semana} de ${mes}`;
  if(!list.length){showEmpty('Sin datos para este filtro.');return}

  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  const isSprint=category!=='liga';
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const badge=isSprint&&i<SPRINT_POINTS.length?`<span class="sprint-badge">+${SPRINT_POINTS[i]} pts GP</span>`:'';
    return rankRow(i,p.name,p.local,formatCategoryValue(cfg,p),badge);
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local&&p.name===state.user.vendedor,
    progressText:p=>`${percent(p.ratio)} ${cfg.progressLabel||`del objetivo de ${cfg.label.toLowerCase()} alcanzado`}`,
    microText:(p,above)=>{
      const pts=above.ratio-p.ratio;
      const absGap=above.real-p.real;
      const unit=cfg.unit?` ${cfg.unit}`:'';
      const absText=absGap>0?`${cfg.unit?Math.max(1,Math.ceil(absGap)):cfg.fmt(absGap)}${cfg.unit?unit:''}`:null;
      return absText
        ?`Estás a ${absText} (+${pts.toFixed(1)}%) de subir al puesto`
        :`Estás a +${pts.toFixed(1)}% de subir al puesto`;
    }
  });
}

/* ── LOCALES · COPA DE CONSTRUCTORES (+ sub-pills por categoría) ─ */
// Cuántos vendedores distintos cargaron datos ese local esa semana — "vendedores activos" de la
// tarjeta de cada local (punto 1 del pedido).
function activeVendorsByLocal(weekKey){
  const sets={};
  weekRows(weekKey).forEach(row=>{
    const local=row.Local||'Sin local';
    if(!sets[local])sets[local]=new Set();
    if(row.Vendedor)sets[local].add(row.Vendedor);
  });
  return Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.size]));
}
// Generaliza "Venta real/obj por local" a cualquier par real/obj (Venta, o cualquiera de los 4
// campos Sprint) — una sola función para Copa Constructores, Sprint Semanal y las 4 sub-pills de
// producto, en vez de un cálculo aparte por pill.
function buildStoreCategoryList(field){
  const weekKeys=allWeekKeys();
  if(!weekKeys.length)return{list:[],currentKey:null,prevKey:null};
  const currentKey=weekKeys[weekKeys.length-1],prevKey=weekKeys.length>1?weekKeys[weekKeys.length-2]:null;
  const realKey=field?`${field} real`:'Venta real',objKey=field?`${field} obj`:'Venta obj';
  const aggregateByLocal=weekKey=>{
    const groups={};
    weekRows(weekKey).forEach(row=>{
      const local=row.Local||'Sin local';
      if(!groups[local])groups[local]={real:0,obj:0};
      groups[local].real+=num(row,realKey);
      groups[local].obj+=num(row,objKey);
    });
    return groups;
  };
  const currentAgg=aggregateByLocal(currentKey),prevAgg=prevKey?aggregateByLocal(prevKey):{};
  const vendorCounts=activeVendorsByLocal(currentKey);
  const list=Object.keys(currentAgg).map(local=>{
    const cur=currentAgg[local],ratio=cur.obj?cur.real/cur.obj*100:null;
    const prev=prevAgg[local],prevRatio=prev&&prev.obj?prev.real/prev.obj*100:null;
    const mejora=(ratio!==null&&prevRatio!==null)?ratio-prevRatio:null;
    return{local,real:cur.real,obj:cur.obj,ratio,mejora,vendorCount:vendorCounts[local]||0};
  });
  return{list,currentKey,prevKey};
}
function sortStoreList(list,mode){
  const arr=[...list];
  if(mode==='mejora'){
    arr.sort((a,b)=>{
      if(a.mejora!==null&&b.mejora!==null){if(b.mejora!==a.mejora)return b.mejora-a.mejora}
      else if(a.mejora!==null)return -1;
      else if(b.mejora!==null)return 1;
      const ar=a.ratio??-Infinity,br=b.ratio??-Infinity;
      if(br!==ar)return br-ar;
      return String(a.local).localeCompare(String(b.local),'es');
    });
  }else{
    arr.sort((a,b)=>{
      const ar=a.ratio??-Infinity,br=b.ratio??-Infinity;
      if(br!==ar)return br-ar;
      if((b.real||0)!==(a.real||0))return(b.real||0)-(a.real||0);
      return String(a.local).localeCompare(String(b.local),'es');
    });
  }
  return arr;
}
function renderStores(){
  const cfg=STORE_CATEGORIES[state.storeCategory]||STORE_CATEGORIES.constructores;
  qa('#storeCatTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.storeCategory===state.storeCategory));
  $('rankKicker').textContent=cfg.kicker;
  $('rankHeading').textContent=cfg.label;
  if(cfg.sort==='puntos'){renderStorePoints();return}
  const{list:rawList,currentKey}=buildStoreCategoryList(cfg.field);
  if(!currentKey){showEmpty('Sin semana cargada todavía.');return}
  const[mes,semana]=currentKey.split('|');
  $('rankPeriod').textContent=`Semana ${semana} de ${mes}`;
  if(!rawList.length){showEmpty('Sin locales para este filtro.');return}

  const list=sortStoreList(rawList,cfg.sort);
  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const trophy=i===0?` ${icon('trophy','svg-icon trophy-icon')}`:'';
    let value;
    if(cfg.sort==='mejora'){
      const trend=p.mejora===null?'':p.mejora>0?' <span class="trend positive">▲</span>':p.mejora<0?' <span class="trend negative">▼</span>':' <span class="trend">■</span>';
      value=p.mejora!==null?`<span class="${p.mejora>=0?'positive':'negative'}">${p.mejora>=0?'+':''}${p.mejora.toFixed(1)} pts</span>${trend}`:'<span style="color:var(--muted)">1ª semana</span>';
    }else{
      value=p.ratio!==null?`<span class="rank-value-main">${percent(p.ratio)}</span>`:'<span style="color:var(--muted)">Sin objetivo</span>';
    }
    const unit=cfg.unit?` ${cfg.unit}`:'';
    const sub=p.ratio!==null?`${cfg.fmt(p.real)}${unit} / ${cfg.fmt(p.obj)}${unit}`:`${cfg.fmt(p.real)}${unit}`;
    const extraHtml=`${p.vendorCount} vendedor${p.vendorCount===1?'':'es'} activo${p.vendorCount===1?'':'s'}`;
    return rankRow(i,p.local,'',value,sub,extraHtml,trophy);
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local,
    nameOf:p=>p.local,
    progressText:p=>p.ratio!==null?`${percent(p.ratio)} del objetivo semanal del local`:'Sin objetivo cargado',
    microText:(p,above)=>{
      if(p.ratio===null||above.ratio===null)return null;
      const pts=above.ratio-p.ratio;
      const absGap=above.real-p.real;
      return absGap>0?`Estás a ${money(absGap)} (+${pts.toFixed(1)}%) de subir al puesto`:`Estás a +${pts.toFixed(1)}% de subir al puesto`;
    }
  });
}
// Copa Constructores (puntos) — mismo layout de fila y misma tarjeta privada que renderChampionship
// (Vendedores · GP VDH), reemplazando "vendedor" por "local": el trofeo, "X pts", el desglose
// Principal/Sprints y "Nº vendedores activos" quedan uno a uno equivalentes entre las dos vistas.
function renderStorePoints(){
  const{list,month,weeks}=buildStorePointsList();
  if(!month){showEmpty('Sin fecha cargada todavía.');return}
  $('rankPeriod').textContent=`${month} · ${weeks.length} fecha${weeks.length===1?'':'s'} corrida${weeks.length===1?'':'s'}`;
  if(!list.length){showEmpty('Sin puntos cargados este mes todavía.');return}

  const currentKey=weeks[weeks.length-1];
  const vendorCounts=activeVendorsByLocal(currentKey);
  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const trophy=i===0?` ${icon('trophy','svg-icon trophy-icon')}`:'';
    const value=`<span class="rank-value-main">${number(p.total)} pts</span>`;
    const b=p.breakdown;
    const sub=state.supervisor
      ?`Principal ${p.main} · Sprints: Tk ${b.ticket} · Pf ${b.perfumes} · Bx ${b.boxer} · PxT ${b.pxt}`
      :`Principal ${p.main} pts · Sprints ${p.sprint} pts`;
    const vendorCount=vendorCounts[p.local]||0;
    const extraHtml=`${vendorCount} vendedor${vendorCount===1?'':'es'} activo${vendorCount===1?'':'s'}`;
    return rankRow(i,p.local,'',value,sub,extraHtml,trophy);
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local,
    nameOf:p=>p.local,
    progressText:p=>`${number(p.total)} pts acumulados este mes`,
    leaderText:'¡Tu local va primero en la Copa Constructores!',
    microText:(p,above)=>{
      const gap=above.total-p.total;
      return gap>0?`Tu local está a ${number(gap)} pts de subir al puesto`:'Tu local está empatado con el puesto';
    }
  });
}

/* ── INICIO / PULSO GENERAL (resumen consolidado de la empresa) ─
   Vista nueva de nivel superior — no existía nada equivalente antes, "Vendedores" hacía de default.
   Reusa datos ya calculados por otras vistas (ratioStandings, aggregateStoresForWeek) en vez de
   armar una agregación nueva por su cuenta. */
function renderHome(){
  $('rankKicker').textContent='PULSO GENERAL';
  $('rankHeading').textContent='Así viene la semana';
  const weekKeys=allWeekKeys();
  if(!weekKeys.length){showEmpty('Sin semana cargada todavía.');return}
  const currentKey=weekKeys[weekKeys.length-1];
  const[mes,semana]=currentKey.split('|');
  $('rankPeriod').textContent=`Semana ${semana} de ${mes}`;

  const sellers=ratioStandings(currentKey,null);
  const stores=aggregateStoresForWeek(currentKey);

  // Sin PIN de Supervisión: ni la venta $ de la empresa ni ningún % de cumplimiento se muestran acá
  // — ni el hero, ni un valor pegado al líder. Solo un Top 3 de nombres (Vendedores y Locales), a
  // modo de "quién va arriba" sin exponer cifras de facturación. Pedido explícito del usuario
  // (2026-08-27): antes se veía el % de todos los locales/vendedores sin ningún gate; ahora ese
  // detalle numérico completo queda atrás del mismo PIN que ya usan el desglose de puntos del
  // Campeonato y capForDisplay. El detalle con %/$ sigue disponible activando Supervisión.
  if(!state.supervisor){
    const top3Html=(list,mapName,mapSub)=>list.length
      ?list.slice(0,3).map((item,i)=>`<div class="home-top3-row"><span class="home-top3-pos">${medalFor(i)}</span><div class="home-top3-info"><span class="home-top3-name">${escapeHtml(mapName(item))}</span>${mapSub(item)?`<span class="home-top3-sub">${escapeHtml(mapSub(item))}</span>`:''}</div></div>`).join('')
      :'<div class="home-top3-empty">Sin datos todavía</div>';
    $('rankList').innerHTML=`<div class="home-wrap">
      <div class="home-top3-card" data-jump="sellers">
        <span class="home-top3-title">${icon('trophy','home-card-icon')}Top 3 Vendedores · Liga VDH</span>
        ${top3Html(sellers,p=>p.name,p=>p.local)}
      </div>
      <div class="home-top3-card" data-jump="stores">
        <span class="home-top3-title">${icon('store','home-card-icon')}Top 3 Locales · Copa Constructores</span>
        ${top3Html(stores,s=>s.local,()=>'')}
      </div>
      <button class="home-cta" data-jump="fama">${icon('award','home-cta-icon')}Ver Salón de la Fama →</button>
    </div>`;
    qa('.home-top3-card,.home-cta').forEach(el=>el.addEventListener('click',()=>{state.scope=el.dataset.jump;render()}));
    renderPrivateCard({
      list:sellers,
      match:p=>state.user&&p.local===state.user.local&&p.name===state.user.vendedor,
      progressText:p=>`${percent(p.ratio)} del objetivo semanal alcanzado`,
      microText:(p,above)=>{
        const pts=above.ratio-p.ratio;
        const absGap=above.real-p.real;
        return absGap>0?`Estás a ${money(absGap)} (+${pts.toFixed(1)}%) de subir al puesto`:`Estás a +${pts.toFixed(1)}% de subir al puesto`;
      }
    });
    return;
  }

  const totals=weekRows(currentKey).reduce((acc,row)=>{acc.real+=num(row,'Venta real');acc.obj+=num(row,'Venta obj');return acc},{real:0,obj:0});
  const ratio=totals.obj?totals.real/totals.obj*100:null;
  const leaderSeller=sellers[0]||null,leaderStore=stores[0]||null;

  $('rankList').innerHTML=`<div class="home-wrap">
    <div class="home-hero">
      <span class="home-hero-label">Venta de la empresa esta semana</span>
      <div class="home-hero-value">${money(totals.real)}</div>
      <div class="home-hero-sub">${ratio!==null?`${percent(ratio)} del objetivo (${money(totals.obj)})`:'Sin objetivo cargado'}</div>
    </div>
    <div class="home-cards">
      <button class="home-card" data-jump="sellers">
        <span class="home-card-label">${icon('trophy','home-card-icon')}Líder Liga</span>
        <span class="home-card-name">${leaderSeller?escapeHtml(leaderSeller.name):'—'}</span>
        <span class="home-card-sub">${leaderSeller?`${escapeHtml(leaderSeller.local)} · ${percent(leaderSeller.ratio)}`:'Sin datos'}</span>
      </button>
      <button class="home-card" data-jump="stores">
        <span class="home-card-label">${icon('store','home-card-icon')}Líder Copa Constructores</span>
        <span class="home-card-name">${leaderStore?escapeHtml(leaderStore.local):'—'}</span>
        <span class="home-card-sub">${leaderStore&&leaderStore.ratio!==null?percent(leaderStore.ratio):'Sin datos'}</span>
      </button>
    </div>
    <button class="home-cta" data-jump="fama">${icon('award','home-cta-icon')}Ver Salón de la Fama →</button>
  </div>`;
  qa('.home-card,.home-cta').forEach(el=>el.addEventListener('click',()=>{state.scope=el.dataset.jump;render()}));

  renderPrivateCard({
    list:sellers,
    match:p=>state.user&&p.local===state.user.local&&p.name===state.user.vendedor,
    progressText:p=>`${percent(p.ratio)} del objetivo semanal alcanzado`,
    microText:(p,above)=>{
      const pts=above.ratio-p.ratio;
      const absGap=above.real-p.real;
      return absGap>0?`Estás a ${money(absGap)} (+${pts.toFixed(1)}%) de subir al puesto`:`Estás a +${pts.toFixed(1)}% de subir al puesto`;
    }
  });
}

/* ── SALÓN DE LA FAMA (podio de la semana ya cerrada) ────────
   No hay "snapshot" ni job que corra el domingo a la noche: cada semana ya vive como su propia
   fila en VENDEDOR_SEMANAL (Mes+Semana), append-only — el Sheet nunca pisa una semana vieja al
   sumar la nueva. "La semana ya cerrada" es sencillamente la anteúltima Semana con datos, no la
   que está corriendo ahora mismo (esa todavía puede seguir sumando ventas hasta que cierre). */
function initialsOf(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return'?';
  return(parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
function aggregateStoresForWeek(weekKey){
  const groups={};
  weekRows(weekKey).forEach(row=>{
    const local=row.Local||'Sin local';
    if(!groups[local])groups[local]={real:0,obj:0};
    groups[local].real+=num(row,'Venta real');
    groups[local].obj+=num(row,'Venta obj');
  });
  const vendorCounts=activeVendorsByLocal(weekKey);
  const list=Object.entries(groups).map(([local,g])=>({local,real:g.real,obj:g.obj,ratio:g.obj?g.real/g.obj*100:null,vendorCount:vendorCounts[local]||0}));
  list.sort((a,b)=>{const ar=a.ratio??-Infinity,br=b.ratio??-Infinity;if(br!==ar)return br-ar;return String(a.local).localeCompare(String(b.local),'es')});
  return list;
}
function famaPodiumCard(person,pos){
  if(!person)return`<div class="fama-podium-card fama-podium-empty pos${pos}"><span class="fama-medal">${medalFor(pos-1)}</span><span class="fama-empty-text">Sin datos</span></div>`;
  return`<div class="fama-podium-card pos${pos}">
    <span class="fama-medal">${medalFor(pos-1)}</span>
    <span class="fama-avatar">${escapeHtml(initialsOf(person.name))}</span>
    <span class="fama-podium-name">${escapeHtml(person.name)}</span>
    <span class="fama-podium-sub">${escapeHtml(person.local)}</span>
    <span class="fama-podium-metric">${person.ratio!==null?percent(person.ratio):'—'}</span>
  </div>`;
}
function famaStoreCard(s,pos){
  if(!s)return`<div class="fama-store-card"><span class="fama-medal-sm">${medalFor(pos-1)}</span><span class="fama-store-name">Sin datos</span></div>`;
  return`<div class="fama-store-card">
    <span class="fama-medal-sm">${medalFor(pos-1)}</span>
    <span class="fama-store-name">${escapeHtml(s.local)}</span>
    <span class="fama-store-metric">${s.ratio!==null?percent(s.ratio):'—'}</span>
    <span class="fama-store-vendors">${s.vendorCount} vendedor${s.vendorCount===1?'':'es'}</span>
  </div>`;
}
function famaHighlightCard(title,person,valueFn){
  if(!person)return`<div class="fama-highlight-card"><span class="fama-highlight-title">${title}</span><span class="fama-highlight-empty">Sin datos esta semana</span></div>`;
  return`<div class="fama-highlight-card">
    <span class="fama-highlight-title">${title}</span>
    <span class="fama-highlight-name">${escapeHtml(person.name)}</span>
    <span class="fama-highlight-sub">${escapeHtml(person.local)} · ${valueFn(person)}</span>
  </div>`;
}
function famaHighlightDualCard(title,perfumesTop,boxerTop){
  return`<div class="fama-highlight-card">
    <span class="fama-highlight-title">${title}</span>
    <div class="fama-highlight-dual">
      <div>${icon('sparkles','svg-icon text-icon')}${perfumesTop?`<strong>${escapeHtml(perfumesTop.name)}</strong> (${number(perfumesTop.real)}u)`:'Sin datos'}</div>
      <div>${icon('shirt','svg-icon text-icon')}${boxerTop?`<strong>${escapeHtml(boxerTop.name)}</strong> (${number(boxerTop.real)}u)`:'Sin datos'}</div>
    </div>
  </div>`;
}
function renderFama(){
  $('rankKicker').textContent='SALÓN DE LA FAMA';
  $('rankHeading').textContent='Podio de la semana';
  const weekKeys=allWeekKeys();
  if(weekKeys.length<2){showEmpty('El Salón de la Fama se arma con la primera semana ya cerrada — todavía no hay una semana anterior completa para mostrar.');return}
  const lastIdx=weekKeys.length-1;
  const famaKey=weekKeys[lastIdx-1];
  const famaPrevKey=lastIdx>=2?weekKeys[lastIdx-2]:null;
  const[mes,semana]=famaKey.split('|');
  $('rankPeriod').textContent=`Semana ${semana} de ${mes} · cerrada`;

  const sellerTop=ratioStandings(famaKey,null).slice(0,3);
  const storeTop=aggregateStoresForWeek(famaKey).slice(0,3);
  const tpTop=ratioStandings(famaKey,'TP')[0]||null;
  const perfumesTop=ratioStandings(famaKey,'Perfumes')[0]||null;
  const boxerTop=ratioStandings(famaKey,'Boxer')[0]||null;
  const mejoraList=famaPrevKey?buildMejoraListFor(famaKey,famaPrevKey):[];
  const aceleracionTop=mejoraList.filter(p=>p.mejora!==null).sort((a,b)=>b.mejora-a.mejora)[0]||null;

  // Todo el contenido de Fama va DENTRO de un único wrapper — #rankList en desktop es
  // display:grid (pensado para las filas normales del ranking), y sin este wrapper cada sección
  // de Fama (podio, título, store-row, título, highlight-grid) se volvía su propia celda de esa
  // grilla y quedaban todas descolocadas una al lado de la otra en vez de apiladas.
  $('rankList').innerHTML=`<div class="fama-wrap">
    <div class="fama-podium">
      ${famaPodiumCard(sellerTop[0],1)}
      <div class="fama-podium-row">${famaPodiumCard(sellerTop[1],2)}${famaPodiumCard(sellerTop[2],3)}</div>
    </div>
    <div class="fama-section-title">// COPA CONSTRUCTORES · TOP 3</div>
    <div class="fama-store-row">${[storeTop[0],storeTop[1],storeTop[2]].map((s,idx)=>famaStoreCard(s,idx+1)).join('')}</div>
    <div class="fama-section-title">// DESTACADOS DE LA SEMANA</div>
    <div class="fama-highlight-grid">
      ${famaHighlightCard(`${icon('crown','svg-icon text-icon')}Rey del TP`,tpTop,p=>money(p.real))}
      ${famaHighlightDualCard(`${icon('sparkles','svg-icon text-icon')}Perfumes · ${icon('shirt','svg-icon text-icon')}Bóxers`,perfumesTop,boxerTop)}
      ${famaHighlightCard(`${icon('rocket','svg-icon text-icon')}Mayor Aceleración`,aceleracionTop,p=>`+${p.mejora.toFixed(1)} pts`)}
    </div>
  </div>`;
  $('privateCard').hidden=true;
  document.body.classList.remove('has-private-card');
}

/* ── TARJETA PRIVADA (puesto + micro-objetivo del usuario) ──── */
function renderPrivateCard({list,match,nameOf,progressText,microText,leaderText}){
  const card=$('privateCard');
  if(!state.user||!list.length){card.hidden=true;document.body.classList.remove('has-private-card');return}
  const idx=list.findIndex(match);
  if(idx===-1){card.hidden=true;document.body.classList.remove('has-private-card');return}
  const p=list[idx];
  const total=list.length,pos=idx+1;
  const displayName=nameOf?nameOf(p):`${state.user.vendedor}`;
  $('privateName').textContent=displayName;
  $('privatePosNum').textContent=`#${pos}`;
  $('privatePosTotal').textContent=`de ${total}`;
  $('privateProgress').textContent=progressText(p);
  if(idx===0){
    $('privateMicro').innerHTML=`<span class="positive">${icon('trophy','svg-icon text-icon')}${leaderText||'¡Vas primero esta semana!'}</span>`;
  }else{
    const above=list[idx-1];
    const text=microText?microText(p,above):null;
    $('privateMicro').textContent=text?`${text} #${idx}`:'Seguí así para subir de puesto.';
  }
  card.hidden=false;
  document.body.classList.add('has-private-card');
}

function showEmpty(message){
  $('rankPeriod').textContent='';
  $('rankList').innerHTML=`<div class="state-msg"><strong>Sin datos</strong>${escapeHtml(message)}</div>`;
  $('privateCard').hidden=true;
  document.body.classList.remove('has-private-card');
}

applyTheme(localStorage.getItem(THEME_KEY)||'dark');
qa('.theme-btn').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themeChoice)));
$('refreshBtn').addEventListener('click',()=>loadData(true));
$('localFilter').addEventListener('change',()=>{state.local=$('localFilter').value;render()});
qa('#scopeTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.scope=btn.dataset.scope;render()}));
qa('#catTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.category=btn.dataset.category;render()}));
qa('#storeCatTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.storeCategory=btn.dataset.storeCategory;render()}));

/* ── BOTTOM NAV + DRAWER (mobile) ─────────────────────────────
   Los 3 botones con data-scope navegan directo (mismo mecanismo que scopeTabs, un solo estado
   compartido). "Más" no cambia de scope — abre el drawer, que es el menú completo. */
qa('.bottom-nav-item[data-scope]').forEach(btn=>btn.addEventListener('click',()=>{state.scope=btn.dataset.scope;render();closeDrawer()}));
function openDrawer(){
  $('drawerBackdrop').hidden=false;
  $('drawerPanel').hidden=false;
  $('bottomNavMore').setAttribute('aria-expanded','true');
}
function closeDrawer(){
  $('drawerBackdrop').hidden=true;
  $('drawerPanel').hidden=true;
  $('bottomNavMore').setAttribute('aria-expanded','false');
}
$('bottomNavMore').addEventListener('click',openDrawer);
$('drawerClose').addEventListener('click',closeDrawer);
$('drawerBackdrop').addEventListener('click',closeDrawer);
// Cada item real del drawer cambia de scope y, si trae data-drawer-anchor, hace scroll hasta esa
// tarjeta puntual dentro de Reglamento (ej. "Sanciones y Criterios" apunta directo a esa sección
// en vez de dejar al vendedor a buscarla arriba de todo).
qa('.drawer-item[data-drawer-scope]').forEach(btn=>btn.addEventListener('click',()=>{
  state.scope=btn.dataset.drawerScope;
  render();
  closeDrawer();
  const anchorId=btn.dataset.drawerAnchor;
  // instant, no smooth: es un salto de navegación de menú (tocás "Sanciones" y aterrizás ahí), no
  // un scroll "relacionado" dentro de la misma pantalla — instant también es lo único verificable
  // en este entorno headless, donde un scroll animado por CSS nunca llegó a completarse en las
  // pruebas (confirmado aislando variable por variable: mismo código, solo cambiando smooth→instant).
  if(anchorId)setTimeout(()=>{const el=$(anchorId);if(el)el.scrollIntoView({behavior:'instant',block:'start'})},80);
}));
$('drawerAjustes').addEventListener('click',()=>{closeDrawer();openIdentityModal('change')});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

renderIdentityChip();
renderSupervisorChip();
loadData(true); // spinner prendido en la carga inicial: si el consolidador tarda, se ve que algo está pasando
setInterval(()=>loadData(false),5*60*1000);
