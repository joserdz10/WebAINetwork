const navGroups = [
  ['CONTROL CENTER', [['overview','▣','Overview']]],
  ['NETWORK', [['mexico','◉','México'],['states','◈','States'],['identities','◈','Media Identities']]],
  ['INTELLIGENCE', [['shared-brain','✦','Shared Brain'],['state-brains','✦','State Brains'],['topics','◎','Topics'],['profiles','◎','Profiles'],['watches','◌','Watches'],['sources','▤','Sources'],['radar','◉','Radar']]],
  ['EDITORIAL', [['discovery','▣','Discovery'],['inbox','▣','Story Inbox'],['stories','▣','Stories'],['studio','✦','Content Studio']]],
  ['DISTRIBUTION', [['publications','▣','Publications'],['channels','◉','Channels']]],
  ['OPERATIONS', [['runs','◉','Runs'],['activity','◉','Activity'],['errors','!','Errors']]],
  ['SYSTEM', [['integrations','⚙','Integrations'],['models','⚙','AI Models'],['settings','⚙','Settings']]],
];

const pageNames = Object.fromEntries(navGroups.flatMap(g=>g[1].map(i=>[i[0],i[2]])));
const data = {
  kpis:[['State Brains','3','+2 planned'],['Media identities','6','4 active NL'],['Sources','147','+12 this week'],['Watches','24','18 healthy'],['Stories / 24h','72','+18%','up'],['Published / 24h','21','+7%','up']],
  identities:[
    ['NEA','Norte En Alerta','Generalista · Nuevo León',['Facebook','Instagram'],'ACTIVE'],
    ['CR','Código Regio','Ciudad / Seguridad',['Facebook'],'ACTIVE'],
    ['PN','Punto Norte','Información local',['Facebook'],'ACTIVE'],
    ['CP','Círculo Político NL','Política estatal',['Facebook','X'],'ACTIVE'],
    ['HI','El Independiente HGO','Hidalgo',['Facebook'],'CONNECTED'],
    ['CO','Colima — identidad pendiente','Colima',[],'SETUP']
  ],
  stories:[
    ['URGENTE','Congreso de Nuevo León discute nuevo paquete de movilidad','Política · 5 fuentes · hace 8 min','READY'],
    ['IMPORTANTE','Gobierno reporta avance del viaducto de Línea 6 en Gonzalitos','Movilidad · 4 fuentes · hace 24 min','CONTENT READY'],
    ['NORMAL','Actualización de niveles y abasto de agua en zona metropolitana','Agua · 6 fuentes · hace 41 min','ANALYZING'],
    ['NORMAL','Agenda pública estatal: eventos y anuncios para esta tarde','Gobierno · 3 fuentes · hace 1 h','DISCOVERED']
  ]
};

function renderNav(){
  document.querySelector('#nav').innerHTML = navGroups.map(([label,items])=>`<div class="nav-group"><div class="nav-label">${label}</div>${items.map(([id,icon,name])=>`<button class="nav-item" data-page="${id}"><span class="nav-icon">${icon}</span>${name}</button>`).join('')}</div>`).join('');
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
}
function kpiCards(){ return `<div class="grid kpis">${data.kpis.map(([l,v,t,c])=>`<div class="card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-trend ${c||''}">${t}</div></div>`).join('')}</div>` }
function section(title,sub,body,action=''){ return `<div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div>${action?`<button class="link-button">${action}</button>`:''}</div>${body}` }
function activity(){ return `<div class="card">${[['Story creada','NL · Línea 6','2 min'],['Contenido aprobado','Norte En Alerta','11 min'],['Discovery run completada','NL · 328 items','18 min'],['Watch actualizado','Proceso Electoral NL','33 min']].map(([a,b,c])=>`<div class="activity-item"><span class="dot"></span><div><b>${a}</b><span>${b}</span></div><span>${c}</span></div>`).join('')}</div>` }

