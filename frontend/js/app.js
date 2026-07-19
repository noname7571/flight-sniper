(function(){'use strict';
const A='/api';let user=null,routes=[],priceChart=null;
const $=function(id){return document.getElementById(id)};

// --- Session & Auth ---
async function checkSession(){
  try{
    const res=await fetch(A+'/auth/me',{credentials:'include'});
    if(!res.ok){user=null;return false;}
    user=await res.json();return true;
  }catch(e){user=null;return false;}
}

async function showToast(m,t){if(!t)t='success';
  const c=$('toastContainer'),o=document.createElement('div');
  o.className='toast '+t;o.textContent=m;c.appendChild(o);
  setTimeout(function(){o.classList.add('removing');setTimeout(function(){o.remove()},300)},4000);
}

async function apiFetch(p,o){
  if(!o)o={};var h={'Content-Type':'application/json'};
  if(o.headers){for(var k in o.headers)if(o.headers.hasOwnProperty(k))h[k]=o.headers[k];}
  var opts={headers:h,credentials:'include'};
  if(o.method)opts.method=o.method;if(o.body)opts.body=o.body;
  var res=await fetch(A+p,opts);
  if(!res.ok){var e;try{e=await res.json()}catch(ex){e={error:res.statusText}}throw new Error(e.error||'Request failed');}
  if(res.status===204)return null;return res.json();
}

function esc(s){if(!s)return '';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

// --- Routing ---
function navigate(){
  var hash=window.location.hash||'#/';
  var pages=document.querySelectorAll('.page');
  pages.forEach(function(p){p.style.display='none'});
  var target=document.getElementById('page-'+hash.replace('#/','').replace('/',''));
  if(!target)navigateTo('home');
  else target.style.display='';
  updateNav();
}

function navigateTo(hash){window.location.hash='#/'+hash;}

document.querySelectorAll('[data-nav]').forEach(function(el){
  el.addEventListener('click',function(e){
    var href=this.getAttribute('href');
    if(href&&href.startsWith('#/')){navigateTo(href.replace('#/',''));e.preventDefault();}
  });
});

window.addEventListener('hashchange',navigate);

// --- Navbar update ---
function updateNav(){
  var hash=window.location.hash||'#/';
  var isAuth=!!user;
  $('navAuth').style.display=isAuth?'none':'';
  $('navUser').style.display=isAuth?'':'none';
  if(isAuth&&user)$('navUserEmail').textContent=user.email||user.name;
  $('navDashboard').style.display=isAuth?'':'none';
  $('navAdmin').style.display=(isAuth&&user&&user.role==='admin')?'':'none';
}

// --- Auth handlers ---
$('loginForm').addEventListener('submit',async function(e){
  e.preventDefault();var btn=$('loginBtn');btn.disabled=true;btn.textContent='Signing in...';
  $('loginError').textContent='';
  try{
    var res=await fetch(A+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:$('loginEmail').value,password:$('loginPassword').value})});
    if(!res.ok){var d=await res.json();throw new Error(d.error||'Login failed');}
    user=await res.json();showToast('Signed in as '+user.email);navigateTo('dashboard');
  }catch(e){$('loginError').textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='Sign In';}
});

$('signupForm').addEventListener('submit',async function(e){
  e.preventDefault();var btn=$('signupBtn');btn.disabled=true;btn.textContent='Creating account...';
  $('signupError').textContent='';
  try{
    var res=await fetch(A+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({name:$('signupName').value,email:$('signupEmail').value,password:$('signupPassword').value})});
    if(!res.ok){var d=await res.json();throw new Error(d.error||'Registration failed');}
    user=await res.json();showToast('Account created! Welcome '+user.name);navigateTo('dashboard');
  }catch(e){$('signupError').textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='Create Account';}
});

$('logoutBtn').addEventListener('click',async function(){
  await fetch(A+'/auth/logout',{method:'POST',credentials:'include'});
  user=null;showToast('Signed out');navigateTo('home');
});

