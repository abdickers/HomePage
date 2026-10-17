import {escapeHtml as esc} from './core.js?v=20261015-personal7';
import {budgetPreset,budgetToday,validateBudgetRange} from './budget-period.js?v=20261017-treasury1';

export const periodIsReady=(data,range)=>data?.activity?.start===range.start&&data?.activity?.end===range.end;
const detail=(name,label)=>`<button type="button" id="treasuryDetail-${name}" data-treasury-detail="${name}">${esc(label)}</button>`;
export function treasurySummaryMarkup({data,range,cash,date,stamp}) {
 const s=data.summary,ready=periodIsReady(data,range),activity=ready?data.activity:null;
 const bank=data.items.some(i=>i.environment==='production'&&i.lastSync),complete=ready&&activity.complete;
 const due=s.next7||[],knownDue=due.filter(b=>Number.isInteger(b.amountCents));
 const metric=(name,title,value,note)=>`<button type="button" id="treasuryMetric-${name}" class="treasury-metric" data-treasury-detail="${name}"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small><span class="treasury-metric-link">View details ↗</span></button>`;
 const recent=activity?.recent||[];
 return `<div class="treasury-metrics">${metric('overview','Available cash',cash(s.availableCents),'Current balance · '+s.cashAccountCount+' included accounts')}${metric('spending','Spending in this period',bank&&complete?cash(activity.amountCents):'Not available','Synced posted purchases less refunds')}${metric('bills','Bills due in the next 7 days',cash(knownDue.reduce((sum,b)=>sum+b.amountCents,0)),knownDue.length+' confirmed bills · future dates')}${metric('review','Needs review',String(data.reviewCount),'Unconfirmed details and matches')}</div>
   ${s.staleCash?'<p class="budget-notice treasury-summary-notice">Cash balances are stale or disconnected. Check the balance timestamp before using an estimate.</p>':''}
   ${ready&&!complete?'<p class="budget-notice treasury-summary-notice">This history exceeds the processing limit. Period totals are withheld; open details for coverage information.</p>':''}
   ${!ready?'<p class="budget-notice treasury-summary-notice">Date-filtered history is unavailable. No period total is shown; your existing ledger remains accessible.</p>':''}
   <div class="treasury-summary-lists"><section><div class="budget-section-head"><h3>Recent activity</h3>${detail('spending','View all activity')}</div><p class="budget-muted">${esc(date(range.start))} – ${esc(date(range.end))} · America/Chicago</p><ul class="treasury-compact-list">${recent.map(t=>`<li><div><strong>${esc(t.merchant||t.name||'Bank entry')}</strong><small>${esc(date(t.date))} · ${esc(t.pending?'Pending':t.classification==='purchase'?'Posted':t.classification||'Unclassified')}</small></div><span>${esc(cash(t.amountCents,t.currency))}</span></li>`).join('')||'<li class="budget-empty">'+(bank&&ready?'No synced production entries in this period.':'No production bank activity is available yet.')+'</li>'}</ul></section>
   <section><div class="budget-section-head"><h3>Upcoming bills</h3>${detail('bills','View all bills')}</div><p class="budget-muted">The next 7 days · separate from activity dates</p><ul class="treasury-compact-list">${due.slice(0,3).map(b=>`<li><div><strong>${esc(b.name)}</strong><small>${esc(date(b.date))} · ${esc(b.paymentStatus==='unknown'?'Payment unconfirmed':b.status)}</small></div><span>${esc(cash(b.amountCents))}</span></li>`).join('')||'<li class="budget-empty">No confirmed bills due in this window. Unconfirmed entries remain in Review.</li>'}</ul></section></div>
   <p class="treasury-summary-footnote">Cash as of ${esc(stamp(s.balanceAsOf))}. Synced history only. Date filters apply to activity; monthly limits and current balances keep their own periods.</p>`;
}