const pages = {
  overview:()=>`${kpiCards()}<div class="grid two-col"><div>${section('Network Intelligence','Estado operativo de los brains y su conocimiento',`<div class="grid three-col"><div class="card brain"><div class="brain-title"><span class="badge">ONLINE</span><span class="muted">GLOBAL</span></div><h3>Shared Brain</h3><p>Conocimiento transversal, entidades, relaciones, contexto nacional y memoria editorial compartida.</p><div class="progress"><i style="width:88%"></i></div></div><div class="card brain"><div class="brain-title"><span class="badge">ONLINE</span><span class="muted">STATE</span></div><h3>Nuevo León Brain</h3><p>47 fuentes · 18 topics · 31 profiles · 14 watches activos.</p><div class="progress"><i style="width:94%"></i></div></div><div class="card brain"><div class="brain-title"><span class="badge warn">SETUP</span><span class="muted">STATE</span></div><h3>Hidalgo Brain</h3><p>Estructura preparada para incorporación de fuentes, topics e identidades.</p><div class="progress"><i style="width:42%"></i></div></div></div>`,'Open Intelligence')}</div><div>${section('Live Activity','Últimos eventos del sistema',activity(),'View activity')}</div></div><div style="height:22px"></div>${section('Editorial Pipeline','Del discovery a la publicación',`<div class="card"><table class="table"><thead><tr><th>Story</th><th>Priority</th><th>Status</th><th>Identity</th><th></th></tr></thead><tbody>${data.stories.map((s,i)=>`<tr class="story-row"><td><div class="story-title">${s[1]}</div><div class="story-sub">${s[2]}</div></td><td><span class="priority ${i===0?'red':i===1?'yellow':'green'}">${s[0]}</span></td><td><span class="badge ${s[3].includes('ANALYZ')?'blue':''}">${s[3]}</span></td><td>Norte En Alerta</td><td><button class="cta secondary" onclick="go('stories')">Open</button></td></tr>`).join('')}</tbody></table></div>`,'Open Story Inbox')}`,
  mexico:()=>`<div class="hero"><div><div class="eyebrow">NETWORK / MEXICO</div><h2>National Control Center</h2><p>Vista de la red completa: brains estatales, identidades editoriales, operación y distribución.</p></div><div><div class="hero-number">32</div><div class="muted">State Brains target</div></div></div>${section('State network','Despliegue actual de la red',`<div class="grid three-col">${[['Nuevo León','ONLINE','6 identities','94'],['Hidalgo','SETUP','1 identity','42'],['Colima','PLANNED','0 identities','16']].map(([n,s,d,p])=>`<div class="card brain"><span class="badge ${s==='SETUP'?'warn':s==='PLANNED'?'blue':''}">${s}</span><h3>${n}</h3><p>${d}</p><div class="progress"><i style="width:${p}%"></i></div></div>`).join('')}</div>`)}`,
  states:()=>`${section('State Brains','Unidades de inteligencia editorial por estado',`<div class="card"><table class="table"><thead><tr><th>State</th><th>Brain</th><th>Sources</th><th>Topics</th><th>Identities</th><th>24h</th></tr></thead><tbody><tr><td class="strong">Nuevo León</td><td><span class="badge">ONLINE</span></td><td>47</td><td>18</td><td>4</td><td>72 stories</td></tr><tr><td class="strong">Hidalgo</td><td><span class="badge warn">SETUP</span></td><td>12</td><td>6</td><td>1</td><td>—</td></tr><tr><td class="strong">Colima</td><td><span class="badge blue">PLANNED</span></td><td>—</td><td>—</td><td>—</td><td>—</td></tr></tbody></table></div>`,'New State Brain')}`,
  identities:()=>`${section('Media Identities','Cada medio como producto independiente con Media DNA propio',`<div class="grid three-col">${data.identities.map(([logo,name,desc,channels,status])=>`<div class="card identity-card"><div class="identity-head"><div class="identity-logo">${logo}</div><span class="badge ${status==='SETUP'?'warn':''}">${status}</span></div><h3>${name}</h3><p>${desc}</p><div class="channel-row">${channels.map(c=>`<span class="channel on">${c}</span>`).join('')||'<span class="channel">No channels</span>'}</div><div style="margin-top:14px"><button class="cta secondary">Open identity</button></div></div>`).join('')}</div>`,'New Identity')}`,
  'shared-brain':()=>brainPage('Shared Brain','Global / México','Conocimiento compartido por toda la red',88,['1,284 entities','446 relationships','92 topics','11,602 source items']),
  'state-brains':()=>brainPage('Nuevo León Brain','State Intelligence','Memoria y contexto editorial específico de Nuevo León',94,['31 profiles','18 topics','47 sources','14 active watches']),
  topics:()=>listPage('Topics','Temas que el sistema sigue y conecta con Stories, Profiles y Watches',[['Proceso Electoral NL 2026-2027','SUPER TOPIC','26 stories','HIGH'],['Agua','PUBLIC ISSUE','84 stories','HIGH'],['Metro Línea 6 / Gonzalitos','INFRASTRUCTURE','41 stories','HIGH'],['Seguridad','PUBLIC ISSUE','117 stories','NORMAL']]),
  profiles:()=>listPage('Profiles','Personas y entidades con expediente acumulativo',[['Samuel García','PUBLIC FIGURE','128 stories','WATCHING'],['Mariana Rodríguez','PUBLIC FIGURE','73 stories','WATCHING'],['Gobierno de Nuevo León','ORGANIZATION','211 stories','ACTIVE'],['Metrorrey','ORGANIZATION','48 stories','ACTIVE']]),
  watches:()=>listPage('Watches','Monitoreos persistentes por entidad o tema',[['Samuel García','PROFILE','Last match 13 min','ACTIVE'],['Proceso Electoral NL','TOPIC','Last match 8 min','ACTIVE'],['Agua Nuevo León','TOPIC','Last match 32 min','ACTIVE'],['Línea 6','TOPIC','Last match 24 min','ACTIVE']]),
  sources:()=>listPage('Sources','Fuentes de información que alimentan Discovery',[['Gobierno de Nuevo León','OFFICIAL','High trust','ACTIVE'],['Congreso de Nuevo León','OFFICIAL','High trust','ACTIVE'],['Milenio Monterrey','MEDIA','Monitored','ACTIVE'],['ABC Noticias','MEDIA','Monitored','ACTIVE']]),
  radar:()=>`${section('Radar','Señales, cambios, tendencias y asuntos emergentes',`<div class="grid three-col">${[['Proceso Electoral NL','18 mentions / 2h','↑ Strong signal'],['Línea 6','11 mentions / 2h','↑ Rising'],['Agua','9 mentions / 2h','→ Stable']].map(x=>`<div class="card"><div class="eyebrow">SIGNAL</div><h3>${x[0]}</h3><p class="muted">${x[1]}</p><span class="badge blue">${x[2]}</span></div>`).join('')}</div>`)}`,
  discovery:()=>`${section('Discovery','Corridas de exploración y candidatos detectados',`<div class="card"><table class="table"><thead><tr><th>Run</th><th>Scope</th><th>Scanned</th><th>Candidates</th><th>Stories</th><th>Status</th></tr></thead><tbody><tr><td class="strong">NL-290928-1730</td><td>Nuevo León</td><td>328</td><td>38</td><td>12</td><td><span class="badge">COMPLETED</span></td></tr><tr><td>NL-290928-1130</td><td>Nuevo León</td><td>289</td><td>31</td><td>9</td><td><span class="badge">COMPLETED</span></td></tr></tbody></table></div>`,'Run discovery')}`,
  inbox:()=>storyTable('Story Inbox','Candidatos editoriales pendientes de decisión'),
  stories:()=>storyTable('Stories','Expedientes editoriales creados por el sistema'),
  studio:()=>`${section('Content Studio','Generación multi-formato por identidad editorial',`<div class="grid two-col"><div class="card"><div class="eyebrow">SELECT STORY</div><h3>Gobierno reporta avance del viaducto de Línea 6 en Gonzalitos</h3><p class="muted">Story #108 · Nuevo León · READY</p><div class="pill-tabs"><span class="pill active">Norte En Alerta</span><span class="pill">Código Regio</span><span class="pill">Punto Norte</span></div><div class="pill-tabs"><span class="pill active">Facebook</span><span class="pill">Instagram</span><span class="pill">Story</span><span class="pill">Reel</span><span class="pill">X</span><span class="pill">Article</span></div><button class="cta">Generate content</button></div><div class="card"><div class="eyebrow">MEDIA DNA</div><h3>Norte En Alerta</h3><div class="metric-line"><span>Tone</span><b>Direct / informative</b></div><div class="metric-line"><span>Political treatment</span><b>Neutral</b></div><div class="metric-line"><span>Geographic focus</span><b>Nuevo León</b></div><div class="metric-line"><span>Headline style</span><b>Short / high clarity</b></div></div></div>`)}`,
  publications:()=>listPage('Publications','Trazabilidad de distribución por pieza y canal',[['#108-FB-01','Norte En Alerta','Facebook','PUBLISHED'],['#107-IG-01','Norte En Alerta','Instagram','APPROVED'],['#104-FB-02','Código Regio','Facebook','PUBLISHED'],['#103-X-01','Círculo Político NL','X','QUEUED']]),
  channels:()=>listPage('Channels','Cuentas y destinos conectados',[['Norte En Alerta','Facebook','Connected','ACTIVE'],['Norte En Alerta','Instagram','Connected','ACTIVE'],['El Independiente HGO','Facebook','Connected','ACTIVE'],['Círculo Político NL','X','Pending','SETUP']]),
  runs:()=>pages.discovery(),
  activity:()=>section('Activity','Registro operativo y decisiones del sistema',activity()),
  errors:()=>listPage('Errors','Incidentes de integraciones y ejecución',[['META-401','Facebook token expired','Norte En Alerta','RESOLVED'],['DRIVE-401','Google Drive token revoked','Asset pipeline','RESOLVED'],['TG-409','Duplicate getUpdates session','Telegram Operator','RESOLVED']]),
  integrations:()=>listPage('Integrations','Servicios externos conectados a la plataforma',[['Meta Graph API','Facebook / Instagram','3 accounts','CONNECTED'],['Google Drive','Asset storage','1 workspace','CONNECTED'],['Telegram','Operator interface','1 bot','CONNECTED'],['S3 Storage','Media assets','Pending','SETUP']]),
  models:()=>listPage('AI Models','Orquestación por función',[['Discovery Model','Classification / filtering','Default','ACTIVE'],['Analysis Model','Story intelligence','Default','ACTIVE'],['Generation Model','Content creation','Media DNA aware','ACTIVE'],['Validation Model','Editorial checks','Neutrality / sourcing','ACTIVE']]),
  settings:()=>`<div class="empty-note">Configuración global del producto. En la siguiente iteración conectaremos persistencia, permisos mínimos, variables de entorno y configuración real de cada módulo.</div>`
};
function brainPage(name,type,desc,health,stats){ return `<div class="hero"><div><div class="eyebrow">${type}</div><h2>${name}</h2><p>${desc}</p></div><div><div class="hero-number">${health}%</div><div class="muted">Knowledge health</div></div></div><div class="grid two-col"><div class="card brain"><span class="badge">ONLINE</span><h3>Knowledge Graph</h3><p>Personas, organizaciones, lugares, temas, eventos y relaciones acumuladas por la plataforma.</p>${stats.map(s=>`<div class="metric-line"><span>${s}</span><span class="muted">indexed</span></div>`).join('')}</div><div>${section('Recent knowledge','Últimos cambios incorporados',activity())}</div></div>` }
function listPage(title,sub,rows){ return section(title,sub,`<div class="card"><table class="table"><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0?'strong':''}">${i===r.length-1?`<span class="badge ${String(c).includes('SETUP')?'warn':''}">${c}</span>`:c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`) }
function storyTable(title,sub){ return section(title,sub,`<div class="card"><table class="table"><thead><tr><th>Story</th><th>Priority</th><th>Status</th><th>Sources</th><th>Actions</th></tr></thead><tbody>${data.stories.map((s,i)=>`<tr><td><div class="story-title">${s[1]}</div><div class="story-sub">${s[2]}</div></td><td><span class="priority ${i===0?'red':i===1?'yellow':'green'}">${s[0]}</span></td><td><span class="badge ${s[3].includes('ANALYZ')?'blue':''}">${s[3]}</span></td><td>${[5,4,6,3][i]}</td><td><button class="cta secondary" onclick="go('studio')">Open</button></td></tr>`).join('')}</tbody></table></div>`,'New Story') }
function go(page){
  if(!pages[page]) page='overview';
  location.hash=page;
  document.querySelector('#page-title').textContent=pageNames[page]||'Overview';
  document.querySelector('#view').innerHTML=pages[page]();
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  window.scrollTo({top:0,behavior:'instant'});
}
window.go=go;
renderNav();
go(location.hash.replace('#','')||'overview');
window.addEventListener('hashchange',()=>go(location.hash.replace('#','')||'overview'));