// --- Dashboard content ---
function renderDashboard(){
  var d=$('dashboardContent');
  d.innerHTML=`<div class="stats-grid" id="dashStats">
    <div class="stat-card sc-routes"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><div class="stat-info"><span class="stat-value" id="statRoutes">0</span><span class="stat-label">Routes</span></div></div>
    <div class="stat-card sc-alerts"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div class="stat-info"><span class="stat-value" id="statAlerts">0</span><span class="stat-label">Alerts</span></div></div>
    <div class="stat-card sc-checks"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="stat-info"><span class="stat-value" id="statChecks">-</span><span class="stat-label">Last Check</span></div></div>
    <div class="stat-card sc-status"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div class="stat-info"><span class="stat-value stat-status-text" id="statStatus">Online</span><span class="stat-label">System</span></div></div>
  </div>
  <div class="panel" id="addRoutePanel"><div class="panel-header"><div class="panel-header-left"><div class="panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><h2 class="panel-title">New Monitor</h2></div><button class="panel-toggle" id="panelToggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button></div>
    <form id="dashRouteForm" class="route-form">
      <div class="form-section">
        <div class="form-row form-row-3">
          <div class="form-field"><label class="form-label">From</label><div class="input-wrap"><input type="text" id="dOrigin" placeholder="VIE" maxlength="3" required></div></div>
          <div class="form-field"><label class="form-label">To</label><div class="input-wrap"><input type="text" id="dDest" placeholder="BCN" maxlength="3" required></div></div>
          <div class="form-field"><label class="form-label">Max Price</label><div class="input-wrap input-price"><span class="input-prefix">&euro;</span><input type="number" id="dMaxPrice" placeholder="50" min="1" step="1" required></div></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-field"><label class="form-label">Email</label><div class="input-wrap"><input type="email" id="dEmail" placeholder="you@example.com"></div></div>
          <div class="form-field"><label class="form-label">Discord Webhook</label><div class="input-wrap"><input type="url" id="dWebhook" placeholder="https://discord.com/api/webhooks/..."></div></div>
          <div class="form-field"><label class="form-label">Check Every</label><div class="input-wrap"><select id="dInterval"><option value="30">30 min</option><option value="60" selected>1 hour</option><option value="120">2 hours</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">24 hours</option></select></div></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-field"><label class="form-label">Allow only</label><div class="input-wrap"><input type="text" id="dInclude" placeholder="BCN, AGP, MAD"></div></div>
          <div class="form-field"><label class="form-label">Exclude</label><div class="input-wrap"><input type="text" id="dExclude" placeholder="LHR, CDG"></div></div>
          <div class="form-field form-field-check"><label class="toggle-label"><input type="checkbox" id="dReturn" class="toggle-input"><span class="toggle-track"><span class="toggle-thumb"></span></span><span class="toggle-text">Return tickets</span></label></div>
        </div>
      </div>
      <div class="form-actions"><button type="submit" class="btn btn-primary" id="dashSubmit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Monitoring</button></div>
    </form>
  </div>
  <div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/><path d="M2 12h20"/></svg></div><h2 class="panel-title">Nearby Airports</h2></div></div>
    <div class="airport-grid"><div class="airport-chip"><span class="chip-code">VIE</span><span class="chip-name">Vienna</span><span class="chip-dist">60km</span></div><div class="airport-chip"><span class="chip-code">BUD</span><span class="chip-name">Budapest</span><span class="chip-dist">200km</span></div><div class="airport-chip"><span class="chip-code">PRG</span><span class="chip-name">Prague</span><span class="chip-dist">330km</span></div><div class="airport-chip"><span class="chip-code">BTS</span><span class="chip-name">Bratislava</span><span class="chip-dist">Local</span></div><div class="airport-chip"><span class="chip-code">KSC</span><span class="chip-name">Kosice</span><span class="chip-dist">400km</span></div><div class="airport-chip"><span class="chip-code">TAT</span><span class="chip-name">Poprad</span><span class="chip-dist">Seasonal</span></div><div class="airport-chip"><span class="chip-code">KTW</span><span class="chip-name">Katowice</span><span class="chip-dist">280km</span></div><div class="airport-chip"><span class="chip-code">KRK</span><span class="chip-name">Krakow</span><span class="chip-dist">350km</span></div></div>
  </div>
  <div class="panel" id="routesPanel"><div class="panel-header"><div class="panel-header-left"><div class="panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><h2 class="panel-title">Monitored Routes</h2><span class="badge" id="dashRouteCount">0</span></div></div>
    <div id="dashRoutesList"><div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><h3 class="empty-title">No routes yet</h3><p class="empty-desc">Add your first route above</p></div></div>
  </div>
  <div class="panel" id="dashAlertsPanel"><div class="panel-header"><div class="panel-header-left"><div class="panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><h2 class="panel-title">Alert History</h2><span class="badge" id="dashAlertCount">0</span></div></div>
    <div id="dashAlertList"><div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg></div><h3 class="empty-title">No alerts yet</h3></div></div>
  </div>`;
  
  // Attach dashboard events
  initDashboard();
}

