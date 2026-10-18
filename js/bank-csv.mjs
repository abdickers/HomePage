// Pure, bounded CSV decoding. Raw files stay in browser memory.
export const CSV_MAX_ROWS = 500;
export const CSV_TYPES = ['purchase','transfer','income','p2p','review'];
export function csvDate(value) {
  const text=String(value).trim(),us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const date=us?`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`:text;
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date?date:null;
}
export function csvMoney(value) {
  let text=String(value).trim();
  const parentheses=/^\(.*\)$/.test(text);if(parentheses)text='-'+text.slice(1,-1).trim();
  text=text.replace(/^(-?)\$/, '$1');
  if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))throw Error('Use a signed USD amount with at most two decimal places.');
  const negative=text.startsWith('-'),[whole,fraction='']=text.replace(/^[+-]/,'').replaceAll(',','').split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents>99999999999)throw Error('The amount is outside the supported range.');
  return negative?-cents:cents;
}
export function csvClassification(description,signedCents) {
  if(/\btransfer\b|credit.card payment|payment to.*card/i.test(description))return 'transfer';
  if(signedCents>0&&/payroll|salary|direct deposit/i.test(description))return 'income';
  // Unidentified credits may be income or refunds; cash withdrawals need review.
  if(signedCents>=0||/\bATM\b|cash withdrawal/i.test(description))return 'review';
  return 'purchase';
}
export function parseCsv(text) {
  if(typeof text!=='string'||text.length>2*1024*1024)throw Error('Choose a CSV file no larger than 2 MB.');
  text=text.replace(/^\uFEFF/,'');
  // Count separators outside quotes in the first record, including quoted headers.
  const counts={',':0,';':0,'\t':0};let inHeaderQuote=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(inHeaderQuote&&text[i+1]==='"')i++;else inHeaderQuote=!inHeaderQuote;}
    else if(!inHeaderQuote){if(c==='\r'||c==='\n')break;if(c in counts)counts[c]++;}
  }
  const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  const rows=[];let row=[],field='',quoted=false,closed=false;
  const cell=()=>{if(field.length>1000)throw Error('A CSV field is too long.');row.push(field);field='';closed=false;if(row.length>40)throw Error('The CSV has too many columns.');};
  const record=()=>{cell();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>CSV_MAX_ROWS+1)throw Error(`Import at most ${CSV_MAX_ROWS} transactions at a time.`);};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c==='"'){if(field||closed)throw Error('Malformed CSV quotation.');quoted=true;}
    else if(c===delimiter)cell();
    else if(c==='\n'||c==='\r'){record();if(c==='\r'&&text[i+1]==='\n')i++;}
    else{if(closed&&!/\s/.test(c))throw Error('Unexpected text after a quoted field.');if(!closed)field+=c;}
    if(field.length>1000)throw Error('A CSV field is too long.');
  }
  if(quoted)throw Error('A quoted CSV field was not closed.');
  if(field||row.length||closed)record();
  if(rows.length<2)throw Error('The CSV needs a header and at least one transaction.');
  const headers=rows.shift().map(s=>s.trim());
  if(rows.some(r=>r.length!==headers.length))throw Error('Every CSV row must have the same number of columns as the header.');
  return {headers,rows};
}
export function guessCsvColumns(headers) {
  const find=names=>headers.findIndex(h=>names.includes(h.toLowerCase().replace(/[^a-z]/g,'')));
  return {date:find(['date','posteddate','postingdate','transactiondate']),description:find(['description','transactiondescription','details','memo']),amount:find(['amount','transactionamount'])};
}
export function mapCsvRows(parsed,mapping=guessCsvColumns(parsed.headers)) {
  const indices=['date','description','amount'].map(k=>Number(mapping[k]));
  if(indices.some(i=>!Number.isInteger(i)||i<0||i>=parsed.headers.length)||new Set(indices).size!==3)throw Error('Choose distinct Date, Description and Amount columns.');
  return parsed.rows.map((r,i)=>{
    try{
      const date=csvDate(r[indices[0]]),description=r[indices[1]].replace(/\s+/g,' ').trim();
      if(!date)throw Error('Use MM/DD/YYYY or YYYY-MM-DD for the date.');
      if(!description||description.length>240)throw Error('Description must contain 1–240 characters.');
      const signedCents=csvMoney(r[indices[2]]);
      return {date,description,signedCents,classification:csvClassification(description,signedCents)};
    }catch(error){throw Error(`Row ${i+2}: ${error.message}`);}
  });
}
