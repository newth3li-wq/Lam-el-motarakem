const SUBJECTS = [
 {id:'stats',name:'الإحصاء',icon:'▦',day:'الأحد',color:'purple'},
 {id:'history',name:'التاريخ',icon:'⌂',day:'الاثنين',color:'orange'},
 {id:'english',name:'اللغة الإنجليزية',icon:'A',day:'الثلاثاء',color:'blue'},
 {id:'geo',name:'الجغرافيا',icon:'◎',day:'الأربعاء',color:'green'},
 {id:'arabic',name:'اللغة العربية',icon:'ع',day:'الخميس',color:'purple'}
];
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const defaultSchedule = [
 {day:'الأحد',subject:'الإحصاء',time:''},{day:'الاثنين',subject:'التاريخ',time:''},
 {day:'الثلاثاء',subject:'اللغة الإنجليزية',time:''},{day:'الأربعاء',subject:'الجغرافيا',time:''},
 {day:'الخميس',subject:'اللغة العربية',time:''}
];
const load = (key, fallback) => {try{return JSON.parse(localStorage.getItem('adabi_'+key)) ?? fallback}catch{return fallback}};
let lessons=load('lessons',[]);
let schedule=load('schedule',defaultSchedule);
let studyHours=load('hours',3), focus=load('focus','balanced'), totalMinutes=load('minutes',0);
let currentSubject='all', backlogFilter='all', quizIndex=0, quizScore=0, quizStarted=false, timerSeconds=1500, timerInterval=null;
const quiz=[
 {q:'ما عاصمة مصر؟',a:['الإسكندرية','القاهرة','الأقصر','أسوان'],correct:1,why:'القاهرة هي عاصمة جمهورية مصر العربية'},
 {q:'أيٌّ مما يلي يُعد من وحدات قياس الزمن؟',a:['المتر','الثانية','اللتر','الكيلوجرام'],correct:1,why:'الثانية وحدة قياس الزمن'},
 {q:'Choose the correct sentence:',a:['She go to school.','She goes to school.','She going school.','She gone to school.'],correct:1,why:'مع he/she/it نضيف s للفعل في المضارع البسيط'},
 {q:'أيٌّ مما يلي يُستخدم لتمثيل سطح الأرض؟',a:['الخريطة','الساعة','الميزان','المسطرة فقط'],correct:0,why:'الخريطة تمثيل مصغر لسطح الأرض أو جزء منه'},
 {q:'الجملة الاسمية تبدأ غالبًا بـ:',a:['فعل','حرف جر','اسم','أداة نفي'],correct:2,why:'الأصل في الجملة الاسمية أن تبدأ باسم'}
];
const $=s=>document.querySelector(s);
const save=()=>{try{activitySig()}catch(e){};localStorage.setItem('adabi_lessons',JSON.stringify(lessons));localStorage.setItem('adabi_schedule',JSON.stringify(schedule));localStorage.setItem('adabi_hours',studyHours);localStorage.setItem('adabi_focus',focus);localStorage.setItem('adabi_minutes',totalMinutes)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subjectName=id=>SUBJECTS.find(s=>s.id===id)?.name||'';
const statusName=s=>({'not-started':'لم أبدأ','in-progress':'بدأت فيه','completed':'مكتمل'}[s]||'لم أبدأ');
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function todayIndex(){return new Date().getDay()}
function currentDay(){return DAYS[todayIndex()]}
function stats(){let done=lessons.filter(l=>l.status==='completed').length, total=lessons.length, started=lessons.filter(l=>l.status==='in-progress').length;return {done,total,started,remaining:total-done,percent:total?Math.round(done/total*100):0}}
function renderStats(){let s=stats();$('#completedStat').textContent=s.done;$('#totalStat').textContent=s.total;$('#percentStat').textContent=s.percent+'%';$('#remainingStat').textContent=s.remaining;$('#hoursStat').textContent=totalMinutes>=60?`${Math.floor(totalMinutes/60)} س`:`${totalMinutes} د`;$('#progressCompleted').textContent=s.done;$('#progressPercent').textContent=s.percent+'%';$('#progressMinutes').textContent=totalMinutes+' دقيقة';$('#progressRemaining').textContent=s.remaining}
function renderSchedule(){ $('#weeklySchedule').innerHTML=schedule.map(x=>`<div class="week-row"><span class="week-day">${esc(x.day)}</span><span class="week-subject">${esc(x.subject)}</span><span class="muted">${esc(x.time||'لم يُحدد الوقت')}</span></div>`).join('');$('#scheduleEditor').innerHTML=schedule.map((x,i)=>`<div class="schedule-edit-row"><span>${esc(x.day)}</span><b>${esc(x.subject)}</b><input class="field time-input" type="time" data-index="${i}" value="${esc(x.time)}" aria-label="موعد درس ${esc(x.subject)}"></div>`).join('')}
function subjectProgress(){return SUBJECTS.map(s=>{let list=lessons.filter(l=>l.subject===s.id),done=list.filter(l=>l.status==='completed').length,p=list.length?Math.round(done/list.length*100):0;return `<div class="mini-progress"><b>${s.icon} ${s.name}</b><small>${done} من ${list.length} درس · ${p}%</small><div class="bar"><span style="width:${p}%"></span></div></div>`}).join('')}
function renderToday(){let day=currentDay(),todaySub=schedule.find(x=>x.day===day)?.subject;let pending=lessons.filter(l=>l.status!=='completed');let chosen=pending.filter(l=>subjectName(l.subject)===todaySub).slice(0,2);if(chosen.length<2)chosen=chosen.concat(pending.filter(l=>!chosen.includes(l)).slice(0,2-chosen.length));if(!chosen.length){$('#todayTasks').innerHTML='<div class="empty-state">مفيش دروس مضافة لسه. أضف دروس المنهج عشان الموقع يقدر يقترح عليك مهام حقيقية</div>';return}$('#todayTasks').innerHTML=chosen.map(l=>`<label class="task-item"><input class="task-check" type="checkbox" data-lesson="${l.id}" ${l.status==='completed'?'checked':''}><span><b>${esc(l.name)}</b><small>${subjectName(l.subject)} · ${esc(l.unit)}</small></span><span class="duration">45 دقيقة</span></label>`).join('')}
function renderSubjects(){
 let filters=[['all','كل المواد'],...SUBJECTS.map(s=>[s.id,s.name])];
 $('#subjectFilters').innerHTML=filters.map(([id,n])=>`<button class="filter-chip ${currentSubject===id?'active':''}" data-filter="${id}">${n}</button>`).join('');
 let chosen=SUBJECTS.filter(s=>currentSubject==='all'||s.id===currentSubject);
 $('#subjectCards').innerHTML=chosen.map(s=>{
  let list=lessons.filter(l=>l.subject===s.id),done=list.filter(l=>l.status==='completed').length,pct=list.length?Math.round(done/list.length*100):0;
  return `<article class="subject-card"><div class="subject-card-head"><div class="subject-symbol">${s.icon}</div><div class="subject-title-wrap"><h3>${s.name}</h3><small>${done} من ${list.length} درس مكتمل</small></div><span class="subject-percent">${pct}%</span></div><div class="subject-card-progress"><span style="width:${pct}%"></span></div>${list.length?list.map(l=>`<div class="lesson-row"><button class="lesson-open" data-open-lesson="${l.id}" aria-label="فتح ${esc(l.name)}"><span class="lesson-chevron">‹</span><span class="lesson-copy"><b>${esc(l.name)}</b><small>${esc(l.unit)}</small></span></button><select class="status-select" data-status="${l.id}" aria-label="حالة ${esc(l.name)}"><option value="not-started" ${l.status==='not-started'?'selected':''}>لم أبدأ</option><option value="in-progress" ${l.status==='in-progress'?'selected':''}>بدأت فيه</option><option value="completed" ${l.status==='completed'?'selected':''}>مكتمل</option></select><button class="text-btn delete-lesson" data-delete="${l.id}" title="حذف الدرس" aria-label="حذف ${esc(l.name)}">×</button></div>`).join(''):'<div class="empty-small">لسه مفيش دروس مضافة للمادة. استخدم زر «إضافة درس» وأدخل اسم الدرس من كتابك</div>'}<button class="subject-add-link" data-add-for="${s.id}">＋ إضافة درس للمادة</button></article>`
 }).join('');
}
function openLessonDetail(id){let l=lessons.find(x=>x.id===id);if(!l)return;$('#detailSubject').textContent=subjectName(l.subject);$('#detailTitle').textContent=l.name;$('#detailUnit').textContent=l.unit;$('#detailStatus').value=l.status;$('#detailStatusText').textContent=statusName(l.status);$('#saveDetailStatus').dataset.lesson=id;$('#lessonDetailDialog').showModal()}
function renderSearchResults(query){let box=$('#searchResults');let q=query.trim().toLocaleLowerCase('ar');if(!q){box.hidden=true;box.innerHTML='';return}let found=[];SUBJECTS.filter(s=>s.name.toLocaleLowerCase('ar').includes(q)).forEach(s=>found.push({type:'subject',id:s.id,title:s.name,sub:'مادة'}));lessons.filter(l=>(l.name+' '+l.unit+' '+subjectName(l.subject)).toLocaleLowerCase('ar').includes(q)).slice(0,8).forEach(l=>found.push({type:'lesson',id:l.id,title:l.name,sub:subjectName(l.subject)+' · '+l.unit}));box.innerHTML=found.length?found.slice(0,9).map(x=>`<button class="search-result" data-search-type="${x.type}" data-search-id="${x.id}"><span class="search-result-icon">${x.type==='subject'?'▤':'▹'}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><span class="search-arrow">←</span></button>`).join(''):'<div class="search-empty">مفيش نتائج مطابقة. جرّب اسم مادة أو درس تاني</div>';box.hidden=false}
function renderBacklog(){let list=lessons.filter(l=>l.status!=='completed');if(backlogFilter!=='all')list=list.filter(l=>l.subject===backlogFilter);let rank={'in-progress':0,'not-started':1};list.sort((a,b)=>rank[a.status]-rank[b.status]);$('#backlogFilters').innerHTML=[['all','كل المواد'],...SUBJECTS.map(s=>[s.id,s.name])].map(([id,n])=>`<button class="filter-chip ${backlogFilter===id?'active':''}" data-backfilter="${id}">${n}</button>`).join('');$('#backlogList').innerHTML=list.length?list.map(l=>`<div class="backlog-item"><span class="priority ${l.status==='in-progress'?'':'low'}"></span><div><b>${esc(l.name)}</b><small>${subjectName(l.subject)} · ${esc(l.unit)} · ${statusName(l.status)}</small></div><select class="status-select" data-status="${l.id}"><option value="not-started" ${l.status==='not-started'?'selected':''}>لم أبدأ</option><option value="in-progress" ${l.status==='in-progress'?'selected':''}>بدأت فيه</option><option value="completed">مكتمل</option></select></div>`).join(''):'<div class="panel empty-state">مفيش دروس متراكمة ظاهرة. أضف دروسك وحالتها عشان نرتبها لك</div>'}
function renderProgress(){let details=SUBJECTS.map(s=>{let ls=lessons.filter(l=>l.subject===s.id),d=ls.filter(l=>l.status==='completed').length,p=ls.length?Math.round(d/ls.length*100):0;return `<div class="progress-line"><b>${s.name}</b><div class="bar"><span style="width:${p}%"></span></div><small>${p}%</small></div>`}).join('');$('#progressDetails').innerHTML=details}
const QUOTES=['خطوة صغيرة النهاردة أحسن من خطة كبيرة بكرة','مش لازم تخلص كل حاجة، المهم متقفش','كل درس بتخلصه بيقلل المتراكم وبيزود ثقتك','ركّز ٢٥ دقيقة بس، والباقي هيمشي لوحده','الاستمرار بيغلب الحماس','النهاردة بتبني نتيجتك اللي هتفرح بيها'];
const localDay=d=>d.toLocaleDateString('sv-SE');
let activeDays=load('days',[]);
const sigNow=()=>lessons.filter(l=>l.status!=='not-started').length+':'+totalMinutes;
let lastSig=sigNow();
function activitySig(){const s=sigNow();if(s!==lastSig){lastSig=s;const d=localDay(new Date());if(!activeDays.includes(d)){activeDays.push(d);localStorage.setItem('adabi_days',JSON.stringify(activeDays))}}}
function streak(){let n=0,d=new Date();if(!activeDays.includes(localDay(d)))d.setDate(d.getDate()-1);while(activeDays.includes(localDay(d))){n++;d.setDate(d.getDate()-1)}return n}
const BADGES=[['🌱','أول درس',s=>s.done>=1],['📘','٥ دروس',s=>s.done>=5],['🏆','١٠ دروس',s=>s.done>=10],['⏱️','ساعة تركيز',()=>totalMinutes>=60],['🔥','٣ أيام متتالية',()=>streak()>=3],['⚡','أسبوع متتالي',()=>streak()>=7]];
function renderMotivation(){const s=stats(),xp=s.done*50+totalMinutes*2,lv=Math.floor(xp/200)+1,st=streak();
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 set('streakChip','🔥 '+st+' يوم متتالي');set('dailyQuote',QUOTES[new Date().getDate()%QUOTES.length]);set('levelNum',lv);set('goalText',`${xp%200} / 200 نقطة للمستوى ${lv+1}`);
 const gb=document.getElementById('goalBar');if(gb)gb.style.width=Math.round(xp%200/2)+'%';
 set('pLevel',lv);set('pXp',xp);set('pStreak',st);set('pMinutes',totalMinutes);
 const bg=document.getElementById('badgeGrid');if(bg)bg.innerHTML=BADGES.map(([i,n,f])=>`<div class="badge ${f(s)?'earned':''}"><span>${i}</span><b>${n}</b></div>`).join('')}
function renderAll(){renderMotivation();renderStats();renderSchedule();renderToday();$('#subjectProgress').innerHTML=subjectProgress();renderSubjects();renderBacklog();renderProgress()}
let pageTransitionToken=0,pendingExit=null;
const motionReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
function isReduced(){return motionReduce.matches&&!document.documentElement.classList.contains('motion-full')}
function showPage(page){
 const target=$('#page-'+page); if(!target)return;
 const current=document.querySelector('.page.active');
 if(current===target){$('#sidebar').classList.remove('open');document.body.classList.remove('mobile-menu-open');$('#menuBtn')?.setAttribute('aria-expanded','false');return;}
 const rapid=!!pendingExit; if(pendingExit){pendingExit.cancel();pendingExit=null}
 const token=++pageTransitionToken;
 const commit=()=>{
  if(token!==pageTransitionToken)return;
  document.querySelectorAll('.page').forEach(p=>{p.getAnimations().forEach(a=>a.cancel());if(p!==target)p.classList.remove('active')});
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#pageTitle').textContent=({dashboard:'الرئيسية',subjects:'المواد والمنهج',planner:'مخطط المذاكرة',backlog:'إنقاذ المتراكم',quizzes:'الاختبارات',progress:'تقدمي',profile:'ملفي الشخصي'})[page];
  target.classList.add('active');
  $('#sidebar').classList.remove('open');
  document.body.classList.remove('mobile-menu-open');
  $('#menuBtn')?.setAttribute('aria-expanded','false');
  if(target.animate){
   target.animate(isReduced()?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translate3d(0,14px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:isReduced()?220:380,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  if(window.adabiRefreshReveal) window.adabiRefreshReveal();
  window.scrollTo({top:0,behavior:'instant'});
  // safety net: anything already on screen must be visible, even if the observer lags behind fast navigation
  requestAnimationFrame(()=>requestAnimationFrame(()=>target.querySelectorAll('.panel,.stat-card,.subject-card,.progress-line,.backlog-item,.week-row,.mini-progress,.task-item,.badge').forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)el.classList.add('is-visible')})));
 };
 if(current && !rapid && !isReduced() && current.animate){
  const exit=current.animate([{opacity:1,transform:'translate3d(0,0,0)'},{opacity:0,transform:'translate3d(0,-6px,0)'}],{duration:140,easing:'ease-in',fill:'forwards'});
  pendingExit=exit;
  exit.finished.then(()=>{if(pendingExit===exit)pendingExit=null;commit()}).catch(()=>{});
 } else commit();
}
document.addEventListener('click',e=>{let sr=e.target.closest('[data-search-type]');if(sr){$('#searchResults').hidden=true;$('#globalSearch').value='';if(sr.dataset.searchType==='subject'){currentSubject=sr.dataset.searchId;showPage('subjects');renderSubjects()}else{let l=lessons.find(x=>x.id===sr.dataset.searchId);if(l){currentSubject=l.subject;showPage('subjects');renderSubjects();openLessonDetail(l.id)}}return}let open=e.target.closest('[data-open-lesson]');if(open){openLessonDetail(open.dataset.openLesson);return}let addFor=e.target.closest('[data-add-for]');if(addFor){$('#lessonSubject').innerHTML=SUBJECTS.map(s=>`<option value="${s.id}" ${s.id===addFor.dataset.addFor?'selected':''}>${s.name}</option>`).join('');$('#lessonDialog').showModal();return}let nav=e.target.closest('[data-page]');if(nav)showPage(nav.dataset.page);let go=e.target.closest('[data-goto]');if(go)showPage(go.dataset.goto);let f=e.target.closest('[data-filter]');if(f){currentSubject=f.dataset.filter;renderSubjects()}let bf=e.target.closest('[data-backfilter]');if(bf){backlogFilter=bf.dataset.backfilter;renderBacklog()}let del=e.target.closest('[data-delete]');if(del){lessons=lessons.filter(l=>l.id!==del.dataset.delete);save();renderAll();toast('تم حذف الدرس')}});
document.addEventListener('change',e=>{if(e.target.matches('[data-status]')){let l=lessons.find(x=>x.id===e.target.dataset.status);if(l){l.status=e.target.value;save();renderAll();toast('تم تحديث حالة الدرس')}}if(e.target.matches('.task-check')){let l=lessons.find(x=>x.id===e.target.dataset.lesson);if(l){l.status=e.target.checked?'completed':'in-progress';save();renderAll()}}});
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
// Desktop sidebar collapse / restore, persisted per browser
const sidebarToggle=$('#sidebarToggle');sidebarToggle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/></svg>';
function setSidebarCollapsed(collapsed){
 // The CSS grid track animates the content width while the sidebar itself
 // glides out on the compositor; keep its width intact during the transition.
 document.body.classList.toggle('sidebar-collapsed',collapsed);
 sidebarToggle.setAttribute('aria-expanded',String(!collapsed));
 sidebarToggle.setAttribute('aria-label',collapsed?'إظهار القائمة الجانبية':'إخفاء القائمة الجانبية');
 sidebarToggle.title=collapsed?'إظهار القائمة الجانبية':'إخفاء القائمة الجانبية';
 
 localStorage.setItem('adabi_sidebar_v3',JSON.stringify(collapsed));
}
setSidebarCollapsed(load('sidebar_v3',false));
sidebarToggle.addEventListener('click',()=>setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
$('#todayLabel').textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
$('#globalSearch').addEventListener('input',e=>renderSearchResults(e.target.value));
document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))$('#searchResults').hidden=true});
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#searchResults').hidden=true;$('#globalSearch').blur()}if(e.key==='Enter'){let first=$('#searchResults .search-result');if(first)first.click()}});
$('#closeDetail').onclick=()=>$('#lessonDetailDialog').close();
$('#saveDetailStatus').onclick=()=>{let l=lessons.find(x=>x.id===$('#saveDetailStatus').dataset.lesson);if(!l)return;l.status=$('#detailStatus').value;save();renderAll();$('#detailStatusText').textContent=statusName(l.status);$('#lessonDetailDialog').close();toast('تم حفظ تقدمك في الدرس')};
$('#addLessonBtn').onclick=()=>{$('#lessonSubject').innerHTML=SUBJECTS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');$('#lessonDialog').showModal()};
$('#lessonForm').addEventListener('submit',e=>{e.preventDefault();let lesson={id:Date.now().toString(),subject:$('#lessonSubject').value,unit:$('#lessonUnit').value.trim(),name:$('#lessonName').value.trim(),status:$('#lessonStatus').value};if(!lesson.unit||!lesson.name)return;lessons.push(lesson);save();$('#lessonDialog').close();e.target.reset();renderAll();toast('اتضاف الدرس للمنهج')});
$('#saveSchedule').onclick=()=>{document.querySelectorAll('.time-input').forEach(inp=>schedule[Number(inp.dataset.index)].time=inp.value);save();renderSchedule();toast('تم حفظ مواعيد دروسك')};
$('#studyHours').value=studyHours;$('#planFocus').value=focus;
$('#studyHours').onchange=e=>{studyHours=Number(e.target.value);save()};$('#planFocus').onchange=e=>{focus=e.target.value;save()};
$('#generatePlan').onclick=()=>{let pending=lessons.filter(l=>l.status!=='completed');if(!pending.length){$('#generatedPlan').innerHTML='<div class="empty-state">أضف دروسك الأول من صفحة المواد، وبعدها أقدر أوزعها على وقتك</div>';return}let sorted=[...pending];if(focus==='backlog')sorted.sort((a,b)=>(a.status==='not-started'?0:1)-(b.status==='not-started'?0:1));if(focus==='next'){let idx=SUBJECTS.findIndex(s=>s.day===currentDay());sorted.sort((a,b)=>{let ai=SUBJECTS.findIndex(s=>s.id===a.subject),bi=SUBJECTS.findIndex(s=>s.id===b.subject);return (ai-idx+5)%5-(bi-idx+5)%5})}let slots=Math.max(1,Math.floor(studyHours*60/50));let chosen=sorted.slice(0,slots);$('#generatedPlan').innerHTML=chosen.map((l,i)=>`<div class="plan-row"><span class="plan-time">${i*50+10}–${i*50+55} د</span><div><b>${esc(l.name)}</b><small>${subjectName(l.subject)} · ${esc(l.unit)} · شرح ومذاكرة ثم أسئلة</small></div><button class="text-btn add-plan-task" data-plan="${l.id}">تمت ✓</button></div>`).join('')+`<p class="helper">اقتراح مبني على ${chosen.length} درس من المتبقي. اضغط «تمت» بعد إنجاز الدرس لتحديث تقدمك</p>`};
document.addEventListener('click',e=>{let p=e.target.closest('[data-plan]');if(p){let l=lessons.find(x=>x.id===p.dataset.plan);if(l){l.status='completed';save();renderAll();p.textContent='اتسجل ✓';p.disabled=true;toast('اتسجل الدرس كمكتمل')}}});
$('#startQuiz').onclick=()=>{if(!quizStarted){quizStarted=true;quizIndex=0;quizScore=0;renderQuestion()}else if(quizIndex>=quiz.length){quizStarted=false;$('#quizQuestion').textContent=`خلصت الاختبار! نتيجتك ${quizScore} من ${quiz.length}`;$('#quizAnswers').innerHTML='';$('#quizFeedback').textContent='الاختبار توضيحي وليس من المنهج الرسمي';$('#startQuiz').textContent='إعادة الاختبار';return}else renderQuestion()};
function renderQuestion(){let q=quiz[quizIndex];$('#quizCount').textContent=`السؤال ${quizIndex+1} من ${quiz.length}`;$('#quizQuestion').textContent=q.q;$('#quizAnswers').innerHTML=q.a.map((a,i)=>`<button class="answer-btn" data-answer="${i}">${['أ','ب','ج','د'][i]}. ${a}</button>`).join('');$('#quizFeedback').textContent='اختار إجابة واحدة';$('#startQuiz').textContent='السؤال التالي';$('#startQuiz').disabled=true}
$('#quizAnswers').addEventListener('click',e=>{let b=e.target.closest('[data-answer]');if(!b)return;let q=quiz[quizIndex],choice=Number(b.dataset.answer);document.querySelectorAll('.answer-btn').forEach(x=>{x.disabled=true;if(Number(x.dataset.answer)===q.correct)x.classList.add('correct')});if(choice===q.correct){quizScore++;$('#quizFeedback').textContent='إجابة صحيحة! '+q.why}else{$('#quizFeedback').textContent='مش مشكلة '+q.why;b.classList.add('wrong')}$('#startQuiz').disabled=false;$('#startQuiz').textContent=quizIndex===quiz.length-1?'عرض النتيجة':'التالي';quizIndex++});
function updateTimer(){let m=Math.floor(timerSeconds/60),s=timerSeconds%60;$('#timerDisplay').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
let timerLogged=0;
function flushSession(){const m=Math.floor((1500-timerSeconds)/60);if(m>timerLogged){totalMinutes+=m-timerLogged;timerLogged=m;save();renderStats();renderProgress()}}
function resetTimer(){clearInterval(timerInterval);timerInterval=null;timerSeconds=1500;timerLogged=0;updateTimer()}
$('#timerStart').onclick=()=>{if(timerInterval)return;if(timerSeconds<=0)resetTimer();timerInterval=setInterval(()=>{timerSeconds--;updateTimer();if(timerSeconds<=0){clearInterval(timerInterval);timerInterval=null;timerSeconds=0;flushSession();toast('خلصت جلسة التركيز! اتسجلت 25 دقيقة');resetTimer()}},1000)};
$('#timerPause').onclick=()=>{if(timerInterval){clearInterval(timerInterval);timerInterval=null;flushSession();toast('تم إيقاف المؤقت وتسجيل الوقت المنجز')}};
$('#timerReset').onclick=()=>{flushSession();resetTimer()};
$('#resetBtn').onclick=()=>{if(confirm('متأكد إنك عايز تمسح كل بيانات الموقع المحفوظة على الجهاز؟')){['lessons','schedule','hours','focus','minutes','days'].forEach(k=>localStorage.removeItem('adabi_'+k));lessons=[];activeDays=[];schedule=defaultSchedule;studyHours=3;focus='balanced';totalMinutes=0;$('#studyHours').value=3;$('#planFocus').value='balanced';renderAll();toast('اتمسحت بيانات التجربة')}};

// Theme and first-run study-track setup
const savedTheme=load('theme_v2','dark');
document.body.dataset.theme=savedTheme;document.documentElement.style.colorScheme=savedTheme;
function updateThemeButton(){
 const dark=document.body.dataset.theme==='dark';
 $('#themeIcon').textContent=dark?'☀':'☾';
 $('#themeText').textContent=dark?'الوضع الفاتح':'الوضع الداكن';
}
updateThemeButton();
function setTheme(next,origin){
 const apply=()=>{document.body.dataset.theme=next;document.documentElement.style.colorScheme=next;localStorage.setItem('adabi_theme_v2',JSON.stringify(next));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='dark'?'#000000':'#F4F5F7');updateThemeButton()};
 if(!document.startViewTransition||isReduced()||!origin){apply();return}
 const r=origin.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,end=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
 const t=document.startViewTransition(apply);
 t.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${end}px at ${x}px ${y}px)`]},{duration:620,easing:'cubic-bezier(.22,1,.36,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});
}
$('#themeToggle').addEventListener('click',e=>setTheme(document.body.dataset.theme==='dark'?'light':'dark',e.currentTarget));
function applyTrack(track){
 const names={literary:'أدبي',science:'علمي علوم',math:'علمي رياضة'};
 const chosen=names[track]||'أدبي';
 const profile=load('profile',{});
 profile.track=track;profile.trackName=chosen;
 localStorage.setItem('adabi_profile',JSON.stringify(profile));
 document.querySelector('.profile-mini b').textContent=(profile.name?profile.name+' · ':'')+'طالب تالتة ثانوي';
 $('#welcomeName').textContent=profile.name?'يا '+profile.name:'في مساحتك';
 document.querySelector('.profile-mini small').textContent=chosen;
}
const existingProfile=load('profile',null);
if(!existingProfile || !existingProfile.track){
 $('#signupDialog').showModal();
}else{
 applyTrack(existingProfile.track);
 if(existingProfile.name)$('#studentName').value=existingProfile.name;
}
document.querySelectorAll('input[name="track"]').forEach(r=>{
 r.addEventListener('change',()=>{
  document.querySelectorAll('.track-option').forEach(x=>x.classList.remove('selected'));
  r.closest('.track-option').classList.add('selected');
 });
});
$('#signupForm').addEventListener('submit',e=>{
 e.preventDefault();
 const track=document.querySelector('input[name="track"]:checked')?.value||'literary';
 const name=$('#studentName').value.trim();
 localStorage.setItem('adabi_profile',JSON.stringify({track,trackName:({literary:'أدبي',science:'علمي علوم',math:'علمي رياضة'})[track],name}));
 applyTrack(track);
 $('#signupDialog').close();
 toast('مساحتك جاهزة! أهلاً بيك');
});

renderAll();updateTimer();

/* Phase 2.5 — bidirectional scroll reveals and mobile navigation motion. */
(function initMotionExperience(){
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sidebar=$('#sidebar');
 const menu=$('#menuBtn');
 if(menu) menu.onclick=null;
 let backdrop=document.querySelector('.sidebar-backdrop');
 if(!backdrop){backdrop=document.createElement('button');backdrop.type='button';backdrop.className='sidebar-backdrop';backdrop.setAttribute('aria-label','إغلاق القائمة');document.body.appendChild(backdrop);}
 const closeMobileMenu=()=>{sidebar.classList.remove('open');document.body.classList.remove('mobile-menu-open');menu?.setAttribute('aria-expanded','false');};
 menu?.addEventListener('click',()=>{const opening=!sidebar.classList.contains('open');sidebar.classList.toggle('open',opening);document.body.classList.toggle('mobile-menu-open',opening);menu.setAttribute('aria-expanded',String(opening));});
 backdrop.addEventListener('click',closeMobileMenu);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileMenu();});
 if('IntersectionObserver' in window){
  const selector='.page .panel, .page .stat-card, .page .subject-card, .page .progress-line, .page .backlog-item, .page .week-row, .page .mini-progress, .page .task-item, .page .badge, .page .motivation-panel';
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(!entry.isIntersecting)entry.target.style.setProperty('--ry',entry.boundingClientRect.top<0?'-22px':'22px');entry.target.classList.toggle('is-visible',entry.isIntersecting);
   entry.target.style.transitionDelay=entry.isIntersecting?`${Math.min(Number(entry.target.dataset.revealIndex||0)%5,4)*42}ms`:'0ms';
  }),{threshold:0.06,rootMargin:'0px 0px -6% 0px'});
  const observed=new WeakSet();
  const refresh=()=>document.querySelectorAll(selector).forEach((el,index)=>{if(!observed.has(el)){observed.add(el);el.dataset.revealIndex=String(index);observer.observe(el);}});
  window.adabiRefreshReveal=refresh;
  refresh();
  new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
 } else {
  document.querySelectorAll('.page .panel, .page .stat-card, .page .subject-card, .page .progress-line, .page .backlog-item, .page .week-row, .page .mini-progress, .page .task-item, .page .badge, .page .motivation-panel').forEach(el=>el.classList.add('is-visible'));
 }
 document.documentElement.classList.add('adabi-motion-ready');
})();

requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('preload')));

function syncProfile(){const p=load('profile',{});$('#profileName').value=p.name||'';$('#profileTrack').value=p.track||'literary';$('#profileAvatar').textContent=(p.name||'ط').trim().charAt(0)}
$('#profileSave').onclick=()=>{const p=load('profile',{});p.name=$('#profileName').value.trim();localStorage.setItem('adabi_profile',JSON.stringify(p));applyTrack($('#profileTrack').value);syncProfile();toast('اتحفظ ملفك الشخصي')};
$('.profile-mini').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPage('profile')}});
$('#exportData').onclick=()=>{const o={};Object.keys(localStorage).filter(k=>k.startsWith('adabi_')).forEach(k=>o[k]=localStorage.getItem(k));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download='adabi-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
$('#importData').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const o=JSON.parse(await f.text());Object.entries(o).forEach(([k,v])=>{if(k.startsWith('adabi_')&&typeof v==='string')localStorage.setItem(k,v)});location.reload()}catch(err){toast('الملف غير صالح')}};
syncProfile();

function applyMotion(full,persist){const root=document.documentElement;root.classList.toggle('motion-full',full);if(persist)localStorage.setItem('adabi_motion',JSON.stringify(full?'full':'auto'));
 const b=$('#motionBtn');b.hidden=!motionReduce.matches;b.setAttribute('aria-pressed',String(full));$('#motionText').textContent=full?'حركة كاملة':'حركة مخففة';
 $('#motionRow').hidden=!motionReduce.matches;$('#motionSwitch').checked=full}
applyMotion(load('motion','auto')==='full',false);
motionReduce.addEventListener('change',()=>applyMotion(document.documentElement.classList.contains('motion-full'),false));
$('#motionBtn').onclick=()=>applyMotion(!document.documentElement.classList.contains('motion-full'),true);
$('#motionSwitch').onchange=e=>applyMotion(e.target.checked,true);