function initDashboard(){
  var f=$('dashRouteForm');if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();var btn=$('dashSubmit');btn.disabled=true;
    try{
      var d={origin:$('dOrigin').value.trim().toUpperCase(),destination:$('dDest').value.trim().toUpperCase(),max_price:parseFloat($('dMaxPrice').value),email:$('dEmail').value.trim()||null,discord_webhook:$('dWebhook').value.trim()||null,check_interval_minutes:parseInt($('dInterval').value),include_destinations:$('dInclude').value.trim()||null,exclude_destinations:$('dExclude').value.trim()||null,return_ticket:$('dReturn').checked};
      var r=await apiFetch('/routes',{method:'POST',body:JSON.stringify(d)});
      routes.push(r);renderDashRoutes();showToast('Now monitoring '+r.origin+' -> '+r.destination);f.reset();$('dReturn').checked=false;
    }catch(e){showToast(e.message,'error')}finally{btn.disabled=false;}
  });
  
  // IATA auto-uppercase
  ['dOrigin','dDest'].forEach(function(id){var el=$(id);if(!el)return;el.addEventListener('input',function(){this.value=this.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)});});
  ['dInclude','dExclude'].forEach(function(id){var el=$(id);if(!el)return;el.addEventListener('input',function(){this.value=this.value.toUpperCase().replace(/[^A-Z, ]/g,'')});});
  
  loadDashData();
}

async function loadDashData(){
  try{routes=await apiFetch('/routes');}catch(e){routes=[];}
  renderDashRoutes();
  try{var c=await apiFetch('/alerts/count');if($('statAlerts'))$('statAlerts').textContent=String(c.count||0);if($('dashAlertCount'))$('dashAlertCount').textContent=String(c.count||0);}catch(e){}
  try{var a=await apiFetch('/alerts');renderDashAlerts(a);}catch(e){}
  if($('statRoutes'))$('statRoutes').textContent=String(routes.length);
  
  // Health check
  try{await apiFetch('/health');if($('statStatus'))$('statStatus').textContent='Online';}catch(e){if($('statStatus'))$('statStatus').textContent='Offline';}
}

function renderDashRoutes(){
  var c=$('dashRouteCount');if(c)c.textContent=String(routes.length);
  var l=$('dashRoutesList');if(!l)return;
  l.innerHTML='';
  if(routes.length===0){l.innerHTML='<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><h3 class="empty-title">No routes yet</h3><p class="empty-desc">Add your first route above</p></div>';return;}
  for(var i=0;i<routes.length;i++){
    var r=routes[i],div=document.createElement('div');div.className='route-item';
    var h='<div class="route-main"><div class="route-dest">'+esc(r.origin)+' <span class="route-arrow">&rarr;</span> '+esc(r.destination)+'</div><div class="route-meta"><span>&#9670; Max '+esc(String(r.max_price))+' '+esc(r.currency)+'</span><span>&#9670; Every '+esc(String(r.check_interval_minutes))+'min</span>';
    if(r.return_ticket)h+='<span><span class="route-tag route-tag-return">Round trip</span></span>';
    if(r.include_destinations)h+='<span><span class="route-tag route-tag-inc">Allow: '+esc(r.include_destinations)+'</span></span>';
    if(r.exclude_destinations)h+='<span><span class="route-tag route-tag-exc">Exclude: '+esc(r.exclude_destinations)+'</span></span>';
    h+='</div></div><div class="route-actions"><button class="btn btn-danger del-route" data-id="'+r.id+'">Remove</button></div>';
    div.innerHTML=h;l.appendChild(div);
  }
  l.querySelectorAll('.del-route').forEach(function(b){
    b.addEventListener('click',async function(){
      var id=parseInt(this.getAttribute('data-id'));
      try{await apiFetch('/routes/'+id,{method:'DELETE'});routes=routes.filter(function(rr){return rr.id!==id});renderDashRoutes();showToast('Route removed');}catch(e){showToast(e.message,'error');}
    });
  });
}