// Native dialogs supply focus containment and Escape. The old budget controller
// still owns every write, connection, editor and privacy decision.
export function createTreasuryPresentation({doc=document,onRange,onTab,onPrivacy,renderDetails,cash,date,stamp}) {
 const $=id=>doc.getElementById(id),workspace=$('budgetWorkspace'),body=$('budgetWorkspaceView'),view=$('budgetView');
 const period=$('budgetPeriod'),custom=$('budgetCustomRange'),start=$('budgetRangeStart'),end=$('budgetRangeEnd'),error=$('budgetRangeError');
 let range=budgetPreset(),model=null,hidden=true,busy=false,tab='overview',editable=false,opener=null,customDraft=false,filterSerial=0;
 const readActions=new Set(['transactions-prev','transactions-next','review-prev','review-next']);
 function restoreFocus() {
  const candidates=[...doc.querySelectorAll('#budgetPrivate [data-treasury-detail],#budgetManage')];
  const target=opener?.id?$(opener.id):candidates.find(e=>e.dataset.treasuryDetail===opener?.detail);
  if(target?.isConnected&&!target.disabled&&target.getClientRects().length)target.focus({preventScroll:true});
 }
 function renderWorkspace() {
  if(!workspace.open||!model||$('budgetDialog').open)return;
  const focused=body.contains(doc.activeElement)?doc.activeElement:null;
  const action=focused?.dataset.budgetAction,id=focused?.dataset.id,scroll=body.scrollTop;
  $('budgetWorkspaceTitle').textContent=editable?'Manage Treasury':'Treasury details';
  $('budgetWorkspaceMode').textContent=editable?'Editing tools are available below. Changes are saved through the existing private ledger.':'Read-only details · choose Manage Treasury to make changes.';
  $('budgetWorkspaceManage').hidden=editable;
  $('budgetWorkspacePrivacy').textContent=hidden?'Show amounts':'Hide amounts';
  $('budgetWorkspacePrivacy').setAttribute('aria-pressed',String(hidden));
  workspace.dataset.editable=String(editable);
  workspace.querySelectorAll('[data-budget-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.budgetTab===tab)));
  body.innerHTML=renderDetails(tab,{readOnly:!editable});body.scrollTop=scroll;
  // Keep real table headings for assistive technology; compact phone rows get
  // decorative field labels so no action needs a sideways scroll.
  body.querySelectorAll('.budget-table').forEach(table=>{
   const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
   table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{
    if(!index||!labels[index]||!cell.textContent.trim())return;
    const label=doc.createElement('span');label.className='treasury-cell-label';label.setAttribute('aria-hidden','true');label.textContent=labels[index];cell.prepend(label);
   }));
  });
  if(focused){const replacement=[...body.querySelectorAll('[data-budget-action]')].find(e=>e.dataset.budgetAction===action&&e.dataset.id===id);(replacement||workspace.querySelector('[aria-pressed="true"]')).focus({preventScroll:true});}
  $('budgetWorkspaceStatus').textContent=$('budgetState').textContent;
  $('budgetWorkspaceStatus').classList.toggle('budget-error',$('budgetState').classList.contains('budget-error'));
 }
 function open(mode='read',selected='overview',trigger=doc.activeElement) {
  if(!model)return;
  if(!workspace.open)opener={id:trigger?.id,detail:trigger?.dataset.treasuryDetail};
  editable=mode==='manage';tab=selected;onTab(tab);
  if(!workspace.open)workspace.showModal();
  body.scrollTop=0;renderWorkspace();
  workspace.querySelector(`[data-budget-tab="${tab}"]`)?.focus({preventScroll:true});
 }
 function controls() {
  $('budgetManage').disabled=!model;
  period.disabled=!model;start.disabled=!model;end.disabled=!model;
  start.max=end.max=budgetToday();
  $('budgetPeriodLabel').textContent=date(range.start)+' – '+date(range.end);
  if(!customDraft){period.value=range.preset;start.value=range.start;end.value=range.end;custom.hidden=range.preset!=='custom';}
 }
 async function chooseRange(next) {
  const serial=++filterSerial;error.hidden=true;
  try {
   const saved=await onRange(next);
   if(serial!==filterSerial)return;
   if(saved){range=next;customDraft=false;}else if(saved===false){error.textContent='The selected period could not load. The previous date range is still shown.';error.hidden=false;}
  } catch(problem) {if(serial===filterSerial){error.textContent=problem.message;error.hidden=false;}}
  if(serial===filterSerial)controls();
 }
 $('budgetManage').addEventListener('click',event=>open('manage','overview',event.currentTarget));
 view.addEventListener('click',event=>{const target=event.target.closest('[data-treasury-detail]');if(target)open('read',target.dataset.treasuryDetail,target);});
 $('budgetWorkspaceManage').addEventListener('click',()=>{editable=true;renderWorkspace();workspace.querySelector('[data-budget-tab][aria-pressed="true"]').focus({preventScroll:true});});
 $('budgetWorkspacePrivacy').addEventListener('click',onPrivacy);
 $('budgetWorkspaceClose').addEventListener('click',()=>workspace.close());
 workspace.addEventListener('close',()=>{editable=false;restoreFocus();});
 period.addEventListener('change',()=>{error.hidden=true;if(period.value==='custom'){customDraft=true;custom.hidden=false;start.value=range.start;end.value=range.end;start.focus();}else{customDraft=false;custom.hidden=true;void chooseRange(budgetPreset(period.value));}});
 for(const field of [start,end])field.addEventListener('input',()=>{customDraft=true;});
 $('budgetRangeForm').addEventListener('submit',event=>{event.preventDefault();if(period.value!=='custom')return;try{const next={preset:'custom',...validateBudgetRange(start.value,end.value)};void chooseRange(next);}catch(problem){error.textContent=problem.message;error.hidden=false;}});
 controls();
 return {
  get range(){return range;},get editable(){return workspace.open&&editable;},readActions,
  update(data,options={}) {
   if(options.tab&&options.tab!==tab)body.scrollTop=0;
   model=data;hidden=options.hidden??hidden;busy=options.busy??busy;tab=options.tab||tab;range=options.range||range;
   controls();
   view.innerHTML=treasurySummaryMarkup({data:model,range,cash,date,stamp});
   renderWorkspace();
  },
  clear(){filterSerial++;model=null;editable=false;view.replaceChildren();body.replaceChildren();$('budgetWorkspaceStatus').textContent='';if(workspace.open)workspace.close();controls();},
  open,renderWorkspace,
  pageChanged(kind){
   const first=body.querySelector(kind==='transactions'?'.budget-table tbody tr':'.budget-list>li');
   if(first){first.tabIndex=-1;first.focus({preventScroll:true});body.scrollTop+=first.getBoundingClientRect().top-body.getBoundingClientRect().top-12;}
  },
  status(){if(workspace.open){$('budgetWorkspaceStatus').textContent=$('budgetState').textContent;$('budgetWorkspaceStatus').classList.toggle('budget-error',$('budgetState').classList.contains('budget-error'));}}
 };
}
