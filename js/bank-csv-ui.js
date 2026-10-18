import {escapeHtml as esc} from './core.js?v=20261018-workshop1';
import {parseCsv,guessCsvColumns,mapCsvRows,CSV_TYPES} from './bank-csv.mjs?v=20261018-csv1';

export function openBankCsv({dialog,request,onSaved,amountsHidden=true}) {
  const opener=document.activeElement;
  let parsed=null,rows=null,masked=amountsHidden,serial=0,saving=false;
  const types={purchase:'Purchase / refund',transfer:'Transfer / card',income:'Income / deposit',p2p:'Person-to-person',review:'Needs review'};
  dialog.innerHTML=`<div id="budgetDialogBody" class="csv-importer"><h2 id="csvImportTitle">Central Bank CSV</h2><p>Preview posted transactions, then add them to your private Treasury. Nothing is uploaded until you choose Import.</p><form class="budget-form">
    <div class="csv-upload-fields"><label>Account nickname<input name="accountLabel" value="Central Bank checking" maxlength="60" required autocomplete="off" /><small>Use the same unique nickname for future exports. Do not enter an account number.</small></label>
    <label>Transaction CSV<input name="csvFile" type="file" accept=".csv,text/csv" required /><small>Date, Description, Amount; Balance is ignored. Up to 500 rows / 2 MB.</small></label>
    </div><details class="csv-columns" hidden><summary>Column mapping</summary><div class="csv-mapping"></div></details>
    <p class="csv-explainer">USD · negative = money out · positive = money in. Transfers and income stay out of spending. Unknown credits and withdrawals need review; Balance is ignored.</p>
    <div class="budget-actions"><button type="button" data-csv-preview disabled>Preview transactions</button><button type="button" data-csv-reveal hidden></button></div>
    <p class="csv-status" role="status" aria-live="polite"></p><div class="csv-preview-area"></div>
    <div class="csv-confirm" hidden><details><summary>Import matching &amp; source priority</summary><p class="budget-muted">Repeated uploads skip matching date + description + amount occurrences for this nickname. Without bank transaction IDs, identical transactions in separate partial exports can be ambiguous; review those rows. If real Plaid history is present, CSV totals pause to prevent double counting.</p></details><label class="budget-checkbox"><input name="confirmed" type="checkbox" required disabled /> I reviewed the rows and transaction types.</label></div>
    <div class="budget-actions"><button type="submit" data-csv-save hidden>Import transactions</button><button type="button" data-budget-cancel>Cancel</button></div>
  </form></div>`;
  dialog.classList.add('csv-dialog');dialog.setAttribute('aria-labelledby','csvImportTitle');
  const form=dialog.querySelector('form'),file=form.elements.csvFile,status=form.querySelector('[role=status]'),preview=form.querySelector('.csv-preview-area'),previewButton=form.querySelector('[data-csv-preview]'),save=form.querySelector('[data-csv-save]'),reveal=form.querySelector('[data-csv-reveal]'),confirm=form.querySelector('.csv-confirm');
  const money=cents=>masked?'••••':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.abs(cents)/100);
  const invalidate=()=>{rows=null;preview.replaceChildren();save.hidden=confirm.hidden=reveal.hidden=true;form.elements.confirmed.checked=false;form.elements.confirmed.disabled=true;};
  const draw=()=>{
    reveal.textContent=masked?'Show amounts in preview':'Hide amounts in preview';
    preview.innerHTML=`<h3 tabindex="-1">${rows.length} transactions to review</h3><ol class="csv-preview">${rows.map((r,i)=>`<li><div><time datetime="${r.date}">${esc(r.date)}</time><strong>${esc(r.description)}</strong></div><span class="csv-amount">${r.signedCents<0?'Money out':'Money in'}<b>${esc(money(r.signedCents))}</b></span><label>Type<select data-csv-row="${i}">${CSV_TYPES.map(v=>`<option value="${v}" ${v===r.classification?'selected':''} ${v==='income'&&r.signedCents<=0?'disabled':''}>${types[v]}</option>`).join('')}</select></label></li>`).join('')}</ol>`;
  };
  file.addEventListener('change',async()=>{
    const token=++serial;invalidate();parsed=null;previewButton.disabled=true;status.textContent='';
    form.querySelector('.csv-columns').hidden=true;
    try{
      const chosen=file.files[0];if(!chosen)return;if(chosen.size>2*1024*1024)throw Error('Choose a CSV no larger than 2 MB.');
      const text=await chosen.text();if(token!==serial||!dialog.open)return;
      parsed=parseCsv(text);const mapping=guessCsvColumns(parsed.headers);
      form.querySelector('.csv-mapping').innerHTML=['date','description','amount'].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} column<select data-csv-column="${k}"><option value="-1">Choose a column</option>${parsed.headers.map((h,i)=>`<option value="${i}" ${i===mapping[k]?'selected':''}>${esc(h||'Column '+(i+1))}</option>`).join('')}</select></label>`).join('');
      form.querySelector('.csv-columns').hidden=false;previewButton.disabled=false;status.textContent='File read locally. Preview it before importing.';
    }catch(error){status.textContent=error.message;}
  });
  form.querySelector('.csv-mapping').addEventListener('change',invalidate);
  previewButton.addEventListener('click',()=>{
    try{
      const mapping=Object.fromEntries([...form.querySelectorAll('[data-csv-column]')].map(e=>[e.dataset.csvColumn,Number(e.value)]));
      rows=mapCsvRows(parsed,mapping);draw();save.hidden=confirm.hidden=reveal.hidden=false;form.elements.confirmed.checked=false;form.elements.confirmed.disabled=false;
      status.textContent='Preview only. Check each type before importing.';preview.querySelector('h3').focus();
    }catch(error){invalidate();status.textContent=error.message;}
  });
  preview.addEventListener('change',event=>{const index=event.target.dataset.csvRow;if(index!==undefined&&rows)rows[Number(index)].classification=event.target.value;});
  reveal.addEventListener('click',()=>{masked=!masked;draw();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!rows||saving||!form.elements.confirmed.checked)return;
    saving=true;form.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);status.textContent='Importing into your private ledger…';
    try{
      const result=await request('/csv/import',{accountLabel:form.elements.accountLabel.value,rows,confirmation:'IMPORT CSV'});
      dialog.close();await onSaved(result);if(opener?.isConnected)opener.focus();
    }catch(error){status.textContent=error.message;}
    finally{saving=false;form.querySelectorAll('input,select,button').forEach(e=>e.disabled=false);}
  });
  const preventPendingClose=event=>{if(saving)event.preventDefault();};
  dialog.addEventListener('cancel',preventPendingClose);
  dialog.addEventListener('close',()=>{serial++;rows=null;parsed=null;file.value='';preview.replaceChildren();dialog.classList.remove('csv-dialog');dialog.removeAttribute('aria-labelledby');dialog.removeEventListener('cancel',preventPendingClose);},{once:true});
  dialog.showModal();form.elements.accountLabel.focus();
}