function renderDashAlerts(data){
  var l=$('dashAlertList');if(!l)return;
  l.innerHTML='';
  if(!data||data.length===0){l.innerHTML='<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg></div><h3 class="empty-title">No alerts yet</h3></div>';return;}
  for(var i=0;i<data.length;i++){
    var a=data[i],div=document.createElement('div');div.className='alert-item';
    var cl=a.channel==='discord'?'alert-channel-discord':'alert-channel-email';
    var lb=a.channel==='discord'?'Discord':'Email';
    div.innerHTML='<div class="alert-main"><div class="alert-route">'+esc(a.route_origin||'?')+' <span class="route-arrow">&rarr;</span> '+esc(a.route_destination||'?')+'</div><div class="alert-meta"><span class="alert-price">'+esc(String(a.price))+' &euro;</span><span class="alert-threshold">Under '+esc(String(a.max_price))+'</span><span class="alert-time">'+esc(a.sent_at?a.sent_at.slice(0,16):'')+'</span></div></div><span class="alert-channel '+cl+'">'+lb+'</span>';
    l.appendChild(div);
  }
}

// --- Admin ---
async function loadAdmin(){
  if(!user||user.role!=='admin')return;
  try{
    var s=await apiFetch('/admin/stats');
    $('adminStats').innerHTML='<div class="admin-stat"><div class="admin-stat-value">'+s.totalUsers+'</div><div class="admin-stat-label">Users</div></div><div class="admin-stat"><div class="admin-stat-value">'+s.totalRoutes+'</div><div class="admin-stat-label">Routes</div></div><div class="admin-stat"><div class="admin-stat-value">'+s.totalAlerts+'</div><div class="admin-stat-label">Alerts</div></div>';
    var u=await apiFetch('/admin/users');
    var ul=$('adminUsersList');ul.innerHTML='';
    u.forEach(function(usr){
      var d=document.createElement('div');d.className='admin-user-item';
      d.innerHTML='<span>'+esc(usr.name)+' <span class="admin-user-email">('+esc(usr.email)+')</span></span><span><span class="admin-user-role '+usr.role+'">'+usr.role+'</span><span class="admin-user-date" style="margin-left:12px">'+esc(usr.created_at?usr.created_at.slice(0,10):'')+'</span></span>';
      ul.appendChild(d);
    });
  }catch(e){console.error('Admin load failed',e);}
}

// --- Init ---
async function init(){
  var hash=window.location.hash||'#/';
  if(hash==='#/')navigateTo('home');
  
  await checkSession();
  updateNav();
  navigate();
  
  if(window.location.hash==='#/dashboard'||window.location.hash==='#/admin'){
    if(!user)navigateTo('login');
    else{
      if(window.location.hash==='#/dashboard')renderDashboard();
      if(window.location.hash==='#/admin')loadAdmin();
    }
  }
  
  // Listen for navigation to dashboard/admin after page switch
  window.addEventListener('hashchange',async function(){
    var h=window.location.hash;
    if(h==='#/dashboard'||h==='#/admin'){
      if(!user){await checkSession();if(!user){navigateTo('login');return;}}
      if(h==='#/dashboard')renderDashboard();
      if(h==='#/admin')loadAdmin();
    }
  });
}

init();
})();