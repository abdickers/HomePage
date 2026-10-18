import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,mapCsvRows,csvDate,csvMoney} from '../js/bank-csv.mjs';

export const sample='Date,Description,Amount,Balance\r\n10/14/2026,ONLINE TRANSFER FROM CHECKING 1234,250.00,1432.50\r\n10/13/2026,TARGET STORES COLUMBIA MO,-42.15,1182.50\r\n10/12/2026,ACH DEPOSIT COMPANY PAYROLL,1850.00,1224.65\r\n10/10/2026,ATM WITHDRAWAL CENTRAL BANK ATM,-60.00,625.35\r\n';
test('Central Bank sample retains exact signed cents and avoids treating deposits or withdrawals as purchases',()=>{
 const rows=mapCsvRows(parseCsv(sample));
 assert.deepEqual(rows.map(r=>r.signedCents),[25000,-4215,185000,-6000]);
 assert.deepEqual(rows.map(r=>r.classification),['transfer','purchase','income','review']);
 assert.equal(rows[0].date,'2026-10-14');assert.ok(rows.every(r=>!('balance' in r)));
});
test('CSV quotes, commas, embedded newlines, BOM, escaped quotes, blank lines and explicit column mapping',()=>{
 const parsed=parseCsv('\uFEFFAmount,Date,Description\n-1.25,02/29/2028,"Shop, \"\"North\"\"\nbranch"\n\n');
 const row=mapCsvRows(parsed,{amount:0,date:1,description:2})[0];
 assert.equal(row.description,'Shop, "North" branch');assert.equal(row.signedCents,-125);
 assert.equal(mapCsvRows(parseCsv('Date;Description;Amount\n2020-01-01;Store;-5.50'))[0].signedCents,-550);
 assert.equal(mapCsvRows(parseCsv('Date,"Details; north; west; branch",Amount\n2020-01-01,Store,-5.50'),{date:0,description:1,amount:2})[0].signedCents,-550);
 assert.throws(()=>mapCsvRows(parsed,{amount:0,date:0,description:2}),/distinct/);
});
test('strict dates and integer-cent parsing reject silent coercion and malformed/oversized files',()=>{
 for(const value of ['2026-02-29','2/30/2026','10/10/26','2026-13-01'])assert.equal(csvDate(value),null);
 assert.equal(csvMoney('($1,234.50)'),-123450);assert.equal(csvMoney('+10'),1000);
 for(const value of ['NaN','1e3','1.001','12,34.00','','Infinity','--1','999999999999'])assert.throws(()=>csvMoney(value));
 for(const text of ['Date,Description,Amount\n2020-01-01,"unclosed,-1','Date,Description,Amount\n2020-01-01,Store','Date,Description,Amount\n2020-01-01,"Store"oops,-1'])assert.throws(()=>parseCsv(text));
 assert.throws(()=>parseCsv('Date,Description,Amount\n'+Array(501).fill('2020-01-01,Shop,-1').join('\n')),/500/);
 assert.throws(()=>parseCsv('x'.repeat(2*1024*1024+1)),/2 MB/);
 assert.throws(()=>mapCsvRows(parseCsv('Date,Description,Amount\n2026-02-30,Store,-1')),/Row 2/);
});
