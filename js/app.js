(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const Backend=window.FrontierBackend, Charts=window.FrontierCharts;
const categories=["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Animais","Viagem","Projeto","Contas","Salário","Renda extra","Investimentos","Outros"];
const tableMap={projects:"projects",finance:"finance_entries",accounts:"accounts",notes:"notes",noteFolders:"note_folders",pets:"pets",calendar:"calendar_events",vehicles:"vehicles",studySessions:"study_sessions",books:"books",habits:"habits",habitLogs:"habit_logs",notifications:"notifications"};
const projectTypes={
  purchase:{category:"Compra",icon:"🚗",title:"Compra",desc:"Carro, moto, computador ou outra compra importante."},
  travel:{category:"Viagem",icon:"🌎",title:"Viagem",desc:"Roteiro, orçamento, checklist, documentos e gastos."},
  learning:{category:"Aprendizado",icon:"💻",title:"Aprendizado",desc:"IA, programação, idioma, curso ou habilidade."},
  career:{category:"Carreira",icon:"📚",title:"Carreira / Concurso",desc:"Provas, matérias, horas de estudo e etapas."},
  personal:{category:"Pessoal",icon:"✨",title:"Projeto pessoal",desc:"Objetivo livre acompanhado por tarefas e etapas."}
};
let user=null,state=Backend.blankState(),activeNoteId=null,projectFilter="",calendarCursor=new Date(),selectedCalendarDate="",noteSaveTimer=null;
let wizard={step:1,type:"",milestones:[],tasks:[],data:{}};
let editingFinanceId=null,editingCalendarId=null,editingVehicleId=null,editingBookId=null,editingProjectId=null,editingHabitId=null,deferredInstallPrompt=null;
let appPrefs={display_name:"",week_start:"sunday",theme:"dark",default_page:"dashboard"};

function uid(prefix="id"){return prefix+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)}
function esc(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function stripHtml(html=""){const d=document.createElement("div");d.innerHTML=html;return d.textContent||""}
const brlFormatter=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
function money(v){return brlFormatter.format(Number(v||0))}
function parseMoney(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let s=String(v??"").trim().replace(/R\$/gi,"").replace(/\s/g,"");
  if(!s)return 0;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^[-+]?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  s=s.replace(/[^0-9+\-.]/g,"");
  const n=Number(s);return Number.isFinite(n)?n:0
}
function formatCurrencyField(el){if(!el)return;const raw=String(el.value||"").trim();el.value=raw?money(parseMoney(raw)):""}
function dateKeyLocal(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function today(){return dateKeyLocal(new Date())}
function localDate(s){return s?new Date(s+"T12:00:00"):null}
function dateBR(s){const d=localDate(s);return d?d.toLocaleDateString("pt-BR"):"—"}
function addMonths(dateString,count){const d=localDate(dateString)||new Date();const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+count);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return dateKeyLocal(d)}
function addDays(dateString,count){const d=localDate(dateString)||new Date();d.setDate(d.getDate()+count);return dateKeyLocal(d)}
function addYears(dateString,count){const d=localDate(dateString)||new Date();const month=d.getMonth(),day=d.getDate();d.setFullYear(d.getFullYear()+count);if(d.getMonth()!==month){d.setDate(0)}return dateKeyLocal(d)}
function monthKey(s){return String(s||"").slice(0,7)}
function isCurrentMonth(s){return monthKey(s)===today().slice(0,7)}
function daysUntil(s){if(!s)return null;return Math.ceil((localDate(s)-new Date(new Date().toDateString()))/86400000)}
function showMessage(el,msg,type=""){el.textContent=msg;el.className="form-message "+type}
function toast(message,type="success"){
  const stack=$("#toastStack");if(!stack)return;
  const item=document.createElement("div");item.className=`toast ${type}`;item.innerHTML=`<span>${type==="error"?"!":"✓"}</span><div>${esc(message)}</div>`;stack.appendChild(item);
  requestAnimationFrame(()=>item.classList.add("show"));setTimeout(()=>{item.classList.remove("show");setTimeout(()=>item.remove(),250)},3000)
}
function currentPreferences(){const m=user?.user_metadata||{};return {display_name:m.display_name||user?.email?.split("@")[0]||"Usuário",week_start:m.week_start||"sunday",theme:m.theme||"dark",default_page:m.default_page||"dashboard"}}
function applyTheme(theme="dark"){
  document.body.classList.remove("theme-light","theme-kuromi","theme-barbie");
  if(theme==="light")document.body.classList.add("theme-light");
  if(theme==="kuromi")document.body.classList.add("theme-kuromi");
  if(theme==="barbie")document.body.classList.add("theme-barbie");
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta){meta.setAttribute("content",theme==="light"?"#f3e7d5":theme==="kuromi"?"#211225":theme==="barbie"?"#f45bb4":"#2b1b14")}
}
function applyPreferences(){appPrefs=currentPreferences();applyTheme(appPrefs.theme);const name=appPrefs.display_name||"Usuário";if($("#sideUserName"))$("#sideUserName").textContent=name;if($("#sideUserEmail"))$("#sideUserEmail").textContent=user?.email||"";if($("#userAvatar"))$("#userAvatar").textContent=name.charAt(0).toUpperCase()}
function isStandalone(){return window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updatePwaUi(){const title=$("#pwaStatusTitle"),text=$("#pwaStatusText"),btn=$("#installPwaBtn");if(!title||!text||!btn)return;if(isStandalone()){title.textContent="Frontier instalado";text.textContent="Você está usando o Frontier como aplicativo.";btn.textContent="Aplicativo instalado";btn.disabled=true;return}title.textContent="Instalar Frontier";text.textContent=deferredInstallPrompt?"Instalação disponível neste dispositivo.":"Você pode instalar o Frontier pelo navegador e abrir como um aplicativo.";btn.textContent="Instalar Frontier";btn.disabled=false}
async function installPwa(){if(isStandalone()){toast("O Frontier já está instalado.");return}if(deferredInstallPrompt){deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;updatePwaUi();if(choice?.outcome==="accepted")toast("Frontier instalado com sucesso.");return}toast("No menu do navegador, escolha ‘Instalar aplicativo’ ou ‘Adicionar à tela inicial’.","info")}
function isStateEmpty(){return !state.projects.length&&!state.finance.length&&!state.notes.length&&!state.pets.length&&!state.calendar.length&&!state.vehicles.length&&!state.studySessions.length&&!state.books.length&&!state.habits.length}

async function persist(kind,entity){await Backend.upsertEntity(user,tableMap[kind],entity);await Backend.saveState(user,state)}
async function removePersist(kind,id){await Backend.deleteEntity(user,tableMap[kind],id);await Backend.saveState(user,state)}
async function persistLocalOnly(){await Backend.saveState(user,state)}

async function boot(){
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("Service Worker:",err))}
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;updatePwaUi()});
  window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;updatePwaUi()});
  Backend.onAuthStateChange(async(event,authUser)=>{
    if(event==="PASSWORD_RECOVERY"){
      const newPassword=prompt("Digite sua nova senha (mínimo 6 caracteres):");
      if(newPassword&&newPassword.length>=6){
        try{await Backend.updatePassword(newPassword);alert("Senha atualizada com sucesso.")}catch(err){alert(err.message||"Não foi possível atualizar a senha.")}
      }
    }
  });
  $("#backendModeLabel").textContent=Backend.mode==="supabase"
    ?"Modo Supabase ativo: autenticação e dados serão salvos no projeto configurado."
    :"Modo demonstração local: funciona agora no navegador. Configure o Supabase depois para sincronizar entre dispositivos.";
  bindStaticEvents();
  user=await Backend.getCurrentUser();
  if(user){await enterApp()}
}
function bindStaticEvents(){
  $$(".auth-tabs button").forEach(b=>b.onclick=()=>switchAuthTab(b.dataset.authTab));
  $("#loginForm").addEventListener("submit",onLogin);
  $("#registerForm").addEventListener("submit",onRegister);
  $("#forgotPasswordBtn").onclick=onForgotPassword;
  $("#logoutBtn").onclick=onLogout;
  $$(".nav button").forEach(b=>b.onclick=()=>openPage(b.dataset.page));
  $$(`[data-mobile-page]`).forEach(b=>b.onclick=()=>openPage(b.dataset.mobilePage));
  $$("[data-page-link]").forEach(b=>b.onclick=e=>{e.preventDefault();openPage(b.dataset.pageLink)});
  $$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  $("#quickAddBtn").onclick=()=>$("#quickAddMenu").classList.toggle("hidden");
  document.addEventListener("click",e=>{if(!e.target.closest("#quickAddBtn")&&!e.target.closest("#quickAddMenu"))$("#quickAddMenu")?.classList.add("hidden")});
  $("#globalSearch").addEventListener("input",renderGlobalSearch);
  document.addEventListener("focusin",e=>{if(e.target?.matches?.("[data-currency]")){e.target.select?.()}});
  document.addEventListener("focusout",e=>{if(e.target?.matches?.("[data-currency]"))formatCurrencyField(e.target)});
  $("#projectSearch").addEventListener("input",renderProjects);
  $("#projectStatusFilter").addEventListener("change",renderProjects);
  $("#projectHealthFilter").addEventListener("change",renderProjects);
  $$("#projectCategoryTabs button").forEach(b=>b.onclick=()=>{$$("#projectCategoryTabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");projectFilter=b.dataset.filter;renderProjects()});
  ["finSearch","finType","finCategory","finAccount","finNature","finMonth"].forEach(id=>$("#"+id).addEventListener("input",renderFinance));
  $("#fSourceType").addEventListener("change",fillFinanceSourceSelect);
  $("#fNature").addEventListener("change",updateFinanceRecurrenceUi);
  $("#financeForm").addEventListener("submit",saveFinanceEntry);
  $("#accountForm").addEventListener("submit",saveAccount);
  $("#calendarForm").addEventListener("submit",saveCalendarEvent);
  $("#calendarPrev").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);selectedCalendarDate=dateKeyLocal(calendarCursor);renderCalendar()};
  $("#calendarNext").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);selectedCalendarDate=dateKeyLocal(calendarCursor);renderCalendar()};
  $("#folderForm").addEventListener("submit",saveNoteFolder);
  $("#noteSearch").addEventListener("input",renderNotes);
  $("#noteFolderFilter").addEventListener("change",renderNotes);
  $("#noteTitle").addEventListener("input",queueNoteSave);
  $("#noteTags").addEventListener("input",queueNoteSave);
  $("#noteFolder").addEventListener("change",queueNoteSave);
  $("#noteColor").addEventListener("input",queueNoteSave);
  $("#noteContent").addEventListener("input",queueNoteSave);
  $("#notePinBtn").onclick=toggleNotePin;
  $("#noteDeleteBtn").onclick=deleteActiveNote;
  $$(".rich-toolbar [data-cmd]").forEach(b=>b.onclick=()=>{document.execCommand(b.dataset.cmd,false,b.dataset.value||null);$("#noteContent").focus();queueNoteSave()});
  $$(".rich-toolbar [data-symbol]").forEach(b=>b.onclick=()=>{document.execCommand("insertText",false,b.dataset.symbol+" ");$("#noteContent").focus();queueNoteSave()});
  $("#petForm").addEventListener("submit",savePet);
  $("#studyForm").addEventListener("submit",saveStudySession);
  $("#vehicleForm").addEventListener("submit",saveVehicle);
  $("#bookForm").addEventListener("submit",saveBook);
  $("#habitForm").addEventListener("submit",saveHabit);
  $("#notificationFilter").addEventListener("change",renderAlerts);
  $("#markAllNotificationsBtn").onclick=markAllNotificationsRead;
  $("#reviewMonthInput").addEventListener("change",renderMonthlyReviewModal);
  $("#enablePushBtn").onclick=togglePushNotifications;
  $("#bookSearch").addEventListener("input",renderBooks);
  $("#bookStatusFilter").addEventListener("change",renderBooks);
  $("#projectEditForm").addEventListener("submit",saveProjectEdit);
  $("#settingsForm").addEventListener("submit",saveSettings);
  $("#installPwaBtn").addEventListener("click",installPwa);

  $("#projectBackBtn").onclick=wizardBack;
  $("#projectNextBtn").onclick=wizardNext;
  window.addEventListener("resize",()=>{if(user){renderDashboardCharts();if($("#finance").classList.contains("active"))renderFinanceCharts()}});
}
function switchAuthTab(tab){$$(".auth-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));$$(".auth-form").forEach(f=>f.classList.toggle("active",f.id===(tab==="login"?"loginForm":"registerForm")))}
async function onLogin(e){e.preventDefault();showMessage($("#loginMessage"),"Entrando...");try{const data=await Backend.login({email:$("#loginEmail").value,password:$("#loginPassword").value});user=data.user;await enterApp()}catch(err){showMessage($("#loginMessage"),err.message||"Não foi possível entrar.","error")}}
async function onRegister(e){e.preventDefault();const p=$("#registerPassword").value,p2=$("#registerPassword2").value;if(p!==p2){showMessage($("#registerMessage"),"As senhas não coincidem.","error");return}showMessage($("#registerMessage"),"Criando conta...");try{const data=await Backend.register({name:$("#registerName").value.trim(),email:$("#registerEmail").value,password:p});if(data.needsConfirmation){showMessage($("#registerMessage"),"Conta criada. Verifique seu e-mail para confirmar o cadastro.","success");return}user=data.user;await enterApp()}catch(err){showMessage($("#registerMessage"),err.message||"Não foi possível criar a conta.","error")}}
async function onForgotPassword(){const email=$("#loginEmail").value.trim();if(!email){showMessage($("#loginMessage"),"Informe seu e-mail primeiro.","error");return}try{await Backend.resetPassword(email);showMessage($("#loginMessage"),"Se a conta existir, o link de recuperação foi enviado.","success")}catch(err){showMessage($("#loginMessage"),err.message,"error")}}
async function onLogout(){try{const sub=await currentPushSubscription();if(sub){await Backend.removePushSubscription(user,sub.endpoint);await sub.unsubscribe()}}catch{}await Backend.logout();location.reload()}
async function enterApp(){
  state=await Backend.loadState(user);normalizeState();
  $("#authScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");
  applyPreferences();
  $("#currentDateLabel").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
  fillStaticOptions();renderAll();renderSettings();openPage(appPrefs.default_page||"dashboard");updatePwaUi();
}
function normalizeState(){
  const blank=Backend.blankState();state={...blank,...state};
  Object.keys(blank).forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
}
function openPage(id){$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));$$(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));$$(`[data-mobile-page]`).forEach(b=>b.classList.toggle("active",b.dataset.mobilePage===id));$("#globalSearchResults").classList.add("hidden");if(id==="finance")renderFinance();if(id==="calendar")renderCalendar();if(id==="notes")renderNotes();if(id==="pets")renderPets();if(id==="studies")renderStudies();if(id==="vehicles")renderVehicles();if(id==="books")renderBooks();if(id==="habits")renderHabits();if(id==="alerts")renderAlerts();if(id==="settings")renderSettings();window.scrollTo({top:0,behavior:"smooth"})}
function closeModal(id){$("#"+id)?.classList.add("hidden")}
function closeQuickMenu(){$("#quickAddMenu").classList.add("hidden")}
function fillStaticOptions(){
  $("#fCategory").innerHTML=categories.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#finCategory").innerHTML='<option value="">Todas as categorias</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join("");
}
function renderAll(){fillAccountSelects();renderDashboard();renderProjects();renderStudies();renderVehicles();renderBooks();renderFinance();renderCalendar();renderNotes();renderPets();renderHabits();renderAlerts();updatePushUi()}
function renderGlobalSearch(){
  const q=$("#globalSearch").value.trim().toLowerCase(),box=$("#globalSearchResults");if(q.length<2){box.classList.add("hidden");return}
  const results=[];
  state.projects.filter(x=>`${x.name} ${x.why||""}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Projeto",title:x.name,sub:x.category,action:`Frontier.openProjectDetail('${x.id}')`}));
  state.notes.filter(x=>`${x.title} ${stripHtml(x.content)}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Nota",title:x.title||"Sem título",sub:(x.tags||[]).join(", "),action:`Frontier.openNoteFromSearch('${x.id}')`}));
  state.finance.filter(x=>`${x.description} ${x.category}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Finanças",title:x.description,sub:`${x.category} • ${money(x.amount)}`,action:`Frontier.goFinanceEntry('${x.id}')`}));
  state.pets.filter(x=>`${x.name} ${x.species} ${x.breed||""}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Animal",title:x.name,sub:`${x.species}${x.breed?" • "+x.breed:""}`,action:`Frontier.openPetDetail('${x.id}')`}));
  state.vehicles.filter(x=>`${x.name} ${x.brand||""} ${x.model||""} ${x.plate||""}`.toLowerCase().includes(q)).slice(0,4).forEach(x=>results.push({kind:"Veículo",title:x.name,sub:`${x.brand||""} ${x.model||""}`.trim(),action:`Frontier.openVehicleDetail('${x.id}')`}));
  state.studySessions.filter(x=>`${x.subject} ${x.note||""}`.toLowerCase().includes(q)).slice(0,4).forEach(x=>results.push({kind:"Estudo",title:x.subject,sub:`${x.minutes} min`,action:`Frontier.goStudies()`}));
  state.books.filter(x=>`${x.title} ${x.author||""} ${x.category||""}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Livro",title:x.title,sub:`${x.author||"Autor não informado"} • ${x.status}`,action:`Frontier.openBookDetail('${x.id}')`}));
  state.habits.filter(x=>`${x.name} ${x.note||""}`.toLowerCase().includes(q)).slice(0,5).forEach(x=>results.push({kind:"Hábito",title:x.name,sub:`Sequência: ${habitStreak(x)} dia(s)`,action:`Frontier.openPagePublic('habits')`}));
  getCalendarEvents().filter(x=>`${x.title} ${x.type||""}`.toLowerCase().includes(q)).slice(0,4).forEach(x=>results.push({kind:"Agenda",title:x.title,sub:`${dateBR(x.date)} • ${x.type||""}`,action:`Frontier.goCalendar()` }));
  box.innerHTML=results.length?results.slice(0,12).map(r=>`<button class="search-result" onclick="${r.action}"><b>${esc(r.title)}</b><small>${r.kind} • ${esc(r.sub||"")}</small></button>`).join(""):'<div class="search-result"><small>Nada encontrado.</small></div>';box.classList.remove("hidden");
}

/* DASHBOARD */
function renderDashboard(){
  const empty=isStateEmpty();$("#dashboardEmpty").classList.toggle("hidden",!empty);$("#dashboardContent").classList.toggle("hidden",empty);if(empty)return;
  const active=state.projects.filter(p=>p.status!=="Concluído"),avg=state.projects.length?Math.round(state.projects.reduce((s,p)=>s+projectProgress(p),0)/state.projects.length):0,tot=financeTotals(state.finance),alerts=getAlerts();
  $("#dashProjectCount").textContent=state.projects.length;$("#dashProjectSub").textContent=active.length+" em andamento";$("#dashProgress").textContent=avg+"%";$("#dashBalance").textContent=money(tot.income-tot.expense);$("#dashPetCount").textContent=state.pets.length;$("#dashPetSub").textContent=alerts.filter(a=>a.domain==="pet").length+" cuidados próximos";
  renderTodayDashboard();renderDashboardHabits();renderDashboardReview();
  renderDashboardCharts();
  const actions=[];
  state.projects.forEach(p=>(p.tasks||[]).filter(t=>!t.done).slice(0,2).forEach(t=>actions.push({title:t.text,sub:p.name,icon:"☑"})));
  getAlerts().slice(0,5).forEach(a=>actions.push({title:a.title,sub:a.subtitle,icon:a.icon}));
  $("#dashboardNextActions").innerHTML=actions.length?actions.slice(0,7).map(x=>stackItem(x.icon,x.title,x.sub)).join(""):'<div class="stack-item"><small>Nenhuma pendência importante.</small></div>';
  $("#dashboardPets").innerHTML=state.pets.length?state.pets.slice(0,4).map(p=>{const exp=financeTotals(state.finance.filter(f=>f.sourceType==="pet"&&f.sourceId===p.id)).expense;return stackItem(petIcon(p.species),p.name,`${p.species} • gastos: ${money(exp)}`)}).join(""):'<div class="stack-item"><small>Nenhum animal cadastrado.</small></div>';
  const weekMinutes=state.studySessions.filter(x=>{const d=localDate(x.date);return d&&((new Date()-d)/86400000)<=7&&d<=new Date()}).reduce((a,x)=>a+Number(x.minutes||0),0);
  $("#dashboardStudies").innerHTML=state.studySessions.length?stackItem("📚",`${(weekMinutes/60).toFixed(1).replace(".0","")}h nos últimos 7 dias`,`${state.studySessions.length} sessões registradas`):'<div class="stack-item"><small>Nenhuma sessão de estudo.</small></div>';
  $("#dashboardVehicles").innerHTML=state.vehicles.length?state.vehicles.slice(0,4).map(v=>{const exp=financeTotals(state.finance.filter(f=>f.sourceType==="vehicle"&&f.sourceId===v.id&&isCurrentMonth(f.date))).expense;return stackItem(vehicleIcon(v.type),v.name,`${Number(v.odometer||0).toLocaleString("pt-BR")} km • mês: ${money(exp)}`)}).join(""):'<div class="stack-item"><small>Nenhum veículo cadastrado.</small></div>';
  const reading=state.books.filter(b=>b.status==="Lendo");
  $("#dashboardBooks").innerHTML=reading.length?reading.slice(0,4).map(b=>stackItem("📖",b.title,`${bookProgress(b)}% • ${b.currentPage||0}/${b.totalPages||"?"} páginas`)).join(""):state.books.length?stackItem("📚","Nenhum livro em leitura",`${state.books.length} livro(s) na biblioteca`):'<div class="stack-item"><small>Nenhum livro cadastrado.</small></div>';
  const recent=[...state.notes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,4);$("#dashboardNotes").innerHTML=recent.length?recent.map(n=>stackItem(n.pinned?"📌":"📝",n.title||"Sem título",stripHtml(n.content).slice(0,65)||"Nota vazia")).join(""):'<div class="stack-item"><small>Nenhuma nota ainda.</small></div>';
  const upcoming=getCalendarEvents().filter(e=>{const d=daysUntil(e.date);return d!==null&&d>=0&&d<=30}).slice(0,5);$("#dashboardCalendar").innerHTML=upcoming.length?upcoming.map(e=>`<div class="calendar-chip"><strong>${dateBR(e.date)}</strong><small>${esc(e.title)}</small></div>`).join(""):'<div class="stack-item"><small>Nenhuma data nos próximos 30 dias.</small></div>';
}
function renderDashboardCharts(){
  Charts.projectBars("dashProjectChart","dashProjectChartEmpty",state.projects,projectProgress);
  Charts.expensePie("dashExpenseChart","dashExpenseChartEmpty",state.finance.filter(f=>isCurrentMonth(f.date)&&f.date<=today()));
  Charts.cashFlow("dashCashChart","dashCashChartEmpty",state.finance.filter(f=>!f.date||f.date<=today()));
}
function stackItem(icon,title,sub){return `<div class="stack-item"><div><b>${icon} ${esc(title)}</b><small>${esc(sub||"")}</small></div></div>`}

/* TODAY + HABITS + MONTHLY REVIEW */
function habitDueOn(h,date=today()){const d=localDate(date);return !!(h?.active!==false&&d&&(h.days||[0,1,2,3,4,5,6]).map(Number).includes(d.getDay()))}
function habitLogFor(habitId,date=today()){return state.habitLogs.find(x=>x.habitId===habitId&&x.date===date)}
function habitDone(habitId,date=today()){return !!habitLogFor(habitId,date)}
function habitStreak(h){
  let streak=0,d=localDate(today());
  for(let i=0;i<370;i++){
    const key=dateKeyLocal(d);
    if(habitDueOn(h,key)){if(habitDone(h.id,key))streak++;else if(key!==today()||habitDueOn(h,key))break}
    d.setDate(d.getDate()-1)
  }
  return streak
}
function habitMonthStats(month=today().slice(0,7)){
  const now=today(),[y,m]=month.split("-").map(Number),last=new Date(y,m,0).getDate();let due=0,done=0;
  state.habits.filter(h=>h.active!==false).forEach(h=>{for(let day=1;day<=last;day++){const key=`${month}-${String(day).padStart(2,"0")}`;if(key>now)continue;if(habitDueOn(h,key)){due++;if(habitDone(h.id,key))done++}}});
  return {due,done,rate:due?Math.round(done/due*100):0}
}
async function toggleHabitToday(id,date=today()){
  const h=state.habits.find(x=>x.id===id);if(!h||!habitDueOn(h,date))return;
  const existing=habitLogFor(id,date);
  if(existing){state.habitLogs=state.habitLogs.filter(x=>x.id!==existing.id);await removePersist("habitLogs",existing.id);toast(`${h.name}: marcação removida.`,"info")}
  else{const log={id:uid("hlog"),habitId:id,date,createdAt:new Date().toISOString()};state.habitLogs.unshift(log);await persist("habitLogs",log);toast(`${h.name} concluído hoje.`)}
  renderAll()
}
function renderDashboardHabits(){
  const box=$("#dashboardHabits");if(!box)return;const due=state.habits.filter(h=>habitDueOn(h));
  box.innerHTML=due.length?due.slice(0,6).map(h=>`<button class="habit-today ${habitDone(h.id)?"done":""}" onclick="Frontier.toggleHabitToday('${h.id}')"><span>${esc(h.icon||"✅")}</span><div><b>${esc(h.name)}</b><small>${habitDone(h.id)?"Concluído hoje":`Sequência: ${habitStreak(h)} dia(s)`}</small></div><strong>${habitDone(h.id)?"✓":"○"}</strong></button>`).join(""):`<div class="stack-item"><small>${state.habits.length?"Nenhum hábito previsto para hoje.":"Crie hábitos simples para acompanhar sua rotina."}</small></div>`
}
function renderTodayDashboard(){
  const box=$("#dashboardToday"),badge=$("#todaySummaryBadge");if(!box)return;const items=[];
  getCalendarEvents().filter(e=>e.date===today()).forEach(e=>items.push({icon:e.type==="Financeiro"?"💵":"📅",title:e.title,sub:e.type||"Agenda"}));
  state.finance.filter(f=>f.type==="expense"&&f.date===today()).forEach(f=>items.push({icon:"💵",title:f.description,sub:`Hoje • ${money(f.amount)}`}));
  state.projects.filter(p=>p.deadline===today()&&p.status!=="Concluído").forEach(p=>items.push({icon:"🧭",title:`Prazo: ${p.name}`,sub:p.category}));
  state.habits.filter(h=>habitDueOn(h)&&!habitDone(h.id)).forEach(h=>items.push({icon:h.icon||"✅",title:h.name,sub:"Hábito de hoje",habitId:h.id}));
  const reading=state.books.find(b=>b.status==="Lendo");if(reading)items.push({icon:"📖",title:reading.title,sub:`Leitura atual • ${bookProgress(reading)}%`,kind:"reading"});
  const importantCount=items.filter(x=>x.kind!=="reading").length;badge.textContent=importantCount?`${importantCount} item(ns)`:"Tudo em ordem";
  box.innerHTML=items.length?items.slice(0,10).map(x=>x.habitId?`<button class="today-item action" onclick="Frontier.toggleHabitToday('${x.habitId}')"><span>${esc(x.icon)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div><strong>Marcar</strong></button>`:`<div class="today-item"><span>${esc(x.icon)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div></div>`).join(""):'<div class="today-empty">✓ Nada urgente hoje. Aproveite o caminho.</div>'
}
function monthLabel(month){const [y,m]=month.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
function reviewForMonth(month){
  const fin=state.finance.filter(f=>monthKey(f.date)===month&&f.date<=today()),ft=financeTotals(fin,true);
  const studyMinutes=state.studySessions.filter(x=>monthKey(x.date)===month).reduce((a,x)=>a+Number(x.minutes||0),0);
  const completedBooks=state.books.filter(b=>b.endDate&&monthKey(b.endDate)===month&&b.status==="Concluído").length;
  const pages=state.books.reduce((sum,b)=>sum+(b.sessions||[]).filter(x=>monthKey(x.date)===month).reduce((a,x)=>a+Number(x.pages||0),0),0);
  const habit=habitMonthStats(month);
  let projectAdvance=0,projectCount=0;
  state.projects.forEach(p=>{const a=(p.progressHistory||[]).filter(x=>monthKey(x.date)===month);if(a.length>=2){projectAdvance+=Math.max(0,Number(a[a.length-1].progress||0)-Number(a[0].progress||0));projectCount++}});
  return {income:ft.income,expense:ft.expense,reserve:ft.reserve,balance:ft.income-ft.expense,studyHours:studyMinutes/60,completedBooks,pages,habitRate:habit.rate,habitDone:habit.done,habitDue:habit.due,projectAdvance:projectCount?Math.round(projectAdvance/projectCount):0,projectCount}
}
function renderDashboardReview(){const month=today().slice(0,7),r=reviewForMonth(month);$("#dashboardReviewMonth").textContent=monthLabel(month);$("#dashboardReview").innerHTML=`<div class="review-mini-grid"><div><small>Saldo</small><b>${money(r.balance)}</b></div><div><small>Estudos</small><b>${r.studyHours.toFixed(1).replace(".0","")}h</b></div><div><small>Hábitos</small><b>${r.habitRate}%</b></div><div><small>Leitura</small><b>${r.pages} pág.</b></div></div>`}
function openMonthlyReview(month=today().slice(0,7)){$("#reviewMonthInput").value=month;$("#monthlyReviewModal").classList.remove("hidden");renderMonthlyReviewModal()}
function renderMonthlyReviewModal(){const month=$("#reviewMonthInput")?.value||today().slice(0,7),r=reviewForMonth(month),box=$("#monthlyReviewBody");if(!box)return;box.innerHTML=`<div class="review-hero"><span class="section-kicker">${esc(monthLabel(month).toUpperCase())}</span><h3>${r.balance>=0?"Mês positivo":"Mês de atenção"}</h3><p>${r.balance>=0?"Você fechou o período com saldo positivo entre entradas e saídas.":"As saídas passaram das entradas neste período."}</p></div><div class="review-grid"><div class="review-metric"><small>Entradas</small><b>${money(r.income)}</b></div><div class="review-metric"><small>Saídas</small><b>${money(r.expense)}</b></div><div class="review-metric"><small>Saldo</small><b>${money(r.balance)}</b></div><div class="review-metric"><small>Reservas</small><b>${money(r.reserve)}</b></div><div class="review-metric"><small>Estudos</small><b>${r.studyHours.toFixed(1).replace(".0","")}h</b></div><div class="review-metric"><small>Páginas lidas</small><b>${r.pages}</b></div><div class="review-metric"><small>Livros concluídos</small><b>${r.completedBooks}</b></div><div class="review-metric"><small>Hábitos</small><b>${r.habitRate}%</b></div><div class="review-metric"><small>Avanço médio de projetos</small><b>+${r.projectAdvance}%</b></div></div><div class="review-note"><b>Resumo</b><p>Você cumpriu ${r.habitDone} de ${r.habitDue} hábitos previstos, estudou ${r.studyHours.toFixed(1).replace(".0","")}h e concluiu ${r.completedBooks} livro(s). O saldo financeiro do período foi ${money(r.balance)}.</p></div>`}

/* HABITS */
function openHabitModal(id=""){
  editingHabitId=id||null;$("#habitForm").reset();$("#habitIcon").value="✅";$$('#habitDays input').forEach(x=>x.checked=true);$("#habitModalTitle").textContent=id?"Editar hábito":"Novo hábito";
  if(id){const h=state.habits.find(x=>x.id===id);if(!h)return;$("#habitIcon").value=h.icon||"✅";$("#habitName").value=h.name||"";$("#habitNote").value=h.note||"";$$('#habitDays input').forEach(x=>x.checked=(h.days||[]).map(Number).includes(Number(x.value)))}
  $("#habitModal").classList.remove("hidden")
}
async function saveHabit(e){
  e.preventDefault();const name=$("#habitName").value.trim(),days=$$('#habitDays input:checked').map(x=>Number(x.value));if(!name||!days.length){toast("Escolha um nome e ao menos um dia da semana.","error");return}
  if(editingHabitId){const h=state.habits.find(x=>x.id===editingHabitId);Object.assign(h,{name,icon:$("#habitIcon").value.trim()||"✅",note:$("#habitNote").value.trim(),days,updatedAt:new Date().toISOString()});await persist("habits",h);toast("Hábito atualizado.")}
  else{const h={id:uid("habit"),name,icon:$("#habitIcon").value.trim()||"✅",note:$("#habitNote").value.trim(),days,active:true,createdAt:new Date().toISOString()};state.habits.unshift(h);await persist("habits",h);toast("Hábito criado.")}
  editingHabitId=null;closeModal("habitModal");renderAll()
}
async function toggleHabitActive(id){const h=state.habits.find(x=>x.id===id);if(!h)return;h.active=h.active===false?true:false;h.updatedAt=new Date().toISOString();await persist("habits",h);renderAll();toast(h.active?"Hábito reativado.":"Hábito pausado.","info")}
async function deleteHabit(id){if(!confirm("Excluir este hábito e seu histórico de marcações?"))return;const logs=state.habitLogs.filter(x=>x.habitId===id);state.habits=state.habits.filter(x=>x.id!==id);state.habitLogs=state.habitLogs.filter(x=>x.habitId!==id);await removePersist("habits",id);for(const l of logs)await removePersist("habitLogs",l.id);renderAll();toast("Hábito excluído.")}
function renderHabits(){
  if(!$("#habitsGrid"))return;const active=state.habits.filter(h=>h.active!==false),due=active.filter(h=>habitDueOn(h)),done=due.filter(h=>habitDone(h.id)),stats=habitMonthStats();$("#habitStatActive").textContent=active.length;$("#habitStatToday").textContent=`${done.length}/${due.length}`;$("#habitStatRate").textContent=stats.rate+"%";$("#habitStatStreak").textContent=Math.max(0,...state.habits.map(h=>habitStreak(h)));
  $("#habitsGrid").innerHTML=state.habits.length?state.habits.map(h=>`<article class="habit-card ${h.active===false?"paused":""}"><div class="habit-card-top"><span class="habit-big-icon">${esc(h.icon||"✅")}</span><div><h3>${esc(h.name)}</h3><p>${esc(h.note||"Sem observação")}</p></div></div><div class="habit-week">${[0,1,2,3,4,5,6].map(d=>`<span class="${(h.days||[]).map(Number).includes(d)?"on":""}">${["D","S","T","Q","Q","S","S"][d]}</span>`).join("")}</div><div class="metric-grid"><div class="metric-box"><small>Sequência</small><b>${habitStreak(h)} dias</b></div><div class="metric-box"><small>Hoje</small><b>${habitDueOn(h)?(habitDone(h.id)?"Feito ✓":"Pendente"):"Folga"}</b></div></div><div class="habit-actions">${habitDueOn(h)?`<button class="btn ${habitDone(h.id)?"ghost":"secondary"}" onclick="Frontier.toggleHabitToday('${h.id}')">${habitDone(h.id)?"Desmarcar":"Concluir hoje"}</button>`:""}<button class="btn ghost" onclick="Frontier.openHabitModal('${h.id}')">Editar</button><button class="btn ghost" onclick="Frontier.toggleHabitActive('${h.id}')">${h.active===false?"Reativar":"Pausar"}</button><button class="btn danger" onclick="Frontier.deleteHabit('${h.id}')">Excluir</button></div></article>`).join(""):'<div class="empty-grid">Nenhum hábito criado. Comece com algo simples e útil.</div>'
}

/* PROJECTS */
function projectProgress(p){
  if((p.trackMode==="money"||p.trackMode==="hours")&&Number(p.target)>0)return Math.max(0,Math.min(100,Math.round(Number(p.current||0)/Number(p.target)*100)));
  const all=[...(p.milestones||[]),...(p.tasks||[])];return all.length?Math.round(all.filter(x=>x.done).length/all.length*100):Number(p.manualProgress||0)
}
function projectHealth(p){
  if(p.status==="Concluído"||projectProgress(p)>=100)return {code:"good",label:"Concluído"};
  if(!p.deadline)return {code:"warn",label:"Sem prazo"};
  const end=localDate(p.deadline),start=new Date(p.createdAt||Date.now()),now=new Date(),total=Math.max(1,end-start),elapsed=Math.max(0,Math.min(total,now-start)),expected=elapsed/total*100,diff=projectProgress(p)-expected;
  if(end<now)return {code:"bad",label:"Atrasado"};if(diff>=-10)return {code:"good",label:"No ritmo"};if(diff>=-25)return {code:"warn",label:"Atenção"};return {code:"bad",label:"Abaixo do ritmo"}
}
function renderProjects(){
  const q=$("#projectSearch").value.toLowerCase(),status=$("#projectStatusFilter").value,health=$("#projectHealthFilter").value;
  const arr=state.projects.filter(p=>(!projectFilter||p.category===projectFilter)&&(!status||p.status===status)&&(!health||projectHealth(p).code===health)&&(!q||`${p.name} ${p.why||""}`.toLowerCase().includes(q)));
  $("#projectsGrid").innerHTML=arr.length?arr.map(p=>{const h=projectHealth(p);return `<article class="project-card" onclick="Frontier.openProjectDetail('${p.id}')"><span class="badge">${p.icon} ${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.why||"")}</p><div class="progress"><span style="width:${projectProgress(p)}%"></span></div><div class="project-footer"><span>${projectProgress(p)}%</span><span class="badge ${h.code}">${h.label}</span></div></article>`}).join(""):'<div class="empty-grid">Nenhum projeto encontrado. <button class="link-btn" onclick="Frontier.openProjectWizard()">Criar um projeto</button></div>';
}
function openProjectWizard(type=""){
  wizard={step:1,type:"",milestones:[],tasks:[],data:{}};$("#projectModal").classList.remove("hidden");if(type)wizard.type=type;renderWizard()
}
function renderWizard(){
  $$(".wizard-steps span").forEach(x=>x.classList.toggle("active",Number(x.dataset.wstepLabel)===wizard.step));$("#projectBackBtn").style.visibility=wizard.step===1?"hidden":"visible";$("#projectNextBtn").textContent=wizard.step===4?"Criar projeto":"Continuar";
  let html="";
  if(wizard.step===1)html=`<div class="type-grid">${Object.entries(projectTypes).map(([k,v])=>`<button type="button" class="type-card ${wizard.type===k?"active":""}" onclick="Frontier.selectProjectType('${k}')"><span class="type-icon">${v.icon}</span><b>${v.title}</b><small>${v.desc}</small></button>`).join("")}</div>`;
  if(wizard.step===2){
    const d=wizard.data;
    html=`<div class="form-grid"><label class="full">Nome do projeto<input id="wpName" value="${esc(d.name||"")}" placeholder="Ex.: Comprar meu carro"></label><label class="full">Por que isso é importante?<textarea id="wpWhy" placeholder="O motivo ou resultado que você quer alcançar.">${esc(d.why||"")}</textarea></label><label>Prioridade<select id="wpPriority"><option ${d.priority==="Alta"?"selected":""}>Alta</option><option ${!d.priority||d.priority==="Média"?"selected":""}>Média</option><option ${d.priority==="Baixa"?"selected":""}>Baixa</option></select></label><label>Prazo desejado<input id="wpDeadline" type="date" value="${d.deadline||""}"></label></div>${wizardSpecificFields()}`;
  }
  if(wizard.step===3)html=wizardTrackingFields();
  if(wizard.step===4)html=`<div class="dynamic-panel"><div class="card-head"><div><h3>Etapas principais</h3><p>Grandes marcos do projeto.</p></div>${suggestionsButton()}</div><div class="inline-builder"><input id="milestoneInput" placeholder="Ex.: pesquisar modelos"><button class="btn secondary" onclick="Frontier.addWizardItem('milestones')">Adicionar</button></div><div id="milestoneBuilder" class="builder-list"></div></div><div class="dynamic-panel"><h3>Tarefas iniciais</h3><div class="inline-builder"><input id="taskInput" placeholder="Ex.: cotar seguro"><button class="btn secondary" onclick="Frontier.addWizardItem('tasks')">Adicionar</button></div><div id="taskBuilder" class="builder-list"></div></div>`;
  $("#projectWizardBody").innerHTML=html;renderWizardBuilders()
}
function selectProjectType(type){wizard.type=type;renderWizard()}
function captureWizardStep(){
  if(wizard.step===2){wizard.data.name=$("#wpName")?.value.trim()||"";wizard.data.why=$("#wpWhy")?.value.trim()||"";wizard.data.priority=$("#wpPriority")?.value||"Média";wizard.data.deadline=$("#wpDeadline")?.value||"";["extra1","extra2","origin","destination","transport","tripStart","tripEnd","skillLevel"].forEach(k=>{const el=$("#wp_"+k);if(el)wizard.data[k]=el.value})}
  if(wizard.step===3){wizard.data.target=parseMoney($("#wpTarget")?.value);wizard.data.current=parseMoney($("#wpCurrent")?.value);wizard.data.budget=parseMoney($("#wpBudget")?.value);wizard.data.reserved=parseMoney($("#wpReserved")?.value)}
}
function wizardSpecificFields(){
  const d=wizard.data,t=wizard.type;
  if(t==="purchase")return `<div class="dynamic-panel"><div class="form-grid"><label>O que deseja comprar?<input id="wp_extra1" value="${esc(d.extra1||"")}" placeholder="Ex.: carro"></label><label>Modelo / preferência<input id="wp_extra2" value="${esc(d.extra2||"")}" placeholder="Ex.: ainda pesquisando"></label></div></div>`;
  if(t==="travel")return `<div class="dynamic-panel"><div class="form-grid"><label>Origem<input id="wp_origin" value="${esc(d.origin||"")}" placeholder="Sua cidade"></label><label>Destino<input id="wp_destination" value="${esc(d.destination||"")}" placeholder="Ex.: Ceará / Argentina"></label><label>Transporte<select id="wp_transport"><option ${d.transport==="Carro"?"selected":""}>Carro</option><option ${d.transport==="Moto"?"selected":""}>Moto</option><option ${d.transport==="Avião"?"selected":""}>Avião</option><option ${d.transport==="Ônibus"?"selected":""}>Ônibus</option><option ${d.transport==="A definir"?"selected":""}>A definir</option></select></label><label>Início da viagem<input id="wp_tripStart" type="date" value="${d.tripStart||""}"></label><label>Retorno<input id="wp_tripEnd" type="date" value="${d.tripEnd||""}"></label></div></div>`;
  if(t==="learning")return `<div class="dynamic-panel"><div class="form-grid"><label>O que deseja aprender?<input id="wp_extra1" value="${esc(d.extra1||"")}" placeholder="Ex.: IA / Programação"></label><label>Nível desejado<select id="wp_skillLevel"><option ${d.skillLevel==="Fundamentos"?"selected":""}>Fundamentos</option><option ${d.skillLevel==="Intermediário"?"selected":""}>Intermediário</option><option ${d.skillLevel==="Avançado"?"selected":""}>Avançado</option></select></label></div></div>`;
  if(t==="career")return `<div class="dynamic-panel"><div class="form-grid"><label>Concurso / objetivo<input id="wp_extra1" value="${esc(d.extra1||"")}" placeholder="Ex.: concurso público"></label><label>Área / cargo<input id="wp_extra2" value="${esc(d.extra2||"")}" placeholder="Ex.: administrativo"></label></div></div>`;
  return `<div class="dynamic-panel"><div class="form-grid"><label>Área do projeto<input id="wp_extra1" value="${esc(d.extra1||"")}" placeholder="Ex.: saúde, casa, pessoal"></label><label>Detalhe opcional<input id="wp_extra2" value="${esc(d.extra2||"")}"></label></div></div>`;
}
function wizardTrackingFields(){
  const d=wizard.data,t=wizard.type;
  if(t==="purchase")return `<div class="dynamic-panel"><h3>Meta financeira</h3><p class="muted">Comprar algo faz sentido ser acompanhado pelo valor.</p><div class="form-grid"><label>Valor estimado<input id="wpTarget" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00" value="${d.target!==undefined&&d.target!==""?money(d.target):""}"></label><label>Já reservado<input id="wpCurrent" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00" value="${d.current!==undefined&&d.current!==""?money(d.current):""}"></label></div></div>`;
  if(t==="travel")return `<div class="dynamic-panel"><h3>Orçamento da viagem</h3><p class="muted">O progresso principal usa etapas; o dinheiro é acompanhado separadamente.</p><div class="form-grid"><label>Orçamento estimado<input id="wpBudget" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00" value="${d.budget!==undefined&&d.budget!==""?money(d.budget):""}"></label><label>Já reservado<input id="wpReserved" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00" value="${d.reserved!==undefined&&d.reserved!==""?money(d.reserved):""}"></label></div></div>`;
  if(t==="learning"||t==="career")return `<div class="dynamic-panel"><h3>Horas de dedicação</h3><p class="muted">Sem forçar valor financeiro onde ele não faz sentido.</p><div class="form-grid"><label>Meta de horas<input id="wpTarget" type="number" min="0" step="0.5" value="${d.target||""}"></label><label>Horas já realizadas<input id="wpCurrent" type="number" min="0" step="0.5" value="${d.current||""}"></label></div></div>`;
  return `<div class="dynamic-panel"><h3>Progresso por execução</h3><p class="muted">Este projeto será medido pelas etapas e tarefas concluídas.</p></div>`;
}
function suggestionsButton(){return `<button class="btn ghost" onclick="Frontier.addProjectSuggestions()">Adicionar sugestões</button>`}
function addProjectSuggestions(){
  const suggestions={
    purchase:{milestones:["Definir orçamento","Pesquisar opções","Comparar custos","Realizar a compra"],tasks:["Pesquisar 3 opções","Levantar custos extras"]},
    travel:{milestones:["Definir roteiro","Fechar orçamento","Preparar documentos","Realizar a viagem"],tasks:["Pesquisar hospedagem","Estimar combustível/transporte","Montar checklist de bagagem"]},
    learning:{milestones:["Concluir fundamentos","Fazer projeto prático","Revisar conteúdos"],tasks:["Definir material de estudo","Estudar primeira hora"]},
    career:{milestones:["Ler edital/definir objetivo","Montar ciclo de estudos","Fazer simulados","Realizar prova"],tasks:["Separar matérias","Definir horas semanais"]},
    personal:{milestones:["Definir resultado","Executar plano","Revisar progresso"],tasks:["Definir primeiro passo"]}
  }[wizard.type];
  wizard.milestones=[...new Set([...wizard.milestones,...suggestions.milestones])];wizard.tasks=[...new Set([...wizard.tasks,...suggestions.tasks])];renderWizardBuilders()
}
function addWizardItem(kind){const el=$("#"+(kind==="milestones"?"milestoneInput":"taskInput")),v=el.value.trim();if(!v)return;wizard[kind].push(v);el.value="";renderWizardBuilders()}
function removeWizardItem(kind,i){wizard[kind].splice(i,1);renderWizardBuilders()}
function renderWizardBuilders(){const m=$("#milestoneBuilder"),t=$("#taskBuilder");if(m)m.innerHTML=wizard.milestones.map((x,i)=>`<div class="builder-item"><span>${esc(x)}</span><button onclick="Frontier.removeWizardItem('milestones',${i})">✕</button></div>`).join("");if(t)t.innerHTML=wizard.tasks.map((x,i)=>`<div class="builder-item"><span>${esc(x)}</span><button onclick="Frontier.removeWizardItem('tasks',${i})">✕</button></div>`).join("")}
function wizardNext(){
  captureWizardStep();
  if(wizard.step===1&&!wizard.type){alert("Escolha um tipo de projeto.");return}
  if(wizard.step===2&&!wizard.data.name){alert("Informe o nome do projeto.");return}
  if(wizard.step<4){wizard.step++;renderWizard();return}
  createProject()
}
function wizardBack(){captureWizardStep();if(wizard.step>1){wizard.step--;renderWizard()}}
async function createProject(){
  const meta=projectTypes[wizard.type],d=wizard.data;
  const trackMode=wizard.type==="purchase"?"money":(wizard.type==="learning"||wizard.type==="career")?"hours":"tasks";
  const project={id:uid("proj"),type:wizard.type,category:meta.category,icon:meta.icon,name:d.name,why:d.why,priority:d.priority||"Média",deadline:d.deadline||"",status:"Planejando",trackMode,target:Number(d.target||0),current:Number(d.current||0),budget:Number(d.budget||0),reserved:Number(d.reserved||0),extra1:d.extra1||"",extra2:d.extra2||"",travel:{origin:d.origin||"",destination:d.destination||"",transport:d.transport||"",startDate:d.tripStart||"",endDate:d.tripEnd||"",stops:[],packing:[],documents:[]},milestones:wizard.milestones.map(text=>({text,done:false})),tasks:wizard.tasks.map(text=>({text,done:false})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),progressHistory:[]};
  recordProjectSnapshot(project);state.projects.unshift(project);await persist("projects",project);closeModal("projectModal");renderAll();openPage("projects");toast("Projeto criado com sucesso.")
}
function openProjectDetail(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;const h=projectHealth(p),fin=state.finance.filter(f=>f.sourceType==="project"&&f.sourceId===p.id),ft=financeTotals(fin);
  $("#projectDetailTitle").textContent=p.name;$("#projectDetailSub").textContent=`${p.category} • ${p.status} • ${h.label}`;
  $("#projectDetailBody").innerHTML=`<div class="detail-grid"><div class="detail-stack">
    <article class="card"><div class="card-head"><div><h3>Progresso</h3><p>${esc(p.why||"")}</p></div><span class="badge ${h.code}">${h.label}</span></div><div class="progress"><span style="width:${projectProgress(p)}%"></span></div><div class="project-footer"><span>${projectProgress(p)}% concluído</span><span>${p.deadline?"prazo "+dateBR(p.deadline):"sem prazo"}</span></div></article>
    <article class="card"><div class="card-head"><div><h3>Evolução</h3><p>Histórico do progresso ao longo do tempo.</p></div></div><canvas id="projectHistoryChart"></canvas><div id="projectHistoryEmpty" class="chart-empty hidden">A evolução aparecerá conforme o projeto avançar.</div></article>
    <article class="card"><div class="card-head"><div><h3>Etapas</h3></div></div>${renderCheckItems(p,"milestones")}</article>
    <article class="card"><div class="card-head"><div><h3>Tarefas</h3></div></div>${renderCheckItems(p,"tasks")}</article>
    ${p.type==="travel"?renderTravelProject(p):""}
  </div><div class="detail-stack">
    <article class="card"><h3>Acompanhamento</h3>${renderProjectMetrics(p)}${p.trackMode!=="tasks"?`<div class="mini-form"><input id="progressAdd" type="number" step="0.5" min="0" placeholder="${p.trackMode==="money"?"Adicionar valor":"Adicionar horas"}"><button class="btn secondary" onclick="Frontier.addProjectProgress('${p.id}')">Adicionar</button></div>`:""}</article>
    <article class="card"><h3>Financeiro vinculado</h3><div class="metric-grid"><div class="metric-box"><small>Entradas</small><b>${money(ft.income)}</b></div><div class="metric-box"><small>Saídas</small><b>${money(ft.expense)}</b></div><div class="metric-box"><small>Reservas</small><b>${money(ft.reserve)}</b></div><div class="metric-box"><small>Saldo</small><b>${money(ft.income-ft.expense)}</b></div></div><button class="btn secondary wide" style="margin-top:9px" onclick="Frontier.openFinanceModal('project','${p.id}')">Registrar movimentação</button></article>
    <article class="card"><h3>Status</h3><select class="wide-select" onchange="Frontier.changeProjectStatus('${p.id}',this.value)"><option ${p.status==="Planejando"?"selected":""}>Planejando</option><option ${p.status==="Em andamento"?"selected":""}>Em andamento</option><option ${p.status==="Pausado"?"selected":""}>Pausado</option><option ${p.status==="Concluído"?"selected":""}>Concluído</option></select><button class="btn secondary wide" style="margin-top:10px" onclick="Frontier.openProjectEdit('${p.id}')">Editar projeto</button><button class="btn danger wide" style="margin-top:8px" onclick="Frontier.deleteProject('${p.id}')">Excluir projeto</button></article>
  </div></div>`;
  $("#projectDetailModal").classList.remove("hidden");drawProjectHistory(p)
}
function openProjectEdit(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;editingProjectId=id;
  const extraLabels=p.type==="purchase"?["O que deseja comprar?","Modelo / preferência"]:p.type==="learning"?["O que deseja aprender?","Nível / foco"]:p.type==="career"?["Concurso / objetivo","Área / cargo"]:["Informação adicional","Detalhe"];
  let tracking="";
  if(p.trackMode==="money")tracking=`<label>Meta financeira<input id="peTarget" data-currency inputmode="decimal" value="${money(p.target)}"></label><label>Valor atual<input id="peCurrent" data-currency inputmode="decimal" value="${money(p.current)}"></label>`;
  else if(p.trackMode==="hours")tracking=`<label>Meta de horas<input id="peTarget" type="number" step="0.5" min="0" value="${Number(p.target||0)}"></label><label>Horas atuais<input id="peCurrent" type="number" step="0.5" min="0" value="${Number(p.current||0)}"></label>`;
  else if(p.type==="travel")tracking=`<label>Orçamento<input id="peBudget" data-currency inputmode="decimal" value="${money(p.budget)}"></label><label>Valor reservado<input id="peReserved" data-currency inputmode="decimal" value="${money(p.reserved)}"></label>`;
  let specific="";
  if(p.type==="travel"){const t=p.travel||{};specific=`<div class="full dynamic-panel"><h3>Viagem</h3><div class="form-grid"><label>Origem<input id="peOrigin" value="${esc(t.origin||"")}"></label><label>Destino<input id="peDestination" value="${esc(t.destination||"")}"></label><label>Transporte<input id="peTransport" value="${esc(t.transport||"")}"></label><label>Saída<input id="peTripStart" type="date" value="${t.startDate||""}"></label><label>Retorno<input id="peTripEnd" type="date" value="${t.endDate||""}"></label></div></div>`}
  else if(p.type!=="personal")specific=`<label>${extraLabels[0]}<input id="peExtra1" value="${esc(p.extra1||"")}"></label><label>${extraLabels[1]}<input id="peExtra2" value="${esc(p.extra2||"")}"></label>`;
  $("#projectEditBody").innerHTML=`<div class="form-grid"><label class="full">Nome<input id="peName" required value="${esc(p.name)}"></label><label class="full">Motivo / descrição<textarea id="peWhy">${esc(p.why||"")}</textarea></label><label>Prioridade<select id="pePriority"><option${p.priority==="Alta"?" selected":""}>Alta</option><option${p.priority==="Média"?" selected":""}>Média</option><option${p.priority==="Baixa"?" selected":""}>Baixa</option></select></label><label>Prazo<input id="peDeadline" type="date" value="${p.deadline||""}"></label><label>Status<select id="peStatus"><option${p.status==="Planejando"?" selected":""}>Planejando</option><option${p.status==="Em andamento"?" selected":""}>Em andamento</option><option${p.status==="Pausado"?" selected":""}>Pausado</option><option${p.status==="Concluído"?" selected":""}>Concluído</option></select></label>${tracking}${specific}<label class="full">Etapas principais <small>(uma por linha)</small><textarea id="peMilestones">${esc((p.milestones||[]).map(x=>x.text).join("\n"))}</textarea></label><label class="full">Tarefas <small>(uma por linha)</small><textarea id="peTasks">${esc((p.tasks||[]).map(x=>x.text).join("\n"))}</textarea></label></div>`;
  $("#projectEditModal").classList.remove("hidden")
}
async function saveProjectEdit(e){
  e.preventDefault();const p=state.projects.find(x=>x.id===editingProjectId);if(!p)return;
  p.name=$("#peName").value.trim();p.why=$("#peWhy").value.trim();p.priority=$("#pePriority").value;p.deadline=$("#peDeadline").value;p.status=$("#peStatus").value;
  if($("#peTarget"))p.target=p.trackMode==="money"?parseMoney($("#peTarget").value):Number($("#peTarget").value||0);
  if($("#peCurrent"))p.current=p.trackMode==="money"?parseMoney($("#peCurrent").value):Number($("#peCurrent").value||0);
  if($("#peBudget"))p.budget=parseMoney($("#peBudget").value);if($("#peReserved"))p.reserved=parseMoney($("#peReserved").value);
  if($("#peExtra1"))p.extra1=$("#peExtra1").value.trim();if($("#peExtra2"))p.extra2=$("#peExtra2").value.trim();
  if(p.type==="travel"){p.travel=p.travel||{};p.travel.origin=$("#peOrigin").value.trim();p.travel.destination=$("#peDestination").value.trim();p.travel.transport=$("#peTransport").value.trim();p.travel.startDate=$("#peTripStart").value;p.travel.endDate=$("#peTripEnd").value}
  const reconcile=(text,old)=>text.split("\n").map(x=>x.trim()).filter(Boolean).map(t=>({text:t,done:old.find(o=>o.text===t)?.done||false}));
  p.milestones=reconcile($("#peMilestones").value,p.milestones||[]);p.tasks=reconcile($("#peTasks").value,p.tasks||[]);p.updatedAt=new Date().toISOString();recordProjectSnapshot(p);await persist("projects",p);closeModal("projectEditModal");renderAll();openProjectDetail(p.id);toast("Projeto atualizado.")
}
function renderCheckItems(p,key){const arr=p[key]||[];return arr.length?`<div class="${key==="milestones"?"timeline":"stack-list"}">${arr.map((x,i)=>key==="milestones"?`<div class="timeline-item"><label class="check-row"><input type="checkbox" ${x.done?"checked":""} onchange="Frontier.toggleProjectItem('${p.id}','${key}',${i})"><span>${esc(x.text)}</span></label></div>`:`<label class="stack-item check-row"><span><input type="checkbox" ${x.done?"checked":""} onchange="Frontier.toggleProjectItem('${p.id}','${key}',${i})"> ${esc(x.text)}</span></label>`).join("")}</div>`:'<p class="muted">Nenhum item cadastrado.</p>'}
function renderProjectMetrics(p){
  if(p.trackMode==="money")return `<div class="metric-grid"><div class="metric-box"><small>Já reservado</small><b>${money(p.current)}</b></div><div class="metric-box"><small>Meta</small><b>${money(p.target)}</b></div></div>`;
  if(p.trackMode==="hours")return `<div class="metric-grid"><div class="metric-box"><small>Horas realizadas</small><b>${Number(p.current||0)} h</b></div><div class="metric-box"><small>Meta</small><b>${Number(p.target||0)} h</b></div></div>`;
  if(p.type==="travel")return `<div class="metric-grid"><div class="metric-box"><small>Orçamento</small><b>${money(p.budget)}</b></div><div class="metric-box"><small>Reservado</small><b>${money(p.reserved)}</b></div></div>`;
  return `<div class="metric-grid"><div class="metric-box"><small>Progresso</small><b>${projectProgress(p)}%</b></div><div class="metric-box"><small>Itens concluídos</small><b>${[...(p.tasks||[]),...(p.milestones||[])].filter(x=>x.done).length}</b></div></div>`
}
function renderTravelProject(p){
  const t=p.travel||{},stops=t.stops||[],pack=t.packing||[],docs=t.documents||[];
  return `<article class="card"><div class="card-head"><div><h3>Planejamento da viagem</h3><p>${esc(t.origin||"Origem a definir")} → ${esc(t.destination||"Destino a definir")} • ${esc(t.transport||"transporte a definir")}</p></div></div>
  <div class="travel-grid"><div><h4>Roteiro / paradas</h4><div class="mini-form"><input id="travelStopInput" placeholder="Cidade / parada"><button class="btn secondary" onclick="Frontier.addTravelItem('${p.id}','stops')">Adicionar</button></div><div class="builder-list">${stops.map((x,i)=>`<div class="builder-item"><span>${esc(x)}</span><button onclick="Frontier.removeTravelItem('${p.id}','stops',${i})">✕</button></div>`).join("")}</div></div>
  <div><h4>Bagagem / preparação</h4><div class="mini-form"><input id="travelPackingInput" placeholder="Item"><button class="btn secondary" onclick="Frontier.addTravelItem('${p.id}','packing')">Adicionar</button></div><div class="builder-list">${pack.map((x,i)=>`<div class="builder-item"><span>${esc(x)}</span><button onclick="Frontier.removeTravelItem('${p.id}','packing',${i})">✕</button></div>`).join("")}</div></div>
  <div><h4>Documentos</h4><div class="mini-form"><input id="travelDocumentsInput" placeholder="Documento / exigência"><button class="btn secondary" onclick="Frontier.addTravelItem('${p.id}','documents')">Adicionar</button></div><div class="builder-list">${docs.map((x,i)=>`<div class="builder-item"><span>${esc(x)}</span><button onclick="Frontier.removeTravelItem('${p.id}','documents',${i})">✕</button></div>`).join("")}</div></div>
  <div><h4>Datas</h4><div class="metric-grid"><div class="metric-box"><small>Saída</small><b>${dateBR(t.startDate)}</b></div><div class="metric-box"><small>Retorno</small><b>${dateBR(t.endDate)}</b></div></div></div></div></article>`
}
async function toggleProjectItem(id,key,i){const p=state.projects.find(x=>x.id===id);p[key][i].done=!p[key][i].done;p.updatedAt=new Date().toISOString();recordProjectSnapshot(p);await persist("projects",p);renderAll()}
async function addProjectProgress(id){const p=state.projects.find(x=>x.id===id),v=Number($("#progressAdd").value||0);if(v<=0)return;p.current=Number(p.current||0)+v;p.updatedAt=new Date().toISOString();recordProjectSnapshot(p);await persist("projects",p);renderAll();openProjectDetail(id)}
async function changeProjectStatus(id,status){const p=state.projects.find(x=>x.id===id);p.status=status;p.updatedAt=new Date().toISOString();recordProjectSnapshot(p);await persist("projects",p);renderAll()}
async function deleteProject(id){if(!confirm("Excluir este projeto? As movimentações financeiras vinculadas não serão apagadas automaticamente."))return;state.projects=state.projects.filter(x=>x.id!==id);await removePersist("projects",id);closeModal("projectDetailModal");renderAll();toast("Projeto excluído.")}
async function addTravelItem(id,key){const p=state.projects.find(x=>x.id===id),ids={stops:"#travelStopInput",packing:"#travelPackingInput",documents:"#travelDocumentsInput"},input=$(ids[key]),v=input?.value.trim()||"";if(!v)return;p.travel=p.travel||{};p.travel[key]=p.travel[key]||[];p.travel[key].push(v);await persist("projects",p);renderAll();openProjectDetail(id)}
async function removeTravelItem(id,key,i){const p=state.projects.find(x=>x.id===id);p.travel[key].splice(i,1);await persist("projects",p);renderAll();openProjectDetail(id)}


/* STUDIES */
function studyProjects(){return state.projects.filter(p=>p.type==="learning"||p.type==="career")}
function openStudyModal(){$("#studyModal").classList.remove("hidden");$("#studyForm").reset();$("#studyDate").value=today();$("#studyProject").innerHTML='<option value="">Sem projeto específico</option>'+studyProjects().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}
async function saveStudySession(e){e.preventDefault();const x={id:uid("study"),projectId:$("#studyProject").value,subject:$("#studySubject").value.trim(),date:$("#studyDate").value||today(),minutes:Number($("#studyMinutes").value||0),score:$("#studyScore").value===""?null:Number($("#studyScore").value),note:$("#studyNote").value.trim(),createdAt:new Date().toISOString()};if(x.minutes<=0)return;state.studySessions.unshift(x);if(x.projectId){const p=state.projects.find(p=>p.id===x.projectId);if(p&&p.trackMode==="hours"){p.current=Number(p.current||0)+x.minutes/60;p.updatedAt=new Date().toISOString();recordProjectSnapshot(p);await persist("projects",p)}}await persist("studySessions",x);closeModal("studyModal");renderAll();toast("Sessão de estudo registrada.")}
function renderStudies(){const total=state.studySessions.reduce((a,x)=>a+Number(x.minutes||0),0),week=state.studySessions.filter(x=>{const d=localDate(x.date);return d&&d<=new Date()&&((new Date()-d)/86400000)<=7}).reduce((a,x)=>a+Number(x.minutes||0),0),scores=state.studySessions.filter(x=>x.score!==null&&x.score!==undefined).map(x=>Number(x.score));$("#studyHoursTotal").textContent=(total/60).toFixed(1).replace(".0","")+"h";$("#studyHoursWeek").textContent=(week/60).toFixed(1).replace(".0","")+"h";$("#studySessionCount").textContent=state.studySessions.length;$("#studyScoreAvg").textContent=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)+"%":"—";$("#studyProjects").innerHTML=studyProjects().length?studyProjects().map(p=>stackItem(p.icon,p.name,`${projectProgress(p)}% • ${Number(p.current||0).toFixed(1).replace(".0","")}h registradas`)).join(""):'<div class="stack-item"><small>Nenhum projeto de aprendizado ou carreira.</small></div>';$("#studyRows").innerHTML=state.studySessions.length?state.studySessions.slice(0,30).map(x=>`<tr><td>${dateBR(x.date)}</td><td>${esc(state.projects.find(p=>p.id===x.projectId)?.name||"—")}</td><td>${esc(x.subject)}</td><td>${Math.round(x.minutes)} min</td><td>${x.score===null||x.score===undefined?"—":x.score+"%"}</td><td><button class="btn ghost" onclick="Frontier.deleteStudySession('${x.id}')">Excluir</button></td></tr>`).join(""):'<tr><td colspan="6" class="muted">Nenhuma sessão registrada.</td></tr>';drawStudySubjectChart()}
function drawStudySubjectChart(){const sums={};state.studySessions.forEach(x=>sums[x.subject]=(sums[x.subject]||0)+Number(x.minutes||0)/60);drawSimpleBars("studySubjectChart","studySubjectEmpty",Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,8),"h")}
async function deleteStudySession(id){const x=state.studySessions.find(s=>s.id===id);if(!x||!confirm("Excluir esta sessão?"))return;if(x.projectId){const p=state.projects.find(p=>p.id===x.projectId);if(p&&p.trackMode==="hours"){p.current=Math.max(0,Number(p.current||0)-Number(x.minutes||0)/60);recordProjectSnapshot(p);await persist("projects",p)}}state.studySessions=state.studySessions.filter(s=>s.id!==id);await removePersist("studySessions",id);renderAll()}
function goStudies(){openPage("studies");$("#globalSearch").value="";$("#globalSearchResults").classList.add("hidden")}

/* VEHICLES */
function vehicleIcon(type){return type==="Moto"?"🏍️":type==="Carro"?"🚘":"🚙"}
function openVehicleModal(id=""){editingVehicleId=id||null;$("#vehicleForm").reset();$("#vehicleModalTitle").textContent=id?"Editar veículo":"Cadastrar veículo";$("#vehicleSubmitBtn").textContent=id?"Salvar alterações":"Cadastrar";if(id){const v=state.vehicles.find(x=>x.id===id);if(!v)return;$("#vehicleName").value=v.name||"";$("#vehicleType").value=v.type||"Carro";$("#vehicleBrand").value=v.brand||"";$("#vehicleModel").value=v.model||"";$("#vehicleYear").value=v.year||"";$("#vehiclePlate").value=v.plate||"";$("#vehicleOdometer").value=Number(v.odometer||0);$("#vehiclePurchaseDate").value=v.purchaseDate||"";$("#vehicleNotes").value=v.notes||""}$("#vehicleModal").classList.remove("hidden")}
function editVehicle(id){closeModal("vehicleDetailModal");openVehicleModal(id)}
async function saveVehicle(e){e.preventDefault();const base={name:$("#vehicleName").value.trim(),type:$("#vehicleType").value,brand:$("#vehicleBrand").value.trim(),model:$("#vehicleModel").value.trim(),year:Number($("#vehicleYear").value||0),plate:$("#vehiclePlate").value.trim().toUpperCase(),odometer:Number($("#vehicleOdometer").value||0),purchaseDate:$("#vehiclePurchaseDate").value,notes:$("#vehicleNotes").value.trim(),updatedAt:new Date().toISOString()};if(editingVehicleId){const v=state.vehicles.find(x=>x.id===editingVehicleId);if(!v)return;Object.assign(v,base);await persist("vehicles",v);editingVehicleId=null;closeModal("vehicleModal");renderAll();toast("Veículo atualizado.");return}const v={id:uid("veh"),...base,fuel:[],maintenances:[],createdAt:new Date().toISOString()};state.vehicles.unshift(v);await persist("vehicles",v);closeModal("vehicleModal");renderAll();toast("Veículo cadastrado.")}
function renderVehicles(){const monthExp=financeTotals(state.finance.filter(f=>f.sourceType==="vehicle"&&isCurrentMonth(f.date))).expense,fuelCount=state.vehicles.reduce((a,v)=>a+(v.fuel||[]).length,0),near=state.vehicles.reduce((a,v)=>a+(v.maintenances||[]).filter(m=>m.nextDate&&daysUntil(m.nextDate)>=0&&daysUntil(m.nextDate)<=30).length,0);$("#vehicleStatCount").textContent=state.vehicles.length;$("#vehicleStatExpense").textContent=money(monthExp);$("#vehicleStatFuel").textContent=fuelCount;$("#vehicleStatMaintenance").textContent=near;$("#vehiclesGrid").innerHTML=state.vehicles.length?state.vehicles.map(v=>{const exp=financeTotals(state.finance.filter(f=>f.sourceType==="vehicle"&&f.sourceId===v.id&&isCurrentMonth(f.date))).expense;return `<article class="vehicle-card" onclick="Frontier.openVehicleDetail('${v.id}')"><div class="vehicle-icon">${vehicleIcon(v.type)}</div><span class="badge">${esc(v.type)}</span><h3>${esc(v.name)}</h3><p>${esc([v.brand,v.model,v.year||""].filter(Boolean).join(" ")||"Sem modelo informado")}</p><div class="metric-grid"><div class="metric-box"><small>KM</small><b>${Number(v.odometer||0).toLocaleString("pt-BR")}</b></div><div class="metric-box"><small>Gasto no mês</small><b>${money(exp)}</b></div></div></article>`}).join(""):'<div class="empty-grid">Nenhum veículo cadastrado.</div>'}
function openVehicleDetail(id){const v=state.vehicles.find(x=>x.id===id);if(!v)return;const fin=state.finance.filter(f=>f.sourceType==="vehicle"&&f.sourceId===id),ft=financeTotals(fin),fuel=v.fuel||[],maint=v.maintenances||[],liters=fuel.reduce((a,x)=>a+Number(x.liters||0),0),fuelCost=fuel.reduce((a,x)=>a+Number(x.amount||0),0);$("#vehicleDetailTitle").textContent=v.name;$("#vehicleDetailSub").textContent=[v.type,v.brand,v.model,v.plate].filter(Boolean).join(" • ");$("#vehicleDetailBody").innerHTML=`<div class="detail-grid"><div class="detail-stack"><article class="card"><h3>Ficha</h3><div class="metric-grid"><div class="metric-box"><small>Quilometragem</small><b>${Number(v.odometer||0).toLocaleString("pt-BR")} km</b></div><div class="metric-box"><small>Ano</small><b>${v.year||"—"}</b></div><div class="metric-box"><small>Combustível registrado</small><b>${liters.toFixed(1)} L</b></div><div class="metric-box"><small>Custo abastecimentos</small><b>${money(fuelCost)}</b></div></div><p class="muted">${esc(v.notes||"")}</p></article><article class="card"><h3>Abastecimentos</h3><div class="vehicle-entry-form"><input id="fuelDate" type="date" value="${today()}"><input id="fuelKm" type="number" placeholder="KM atual"><input id="fuelLiters" type="number" step="0.01" placeholder="Litros"><input id="fuelAmount" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00"><button class="btn secondary" onclick="Frontier.addVehicleFuel('${v.id}')">Registrar</button></div><div class="stack-list">${fuel.slice(0,8).map(x=>stackItem("⛽",`${dateBR(x.date)} • ${x.liters} L`,`${Number(x.odometer||0).toLocaleString("pt-BR")} km • ${money(x.amount)}`)).join("")||'<div class="stack-item"><small>Nenhum abastecimento.</small></div>'}</div></article><article class="card"><h3>Manutenções</h3><div class="vehicle-entry-form"><input id="maintService" placeholder="Serviço"><input id="maintDate" type="date" value="${today()}"><input id="maintKm" type="number" placeholder="KM"><input id="maintCost" type="text" inputmode="decimal" data-currency placeholder="R$ 0,00"><input id="maintNextDate" type="date"><button class="btn secondary" onclick="Frontier.addVehicleMaintenance('${v.id}')">Registrar</button></div><div class="stack-list">${maint.slice(0,8).map(x=>stackItem("🔧",x.service,`${dateBR(x.date)} • ${money(x.cost)}${x.nextDate?" • próxima "+dateBR(x.nextDate):""}`)).join("")||'<div class="stack-item"><small>Nenhuma manutenção.</small></div>'}</div></article></div><div class="detail-stack"><article class="card"><h3>Financeiro</h3><div class="metric-grid"><div class="metric-box"><small>Gastos</small><b>${money(ft.expense)}</b></div><div class="metric-box"><small>Entradas</small><b>${money(ft.income)}</b></div></div><button class="btn secondary wide" style="margin-top:9px" onclick="Frontier.openFinanceModal('vehicle','${v.id}')">Registrar outro gasto</button></article><article class="card"><h3>Atualizar KM</h3><div class="mini-form"><input id="vehicleOdometerUpdate" type="number" value="${Number(v.odometer||0)}"><button class="btn secondary" onclick="Frontier.updateVehicleOdometer('${v.id}')">Salvar</button></div></article><button class="btn secondary" onclick="Frontier.editVehicle('${v.id}')">Editar veículo</button><button class="btn danger" onclick="Frontier.deleteVehicle('${v.id}')">Excluir veículo</button></div></div>`;$("#vehicleDetailModal").classList.remove("hidden")}
async function addVehicleFuel(id){const v=state.vehicles.find(x=>x.id===id),date=$("#fuelDate").value||today(),od=Number($("#fuelKm").value||v.odometer||0),liters=Number($("#fuelLiters").value||0),amount=parseMoney($("#fuelAmount").value);if(liters<=0)return;v.fuel.unshift({date,odometer:od,liters,amount});v.odometer=Math.max(Number(v.odometer||0),od);v.updatedAt=new Date().toISOString();await persist("vehicles",v);if(amount>0)await createLinkedFinance({type:"expense",amount,description:`Abastecimento — ${v.name}`,category:"Transporte",date,sourceType:"vehicle",sourceId:v.id});renderAll();openVehicleDetail(id);toast("Abastecimento registrado.")}
async function addVehicleMaintenance(id){const v=state.vehicles.find(x=>x.id===id),service=$("#maintService").value.trim(),date=$("#maintDate").value||today(),od=Number($("#maintKm").value||v.odometer||0),cost=parseMoney($("#maintCost").value),nextDate=$("#maintNextDate").value;if(!service)return;v.maintenances.unshift({service,date,odometer:od,cost,nextDate});v.odometer=Math.max(Number(v.odometer||0),od);v.updatedAt=new Date().toISOString();await persist("vehicles",v);if(cost>0)await createLinkedFinance({type:"expense",amount:cost,description:`${service} — ${v.name}`,category:"Transporte",date,sourceType:"vehicle",sourceId:v.id});renderAll();openVehicleDetail(id);toast("Manutenção registrada.")}
async function updateVehicleOdometer(id){const v=state.vehicles.find(x=>x.id===id),val=Number($("#vehicleOdometerUpdate").value||0);v.odometer=val;v.updatedAt=new Date().toISOString();await persist("vehicles",v);renderAll();openVehicleDetail(id)}
async function createLinkedFinance(entry){const f={id:uid("fin"),accountId:"",note:"",createdAt:new Date().toISOString(),...entry};state.finance.unshift(f);await persist("finance",f)}
async function deleteVehicle(id){if(!confirm("Excluir este veículo? O histórico financeiro continuará preservado."))return;state.vehicles=state.vehicles.filter(x=>x.id!==id);await removePersist("vehicles",id);closeModal("vehicleDetailModal");renderAll();toast("Veículo excluído.")}

/* PROJECT HISTORY + MINI CHARTS */
function recordProjectSnapshot(p){p.progressHistory=p.progressHistory||[];const key=today(),value=projectProgress(p),last=p.progressHistory[p.progressHistory.length-1];if(last&&last.date===key)last.progress=value;else p.progressHistory.push({date:key,progress:value});if(p.progressHistory.length>120)p.progressHistory=p.progressHistory.slice(-120)}
function drawProjectHistory(p){const data=p.progressHistory||[],c=$("#projectHistoryChart"),empty=$("#projectHistoryEmpty");if(!c||!empty)return;c.classList.toggle("hidden",data.length<2);empty.classList.toggle("hidden",data.length>=2);if(data.length<2)return;const {ctx,w,h}=simpleCanvas(c,255),left=36,right=10,top=18,bottom=35,pw=w-left-right,ph=h-top-bottom;ctx.strokeStyle="rgba(240,221,192,.09)";[0,25,50,75,100].forEach(v=>{const y=top+ph-v/100*ph;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()});ctx.beginPath();data.forEach((x,i)=>{const px=left+i*(pw/Math.max(1,data.length-1)),py=top+ph-Number(x.progress||0)/100*ph;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.strokeStyle="#c7895b";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#baa58f";ctx.font="9px system-ui";ctx.textAlign="center";[0,Math.floor((data.length-1)/2),data.length-1].forEach(i=>{const x=left+i*(pw/Math.max(1,data.length-1));ctx.fillText(new Date(data[i].date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}),x,h-9)})}
function simpleCanvas(c,height=255){const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.max(1,r.width*dpr);c.height=height*dpr;const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,height);return {ctx,w:r.width,h:height}}
function drawSimpleBars(id,emptyId,entries,suffix=""){const c=$("#"+id),e=$("#"+emptyId),has=entries.length>0;c.classList.toggle("hidden",!has);e.classList.toggle("hidden",has);if(!has)return;const {ctx,w,h}=simpleCanvas(c,255),left=95,right=16,top=16,bottom=16,pw=w-left-right,rowH=Math.max(22,(h-top-bottom)/entries.length),max=Math.max(1,...entries.map(x=>x[1]));ctx.font="10px system-ui";entries.forEach(([label,val],i)=>{const y=top+i*rowH+3,bw=val/max*pw;ctx.fillStyle="#baa58f";ctx.textAlign="right";ctx.fillText(String(label).slice(0,16),left-8,y+12);ctx.fillStyle="#a65f3d";ctx.fillRect(left,y,bw,13);ctx.fillStyle="#e8d7c4";ctx.textAlign="left";ctx.fillText(`${Number(val).toFixed(1).replace(".0","")}${suffix}`,Math.min(left+bw+6,w-35),y+11)})}

/* FINANCE */
function financeTotals(arr,includeFuture=false){const base=(arr||[]).filter(f=>includeFuture||!f.date||f.date<=today());return base.reduce((a,f)=>{a[f.type]=(a[f.type]||0)+Number(f.amount||0);return a},{income:0,expense:0,reserve:0})}
function accountBalance(a){const t=financeTotals(state.finance.filter(f=>f.accountId===a.id));return Number(a.initial||0)+t.income-t.expense}
function fillAccountSelects(){
  $("#fAccount").innerHTML='<option value="">Sem conta específica</option>'+state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  $("#finAccount").innerHTML='<option value="">Todas as contas</option>'+state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  fillFinanceSourceSelect()
}
function openAccountModal(){$("#accountModal").classList.remove("hidden");$("#aName").value="";$("#aInitial").value=money(0)}
async function saveAccount(e){e.preventDefault();const a={id:uid("acc"),name:$("#aName").value.trim(),type:$("#aType").value,initial:parseMoney($("#aInitial").value),color:$("#aColor").value,createdAt:new Date().toISOString()};state.accounts.push(a);await persist("accounts",a);closeModal("accountModal");renderAll();toast("Conta criada.")}
function openFinanceModal(sourceType="manual",sourceId=""){
  editingFinanceId=null;$("#financeForm").reset();$("#financeModalTitle").textContent="Nova movimentação";$("#financeSubmitBtn").textContent="Salvar";$("#fNature").disabled=false;$("#fInstallments").disabled=false;$("#fDate").value=today();$("#fInstallments").value=1;$("#fNature").value="single";$("#fRecurring").value="monthly";$("#fRepeatCount").value=12;$("#fSourceType").value=sourceType;fillFinanceSourceSelect();$("#fSourceId").value=sourceId||"";updateFinanceRecurrenceUi();$("#financeModal").classList.remove("hidden")
}
function editFinance(id){
  const f=state.finance.find(x=>x.id===id);if(!f)return;editingFinanceId=id;$("#financeForm").reset();$("#financeModalTitle").textContent="Editar movimentação";$("#financeSubmitBtn").textContent="Salvar alterações";
  $("#fType").value=f.type;$("#fAmount").value=money(f.amount);$("#fDescription").value=f.description||"";$("#fCategory").value=f.category||categories[0];$("#fDate").value=f.date||today();$("#fAccount").value=f.accountId||"";$("#fSourceType").value=f.sourceType||"manual";fillFinanceSourceSelect();$("#fSourceId").value=f.sourceId||"";$("#fNote").value=f.note||"";$("#fInstallments").value=1;$("#fNature").value="single";$("#fInstallments").disabled=true;$("#fNature").disabled=true;updateFinanceRecurrenceUi();$("#financeModal").classList.remove("hidden")
}
function fillFinanceSourceSelect(){
  const type=$("#fSourceType").value;let html='<option value="">Nenhum</option>';
  if(type==="project")html+=state.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if(type==="pet")html+=state.pets.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if(type==="vehicle")html+=state.vehicles.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join("");
  if(type==="book")html+=state.books.map(b=>`<option value="${b.id}">${esc(b.title)}</option>`).join("");
  $("#fSourceId").innerHTML=html
}
function updateFinanceRecurrenceUi(){
  const recurring=$("#fNature")?.value==="recurring";$("#fRecurringGroup")?.classList.toggle("hidden",!recurring);if($("#fInstallmentsLabel"))$("#fInstallmentsLabel").classList.toggle("hidden",recurring);if($("#fInstallments"))$("#fInstallments").disabled=recurring||!!editingFinanceId
}
async function saveFinanceEntry(e){
  e.preventDefault();const amount=parseMoney($("#fAmount").value),description=$("#fDescription").value.trim(),date=$("#fDate").value||today();if(amount<=0||!description)return;
  if(editingFinanceId){const f=state.finance.find(x=>x.id===editingFinanceId);if(!f)return;Object.assign(f,{type:$("#fType").value,amount:Number(amount.toFixed(2)),description,category:$("#fCategory").value,date,accountId:$("#fAccount").value,sourceType:$("#fSourceType").value,sourceId:$("#fSourceId").value,note:$("#fNote").value.trim(),updatedAt:new Date().toISOString()});await persist("finance",f);editingFinanceId=null;closeModal("financeModal");renderAll();toast("Movimentação atualizada.");return}
  const nature=$("#fNature").value,installments=Math.max(1,Number($("#fInstallments").value||1)),recurring=$("#fRecurring").value,repeatCount=Math.max(2,Math.min(60,Number($("#fRepeatCount").value||12))),entries=[];
  if(nature==="recurring"){
    const groupId=uid("rec");for(let i=0;i<repeatCount;i++){const occurrenceDate=recurring==="weekly"?addDays(date,i*7):recurring==="yearly"?addYears(date,i):addMonths(date,i);entries.push(makeFinanceEntry(amount,description,occurrenceDate,{groupId,recurring,occurrence:i+1,occurrences:repeatCount,nature:"recurring"}))}
  }else if(installments>1){const part=amount/installments,groupId=uid("grp");for(let i=0;i<installments;i++)entries.push(makeFinanceEntry(part,`${description} (${i+1}/${installments})`,addMonths(date,i),{groupId,installment:i+1,installments,nature:"single"}))}
  else entries.push(makeFinanceEntry(amount,description,date,{nature:"single"}));
  state.finance.unshift(...entries);for(const f of entries)await persist("finance",f);closeModal("financeModal");renderAll();toast(entries.length>1?`${entries.length} movimentações criadas.`:"Movimentação salva.")
}
function makeFinanceEntry(amount,description,date,extra){return {id:uid("fin"),type:$("#fType").value,amount:Number(amount.toFixed(2)),description,category:$("#fCategory").value,date,accountId:$("#fAccount").value,sourceType:$("#fSourceType").value,sourceId:$("#fSourceId").value,note:$("#fNote").value.trim(),...extra,createdAt:new Date().toISOString()}}
function filteredFinance(){
  const q=$("#finSearch").value.toLowerCase(),type=$("#finType").value,cat=$("#finCategory").value,acc=$("#finAccount").value,nature=$("#finNature").value,month=$("#finMonth").value;
  return state.finance.filter(f=>(!q||`${f.description} ${f.category} ${financeSourceLabel(f)}`.toLowerCase().includes(q))&&(!type||f.type===type)&&(!cat||f.category===cat)&&(!acc||f.accountId===acc)&&(!nature||(nature==="recurring"?!!f.recurring:!f.recurring))&&(!month||monthKey(f.date)===month))
}
function financeSourceLabel(f){if(f.sourceType==="project")return "Projeto: "+(state.projects.find(p=>p.id===f.sourceId)?.name||"removido");if(f.sourceType==="pet")return "Animal: "+(state.pets.find(p=>p.id===f.sourceId)?.name||"removido");if(f.sourceType==="vehicle")return "Veículo: "+(state.vehicles.find(v=>v.id===f.sourceId)?.name||"removido");if(f.sourceType==="book")return "Livro: "+(state.books.find(b=>b.id===f.sourceId)?.title||"removido");return "Geral"}
function financeAccountLabel(f){return state.accounts.find(a=>a.id===f.accountId)?.name||"—"}
function renderFinance(){
  $("#accountsStrip").innerHTML=state.accounts.length?state.accounts.map(a=>`<div class="account-card" style="--account-color:${a.color}"><span>${esc(a.type)}</span><b>${esc(a.name)}</b><strong>${money(accountBalance(a))}</strong></div>`).join(""):'<div class="account-card"><span>Nenhuma conta</span><b>Cadastre banco, dinheiro ou carteira.</b></div>';
  const arr=filteredFinance(),t=financeTotals(arr);$("#finIncome").textContent=money(t.income);$("#finExpense").textContent=money(t.expense);$("#finBalance").textContent=money(t.income-t.expense);$("#finReserve").textContent=money(t.reserve);$("#financeCount").textContent=`${arr.length} registro${arr.length===1?"":"s"}`;
  $("#financeRows").innerHTML=arr.length?arr.map(f=>`<tr><td>${dateBR(f.date)}</td><td>${esc(f.description)}</td><td>${esc(f.category)}</td><td>${esc(financeAccountLabel(f))}</td><td>${esc(financeSourceLabel(f))}</td><td>${f.type==="income"?"Entrada":f.type==="expense"?"Saída":"Reserva"}${f.recurring?`<small class="table-sub"> • ${f.recurring==="weekly"?"Semanal":f.recurring==="yearly"?"Anual":"Mensal"}</small>`:""}</td><td class="${f.type==="income"?"money-in":f.type==="expense"?"money-out":"money-reserve"}">${f.type==="expense"?"− ":f.type==="income"?"+ ":""}${money(f.amount)}</td><td><div class="row-actions"><button class="btn ghost" onclick="Frontier.editFinance('${f.id}')">Editar</button><button class="btn ghost" onclick="Frontier.deleteFinance('${f.id}')">Excluir</button></div></td></tr>`).join(""):'<tr><td colspan="8" class="muted">Nenhuma movimentação.</td></tr>';
  renderFinanceCharts()
}
function renderFinanceCharts(){const arr=filteredFinance().filter(f=>!f.date||f.date<=today());Charts.cashFlow("financeLineChart","financeLineEmpty",arr);Charts.expensePie("financePieChart","financePieEmpty",arr)}
async function deleteFinance(id){if(!confirm("Excluir esta movimentação?"))return;state.finance=state.finance.filter(x=>x.id!==id);await removePersist("finance",id);renderAll();toast("Movimentação excluída.")}

/* CALENDAR */
function getCalendarEvents(){
  const list=[...state.calendar.map(x=>({...x,source:"manual"}))];
  state.projects.forEach(p=>{if(p.deadline)list.push({id:"pd_"+p.id,title:"Prazo: "+p.name,date:p.deadline,type:"Projeto",source:"project"});if(p.type==="travel"&&p.travel?.startDate)list.push({id:"ts_"+p.id,title:"Início: "+p.name,date:p.travel.startDate,type:"Viagem",source:"project"});if(p.type==="travel"&&p.travel?.endDate)list.push({id:"te_"+p.id,title:"Retorno: "+p.name,date:p.travel.endDate,type:"Viagem",source:"project"})});
  state.pets.forEach(p=>{(p.vaccines||[]).forEach((v,i)=>{if(v.nextDate)list.push({id:`vac_${p.id}_${i}`,title:`Vacina ${v.name} — ${p.name}`,date:v.nextDate,type:"Saúde",source:"pet"})});(p.visits||[]).forEach((v,i)=>{if(v.date)list.push({id:`visit_${p.id}_${i}`,title:`Veterinário — ${p.name}`,date:v.date,type:"Saúde",source:"pet"})})});
  state.vehicles.forEach(v=>{(v.maintenances||[]).forEach((m,i)=>{if(m.nextDate)list.push({id:`veh_${v.id}_${i}`,title:`Manutenção — ${v.name}: ${m.service}`,date:m.nextDate,type:"Veículo",source:"vehicle"})})});
  state.finance.filter(f=>localDate(f.date)>new Date()&&f.type==="expense").forEach(f=>list.push({id:"fin_"+f.id,title:f.description,date:f.date,type:"Financeiro",source:"finance"}));
  return list.sort((a,b)=>String(a.date).localeCompare(String(b.date)))
}
function openCalendarModal(date=selectedCalendarDate||today()){editingCalendarId=null;$("#calendarModalTitle").textContent="Novo compromisso";$("#calendarSubmitBtn").textContent="Salvar";$("#calendarModal").classList.remove("hidden");$("#calendarForm").reset();$("#calTitle").value="";$("#calDate").value=date||today();$("#calNote").value=""}
function editCalendarEvent(id){const ev=state.calendar.find(x=>x.id===id);if(!ev)return;editingCalendarId=id;$("#calendarModalTitle").textContent="Editar compromisso";$("#calendarSubmitBtn").textContent="Salvar alterações";$("#calTitle").value=ev.title||"";$("#calDate").value=ev.date||today();$("#calType").value=ev.type||"Compromisso";$("#calNote").value=ev.note||"";$("#calendarModal").classList.remove("hidden")}
async function saveCalendarEvent(e){e.preventDefault();const title=$("#calTitle").value.trim(),date=$("#calDate").value;if(!title||!date)return;if(editingCalendarId){const ev=state.calendar.find(x=>x.id===editingCalendarId);if(!ev)return;Object.assign(ev,{title,date,type:$("#calType").value,note:$("#calNote").value.trim(),updatedAt:new Date().toISOString()});selectedCalendarDate=date;calendarCursor=new Date(localDate(date).getFullYear(),localDate(date).getMonth(),1);await persist("calendar",ev);editingCalendarId=null;closeModal("calendarModal");renderAll();toast("Compromisso atualizado.");return}const ev={id:uid("cal"),title,date,type:$("#calType").value,note:$("#calNote").value.trim(),createdAt:new Date().toISOString()};state.calendar.push(ev);selectedCalendarDate=ev.date;calendarCursor=new Date(localDate(ev.date).getFullYear(),localDate(ev.date).getMonth(),1);await persist("calendar",ev);closeModal("calendarModal");renderAll();toast("Compromisso salvo.")}
function selectCalendarDay(date){
  selectedCalendarDate=date;
  const d=localDate(date);if(d)calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  renderCalendar()
}
function openSelectedCalendarModal(){openCalendarModal(selectedCalendarDate||today())}
async function deleteCalendarEvent(id){
  const ev=state.calendar.find(x=>x.id===id);if(!ev||!confirm("Excluir este compromisso?"))return;
  state.calendar=state.calendar.filter(x=>x.id!==id);await removePersist("calendar",id);renderAll()
}
function renderSelectedCalendarDay(events){
  const date=selectedCalendarDate||today(),d=localDate(date),dayEvents=events.filter(e=>e.date===date);
  $("#calendarSelectedTitle").textContent=d?d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"}):"Dia selecionado";
  $("#calendarSelectedSubtitle").textContent=dayEvents.length?`${dayEvents.length} evento${dayEvents.length===1?"":"s"} nesta data.`:"Nenhum evento nesta data.";
  $("#calendarSelectedEvents").innerHTML=dayEvents.length?dayEvents.map(e=>`<div class="stack-item calendar-event-detail"><div><b>${esc(e.title)}</b><small>${esc(e.type||"Compromisso")}${e.note?" • "+esc(e.note):""}</small></div>${e.source==="manual"?`<div class="row-actions"><button class="icon-btn" title="Editar compromisso" onclick="Frontier.editCalendarEvent('${e.id}')">✎</button><button class="icon-btn danger-icon" title="Excluir compromisso" onclick="Frontier.deleteCalendarEvent('${e.id}')">🗑</button></div>`:""}</div>`).join(""):'<div class="stack-item"><small>Dia livre. Use “+ Neste dia” para adicionar um compromisso.</small></div>'
}
function renderCalendar(){
  if(!selectedCalendarDate)selectedCalendarDate=today();
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),first=new Date(y,m,1),weekMonday=appPrefs.week_start==="monday",offset=weekMonday?(first.getDay()+6)%7:first.getDay(),start=new Date(y,m,1-offset),events=getCalendarEvents();$("#calendarWeekHeader").innerHTML=(weekMonday?["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]).map(x=>`<span>${x}</span>`).join("");$("#calendarMonthTitle").textContent=new Date(y,m,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  let html="";for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKeyLocal(d),dayEvents=events.filter(e=>e.date===key).slice(0,3);html+=`<button type="button" class="cal-day ${d.getMonth()!==m?"muted-day":""} ${key===today()?"today":""} ${key===selectedCalendarDate?"selected":""}" onclick="Frontier.selectCalendarDay('${key}')" aria-label="${d.toLocaleDateString('pt-BR')}"><b>${d.getDate()}</b>${dayEvents.map(e=>`<span class="cal-dot">${esc(e.title)}</span>`).join("")}${events.filter(e=>e.date===key).length>3?`<small class="cal-more">+${events.filter(e=>e.date===key).length-3}</small>`:""}</button>`}$("#calendarGrid").innerHTML=html;
  renderSelectedCalendarDay(events);
  const upcoming=events.filter(e=>daysUntil(e.date)>=0).slice(0,12);$("#calendarUpcoming").innerHTML=upcoming.length?upcoming.map(e=>`<button class="stack-item calendar-upcoming-item" onclick="Frontier.selectCalendarDay('${e.date}')"><div><b>${esc(e.title)}</b><small>${dateBR(e.date)} • ${esc(e.type)}</small></div></button>`).join(""):'<div class="stack-item"><small>Nenhum evento futuro.</small></div>'
}

/* NOTES */
function openFolderModal(){$("#folderModal").classList.remove("hidden");$("#folderName").value=""}
async function saveNoteFolder(e){e.preventDefault();const f={id:uid("folder"),name:$("#folderName").value.trim(),createdAt:new Date().toISOString()};state.noteFolders.push(f);await persist("noteFolders",f);closeModal("folderModal");renderNotes()}
async function newNote(){
  const n={id:uid("note"),title:"Nova nota",content:"",folderId:"",tags:[],color:"#c7895b",pinned:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.notes.unshift(n);activeNoteId=n.id;await persist("notes",n);renderNotes();openNote(n.id);openPage("notes")
}
function renderNotes(){
  $("#noteFolderFilter").innerHTML='<option value="">Todas as pastas</option>'+state.noteFolders.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join("");
  $("#noteFolder").innerHTML='<option value="">Sem pasta</option>'+state.noteFolders.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join("");
  const active=state.notes.find(x=>x.id===activeNoteId);if(active)$("#noteFolder").value=active.folderId||"";
  const q=$("#noteSearch").value.toLowerCase(),folder=$("#noteFolderFilter").value;const arr=[...state.notes].sort((a,b)=>(b.pinned-a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt)).filter(n=>(!folder||n.folderId===folder)&&(!q||`${n.title} ${stripHtml(n.content)} ${(n.tags||[]).join(" ")}`.toLowerCase().includes(q)));
  $("#notesList").innerHTML=arr.length?arr.map(n=>`<div class="note-list-item ${n.id===activeNoteId?"active":""}" style="border-left:3px solid ${n.color||"#c7895b"}" onclick="Frontier.openNote('${n.id}')"><b>${n.pinned?"📌 ":""}${esc(n.title||"Sem título")}</b><small>${esc(stripHtml(n.content).slice(0,58)||"Nota vazia")}</small></div>`).join(""):'<div class="muted">Nenhuma nota.</div>'
}
function openNote(id){
  const n=state.notes.find(x=>x.id===id);if(!n)return;activeNoteId=id;renderNotes();$("#noteEmpty").classList.add("hidden");$("#noteEditor").classList.remove("hidden");$("#noteTitle").value=n.title||"";$("#noteContent").innerHTML=n.content||"";$("#noteFolder").value=n.folderId||"";$("#noteTags").value=(n.tags||[]).join(", ");$("#noteColor").value=n.color||"#c7895b";$("#notePinBtn").textContent=n.pinned?"📍":"📌";$("#noteUpdated").textContent="Atualizada "+new Date(n.updatedAt).toLocaleString("pt-BR")
}
function queueNoteSave(){clearTimeout(noteSaveTimer);$("#noteSaveStatus").textContent="Salvando...";noteSaveTimer=setTimeout(saveActiveNote,450)}
async function saveActiveNote(){const n=state.notes.find(x=>x.id===activeNoteId);if(!n)return;n.title=$("#noteTitle").value||"Sem título";n.content=$("#noteContent").innerHTML;n.folderId=$("#noteFolder").value;n.tags=$("#noteTags").value.split(",").map(x=>x.trim()).filter(Boolean);n.color=$("#noteColor").value;n.updatedAt=new Date().toISOString();await persist("notes",n);$("#noteSaveStatus").textContent="Salvo automaticamente";$("#noteUpdated").textContent="Atualizada "+new Date(n.updatedAt).toLocaleString("pt-BR");renderNotes();renderDashboard()}
async function toggleNotePin(){const n=state.notes.find(x=>x.id===activeNoteId);if(!n)return;n.pinned=!n.pinned;n.updatedAt=new Date().toISOString();await persist("notes",n);openNote(n.id)}
async function deleteActiveNote(){if(!activeNoteId||!confirm("Excluir esta nota?"))return;const id=activeNoteId;state.notes=state.notes.filter(x=>x.id!==id);activeNoteId=null;await removePersist("notes",id);$("#noteEditor").classList.add("hidden");$("#noteEmpty").classList.remove("hidden");renderAll()}
function openNoteFromSearch(id){openPage("notes");openNote(id);$("#globalSearch").value="";$("#globalSearchResults").classList.add("hidden")}
function goFinanceSearch(text){openPage("finance");$("#finSearch").value=text;renderFinance();$("#globalSearch").value="";$("#globalSearchResults").classList.add("hidden")}
function goFinanceEntry(id){const f=state.finance.find(x=>x.id===id);goFinanceSearch(f?.description||"")}
function goCalendar(){openPage("calendar");$("#globalSearch").value="";$("#globalSearchResults").classList.add("hidden")}

/* PETS */
function petIcon(species){return species==="Cachorro"?"🐶":species==="Gato"?"🐱":species==="Ave"?"🐦":species==="Coelho"?"🐰":"🐾"}
function openPetModal(){$("#petModal").classList.remove("hidden");$("#petForm").reset()}
async function savePet(e){e.preventDefault();const p={id:uid("pet"),name:$("#petName").value.trim(),species:$("#petSpecies").value,breed:$("#petBreed").value.trim(),sex:$("#petSex").value,birth:$("#petBirth").value,weight:Number($("#petWeight").value||0),vet:$("#petVet").value.trim(),notes:$("#petNotes").value.trim(),vaccines:[],medications:[],weights:$("#petWeight").value?[{date:today(),value:Number($("#petWeight").value)}]:[],visits:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.pets.unshift(p);await persist("pets",p);closeModal("petModal");renderAll();toast("Animal cadastrado.")}
function renderPets(){
  const alerts=getAlerts().filter(a=>a.domain==="pet"),monthExpenses=financeTotals(state.finance.filter(f=>f.sourceType==="pet"&&f.type==="expense"&&isCurrentMonth(f.date))).expense,visits=state.pets.reduce((s,p)=>s+(p.visits||[]).filter(v=>{const d=daysUntil(v.date);return d!==null&&d>=0&&d<=30}).length,0);
  $("#petStatCount").textContent=state.pets.length;$("#petStatVaccines").textContent=alerts.filter(a=>a.kind==="vaccine").length;$("#petStatExpenses").textContent=money(monthExpenses);$("#petStatVisits").textContent=visits;
  $("#petsGrid").innerHTML=state.pets.length?state.pets.map(p=>{const pa=alerts.filter(a=>a.petId===p.id);return `<article class="pet-card" onclick="Frontier.openPetDetail('${p.id}')"><div class="pet-top"><div class="pet-avatar">${petIcon(p.species)}</div><div><h3>${esc(p.name)}</h3><span class="muted">${esc(p.species)}${p.breed?" • "+esc(p.breed):""}</span></div></div><p>${p.weight?p.weight+" kg • ":""}${esc(p.sex)}</p>${pa.length?`<div class="pet-alert">⚠ ${esc(pa[0].title)}</div>`:""}</article>`}).join(""):'<div class="empty-grid">Nenhum animal cadastrado. <button class="link-btn" onclick="Frontier.openPetModal()">Cadastrar agora</button></div>'
}
function openPetDetail(id){
  const p=state.pets.find(x=>x.id===id);if(!p)return;const fin=state.finance.filter(f=>f.sourceType==="pet"&&f.sourceId===p.id),ft=financeTotals(fin),lastWeight=(p.weights||[]).slice(-1)[0]?.value||p.weight||0;
  $("#petDetailTitle").textContent=p.name;$("#petDetailSub").textContent=`${p.species}${p.breed?" • "+p.breed:""}`;
  $("#petDetailBody").innerHTML=`<div class="detail-grid"><div class="detail-stack">
  <article class="card"><h3>Ficha</h3><div class="metric-grid"><div class="metric-box"><small>Sexo</small><b>${esc(p.sex)}</b></div><div class="metric-box"><small>Peso atual</small><b>${lastWeight?lastWeight+" kg":"—"}</b></div><div class="metric-box"><small>Nascimento</small><b>${dateBR(p.birth)}</b></div><div class="metric-box"><small>Veterinário</small><b>${esc(p.vet||"—")}</b></div></div><p class="muted">${esc(p.notes||"Sem observações.")}</p></article>
  <article class="card"><h3>Vacinas</h3><div class="mini-form"><input id="vacName" placeholder="Vacina"><input id="vacDate" type="date"><input id="vacNext" type="date"><button class="btn secondary" onclick="Frontier.addPetRecord('${p.id}','vaccine')">Adicionar</button></div><div class="stack-list" style="margin-top:9px">${(p.vaccines||[]).map((v,i)=>`<div class="stack-item"><div><b>${esc(v.name)}</b><small>${dateBR(v.date)}${v.nextDate?" • próxima "+dateBR(v.nextDate):""}</small></div><button class="link-btn" onclick="event.stopPropagation();Frontier.removePetRecord('${p.id}','vaccines',${i})">Excluir</button></div>`).join("")||"<small class='muted'>Nenhuma vacina.</small>"}</div></article>
  <article class="card"><h3>Medicamentos</h3><div class="mini-form"><input id="medName" placeholder="Medicamento"><input id="medDose" placeholder="Dose / frequência"><input id="medUntil" type="date"><button class="btn secondary" onclick="Frontier.addPetRecord('${p.id}','medication')">Adicionar</button></div><div class="stack-list" style="margin-top:9px">${(p.medications||[]).map((v,i)=>`<div class="stack-item"><div><b>${esc(v.name)}</b><small>${esc(v.dose||"")}${v.until?" • até "+dateBR(v.until):""}</small></div><button class="link-btn" onclick="event.stopPropagation();Frontier.removePetRecord('${p.id}','medications',${i})">Excluir</button></div>`).join("")||"<small class='muted'>Nenhum medicamento.</small>"}</div></article>
  <article class="card"><h3>Peso</h3><div class="mini-form"><input id="weightValue" type="number" step="0.01" placeholder="kg"><input id="weightDate" type="date" value="${today()}"><button class="btn secondary" onclick="Frontier.addPetRecord('${p.id}','weight')">Registrar</button></div><div class="stack-list" style="margin-top:9px">${(p.weights||[]).slice(-5).reverse().map(w=>`<div class="stack-item"><span>${dateBR(w.date)}</span><b>${w.value} kg</b></div>`).join("")||"<small class='muted'>Sem histórico.</small>"}</div></article>
  </div><div class="detail-stack">
  <article class="card"><h3>Consultas</h3><div class="mini-form"><input id="visitDate" type="date"><input id="visitReason" placeholder="Motivo"><button class="btn secondary" onclick="Frontier.addPetRecord('${p.id}','visit')">Agendar</button></div><div class="stack-list" style="margin-top:9px">${(p.visits||[]).map((v,i)=>`<div class="stack-item"><div><b>${dateBR(v.date)}</b><small>${esc(v.reason||"Consulta")}</small></div><button class="link-btn" onclick="event.stopPropagation();Frontier.removePetRecord('${p.id}','visits',${i})">Excluir</button></div>`).join("")||"<small class='muted'>Nenhuma consulta.</small>"}</div></article>
  <article class="card"><h3>Financeiro do animal</h3><div class="metric-grid"><div class="metric-box"><small>Gastos</small><b>${money(ft.expense)}</b></div><div class="metric-box"><small>Entradas</small><b>${money(ft.income)}</b></div></div><button class="btn secondary wide" style="margin-top:9px" onclick="Frontier.openFinanceModal('pet','${p.id}')">Registrar ração, consulta, vacina...</button><div class="stack-list" style="margin-top:9px">${fin.slice(0,6).map(f=>`<div class="stack-item"><span>${esc(f.description)}</span><b>${money(f.amount)}</b></div>`).join("")||"<small class='muted'>Nenhum gasto.</small>"}</div></article>
  <article class="card"><h3>Integração</h3><p class="muted">Tudo registrado como gasto aqui aparece automaticamente no Livro-caixa geral e nos gráficos da Visão Geral.</p></article>
  <button class="btn danger" onclick="Frontier.deletePet('${p.id}')">Excluir animal</button>
  </div></div>`;$("#petDetailModal").classList.remove("hidden")
}
async function addPetRecord(id,type){
  const p=state.pets.find(x=>x.id===id);
  if(type==="vaccine"){const name=$("#vacName").value.trim();if(!name)return;p.vaccines.push({name,date:$("#vacDate").value,nextDate:$("#vacNext").value})}
  if(type==="medication"){const name=$("#medName").value.trim();if(!name)return;p.medications.push({name,dose:$("#medDose").value.trim(),until:$("#medUntil").value})}
  if(type==="weight"){const value=Number($("#weightValue").value||0);if(!value)return;p.weights.push({value,date:$("#weightDate").value||today()});p.weight=value}
  if(type==="visit"){const date=$("#visitDate").value;if(!date)return;p.visits.push({date,reason:$("#visitReason").value.trim()})}
  p.updatedAt=new Date().toISOString();await persist("pets",p);renderAll();openPetDetail(id)
}
async function removePetRecord(id,key,i){const p=state.pets.find(x=>x.id===id);p[key].splice(i,1);await persist("pets",p);renderAll();openPetDetail(id)}
async function deletePet(id){if(!confirm("Excluir este animal? Os gastos vinculados continuarão no financeiro como histórico."))return;state.pets=state.pets.filter(x=>x.id!==id);await removePersist("pets",id);closeModal("petDetailModal");renderAll()}


/* BOOKS */
function bookProgress(b){
  const total=Number(b.totalPages||0),current=Number(b.currentPage||0);
  if(b.status==="Concluído")return 100;
  return total>0?Math.max(0,Math.min(100,Math.round(current/total*100))):0
}
function bookCover(b){
  if(b.coverUrl)return `<img src="${esc(b.coverUrl)}" alt="Capa de ${esc(b.title)}" loading="lazy" onerror="this.parentElement.classList.add('cover-fallback');this.remove()">`;
  return `<div class="book-cover-fallback"><span>★</span><b>${esc((b.title||"Livro").slice(0,28))}</b><small>${esc(b.author||"Frontier Library")}</small></div>`
}
function renderBooks(){
  const q=$("#bookSearch")?.value.trim().toLowerCase()||"",status=$("#bookStatusFilter")?.value||"",year=String(new Date().getFullYear()),month=new Date().toISOString().slice(0,7);
  const arr=state.books.filter(b=>(!status||b.status===status)&&(!q||`${b.title} ${b.author||""} ${b.category||""}`.toLowerCase().includes(q)));
  if(!$("#booksGrid"))return;
  $("#bookStatTotal").textContent=state.books.length;
  $("#bookStatReading").textContent=state.books.filter(b=>b.status==="Lendo").length;
  $("#bookStatYear").textContent=state.books.filter(b=>b.status==="Concluído"&&String(b.endDate||"").startsWith(year)).length;
  $("#bookStatPages").textContent=state.books.reduce((sum,b)=>sum+(b.sessions||[]).filter(x=>String(x.date||"").startsWith(month)).reduce((a,x)=>a+Number(x.pages||0),0),0);
  $("#booksGrid").innerHTML=arr.length?arr.map(b=>`<article class="book-card" onclick="Frontier.openBookDetail('${b.id}')"><div class="book-cover">${bookCover(b)}</div><div class="book-info"><span class="book-status">${esc(b.status)}</span><h3>${esc(b.title)}</h3><p>${esc(b.author||"Autor não informado")}</p><small>${esc(b.category||"Sem categoria")}</small><div class="progress"><span style="width:${bookProgress(b)}%"></span></div><div class="book-progress-row"><b>${bookProgress(b)}%</b><span>${Number(b.currentPage||0)} / ${b.totalPages||"?"} pág.</span></div></div></article>`).join(""):'<div class="empty-grid">Nenhum livro encontrado. <button class="link-btn" onclick="Frontier.openBookModal()">Adicionar o primeiro</button></div>'
}
function openBookModal(id=""){
  editingBookId=id||null;$("#bookForm").reset();$("#bookProject").innerHTML='<option value="">Nenhum</option>'+state.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");$("#bookModalTitle").textContent=id?"Editar livro":"Adicionar livro";$("#bookSubmitBtn").textContent=id?"Salvar alterações":"Salvar livro";
  if(id){const b=state.books.find(x=>x.id===id);if(!b)return;$("#bookTitle").value=b.title||"";$("#bookAuthor").value=b.author||"";$("#bookCategory").value=b.category||"";$("#bookStatus").value=b.status||"Quero ler";$("#bookTotalPages").value=b.totalPages||"";$("#bookCurrentPage").value=b.currentPage||0;$("#bookStartDate").value=b.startDate||"";$("#bookEndDate").value=b.endDate||"";$("#bookPrice").value=b.price?money(b.price):"";$("#bookProject").value=b.projectId||"";$("#bookCoverUrl").value=b.coverUrl||"";$("#bookNotes").value=b.notes||""}else $("#bookStatus").value="Quero ler";$("#bookModal").classList.remove("hidden")
}
function editBook(id){closeModal("bookDetailModal");openBookModal(id)}
async function saveBook(e){
  e.preventDefault();const price=parseMoney($("#bookPrice").value),status=$("#bookStatus").value,total=Number($("#bookTotalPages").value||0),current=Number($("#bookCurrentPage").value||0),base={title:$("#bookTitle").value.trim(),author:$("#bookAuthor").value.trim(),category:$("#bookCategory").value.trim(),status,totalPages:total,currentPage:status==="Concluído"&&total?total:Math.min(current,total||current),startDate:$("#bookStartDate").value,endDate:$("#bookEndDate").value||(status==="Concluído"?today():""),price,projectId:$("#bookProject").value,coverUrl:$("#bookCoverUrl").value.trim(),notes:$("#bookNotes").value.trim(),updatedAt:new Date().toISOString()};if(!base.title)return;
  if(editingBookId){const b=state.books.find(x=>x.id===editingBookId);if(!b)return;Object.assign(b,base);await persist("books",b);editingBookId=null;closeModal("bookModal");renderAll();openPage("books");toast("Livro atualizado.");return}
  const b={id:uid("book"),...base,rating:0,quotes:[],sessions:[],favorite:false,createdAt:new Date().toISOString()};state.books.unshift(b);await persist("books",b);if(price>0){await createLinkedFinance({type:"expense",amount:price,description:`Livro — ${b.title}`,category:"Educação",date:today(),sourceType:"book",sourceId:b.id})}closeModal("bookModal");renderAll();openPage("books");toast("Livro adicionado à biblioteca.")
}
function openBookDetail(id){
  const b=state.books.find(x=>x.id===id);if(!b)return;const project=state.projects.find(p=>p.id===b.projectId),fin=state.finance.filter(f=>f.sourceType==="book"&&f.sourceId===b.id),pages=(b.sessions||[]).reduce((a,x)=>a+Number(x.pages||0),0);
  $("#bookDetailTitle").textContent=b.title;$("#bookDetailSub").textContent=`${b.author||"Autor não informado"}${b.category?" • "+b.category:""}`;
  $("#bookDetailBody").innerHTML=`<div class="detail-grid"><div class="detail-stack">
  <article class="card book-detail-hero"><div class="book-detail-cover book-cover">${bookCover(b)}</div><div><span class="book-status">${esc(b.status)}</span><h3>${esc(b.title)}</h3><p class="muted">${esc(b.author||"Autor não informado")}</p><div class="progress large"><span style="width:${bookProgress(b)}%"></span></div><p><b>${bookProgress(b)}%</b> • ${Number(b.currentPage||0)} de ${b.totalPages||"?"} páginas</p><div class="rating-row">${[1,2,3,4,5].map(n=>`<button class="star-btn ${Number(b.rating)>=n?"active":""}" onclick="Frontier.rateBook('${b.id}',${n})">★</button>`).join("")}</div></div></article>
  <article class="card"><h3>Atualizar leitura</h3><div class="mini-form"><input id="bookPageUpdate" type="number" min="0" max="${b.totalPages||999999}" value="${Number(b.currentPage||0)}"><select id="bookStatusUpdate"><option${b.status==="Quero ler"?" selected":""}>Quero ler</option><option${b.status==="Lendo"?" selected":""}>Lendo</option><option${b.status==="Pausado"?" selected":""}>Pausado</option><option${b.status==="Concluído"?" selected":""}>Concluído</option><option${b.status==="Abandonado"?" selected":""}>Abandonado</option></select><button class="btn secondary" onclick="Frontier.updateBookProgress('${b.id}')">Atualizar</button></div><small class="muted">Ao marcar como concluído, a data de término é registrada automaticamente se estiver vazia.</small></article>
  <article class="card"><h3>Sessões de leitura</h3><div class="mini-form"><input id="bookSessionDate" type="date" value="${today()}"><input id="bookSessionPages" type="number" min="1" placeholder="Páginas lidas"><input id="bookSessionMinutes" type="number" min="0" placeholder="Minutos"><button class="btn secondary" onclick="Frontier.addBookSession('${b.id}')">Registrar</button></div><div class="stack-list" style="margin-top:9px">${(b.sessions||[]).slice().reverse().slice(0,8).map((x,i)=>`<div class="stack-item"><div><b>${dateBR(x.date)}</b><small>${x.pages||0} pág. • ${x.minutes||0} min</small></div></div>`).join("")||"<small class='muted'>Nenhuma sessão registrada.</small>"}</div></article>
  </div><div class="detail-stack">
  <article class="card"><h3>Informações</h3><div class="metric-grid"><div class="metric-box"><small>Páginas registradas</small><b>${pages}</b></div><div class="metric-box"><small>Nota</small><b>${b.rating?b.rating+"/5":"—"}</b></div><div class="metric-box"><small>Início</small><b>${dateBR(b.startDate)}</b></div><div class="metric-box"><small>Término</small><b>${dateBR(b.endDate)}</b></div></div><p class="muted">${esc(b.notes||"Sem observações.")}</p>${project?`<p><b>Projeto:</b> ${esc(project.name)}</p>`:""}</article>
  <article class="card"><h3>Citações e aprendizados</h3><div class="mini-form"><textarea id="bookQuoteText" placeholder="Trecho, ideia ou aprendizado..."></textarea><button class="btn secondary" onclick="Frontier.addBookQuote('${b.id}')">Adicionar</button></div><div class="quote-list">${(b.quotes||[]).slice().reverse().map((q,i)=>`<blockquote>${esc(q.text)}<footer>${dateBR(q.date)}</footer></blockquote>`).join("")||"<small class='muted'>Nenhuma anotação de leitura.</small>"}</div></article>
  <article class="card"><h3>Financeiro</h3><p class="muted">Compras e gastos vinculados ao livro aparecem no financeiro geral.</p><button class="btn secondary wide" onclick="Frontier.openFinanceModal('book','${b.id}')">Registrar gasto deste livro</button><div class="stack-list" style="margin-top:9px">${fin.slice(0,5).map(f=>`<div class="stack-item"><span>${esc(f.description)}</span><b>${money(f.amount)}</b></div>`).join("")||"<small class='muted'>Nenhum gasto vinculado.</small>"}</div></article>
  <button class="btn secondary" onclick="Frontier.editBook('${b.id}')">Editar livro</button><button class="btn danger" onclick="Frontier.deleteBook('${b.id}')">Excluir livro</button>
  </div></div>`;$("#bookDetailModal").classList.remove("hidden")
}
async function updateBookProgress(id){const b=state.books.find(x=>x.id===id);if(!b)return;b.currentPage=Math.max(0,Number($("#bookPageUpdate").value||0));b.status=$("#bookStatusUpdate").value;if(b.status==="Lendo"&&!b.startDate)b.startDate=today();if(b.status==="Concluído"){if(b.totalPages)b.currentPage=b.totalPages;if(!b.endDate)b.endDate=today()}b.updatedAt=new Date().toISOString();await persist("books",b);renderAll();openBookDetail(id)}
async function addBookSession(id){const b=state.books.find(x=>x.id===id);if(!b)return;const pages=Number($("#bookSessionPages").value||0),minutes=Number($("#bookSessionMinutes").value||0),date=$("#bookSessionDate").value||today();if(pages<=0&&minutes<=0)return;b.sessions=b.sessions||[];b.sessions.push({date,pages,minutes});if(pages>0)b.currentPage=Math.min(Number(b.totalPages||Infinity),Number(b.currentPage||0)+pages);if(b.status==="Quero ler")b.status="Lendo";if(!b.startDate)b.startDate=date;if(b.totalPages&&b.currentPage>=b.totalPages){b.status="Concluído";b.endDate=b.endDate||date}b.updatedAt=new Date().toISOString();await persist("books",b);renderAll();openBookDetail(id)}
async function addBookQuote(id){const b=state.books.find(x=>x.id===id),text=$("#bookQuoteText").value.trim();if(!b||!text)return;b.quotes=b.quotes||[];b.quotes.push({text,date:today()});b.updatedAt=new Date().toISOString();await persist("books",b);openBookDetail(id)}
async function rateBook(id,rating){const b=state.books.find(x=>x.id===id);if(!b)return;b.rating=rating;b.updatedAt=new Date().toISOString();await persist("books",b);openBookDetail(id)}
async function deleteBook(id){if(!confirm("Excluir este livro? Os gastos vinculados continuarão preservados no financeiro."))return;state.books=state.books.filter(x=>x.id!==id);await removePersist("books",id);closeModal("bookDetailModal");renderAll();toast("Livro excluído.")}

/* SETTINGS + PWA */
function renderSettings(){
  if(!user)return;appPrefs=currentPreferences();$("#settingsName").value=appPrefs.display_name;$("#settingsWeekStart").value=appPrefs.week_start;$("#settingsTheme").value=appPrefs.theme;$("#settingsDefaultPage").value=appPrefs.default_page;$("#settingsBackendLabel").textContent=Backend.mode==="supabase"?"Supabase conectado":"Armazenamento local";updatePwaUi()
}
async function saveSettings(e){
  e.preventDefault();const prefs={display_name:$("#settingsName").value.trim()||"Usuário",week_start:$("#settingsWeekStart").value,theme:$("#settingsTheme").value,default_page:$("#settingsDefaultPage").value};
  try{user=await Backend.updatePreferences(prefs);applyPreferences();renderCalendar();renderSettings();toast("Preferências salvas.")}catch(err){toast(err.message||"Não foi possível salvar as preferências.","error")}
}

/* NOTIFICATION CENTER */
function previousMonthKey(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthHasActivity(month){return state.finance.some(x=>monthKey(x.date)===month)||state.studySessions.some(x=>monthKey(x.date)===month)||state.books.some(b=>monthKey(b.endDate)===month)||(state.habitLogs||[]).some(x=>monthKey(x.date)===month)}
function getAlerts(){
  const arr=[],now=new Date(new Date().toDateString());
  state.projects.forEach(p=>{if(p.deadline&&p.status!=="Concluído"){const d=daysUntil(p.deadline);if(d!==null&&d<=14)arr.push({id:`project:${p.id}:${p.deadline}`,domain:"project",kind:"deadline",icon:"🧭",title:d<0?`Projeto atrasado: ${p.name}`:`Prazo de ${p.name} em ${d} dia(s)`,subtitle:p.category,date:p.deadline})}});
  state.pets.forEach(p=>{(p.vaccines||[]).forEach((v,i)=>{const d=daysUntil(v.nextDate);if(v.nextDate&&d!==null&&d<=30)arr.push({id:`pet:vaccine:${p.id}:${i}:${v.nextDate}`,domain:"pet",petId:p.id,kind:"vaccine",icon:"💉",title:d<0?`${v.name} de ${p.name} está atrasada`:`${v.name} de ${p.name} em ${d} dia(s)`,subtitle:"Vacina",date:v.nextDate})});(p.visits||[]).forEach((v,i)=>{const d=daysUntil(v.date);if(v.date&&d!==null&&d>=0&&d<=14)arr.push({id:`pet:visit:${p.id}:${i}:${v.date}`,domain:"pet",petId:p.id,kind:"visit",icon:"🐾",title:`Consulta de ${p.name} em ${d} dia(s)`,subtitle:v.reason||"Veterinário",date:v.date})})});
  state.vehicles.forEach(v=>(v.maintenances||[]).forEach((m,i)=>{const d=daysUntil(m.nextDate);if(m.nextDate&&d!==null&&d>=0&&d<=30)arr.push({id:`vehicle:${v.id}:${i}:${m.nextDate}`,domain:"vehicle",vehicleId:v.id,kind:"maintenance",icon:"🔧",title:`${v.name}: ${m.service} em ${d} dia(s)`,subtitle:"Manutenção",date:m.nextDate})}));
  state.finance.filter(f=>f.type==="expense"&&daysUntil(f.date)!==null&&daysUntil(f.date)>=0&&daysUntil(f.date)<=7&&localDate(f.date)>now).forEach(f=>arr.push({id:`finance:${f.id}:${f.date}`,domain:"finance",kind:"bill",icon:"💵",title:`${f.description} vence em ${daysUntil(f.date)} dia(s)`,subtitle:money(f.amount),date:f.date}));
  state.calendar.forEach(e=>{const d=daysUntil(e.date);if(e.date&&d!==null&&d>=0&&d<=2)arr.push({id:`calendar:${e.id}:${e.date}`,domain:"calendar",kind:"calendar",icon:"📅",title:d===0?`Hoje: ${e.title}`:d===1?`Amanhã: ${e.title}`:`${e.title} em ${d} dias`,subtitle:e.type||"Agenda",date:e.date})});
  const prev=previousMonthKey(),day=new Date().getDate();if(day<=7&&monthHasActivity(prev))arr.push({id:`review:${prev}`,domain:"review",kind:"monthly_review",icon:"📊",title:`Sua revisão de ${monthLabel(prev)} está pronta`,subtitle:"Veja finanças, estudos, leitura, hábitos e projetos.",date:today(),reviewMonth:prev});
  return arr.sort((a,b)=>String(a.date).localeCompare(String(b.date)))
}
function getNotificationView(){
  const current=getAlerts(),persisted=new Map((state.notifications||[]).map(n=>[n.id,n]));
  const merged=current.map(a=>{const old=persisted.get(a.id);return {...(old||{}),...a,read:old?.read===true,active:true}});
  const currentIds=new Set(current.map(x=>x.id));
  (state.notifications||[]).filter(n=>!currentIds.has(n.id)).forEach(n=>merged.push({...n,active:false}));
  return merged.sort((a,b)=>Number(a.read)-Number(b.read)||Number(b.active)-Number(a.active)||String(a.date||"").localeCompare(String(b.date||"")))
}
async function markNotificationRead(id){
  const all=getNotificationView(),view=all.find(x=>x.id===id);if(!view)return;let n=state.notifications.find(x=>x.id===id);
  if(!n){n={...view,read:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};delete n.active;state.notifications.unshift(n)}else{n.read=true;n.updatedAt=new Date().toISOString()}
  await persist("notifications",n);renderAlerts();if(view.kind==="monthly_review"&&view.reviewMonth)openMonthlyReview(view.reviewMonth)
}
async function markAllNotificationsRead(){
  const unread=getNotificationView().filter(n=>!n.read);for(const view of unread){let n=state.notifications.find(x=>x.id===view.id);if(!n){n={...view,read:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};delete n.active;state.notifications.unshift(n)}else{n.read=true;n.updatedAt=new Date().toISOString()}await persist("notifications",n)}renderAlerts();toast("Notificações marcadas como lidas.")
}
function renderAlerts(){
  const all=getNotificationView(),filter=$("#notificationFilter")?.value||"all",arr=all.filter(n=>filter==="all"||(filter==="unread"?!n.read:n.read)),unread=all.filter(n=>!n.read).length;
  $("#alertCountBadge").textContent=unread;$("#alertCountBadge").classList.toggle("hidden",!unread);if($("#notificationSummary"))$("#notificationSummary").textContent=`${unread} não lida${unread===1?"":"s"} • ${all.length} no histórico`;
  $("#alertsList").innerHTML=arr.length?arr.map(a=>`<article class="alert-card notification-card ${a.read?"read":"unread"}"><div class="alert-icon">${a.icon||"🔔"}</div><div><h4>${esc(a.title)}</h4><p>${esc(a.subtitle||"")}</p><time>${a.date?dateBR(a.date):""}${a.active===false?" • histórico":""}</time></div><div class="notification-actions">${a.read?'<span class="badge">Lida</span>':`<button class="btn secondary compact" onclick="Frontier.markNotificationRead('${esc(a.id)}')">Marcar como lida</button>`}</div></article>`).join(""):'<div class="empty-hero"><div class="empty-icon">✓</div><h2>Nada por aqui.</h2><p>Quando houver prazos, contas, agenda, cuidados ou revisões, aparecerão aqui.</p></div>'
}

/* OPTIONAL WEB PUSH */
function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function currentPushSubscription(){if(!("serviceWorker" in navigator))return null;try{const reg=await navigator.serviceWorker.ready;return await reg.pushManager.getSubscription()}catch{return null}}
async function updatePushUi(){
  const title=$("#pushStatusTitle"),text=$("#pushStatusText"),btn=$("#enablePushBtn");if(!title||!text||!btn)return;
  const configured=!!(window.FRONTIER_CONFIG?.VAPID_PUBLIC_KEY),supported="Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window;
  if(!supported){title.textContent="Push indisponível neste navegador";text.textContent="A Central de Notificações interna continua funcionando.";btn.disabled=true;return}
  if(!configured){title.textContent="Push opcional não configurado";text.textContent="Configure a chave VAPID pública quando quiser receber avisos com o app fechado.";btn.textContent="Configurar depois";btn.disabled=true;return}
  const sub=await currentPushSubscription();btn.disabled=false;if(sub){title.textContent="Notificações no celular ativas";text.textContent="Este dispositivo está inscrito para receber avisos importantes.";btn.textContent="Desativar neste dispositivo"}else{title.textContent="Notificações no celular disponíveis";text.textContent=Notification.permission==="denied"?"Permissão bloqueada no navegador. Altere nas configurações do site.":"Ative para receber avisos importantes mesmo com o Frontier fechado.";btn.textContent="Ativar notificações no celular"}
}
async function togglePushNotifications(){
  try{
    const existing=await currentPushSubscription();if(existing){await Backend.removePushSubscription(user,existing.endpoint);await existing.unsubscribe();toast("Notificações push desativadas neste dispositivo.","info");updatePushUi();return}
    const key=window.FRONTIER_CONFIG?.VAPID_PUBLIC_KEY;if(!key){toast("Web Push ainda não foi configurado no Frontier.","info");return}
    const permission=await Notification.requestPermission();if(permission!=="granted"){toast("Permissão de notificações não concedida.","error");updatePushUi();return}
    const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});await Backend.savePushSubscription(user,sub);toast("Notificações no celular ativadas.");updatePushUi()
  }catch(err){console.error(err);toast(err.message||"Não foi possível ativar as notificações.","error")}
}

/* PUBLIC API */
window.Frontier={
  openPagePublic:openPage,
  openProjectWizard,selectProjectType,addProjectSuggestions,addWizardItem,removeWizardItem,openProjectDetail,openProjectEdit,toggleProjectItem,addProjectProgress,changeProjectStatus,deleteProject,addTravelItem,removeTravelItem,
  openFinanceModal,openAccountModal,editFinance,deleteFinance,
  openCalendarModal,editCalendarEvent,selectCalendarDay,openSelectedCalendarModal,deleteCalendarEvent,
  newNote,openNote,openNoteFromSearch,openFolderModal,
  openPetModal,openPetDetail,addPetRecord,removePetRecord,deletePet,
  openStudyModal,deleteStudySession,goStudies,
  openVehicleModal,openVehicleDetail,editVehicle,addVehicleFuel,addVehicleMaintenance,updateVehicleOdometer,deleteVehicle,
  openBookModal,openBookDetail,editBook,updateBookProgress,addBookSession,addBookQuote,rateBook,deleteBook,
  openHabitModal,toggleHabitToday,toggleHabitActive,deleteHabit,
  openMonthlyReview,markNotificationRead,
  closeQuickMenu,goFinanceSearch,goFinanceEntry,goCalendar
};
boot().catch(err=>{console.error(err);alert("Erro ao iniciar o Frontier: "+(err.message||err))});
})();