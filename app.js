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
// Puntos estilo F1 del Campeonato/Copa Constructores. El top 10 (25…1) es la escala real de F1;
// de ahí para abajo (11º a 15º) es invento propio, 1 pt parejo — un lugar en el podio del top 15
// vale poco por sí solo pero no deja a nadie afuera. Se usa completo (15 puestos) para vendedores
// — con ~41 vendedores cargados, el top 10 de F1 (10 de 22 pilotos, ~45%) dejaba afuera a 3 de
// cada 4; el top 15 (~37% de 41) se acerca más a esa proporción real sin ablandar el podio de
// arriba. Copa Constructores (locales) sigue tomando solo los primeros 10 de este mismo array
// (son 13 locales — top 10 ya cubre casi todos, no hace falta estirarlo). Ver conversación del
// 2026-09-04.
const MAIN_POINTS=[25,18,15,12,10,8,6,4,2,1,1,1,1,1,1];
// Antes calcado del sprint real de F1 (8…1), pero acá hay CUATRO sprints por semana (Ticket,
// Perfumes, Bóxer, PxT) contra el sprint único de F1 — barrer los 4 daba hasta 32 pts, más que
// ganar la Venta de la semana (25 pts la carrera principal). Bajado a un techo de 4 por sprint:
// barrer los 4 da como máximo 16 pts, bien por debajo de ganar Venta — los sprints siguen sumando
// y desempatando, pero ya no le pueden ganar el puesto al que más vendió. Se mantienen los mismos
// 8 puestos que puntúan (solo baja el valor), para no sacarle el incentivo a nadie de golpe. Ver
// conversación del 2026-09-04.
const SPRINT_POINTS=[4,3,2,1,1,1,1,1];
// Cuántos puestos puntúan en la carrera principal de LOCALES (Sprint Semanal → Copa
// Constructores). Son 13 locales: el top 10 ya cubre casi todo el campo, estirarlo a los 15
// puestos de MAIN_POINTS (pensado para ~41 vendedores, ver arriba) dejaba sin premiar el esfuerzo
// a casi nadie. Vive en una constante porque antes el número estaba en dos lugares que se
// desincronizaron: buildStoreChampionship repartía al top 10, pero la pastillita de Sprint
// Semanal se dibujaba con MAIN_POINTS entero y prometía "+1 pts GP" a los puestos 11 a 13 que
// nunca los recibían. Pedido del 2026-09-15 a partir de esa captura.
const STORE_MAIN_TOP=10;
const SPRINT_FIELDS={ticket:'TP',perfumes:'Perfumes',boxer:'Boxer',pxt:'PxT'};
// Mínimo de días trabajados para clasificar a puntos en una semana. Sale de un caso real
// (conversación del 2026-09-15): una vendedora de Rivadavia trabajó UN solo día de la semana 2
// —justo un domingo, el día más fuerte del local— vendió $628.803 contra un objetivo semanal de
// $290.656 y quedó 1ª con 216%, arriba de gente que hizo la semana completa. El objetivo diario
// que carga Ventas es un share FIJO por persona (ella 5%, un full-time 29%) que se le imputa
// todos los días, trabaje o no: quien trabaja un día solo arrastra un objetivo chico y encima
// elige (sin querer) el mejor día, mientras el que hace 6 días se come también los lunes flojos.
// Medido sobre las semanas 1 y 2: quien trabajó 1 día aportó 24,1% del local los días que estuvo
// contra el 1,7% que le pedían (+22,4 pts de ventaja); de 2 a 6 días la ventaja es de 3 a 7 pts,
// o sea ruido normal. La distorsión no es gradual, está concentrada en el caso de 1 día.
// Por eso el piso es 3 y no un % relativo a los días que abre el local: con "la mitad de los días
// del local" (7 días → 4) quedaban afuera TODAS las semanas los part-time estables de 3 días
// (Melanie Flores, Flor Caro), que cumplen su horario completo. El piso de 3 deja competir a los
// part-time y solo saca las semanas anómalas: en las 2 semanas completas cargadas afecta a 1
// persona por semana (Mari Ramon con 1 día en la S2 —que normalmente hace 6— y Gabi Burroso con
// 2 días en la S1). Si algún día hay contratos estables de 2 días por semana, bajar esto a 2.
const MIN_DIAS_CLASIFICA=3;
const state={tables:{},local:'all',scope:'home',category:'liga',storeCategory:'sprint',user:null,guest:false,supervisor:false};
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
  rocket:'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alertTriangle:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
};
function icon(name,cls){return`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`}

/* ── APERTURA/CIERRE ANIMADO DE HOJAS (drawer, modal de identidad, PIN, banner de update) ──
   Todas comparten el mismo problema: se mostraban/ocultaban alternando el atributo "hidden", que
   mapea a display:none (ver [hidden]{display:none!important} arriba) — display:none no transiciona,
   así que aparecían y desaparecían de un corte en vez de deslizar/desvanecer como corresponde a algo
   con pinta de bottom-sheet o panel lateral. openSheet saca "hidden" primero, fuerza un reflow
   (leer offsetHeight) para que el navegador registre ESE estado inicial antes de agregar ".open"
   —si no, ambos cambios se pisan en el mismo frame y la transición nunca dispara— recién ahí agrega
   ".open", que es la clase que cada componente anima en su propio CSS. closeSheet hace el camino
   inverso: saca ".open" (arranca la transición de salida) y recién cuando termina (mismo tiempo que
   declara el CSS) vuelve a poner "hidden", para no dejar el elemento tapando/tocable mientras
   todavía está terminando de irse. El guard del setTimeout evita que un reabrir rápido (cerrar y
   volver a abrir antes de que termine la salida) se pise con el hidden viejo. */
function openSheet(el){
  el.hidden=false;
  el.offsetHeight; // fuerza reflow
  el.classList.add('open');
}
function closeSheet(el,duration){
  el.classList.remove('open');
  setTimeout(()=>{if(!el.classList.contains('open'))el.hidden=true},duration??300);
}

/* ── IDENTIDAD DE VENDEDOR (localStorage, sin usuario ni clave) ─ */
function loadUser(){try{const raw=localStorage.getItem(USER_KEY);const parsed=raw?JSON.parse(raw):null;return(parsed&&parsed.local&&parsed.vendedor)?parsed:null}catch{return null}}
function saveUser(user){try{localStorage.setItem(USER_KEY,JSON.stringify(user));localStorage.removeItem(GUEST_KEY)}catch{}}
function saveGuest(){try{localStorage.setItem(GUEST_KEY,'1')}catch{}}
function isGuest(){try{return localStorage.getItem(GUEST_KEY)==='1'}catch{return false}}
state.user=loadUser();
state.guest=!state.user&&isGuest();

// ── ANALYTICS (Google Analytics 4) ──────────────────────────
// track() nunca puede romper la app: si gtag no cargó (bloqueador de anuncios, sin red, GA caído)
// el try/catch lo hace desaparecer en silencio en vez de tirar la carga de datos abajo.
// app_open se manda una vez por apertura, con local+vendedor si ya hay alguien identificado —
// así en Analytics se puede ver no solo "cuántas aperturas" sino "quién específicamente" volvió
// (Informes → Interacción → Eventos → app_open, desglosado por el parámetro vdh_vendedor).
function track(event,params){try{if(typeof gtag==='function')gtag('event',event,params||{})}catch{}}
track('app_open',{vdh_local:state.user?state.user.local:'(sin identificar)',vdh_vendedor:state.user?state.user.vendedor:'(sin identificar)'});

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
  openSheet(modal);
}
function closeIdentityModal(){closeSheet($('identityModal'))}
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

// closeDrawer() antes de abrir el modal: identityChip/supervisorChip ahora viven DENTRO del drawer
// (ver index.html) — sin esto, el modal (z-index:30) queda tapado atrás del panel del drawer
// (z-index:31), que se queda abierto de fondo aunque el usuario ya esté mirando el modal.
$('identityChip').addEventListener('click',()=>{closeDrawer();openIdentityModal(state.user?'change':'onboard')});
$('identityClose').addEventListener('click',closeIdentityModal);
$('identityLocal').addEventListener('change',()=>{fillIdentityVendors();updateIdentityConfirm()});
$('identityVendor').addEventListener('change',updateIdentityConfirm);
$('identityConfirm').addEventListener('click',()=>{
  const local=$('identityLocal').value,vendedor=$('identityVendor').value;
  if(!local||!vendedor)return;
  state.user={local,vendedor};
  state.guest=false;
  saveUser(state.user);
  track('identify_vendor',{vdh_local:local,vdh_vendedor:vendedor});
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
  closeDrawer();
  if(state.supervisor){
    state.supervisor=false;
    setSupervisorFlag(false);
    renderSupervisorChip();
    render();
  }else{
    $('pinInput').value='';
    $('pinError').hidden=true;
    openSheet($('pinModal'));
    $('pinInput').focus();
  }
});
$('pinCancel').addEventListener('click',()=>{closeSheet($('pinModal'))});
$('pinConfirm').addEventListener('click',()=>{
  if($('pinInput').value===SUPERVISOR_PIN){
    state.supervisor=true;
    setSupervisorFlag(true);
    closeSheet($('pinModal'));
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

// Sub-pills de "Locales" — todas ordenan por % de cumplimiento de la semana y muestran los mismos
// dos elementos que ya usa Liga VDH del lado de vendedores: arriba "% (real/obj)", abajo la
// pastillita "+X pts GP". Sprint Semanal (Venta) reusa MAIN_POINTS —es la misma carrera principal
// que ya puntúa en Copa Constructores—; Ticket/PxT/Perfumes/Bóxer reusan SPRINT_POINTS, agregado
// por local en vez de por persona (ver renderStores).
// Sprint Semanal antes ordenaba por MEJORA vs. la semana anterior — se sacó el 2026-09-05: recién
// arrancando el mes siempre decía "1ª semana" (sin nada para comparar todavía) y duplicaba
// información que "% + puntos" ya cubre mejor. La mejora semana a semana de VENDEDORES (pestaña
// "Mayor Mejora VDH") no se tocó, sigue con su propia lógica más abajo.
// Copa Constructores YA NO vive acá — pasó a ser un campeonato de puntos (ver
// buildStoreChampionship más abajo), con renderStores() derivando a renderStoreChampionship()
// antes de tocar este objeto.
// fmt define cómo se lee "real / objetivo" en la tarjeta — Perfumes/Bóxer son UNIDADES (8 / 3, no
// $8 / $3), PxT es un promedio decimal sin signo — solo Venta/Ticket son montos en $. Sin esto se
// mostraba "$8 / $3" en Perfumes, un bug real encontrado al verificar con captura.
// kicker es texto propio (no cfg.label.toUpperCase()) — antes el kicker repetía el título de abajo
// tal cual, ahora describe la métrica en vez del nombre de la pestaña.
const STORE_CATEGORIES={
  sprint:{label:'Sprint Semanal',field:null,fmt:moneyShort,kicker:'RANKING SEMANAL'},
  ticket:{label:'Ticket Promedio',field:'TP',fmt:moneyShort,kicker:'PROMEDIO POR VENTA'},
  pxt:{label:'PxT',field:'PxT',fmt:decimal,kicker:'PRENDAS POR TICKET'},
  perfumes:{label:'Perfumes',field:'Perfumes',fmt:number,unit:'u',kicker:'VENTA CRUZADA'},
  boxer:{label:'Bóxer',field:'Boxer',fmt:number,unit:'u',kicker:'VENTA CRUZADA'}
};

function allWeekKeys(){
  const rows=state.tables.VENDEDOR_SEMANAL||[];
  return[...new Set(rows.map(weekKeyOf))].sort((a,b)=>weekKeyOrder(a)-weekKeyOrder(b));
}
function weekRows(weekKey){return(state.tables.VENDEDOR_SEMANAL||[]).filter(r=>weekKeyOf(r)===weekKey)}
// LOCAL_DIARIO trae, por día y por LOCAL (no por vendedor), el Ticket Promedio real de la
// operación — el mismo dato que ya se mira en la pestaña de Tráfico del dashboard. Se usa para
// agregar Ticket Promedio por local (ver aggregateStoreMetricForWeek) en vez de promediar el TP
// de cada vendedor, que es lo que hacía antes. Ver conversación del 2026-09-04.
function localDiarioWeekRows(weekKey){return(state.tables.LOCAL_DIARIO||[]).filter(r=>weekKeyOf(r)===weekKey)}
// ── Vendedores compartidos entre locales (cobertura) ───────────────────
// Personas que trabajan repartidas entre locales (cubren días en otro local, incluso con cambios
// a mitad de mes). El consolidador NO las funde — cada local sigue viendo su venta real completa
// (así Copa Constructores/Sprint Semanal/etc. quedan bien, ver STORE_CATEGORIES arriba). Acá SÍ
// se funden, pero solo para las vistas que rankean PERSONAS (Liga, Sprints, Mejora, Fama de
// vendedores) — así su ranking individual refleja la venta total, no la mitad.
//
// Automático por nombre+apellido: si el mismo nombre aparece en más de un Local dentro de la
// misma semana, se asume que es la misma persona cubriendo y se funden esas filas — sin lista
// para mantener a mano (antes existía VENDEDORES_COMPARTIDOS con altas manuales; se sacó el
// 2026-09-03 porque los cambios de cobertura son a mitad de mes y no daba tiempo a avisar). Único
// riesgo real: si dos personas DISTINTAS del equipo llegaran a compartir nombre y apellido exacto
// en dos locales sin relación, se fundirían por error — con nombre+apellido siempre cargado, es
// poco probable, pero si pasa algún día hay que volver a algo explícito acá.
function fusionarCompartidos(rows){
  const grupos={},resto=[];
  rows.forEach(row=>{
    if(!grupos[row.Vendedor])grupos[row.Vendedor]=[];
    grupos[row.Vendedor].push(row);
  });
  Object.keys(grupos).forEach(nombre=>{
    const partes=grupos[nombre];
    const localesDistintos=[...new Set(partes.map(r=>r.Local))];
    if(localesDistintos.length===1){partes.forEach(p=>resto.push(p));return} // un solo local esta semana: nada que fundir
    const sumaCol=campo=>partes.reduce((s,r)=>s+num(r,campo),0);
    // TP/PxT/Conversión son PROMEDIOS, no cantidades — sumarlos infla el número (mismo criterio
    // que ya usa buildStoreCategoryList más abajo). Se recalculan ponderados por su propio peso
    // natural: Conversión por Tráfico, TP y PxT por Venta.
    const promedioCol=(campo,pesoCampo)=>{const peso=sumaCol(pesoCampo);return peso?partes.reduce((s,r)=>s+num(r,campo)*num(r,pesoCampo),0)/peso:0};
    const base={...partes[0]};
    base.Local=localesDistintos.join(' + ');
    ['Venta obj','Venta real','Tráfico obj','Tráfico real','Perfumes obj','Perfumes real','Boxer obj','Boxer real'].forEach(c=>{base[c]=sumaCol(c)});
    base['Conv obj']=promedioCol('Conv obj','Tráfico obj');
    base['Conv real']=promedioCol('Conv real','Tráfico real');
    base['TP obj']=promedioCol('TP obj','Venta obj');
    base['TP real']=promedioCol('TP real','Venta real');
    base['PxT obj']=promedioCol('PxT obj','Venta obj');
    base['PxT real']=promedioCol('PxT real','Venta real');
    resto.push(base);
  });
  return resto;
}
// Igual que weekRows(), pero fusionando vendedores compartidos — usarla en todo lo que rankee
// PERSONAS. Lo que rankea LOCALES (buildStoreCategoryList, aggregateStoresForWeek) sigue usando
// weekRows() crudo a propósito, para no perder su venta real en el total de cada local.
function weekRowsPersonas(weekKey){return fusionarCompartidos(weekRows(weekKey))}
// ── DÍAS TRABAJADOS Y CLASIFICACIÓN (ver MIN_DIAS_CLASIFICA arriba) ────
// El consolidador NO trae "días trabajados": el objetivo diario se imputa todos los días, esté o
// no la persona, así que no sirve como señal de presencia. El único proxy disponible es "días con
// venta > 0" en VENDEDOR_DIARIO. Tiene un borde conocido: alguien que trabajó y no vendió NADA en
// todo el día figura como ausente. Es raro con estos tickets, pero si algún día Ventas carga el
// objetivo diario en 0 los días de franco, conviene usar eso (sería exacto) en vez de este proxy.
// Los días se cuentan por PERSONA (no por local): quien cubre en dos locales el mismo día suma un
// día, no dos — mismo criterio que fusionarCompartidos() para todo lo que rankea personas.
let diasCache={};
function diaKeyOf(row){return String(fieldValue(row,'Fecha')??'').slice(0,10)}
function diasTrabajadosDeLaSemana(weekKey){
  if(diasCache[weekKey])return diasCache[weekKey];
  // Días que el local tuvo actividad real esa semana — es el tope para el mínimo exigido, sin
  // esto el lunes y el martes el ranking quedaría vacío (nadie puede tener 3 días todavía).
  const diasLocal={};
  localDiarioWeekRows(weekKey).forEach(row=>{
    if(num(row,'Venta real')<=0)return;
    const local=row.Local||'';
    (diasLocal[local]||(diasLocal[local]=new Set())).add(diaKeyOf(row));
  });
  const porPersona={};
  (state.tables.VENDEDOR_DIARIO||[]).filter(row=>weekKeyOf(row)===weekKey).forEach(row=>{
    const nombre=row.Vendedor;
    if(!nombre)return;
    const p=porPersona[nombre]||(porPersona[nombre]={dias:new Set(),locales:new Set()});
    p.locales.add(row.Local||'');
    if(num(row,'Venta real')>0)p.dias.add(diaKeyOf(row));
  });
  const resultado={};
  Object.entries(porPersona).forEach(([nombre,p])=>{
    const abiertos=Math.max(0,...[...p.locales].map(local=>diasLocal[local]?diasLocal[local].size:0));
    // Rampa de mitad de semana: se exige la mitad de los días que lleva abiertos el local, con
    // techo en MIN_DIAS_CLASIFICA. Con la semana entera cargada (5, 6 o 7 días) da siempre 3 —el
    // piso prometido—, pero el miércoles pide 2 y el lunes 1, así nadie aparece como "no
    // clasificado" solo porque la semana recién arranca. Sin la rampa, un part-time de 3 días
    // figuraría NC hasta el jueves todas las semanas.
    const minimo=abiertos?Math.min(MIN_DIAS_CLASIFICA,Math.max(1,Math.ceil(abiertos/2))):MIN_DIAS_CLASIFICA;
    resultado[nombre]={dias:p.dias.size,abiertos,minimo,clasifica:p.dias.size>=minimo};
  });
  diasCache[weekKey]=resultado;
  return resultado;
}
// Sin fila en VENDEDOR_DIARIO (tabla vieja o consolidador que todavía no la manda) se clasifica
// igual: la regla nunca puede sacar a alguien del ranking por falta de datos, solo por un dato
// que efectivamente diga que trabajó menos días que el mínimo.
function infoDiasDe(weekKey,nombre){
  const info=diasTrabajadosDeLaSemana(weekKey)[nombre];
  return info||{dias:null,abiertos:0,minimo:MIN_DIAS_CLASIFICA,clasifica:true};
}
const estaClasificado=p=>p.clasifica!==false;
// Empates: si dos personas quedan exactamente igual en % de cumplimiento, la posición (y por lo
// tanto los puntos F1/Sprint que reparte esa posición) se define por mayor venta/unidad absoluta
// real y, si también empatan ahí, alfabético — determinístico siempre, nunca "quien cargó primero
// en la planilla" (que es lo que pasaba antes, porque Array.sort es estable pero el orden de
// origen no tiene ningún criterio de negocio detrás).
// Los no clasificados (menos de MIN_DIAS_CLASIFICA días trabajados) NO se sacan de la lista: van
// al final, ordenados entre ellos por el mismo criterio, con su % a la vista. Esconderlos cambia
// la pregunta del local de "¿por qué está primera con un día?" a "¿por qué no está?" — se ven,
// pero sin medalla y sin puntos (los reparte quien clasifica, ver buildChampionship).
function ratioStandings(weekKey,field){
  const realKey=field?`${field} real`:'Venta real',objKey=field?`${field} obj`:'Venta obj';
  const list=weekRowsPersonas(weekKey).map(row=>{
    const real=num(row,realKey),obj=num(row,objKey),info=infoDiasDe(weekKey,row.Vendedor);
    // Sin venta en toda la semana no hay ningún % inflado que corregir: la regla está para que un
    // día suelto no se convierta en un 216%, no para etiquetar al que todavía no vendió. Sin esta
    // línea, el lunes (con un solo día cargado) media lista aparecía como "no clasifica" sin que
    // eso cambiara nada — con 0% quedan últimos igual, clasifiquen o no.
    const clasifica=info.clasifica||real<=0;
    return{local:row.Local,name:row.Vendedor,real,obj,ratio:obj?real/obj*100:null,
      dias:info.dias,diasAbiertos:info.abiertos,minDias:info.minimo,clasifica};
  }).filter(p=>p.ratio!==null);
  list.sort((a,b)=>(estaClasificado(b)-estaClasificado(a))||(b.ratio-a.ratio)||(b.real-a.real)||String(a.name).localeCompare(String(b.name),'es'));
  return list;
}

// Mensaje SIEMPRE en español y sin exponer texto crudo del navegador ("Failed to fetch", nombres
// de excepción en inglés, etc.) — antes error.message se mostraba tal cual para cualquier falla
// que no fuera el timeout explícito, justo en el peor momento para que alguien no técnico del
// local lea algo en inglés en la pantalla.
function friendlyErrorMessage(error,timedOut){
  if(timedOut)return'El consolidador tardó demasiado en responder (más de 20s). Probá de nuevo.';
  if(error instanceof TypeError)return'No hay conexión a internet. Revisá el wifi o los datos móviles.';
  if(typeof error?.message==='string'&&error.message.startsWith('HTTP '))return`El consolidador respondió con un error (${error.message.slice(5)}). Probá de nuevo en un rato.`;
  return'Ocurrió un error inesperado. Probá de nuevo en un rato.';
}
function showSyncBanner(message){
  $('syncBannerText').textContent=message;
  $('syncBanner').hidden=false;
}
function hideSyncBanner(){$('syncBanner').hidden=true}

// Placeholder de carga con la MISMA forma que rankRow (medalla + nombre + valor) en vez de un
// texto centrado — se ve de entrada que ahí va a aparecer una lista, no una pantalla en blanco.
function skeletonRows(n){
  return Array.from({length:n||6}).map(()=>`<div class="skeleton-row">
    <div class="skeleton-block skeleton-pos"></div>
    <div><div class="skeleton-block skeleton-line w60"></div><div class="skeleton-block skeleton-line w40"></div></div>
    <div><div class="skeleton-block skeleton-value"></div><div class="skeleton-block skeleton-sub"></div></div>
  </div>`).join('');
}

async function loadData(spinning){
  const btn=$('refreshBtn');
  if(spinning)btn.classList.add('spin');
  const hasDataAlready=Object.keys(state.tables).length>0;
  // Sin datos todavía (primera carga, o el reintento después de una primera carga fallida):
  // esqueleto en vez de dejar la pantalla en blanco o el cartel de error viejo mientras refetchea.
  if(!hasDataAlready)$('rankList').innerHTML=skeletonRows();
  // Timeout explícito: el Apps Script puede tardar por cold start o red lenta. Sin esto, un
  // fetch colgado deja el esqueleto en pantalla indefinidamente sin ningún mensaje de error.
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(DATA_ENDPOINT,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    state.tables=Array.isArray(data)?{LOCAL_DIARIO:data}:{...data};
    diasCache={}; // los días trabajados se recalculan con la data nueva, no con la del fetch anterior
    normalizeLocalNames(state.tables);
    fillLocalFilter();
    renderIdentityChip();
    renderSupervisorChip();
    render();
    maybeShowIdentityOnboarding();
    hideSyncBanner();
    const stamp=new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
    $('updatedLabel').textContent=`Actualizado ${stamp}`;
  }catch(error){
    const timedOut=error.name==='AbortError';
    const message=friendlyErrorMessage(error,timedOut);
    $('updatedLabel').textContent='Sin conexión con el consolidado';
    // Si ya había datos en pantalla (un refresh de fondo o manual que falló) NO se pisa la lista:
    // antes cualquier error acá borraba todo el ranking y lo reemplazaba por el cartel de error,
    // incluso en el auto-refresh silencioso de setInterval — un hipo de red de 2 segundos tiraba
    // abajo la pantalla que alguien estaba mirando sin haber tocado nada. Ahora eso solo prende
    // un aviso chico (con botón de reintentar) y deja la última data buena tal cual estaba.
    if(hasDataAlready){
      showSyncBanner(message);
    }else{
      $('rankList').innerHTML=`<div class="state-msg state-msg-error">${icon('alertTriangle','svg-icon state-msg-icon')}<strong>No se pudo cargar</strong>${escapeHtml(message)}<button type="button" class="state-msg-retry" data-retry>Reintentar</button></div>`;
    }
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
// El stagger de la animación de entrada usa el índice i (tapado en 10 filas): así la fila 1 entra
// primero y la 2ª/3ª un poquito después sin que una lista larga tarde 2 segundos en terminar.
// Se probaron acá, y se sacaron ambas tras verlas en celular real: una barra de cumplimiento al
// pie de la fila (no convencía — "la barra no me cierra") y un avatar con iniciales (sin foto real
// no sumaba info sobre el nombre ya escrito al lado). Quedan documentadas por si en algún momento
// hay fotos reales de vendedores o se las quiere retomar con otro enfoque.
// opts (opcional) es para las filas que no siguen la numeración normal: hoy solo las de "no
// clasificado", que muestran NC en vez del puesto y no pueden llevar la clase top1/top2/top3 (van
// al final de la lista, pero si una semana tuviera 2 clasificados quedarían en índice 0/1/2).
function rankRow(i,name,local,valueHtml,subHtml,extraHtml,nameSuffixHtml,opts){
  const o=opts||{};
  const rowClass=o.rowClass!==undefined?o.rowClass:rankRowClass(i);
  const posHtml=o.posLabel!==undefined?o.posLabel:(medalFor(i)||(i+1));
  return `<div class="rank-row ${rowClass}" style="animation-delay:${Math.min(i,10)*35}ms"><div class="rank-medal-pos">${posHtml}</div><div class="rank-info"><div class="rank-name">${escapeHtml(name)}${nameSuffixHtml||''}</div>${local?`<div class="rank-local">${escapeHtml(local)}</div>`:''}${extraHtml?`<div class="rank-extra">${extraHtml}</div>`:''}</div><div class="rank-metric"><div class="rank-value">${valueHtml}</div><div class="rank-sub">${subHtml}</div></div></div>`;
}
// "3 de 6 días" debajo del nombre para quien no hizo la semana completa. Va también en las filas
// que SÍ clasifican (en gris, no en ámbar): un 143% hecho en 3 días y uno hecho en 6 no son el
// mismo dato, y verlo al lado del número saca la sospecha de arriba de la mesa sin tener que
// explicar nada. Semana completa = sin etiqueta, para no llenar la lista de ruido.
function diasTagHtml(p){
  // Sin días (0 o sin dato) tampoco se etiqueta: "0 de 1 días" al lado de un 0% no agrega nada y
  // el lunes lo tendría media lista.
  if(!p.dias||!p.diasAbiertos)return'';
  if(estaClasificado(p)&&p.dias>=p.diasAbiertos)return'';
  const texto=`${p.dias} de ${p.diasAbiertos} día${p.diasAbiertos===1?'':'s'}`;
  return`<span class="rank-days${estaClasificado(p)?'':' nc'}">${texto}</span>`;
}
// Corto a propósito: la pastillita vive en .rank-sub, que es nowrap — un texto largo acá le come
// el ancho al nombre en un teléfono de 390px. El motivo ("1 de 7 días") ya va en la línea de
// abajo del nombre, que sí envuelve.
const NC_BADGE='<span class="sprint-badge nc-badge">No clasifica</span>';
// Opciones de rankRow para una fila no clasificada — mismas tres en todas las vistas.
const ncRowOpts={posLabel:'<span class="rank-nc-pos">NC</span>',rowClass:'nc'};

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
    // Top 15, no 10 — MAIN_POINTS tiene 15 puestos justamente para esto (ver comentario en su
    // definición). buildStoreChampionship (locales) usa este mismo array pero con slice(0,10):
    // no tocar ese sin motivo, son campos de tamaño muy distinto (~41 vendedores vs 13 locales).
    // filter(estaClasificado) antes del slice: los no clasificados quedan al final de la lista,
    // pero si una semana tuviera menos de 15 clasificados se colarían igual a la zona de puntos.
    ratioStandings(weekKey,null).filter(estaClasificado).slice(0,15).forEach((p,i)=>{ensure(p.local,p.name).main+=MAIN_POINTS[i]});
    Object.entries(SPRINT_FIELDS).forEach(([cat,field])=>{
      ratioStandings(weekKey,field).filter(estaClasificado).slice(0,8).forEach((p,i)=>{
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
  const rows=[...weekRowsPersonas(currentKey),...(prevKey?weekRowsPersonas(prevKey):[])];
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
    const info=infoDiasDe(currentKey,p.name);
    // La mejora necesita DOS semanas válidas: si la semana previa fue parcial (trabajó 1 día y
    // marcó 216%), el delta de esta semana no mide una caída real sino el rebote contra una
    // semana que ni siquiera clasificó. Y al revés: la semana siguiente a una parcial daría una
    // "mejora" enorme regalada. La Mayor Mejora VDH paga premio en efectivo (ver reglamento), no
    // puede salir de una comparación así.
    const baseValida=!p.previo||infoDiasDe(prevKey,p.name).clasifica;
    const mejora=(actualRatio!==null&&prevRatio!==null&&baseValida)?actualRatio-prevRatio:null;
    return{...p,actualRatio,prevRatio,mejora,baseValida,
      dias:info.dias,diasAbiertos:info.abiertos,minDias:info.minimo,
      clasifica:info.clasifica||!(actualRatio>0)}; // mismo criterio que ratioStandings: sin venta no se etiqueta
  });
  list.sort((a,b)=>{
    if(estaClasificado(a)!==estaClasificado(b))return estaClasificado(b)-estaClasificado(a);
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
  const clasificados=filtered.filter(estaClasificado);
  const visible=[...capForDisplay(clasificados),...filtered.filter(p=>!estaClasificado(p))];
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const trend=p.mejora===null?'':p.mejora>0?' <span class="trend positive">▲</span>':p.mejora<0?' <span class="trend negative">▼</span>':' <span class="trend">■</span>';
    const value=p.mejora!==null
      ?`<span class="${p.mejora>=0?'positive':'negative'}">${p.mejora>=0?'+':''}${p.mejora.toFixed(1)} pts</span>${trend}`
      :`<span style="color:var(--muted)">${p.prevRatio===null?'1ª semana':'sin base'}</span>`;
    const sub=p.actualRatio!==null?`${percent(p.actualRatio)} esta semana`:'sin objetivo';
    // "base de comparación parcial" va en la línea que envuelve (rank-extra), no en rank-sub, que
    // es nowrap y le comería el ancho al nombre en un teléfono angosto.
    const extra=[diasTagHtml(p),p.baseValida?'':'<span class="rank-days">base de comparación parcial</span>'].filter(Boolean).join(' · ');
    if(!estaClasificado(p))return rankRow(i,p.name,p.local,value,NC_BADGE,extra,'',ncRowOpts);
    return rankRow(i,p.name,p.local,value,sub,extra);
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
// El detalle "(real/obj)" va en todas las categorías, Liga incluida: el % solo no distingue entre
// "vendí $1.550 contra un objetivo de $1.000" y "vendí $15.500.000 contra $10.000.000" — mismo
// 155%, escala de esfuerzo completamente distinta. Se probó sacarlo en Liga (montos de 7 cifras) y
// se volvió a poner: probado en celular real, el dato pesa más que el espacio que ocupa.
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
  // Los no clasificados se agregan SIEMPRE al final de lo visible, incluso cuando el corte público
  // de 15 puestos (capForDisplay) los dejaría afuera por estar en el puesto 40: si no se ven, la
  // regla no se entiende y el que trabajó un día simplemente "desaparece" del ranking.
  const clasificados=filtered.filter(estaClasificado);
  const visible=[...capForDisplay(clasificados),...filtered.filter(p=>!estaClasificado(p))];
  const isSprint=category!=='liga';
  // La pastillita "+X pts GP" ya marcaba el Top 8 de los Sprints (Ticket/Perfumes/Boxer/PxT) — acá
  // se extiende a Liga con su propia escala (MAIN_POINTS, Top 10) para que la Carrera Principal
  // muestre la misma señal de "zona de puntos" que ya tenían los Sprints. Sin esto, un vendedor en
  // 4°-10° puesto (que SÍ suma puntos al Campeonato del mes, ver reglasPanel) se veía igual que uno
  // en 11° (que no suma nada) — el dato más importante de esa fila estaba invisible.
  const pointsTable=isSprint?SPRINT_POINTS:MAIN_POINTS;
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const extra=diasTagHtml(p);
    if(!estaClasificado(p))return rankRow(i,p.name,p.local,formatCategoryValue(cfg,p),NC_BADGE,extra,'',ncRowOpts);
    const badge=i<pointsTable.length?`<span class="sprint-badge">+${pointsTable[i]} pts GP</span>`:'';
    return rankRow(i,p.name,p.local,formatCategoryValue(cfg,p),badge,extra);
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
// Cuántos vendedores distintos cargaron datos ese local esa semana. Ya no se muestra en las
// sub-pills de Locales (se sacó el 2026-09-05, no aportaba nada útil ahí — reemplazado por la
// pastillita de puntos) — sigue usándose en las tarjetas de local del Salón de la Fama.
function activeVendorsByLocal(weekKey){
  const sets={};
  weekRows(weekKey).forEach(row=>{
    const local=row.Local||'Sin local';
    if(!sets[local])sets[local]=new Set();
    if(row.Vendedor)sets[local].add(row.Vendedor);
  });
  return Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.size]));
}
// Agrega Venta (o cualquiera de los 4 campos Sprint) real/obj por LOCAL para UNA semana puntual
// — la sacamos de buildStoreCategoryList para poder pedir también semanas viejas (no solo "la
// última cargada") y así sumar puntos semana a semana en buildStoreChampionship().
// TP (Ticket Promedio) sale de LOCAL_DIARIO, el dato real del local por día — antes se promediaba
// el "TP real" que cada vendedor carga en VENDEDOR_SEMANAL dividiendo por la cantidad de
// vendedores del local, y un solo vendedor con poca venta (o el ticket en 0) pesaba igual que el
// que factura la mayoría del local y arrastraba todo el número (así se explicaba, por ej., un
// local mostrando $34 de TP contra un objetivo de $80). Ahora es el promedio simple de los
// "Ticket prom." diarios del local (días con dato, sin ponderar por venta del día) — EL MISMO
// cálculo que ya hace la pestaña de Tráfico para su total semanal, verificado peso a peso contra
// Rivadavia Semana 1 (Tráfico muestra $73.871; ponderar por venta daba $74.577, parecido pero no
// igual — el promedio derecho de los 4 días con dato sí cierra exacto). Se usa "Tráfico" como
// fuente de verdad porque ya es lo que el local ve todos los días, no un cálculo nuevo que compita
// con ese número.
// PxT (Prendas por Ticket) también sale de LOCAL_DIARIO desde el 2026-09-05 — el consolidador
// (v9) ahora exporta "PxT real"/"PxT obj" ahí, calculados en la propia hoja "Tráfico" del local
// (Q Prendas / Q Líneas, la misma cuenta que ya se mira todos los días) en vez de derivarlo de
// VENDEDOR_SEMANAL ponderando por vendedor — ese cálculo por vendedor daba 2,7-2,8 en Rivadavia
// contra el 2,41 real de Tráfico, una diferencia real por vendedores con TP mal cargado. Es un
// valor mensual (como Ticket obj/Conv obj), se repite igual en cada día del mes, así que el
// promedio simple por día da directamente ese mismo número — mismo criterio que Ticket Promedio.
// Venta (field null — Sprint Semanal y la carrera principal de Copa Constructores) también sale
// de LOCAL_DIARIO desde el 2026-09-05, NO de sumar "Venta obj"/"Venta real" de cada vendedor en
// VENDEDOR_SEMANAL. Motivo real, encontrado con Rivadavia: el objetivo semanal de cada vendedor en
// "Informe Vendedor" sale de prorratear SU % de objetivo mensual, y esos porcentajes entre los 5
// vendedores de un local pueden sumar más del 100% del objetivo mensual (pasa en Rivadavia) — al
// sumarlos por local, el objetivo semanal quedaba inflado ($6,44M calculado contra $5,53M real,
// el que ya muestra la hoja de Ventas). Con LOCAL_DIARIO no hay ese problema: es el Objetivo/Venta
// real del LOCAL día a día, tal cual los carga Ventas, sin pasar por el prorrateo por vendedor.
// Perfumes/Bóxer sí siguen sumando de VENDEDOR_SEMANAL: son cantidades reales (no objetivos
// prorrateados) y no tienen un equivalente por local en LOCAL_DIARIO.
// Ver conversación del 2026-09-04 y 2026-09-05.
function aggregateStoreMetricForWeek(weekKey,field){
  if(field===null){
    const groups={};
    localDiarioWeekRows(weekKey).forEach(row=>{
      const local=row.Local||'Sin local';
      if(!groups[local])groups[local]={real:0,obj:0};
      groups[local].real+=num(row,'Venta real');
      groups[local].obj+=num(row,'Objetivo');
    });
    return groups;
  }
  if(field==='TP'||field==='PxT'){
    const realKey=field==='TP'?'Ticket prom.':'PxT real',objKey=field==='TP'?'Ticket obj':'PxT obj';
    const groups={};
    localDiarioWeekRows(weekKey).forEach(row=>{
      const local=row.Local||'Sin local';
      if(!groups[local])groups[local]={sumReal:0,countReal:0,sumObj:0,countObj:0};
      const g=groups[local];
      const valReal=num(row,realKey),valObj=num(row,objKey);
      if(valReal){g.sumReal+=valReal;g.countReal++}
      if(valObj){g.sumObj+=valObj;g.countObj++}
    });
    return Object.fromEntries(Object.entries(groups).map(([local,g])=>[local,{
      real:g.countReal?g.sumReal/g.countReal:0,
      obj:g.countObj?g.sumObj/g.countObj:0
    }]));
  }
  // Solo llega acá Perfumes/Bóxer (Venta/TP/PxT ya se resolvieron arriba) — cantidades reales,
  // sumarlas por vendedor sigue siendo correcto.
  const realKey=`${field} real`,objKey=`${field} obj`;
  const groups={};
  weekRows(weekKey).forEach(row=>{
    const local=row.Local||'Sin local';
    if(!groups[local])groups[local]={real:0,obj:0};
    groups[local].real+=num(row,realKey);
    groups[local].obj+=num(row,objKey);
  });
  return groups;
}
// Análogo a ratioStandings() (vendedores) pero agregado por LOCAL, para una semana puntual —
// la usa buildStoreChampionship() para sumar puntos semana a semana. Mismo criterio de empates:
// mayor venta/unidad real y, si también empata, alfabético.
function storeRatioStandings(weekKey,field){
  const agg=aggregateStoreMetricForWeek(weekKey,field);
  const list=Object.entries(agg).map(([local,g])=>({local,real:g.real,obj:g.obj,ratio:g.obj?g.real/g.obj*100:null})).filter(p=>p.ratio!==null);
  list.sort((a,b)=>(b.ratio-a.ratio)||(b.real-a.real)||String(a.local).localeCompare(String(b.local),'es'));
  return list;
}
// ── COPA CONSTRUCTORES (puntos estilo F1, mismo método que el Campeonato de vendedores) ──
// Antes ordenaba los locales por % de Venta crudo de la semana — el mismo dato que ya mostraba
// Sprint Semanal, solo que con otro orden ("es lo mismo que el Sprint", pedido del 2026-09-04).
// Ahora suma puntos semana a semana en las 5 métricas — Venta = carrera principal (top 10),
// Ticket/PxT/Perfumes/Bóxer = sprints (top 8) — y acumula en el mes, igual que buildChampionship()
// para vendedores: responde "cuál es el mejor local en todas las métricas", no solo quién vende
// más esta semana puntual.
function buildStoreChampionship(){
  const month=currentMonth();
  if(!month)return{list:[],month:null,weeks:[]};
  const weeks=weeksOfMonth(month);
  const totals={};
  const ensure=local=>{if(!totals[local])totals[local]={local,main:0,sprint:0,breakdown:{ticket:0,perfumes:0,boxer:0,pxt:0}};return totals[local]};
  weeks.forEach(weekKey=>{
    storeRatioStandings(weekKey,null).slice(0,STORE_MAIN_TOP).forEach((p,i)=>{ensure(p.local).main+=MAIN_POINTS[i]});
    Object.entries(SPRINT_FIELDS).forEach(([cat,field])=>{
      storeRatioStandings(weekKey,field).slice(0,8).forEach((p,i)=>{
        const e=ensure(p.local);
        e.sprint+=SPRINT_POINTS[i];
        e.breakdown[cat]+=SPRINT_POINTS[i];
      });
    });
  });
  const list=Object.values(totals).map(e=>({...e,total:e.main+e.sprint}));
  list.sort((a,b)=>(b.total-a.total)||(b.main-a.main)||String(a.local).localeCompare(String(b.local),'es'));
  return{list,month,weeks};
}
// Une "Venta/Sprint real/obj por local" con el % de cumplimiento — una sola función para las 5
// sub-pills reales (Sprint Semanal + las 4 de producto; Copa Constructores usa
// buildStoreChampionship de arriba, no esta). Ya no calcula mejora vs. la semana anterior — se
// sacó el 2026-09-05 junto con el sort por mejora, ver comentario en STORE_CATEGORIES.
function buildStoreCategoryList(field){
  const weekKeys=allWeekKeys();
  if(!weekKeys.length)return{list:[],currentKey:null};
  const currentKey=weekKeys[weekKeys.length-1];
  const currentAgg=aggregateStoreMetricForWeek(currentKey,field);
  const list=Object.keys(currentAgg).map(local=>{
    const cur=currentAgg[local];
    return{local,real:cur.real,obj:cur.obj,ratio:cur.obj?cur.real/cur.obj*100:null};
  });
  return{list,currentKey};
}
function sortStoreList(list){
  const arr=[...list];
  arr.sort((a,b)=>{
    const ar=a.ratio??-Infinity,br=b.ratio??-Infinity;
    if(br!==ar)return br-ar;
    if((b.real||0)!==(a.real||0))return(b.real||0)-(a.real||0);
    return String(a.local).localeCompare(String(b.local),'es');
  });
  return arr;
}
function renderStores(){
  qa('#storeCatTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.storeCategory===state.storeCategory));
  // Copa Constructores es un campeonato de puntos, no una sub-pill real/obj/ratio como el resto —
  // se resuelve aparte, antes de tocar STORE_CATEGORIES (mismo patrón que category==='campeonato'
  // en render(), para vendedores).
  if(state.storeCategory==='constructores'){renderStoreChampionship();return}
  const cfg=STORE_CATEGORIES[state.storeCategory]||STORE_CATEGORIES.sprint;
  $('rankKicker').textContent=cfg.kicker;
  $('rankHeading').textContent=cfg.label;
  const{list:rawList,currentKey}=buildStoreCategoryList(cfg.field);
  if(!currentKey){showEmpty('Sin semana cargada todavía.');return}
  const[mes,semana]=currentKey.split('|');
  $('rankPeriod').textContent=`Semana ${semana} de ${mes}`;
  if(!rawList.length){showEmpty('Sin locales para este filtro.');return}

  const list=sortStoreList(rawList);
  const filtered=state.local==='all'?list:list.filter(p=>p.local===state.local);
  const visible=capForDisplay(filtered);
  // Mismo layout que Liga VDH del lado de Vendedores: arriba "% (real/obj)" en una sola línea,
  // abajo la pastillita "+X pts GP" — antes acá arriba iba el % solo y abajo el real/obj, con
  // "X vendedores activos" (o, en Sprint Semanal, "1ª semana") como dato aparte; ninguna de las
  // dos cosas aportaba tanto como ver de una el puntaje. Sprint Semanal (field null → Venta) usa
  // MAIN_POINTS, la misma carrera principal que ya puntúa en Copa Constructores; las 4 de producto
  // usan SPRINT_POINTS. Pedido del 2026-09-05.
  // Sprint Semanal corta en STORE_MAIN_TOP (10), no en los 15 puestos de MAIN_POINTS: la
  // pastillita tiene que mostrar exactamente los puntos que después reparte buildStoreChampionship
  // — del 11º para abajo no se suma nada, así que no va pastillita. Las 4 de producto siguen con
  // SPRINT_POINTS (8 puestos), que ya coincide con lo que reparte el campeonato.
  const pointsTable=cfg.field?SPRINT_POINTS:MAIN_POINTS.slice(0,STORE_MAIN_TOP);
  $('rankList').innerHTML=visible.map(p=>{
    const i=list.indexOf(p);
    const unit=cfg.unit?` ${cfg.unit}`:'';
    const value=p.ratio!==null
      ?`<span class="rank-value-main">${percent(p.ratio)}</span> <span class="rank-value-ctx">(${cfg.fmt(p.real)}/${cfg.fmt(p.obj)}${unit})</span>`
      :'<span style="color:var(--muted)">Sin objetivo</span>';
    const badge=i<pointsTable.length?`<span class="sprint-badge">+${pointsTable[i]} pts GP</span>`:'';
    // Antes el líder llevaba medalla dorada Y un trofeo aparte pegado al nombre — dos señales para
    // el mismo dato, y encima un lenguaje distinto al de Vendedores (que solo usa la medalla). Se
    // saca el trofeo: la medalla ya alcanza, y ahora "quién va primero" se lee igual en las dos
    // pantallas. Ver revisión de UX del 2026-09-06.
    return rankRow(i,p.local,'',value,badge);
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
function renderStoreChampionship(){
  const{list,month,weeks}=buildStoreChampionship();
  $('rankKicker').textContent='ACUMULADO DEL MES';
  $('rankHeading').textContent='Copa Constructores';
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
    return rankRow(i,p.local,'',value,sub); // medalla alcanza para marcar el líder, ver renderStores
  }).join('');

  renderPrivateCard({
    list,
    match:p=>state.user&&p.local===state.user.local,
    nameOf:p=>p.local,
    progressText:p=>`${number(p.total)} pts acumulados este mes`,
    leaderText:'¡Vas primero en la Copa Constructores del mes!',
    microText:(p,above)=>{
      const gap=above.total-p.total;
      return gap>0?`Estás a ${number(gap)} pts de subir al puesto`:'Estás empatado con el puesto';
    }
  });
}

/* ── INICIO / PULSO GENERAL (resumen consolidado de la empresa) ─
   Vista nueva de nivel superior — no existía nada equivalente antes, "Vendedores" hacía de default.
   Reusa datos ya calculados por otras vistas (ratioStandings, buildStoreChampionship) en vez de
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
  // Inicio muestra quién va arriba: solo clasificados. La lista completa (con los no clasificados
  // al final) se sigue pasando a renderPrivateCard, para que quien no clasifica vea su propia
  // tarjeta con el estado real en vez de que le desaparezca sin explicación.
  const sellersClasificados=sellers.filter(estaClasificado);
  // Copa Constructores es el campeonato de puntos del mes (ver buildStoreChampionship) — Inicio
  // reusa esa misma lista para que el líder que muestra acá sea el mismo que ve el local al entrar
  // a la pestaña Locales, no un cálculo aparte con otro criterio.
  const stores=buildStoreChampionship().list;

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
        ${top3Html(sellersClasificados,p=>p.name,p=>p.local)}
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

  // Venta objetivo de la EMPRESA sale de LOCAL_DIARIO (Objetivo de cada local, sumado), no de sumar
  // "Venta obj" por vendedor — mismo motivo que aggregateStoreMetricForWeek(weekKey,null): esa suma
  // puede inflarse si los % de objetivo mensual de los vendedores de un local pasan el 100%.
  const totals=localDiarioWeekRows(currentKey).reduce((acc,row)=>{acc.real+=num(row,'Venta real');acc.obj+=num(row,'Objetivo');return acc},{real:0,obj:0});
  const ratio=totals.obj?totals.real/totals.obj*100:null;
  const leaderSeller=sellersClasificados[0]||null,leaderStore=stores[0]||null;

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
        <span class="home-card-sub">${leaderStore?`${number(leaderStore.total)} pts`:'Sin datos'}</span>
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
// Solo para el podio de Fama ("Locales destacados" de la semana ya cerrada) — % de Venta crudo de
// ESA semana puntual, análogo al podio de vendedores de arriba (que tampoco es la Liga ni el
// Campeonato, es la foto de esa semana). No es lo mismo que la Copa Constructores (que ahora es el
// campeonato de puntos acumulado del mes, ver buildStoreChampionship) — antes sí lo eran y el
// título de esta sección decía "Copa Constructores", así que se renombró para no repetir la misma
// confusión ("es lo mismo que...") que motivó el cambio. Ver conversación del 2026-09-04.
function aggregateStoresForWeek(weekKey){
  // Reusa aggregateStoreMetricForWeek(weekKey,null) — Venta del LOCAL desde LOCAL_DIARIO, no
  // sumando "Venta obj" por vendedor (ver comentario largo ahí arriba: sumar por vendedor podía
  // inflar el objetivo del local si los % de objetivo mensual de sus vendedores sumaban más de
  // 100%, como pasaba en Rivadavia).
  const groups=aggregateStoreMetricForWeek(weekKey,null);
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
// Mismo look que famaHighlightCard, pero para un LOCAL (identidad = local, no name+local como en
// un vendedor) — mismo patrón que ya separa famaPodiumCard/famaStoreCard para persona vs. local.
function famaHighlightStoreCard(title,store,valueFn){
  if(!store)return`<div class="fama-highlight-card"><span class="fama-highlight-title">${title}</span><span class="fama-highlight-empty">Sin datos esta semana</span></div>`;
  return`<div class="fama-highlight-card">
    <span class="fama-highlight-title">${title}</span>
    <span class="fama-highlight-name">${escapeHtml(store.local)}</span>
    <span class="fama-highlight-sub">${valueFn(store)}</span>
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

  const sellersOfWeek=ratioStandings(famaKey,null);
  const storesOfWeek=aggregateStoresForWeek(famaKey);
  // El podio y los destacados por % son premios: solo entra quien clasificó esa semana (mínimo de
  // días trabajados, ver MIN_DIAS_CLASIFICA). Sin esto el Salón de la Fama seguiría coronando la
  // semana de 1 día que el ranking ya deja sin puntos.
  const sellerTop=sellersOfWeek.filter(estaClasificado).slice(0,3);
  const storeTop=storesOfWeek.slice(0,3);
  const tpTop=ratioStandings(famaKey,'TP').filter(estaClasificado)[0]||null;
  const perfumesTop=ratioStandings(famaKey,'Perfumes').filter(estaClasificado)[0]||null;
  const boxerTop=ratioStandings(famaKey,'Boxer').filter(estaClasificado)[0]||null;
  const mejoraList=famaPrevKey?buildMejoraListFor(famaKey,famaPrevKey):[];
  const aceleracionTop=mejoraList.filter(p=>p.mejora!==null&&estaClasificado(p)).sort((a,b)=>b.mejora-a.mejora)[0]||null;
  // Mayor venta en $ CRUDO (no % de cumplimiento) — a propósito solo como dato informativo acá, sin
  // ranking de 15 puestos ni puntos GP: un local grande (más tráfico/más vendedores) va a ganar esto
  // siempre, sea cual sea el esfuerzo relativo de cada quien — justo lo que el resto de la app evita
  // midiendo todo por % del objetivo. Como highlight suelto, es un dato de negocio legítimo (quién
  // genera más facturación) sin instalar una competencia que ya se sabe quién gana. Pedido del
  // usuario, conversación del 2026-09-06.
  // Ésta SÍ queda abierta a todos, clasifiquen o no: no reparte puntos ni premio, y es venta en $
  // crudo de la semana entera — quien trabajó pocos días no la va a ganar por accidente, y si
  // alguna vez la gana es porque efectivamente facturó más que nadie.
  const vendorMayorVenta=[...sellersOfWeek].sort((a,b)=>b.real-a.real)[0]||null;
  const localMayorVenta=[...storesOfWeek].sort((a,b)=>b.real-a.real)[0]||null;

  // Todo el contenido de Fama va DENTRO de un único wrapper — #rankList en desktop es
  // display:grid (pensado para las filas normales del ranking), y sin este wrapper cada sección
  // de Fama (podio, título, store-row, título, highlight-grid) se volvía su propia celda de esa
  // grilla y quedaban todas descolocadas una al lado de la otra en vez de apiladas.
  $('rankList').innerHTML=`<div class="fama-wrap">
    <div class="fama-podium">
      ${famaPodiumCard(sellerTop[0],1)}
      <div class="fama-podium-row">${famaPodiumCard(sellerTop[1],2)}${famaPodiumCard(sellerTop[2],3)}</div>
    </div>
    <div class="fama-section-title">// LOCALES DESTACADOS · TOP 3</div>
    <div class="fama-store-row">${[storeTop[0],storeTop[1],storeTop[2]].map((s,idx)=>famaStoreCard(s,idx+1)).join('')}</div>
    <div class="fama-section-title">// DESTACADOS DE LA SEMANA</div>
    <div class="fama-highlight-grid">
      ${famaHighlightCard(`${icon('crown','svg-icon text-icon')}Rey del TP`,tpTop,p=>money(p.real))}
      ${famaHighlightDualCard(`${icon('sparkles','svg-icon text-icon')}Perfumes · ${icon('shirt','svg-icon text-icon')}Bóxers`,perfumesTop,boxerTop)}
      ${famaHighlightCard(`${icon('rocket','svg-icon text-icon')}Mayor Aceleración`,aceleracionTop,p=>`+${p.mejora.toFixed(1)} pts`)}
      ${famaHighlightCard(`${icon('banknote','svg-icon text-icon')}Mayor Venta · Vendedor`,vendorMayorVenta,p=>money(p.real))}
      ${famaHighlightStoreCard(`${icon('banknote','svg-icon text-icon')}Mayor Venta · Local`,localMayorVenta,s=>money(s.real))}
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
  // Semana no clasificada: el puesto en la lista no significa nada (va al final por regla, no por
  // rendimiento), así que se muestra NC con el motivo — un "#41 de 43" se leería como si hubiera
  // rendido pésimo, justo al revés de lo que suele pasar en estos casos.
  const noClasifica=p.clasifica===false;
  $('privatePosNum').textContent=noClasifica?'NC':`#${pos}`;
  $('privatePosTotal').textContent=noClasifica?'sin puntos':`de ${total}`;
  $('privateProgress').textContent=progressText(p);
  if(noClasifica){
    // Corto sí o sí: .private-micro es nowrap con ellipsis, un texto largo se corta a la mitad en
    // un teléfono angosto. La explicación completa vive en el Reglamento.
    $('privateMicro').innerHTML=`<span class="nc-text">${icon('alertTriangle','svg-icon text-icon')}Trabajaste ${p.dias} de ${p.diasAbiertos} día${p.diasAbiertos===1?'':'s'} · mínimo ${p.minDias}</span>`;
  }else if(idx===0){
    $('privateMicro').innerHTML=`<span class="positive">${icon('trophy','svg-icon text-icon')}${leaderText||'¡Vas primero esta semana!'}</span>`;
  }else{
    const above=list[idx-1];
    const text=microText?microText(p,above):null;
    $('privateMicro').textContent=text?`${text} #${idx}`:'Seguí así para subir de puesto.';
  }
  // Barra + festejo: solo para métricas real/objetivo (p.ratio existe) — Campeonato y Mejora usan
  // puntos/deltas sin un 100% fijo de referencia, así que ahí no hay ni barra ni "objetivo cumplido".
  const goalBadge=$('privateGoalBadge'),barEl=$('privateBar'),barFill=$('privateBarFill');
  const hasRatio=typeof p.ratio==='number';
  // Sin festejo de "objetivo cumplido" en una semana que no clasifica: la barra llena y el cartel
  // verde al lado del aviso de "no suma puntos" se contradicen entre sí.
  const goalHit=hasRatio&&p.ratio>=100&&!noClasifica;
  barEl.hidden=!hasRatio;
  if(hasRatio){
    barFill.style.width=`${Math.max(3,Math.min(100,p.ratio))}%`;
    barFill.classList.toggle('goal-hit',goalHit);
  }
  goalBadge.hidden=!goalHit;
  card.classList.toggle('goal-hit',goalHit);
  card.hidden=false;
  document.body.classList.add('has-private-card');
}

function showEmpty(message){
  $('rankPeriod').textContent='';
  $('rankList').innerHTML=`<div class="state-msg">${icon('search','svg-icon state-msg-icon')}<strong>Sin datos</strong>${escapeHtml(message)}</div>`;
  $('privateCard').hidden=true;
  document.body.classList.remove('has-private-card');
}

applyTheme(localStorage.getItem(THEME_KEY)||'dark');
qa('.theme-btn').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themeChoice)));
$('refreshBtn').addEventListener('click',()=>loadData(true));
// Delegado porque el botón vive DENTRO del innerHTML que arma loadData() en el error de primera
// carga — se re-crea cada vez, así que un listener puesto una sola vez en #rankList (que nunca se
// reemplaza a sí mismo) es lo único que sigue funcionando después del primer render.
$('rankList').addEventListener('click',e=>{if(e.target.closest('[data-retry]'))loadData(true)});
$('syncBannerRetry').addEventListener('click',()=>loadData(true));
$('localFilter').addEventListener('change',()=>{state.local=$('localFilter').value;render()});
qa('#scopeTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.scope=btn.dataset.scope;render()}));
qa('#catTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.category=btn.dataset.category;render()}));
qa('#storeCatTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{state.storeCategory=btn.dataset.storeCategory;render()}));

/* ── SWIPE ENTRE CATEGORÍAS (atajo táctil sobre la lista) ─────
   Deslizar el dedo sobre #rankList avanza/retrocede una píldora de categoría — mismo resultado que
   tocar la píldora de al lado, solo que con el gesto. A propósito NO usa preventDefault en ningún
   momento (ambos listeners son {passive:true}): solo lee dónde empezó y dónde terminó el toque, así
   que el scroll vertical nativo de la lista sigue funcionando exactamente igual que antes, sin
   ningún riesgo de que un swipe "se coma" el scroll o viceversa. Umbrales (50px horizontal mínimo,
   60px vertical máximo, 600ms máximo) para que solo dispare con un gesto horizontal franco y rápido
   — un scroll vertical normal, aunque tenga algo de deriva lateral, nunca lo activa.
   Cicla con wrap-around (de la última píldora vuelve a la primera) y solo aplica en Vendedores/
   Locales, que son las únicas vistas con píldoras de categoría para recorrer. */
(function initCategorySwipe(){
  const rankList=$('rankList');
  const SWIPE_MIN_X=50,SWIPE_MAX_Y=60,SWIPE_MAX_MS=600;
  let startX=0,startY=0,startT=0;
  rankList.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;startT=Date.now();
  },{passive:true});
  rankList.addEventListener('touchend',e=>{
    const touch=e.changedTouches[0];
    if(!touch||(state.scope!=='sellers'&&state.scope!=='stores'))return;
    const dx=touch.clientX-startX,dy=touch.clientY-startY;
    if(Date.now()-startT>SWIPE_MAX_MS)return;
    if(Math.abs(dx)<SWIPE_MIN_X||Math.abs(dy)>SWIPE_MAX_Y)return;
    const dir=dx<0?1:-1; // deslizar a la izquierda = siguiente (misma convención que stories/carruseles)
    const tabs=qa(state.scope==='sellers'?'#catTabs .tab':'#storeCatTabs .tab');
    // El nombre de la propiedad de state ("category"/"storeCategory") coincide 1:1 con el atributo
    // data-* de su fila de píldoras — una sola variable alcanza para leer state[key] y el dataset.
    const key=state.scope==='sellers'?'category':'storeCategory';
    const keys=tabs.map(b=>b.dataset[key]);
    const idx=keys.indexOf(state[key]);
    if(idx===-1)return;
    const nextKey=keys[(idx+dir+keys.length)%keys.length];
    state[key]=nextKey;
    render();
    tabs[keys.indexOf(nextKey)].scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
  },{passive:true});
})();

/* ── BOTTOM NAV + DRAWER (mobile) ─────────────────────────────
   Los 3 botones con data-scope navegan directo (mismo mecanismo que scopeTabs, un solo estado
   compartido). "Más" no cambia de scope — abre el drawer, que es el menú completo. */
qa('.bottom-nav-item[data-scope]').forEach(btn=>btn.addEventListener('click',()=>{state.scope=btn.dataset.scope;render();closeDrawer()}));
function openDrawer(){
  openSheet($('drawerBackdrop'));
  openSheet($('drawerPanel'));
  $('bottomNavMore').setAttribute('aria-expanded','true');
}
function closeDrawer(){
  closeSheet($('drawerBackdrop'));
  closeSheet($('drawerPanel'));
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

// Detecta cuando hay una versión nueva del sitio ya publicada (el SW la baja solo en segundo
// plano) y muestra el cartel de "Actualizar" en vez de dejar la actualización pasar calladita.
// Escucha 'controllerchange' en vez de 'updatefound'/'statechange' del worker instalando (como se
// hacía antes): sw.js llama a skipWaiting()+clients.claim() apenas se instala, sin esperar a que
// se cierren las pestañas viejas, y esa transición puede pasar tan rápido que el estado
// "installed" nunca llega a engancharse a tiempo — carrera de tiempos real, confirmada en uso
// (el cartel no estaba apareciendo pese a que la versión sí se actualizaba, gracias a que sw.js ya
// pide todo a la red primero). 'controllerchange' en cambio se dispara siempre que el control
// efectivamente cambia de manos, sin importar cuán rápido haya sido skipWaiting — es el evento que
// las guías de PWA recomiendan para esto justamente por eso.
// hadController se guarda ANTES de registrar nada: si ya es true, esta pestaña venía controlada
// por un SW previo y cualquier controllerchange posterior es una actualización real. Si es false,
// es la primera visita (no hay "versión anterior" de la que avisar) y no se engancha el listener.
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    const hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(()=>{
      if(hadController){
        navigator.serviceWorker.addEventListener('controllerchange',()=>{
          openSheet($('updateBanner'));
        });
      }
    }).catch(()=>{});
  });
  $('updateBannerBtn').addEventListener('click',()=>location.reload());
}

/* ── PULL-TO-REFRESH (gesto táctil, dispara lo mismo que el botón de refresh) ──────────────────
   La app no tenía forma de "tirar hacia abajo para actualizar" — el único disparador visible era
   el ícono de 30px arriba a la derecha, un gesto que en el celular de cualquiera ya está
   incorporado de memoria (Instagram/WhatsApp/Gmail). Solo se activa con scrollY=0 (no hay nada
   arriba para "tirar" si ya se está scrolleando la lista), con ningún panel/modal abierto encima,
   y con un gesto claramente vertical (dy > |dx|) para no pisar el swipe horizontal de categorías
   que ya vive en #rankList (ver initCategorySwipe más arriba) — ambos escuchan touchmove sobre
   elementos distintos sin frenar la propagación, así que conviven sin problema mientras cada uno
   se quede en su eje. Damped a la mitad del recorrido del dedo (mismo "rubber-band" que el scroll
   nativo) para que no se sienta que el indicador "se despega" del dedo.
   OJO: esto no se pudo probar con el dedo en un celular real desde acá — antes de darlo por
   bueno del todo conviene confirmarlo a mano, mismo criterio que ya se usa en el resto del
   archivo para todo lo táctil (swipe de categorías, tamaños de tap, etc.). */
(function initPullToRefresh(){
  const indicator=document.createElement('div');
  indicator.className='ptr-indicator';
  indicator.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
  document.body.appendChild(indicator);
  const THRESHOLD=64,MAX_PULL=90,DAMP=.5;
  let startX=0,startY=0,dragging=false,pulling=false,ready=false,refreshing=false;
  const scrollTopOf=()=>window.scrollY||document.documentElement.scrollTop||0;
  const anySheetOpen=()=>!$('identityModal').hidden||!$('pinModal').hidden||!$('drawerPanel').hidden;
  function reset(){
    pulling=false;ready=false;
    indicator.classList.add('snap');
    indicator.classList.remove('show','ready');
    indicator.style.transform='';
    setTimeout(()=>indicator.classList.remove('snap'),260);
  }
  window.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||refreshing||anySheetOpen()||scrollTopOf()>0){dragging=false;return}
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;dragging=true;
  },{passive:true});
  window.addEventListener('touchmove',e=>{
    if(!dragging||refreshing)return;
    const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;
    if(dy<=0||Math.abs(dx)>dy||scrollTopOf()>0){if(pulling)reset();return}
    pulling=true;
    const damped=Math.min(MAX_PULL,dy*DAMP);
    ready=damped>=THRESHOLD*DAMP;
    indicator.classList.remove('snap');
    indicator.style.transform=`translate(-50%, ${damped}px) rotate(${damped*2.4}deg)`;
    indicator.classList.add('show');
    indicator.classList.toggle('ready',ready);
    if(e.cancelable)e.preventDefault();
  },{passive:false});
  window.addEventListener('touchend',()=>{
    if(!dragging)return;
    dragging=false;
    if(pulling&&ready){
      refreshing=true;
      indicator.classList.add('spin','snap');
      indicator.style.transform='translate(-50%, 36px)';
      setTimeout(()=>indicator.classList.remove('snap'),260);
      loadData(false).finally(()=>{
        refreshing=false;
        indicator.classList.remove('spin');
        reset();
      });
    }else{
      reset();
    }
  },{passive:true});
})();

renderIdentityChip();
renderSupervisorChip();
loadData(true); // spinner prendido en la carga inicial: si el consolidador tarda, se ve que algo está pasando
setInterval(()=>loadData(false),5*60*1000);
