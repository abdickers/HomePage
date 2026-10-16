import test from 'node:test';
import assert from 'node:assert/strict';
import {plaidCall,createBankLink} from '../nest-service/budget/plaid.mjs';
import {boundedJson} from '../nest-service/worker.mjs';
import {parseBudgetMessage} from '../nest-service/budget/mail.mjs';
test('invalid Plaid field diagnostics identify only fixed field names and never provider text or tokens',async t=>{
  const env={PLAID_CLIENT_ID:'test-client',PLAID_SECRET:'test-secret',PLAID_ENV:'sandbox',FRONTEND_ORIGIN:'https://dashboard.test'};
  t.mock.method(globalThis,'fetch',async()=>Response.json({error_code:'INVALID_FIELD',error_message:'redirect_uri must be configured. private-token private-person@example.com'},{status:400}));
  await assert.rejects(plaidCall(env,'/link/token/create',{},boundedJson),error=>{assert.equal(error.code,'INVALID_FIELD');assert.equal(error.details.field,'redirect_uri');assert.equal(error.details.operation,'/link/token/create');assert.match(error.message,/https:\/\/dashboard.test\/HomePage\//);assert.doesNotMatch(JSON.stringify(error)+error.message,/private-token|private-person/);return true;});
});
test('unknown Plaid fields remain opaque instead of forwarding the response body',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({error_code:'INVALID_FIELD',error_message:'unknown private-token'},{status:400}));
  await assert.rejects(plaidCall({PLAID_CLIENT_ID:'test',PLAID_SECRET:'test'},'/institutions/search',{},boundedJson),error=>{assert.equal(error.details.field,null);assert.match(error.message,/institution verification/);assert.doesNotMatch(error.message,/private-token/);return true;});
});
test('Sandbox can isolate an invalid redirect using a single non-OAuth retry',async t=>{
  const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push(JSON.parse(options.body));return calls.length===1?Response.json({error_code:'INVALID_FIELD',error_message:'The redirect URI is not configured.'},{status:400}):Response.json({link_token:'test-link'});});
  const input={redirect_uri:'https://dashboard.test/HomePage/',products:['transactions'],user:{client_user_id:'opaque'},country_codes:['US'],language:'en',webhook:'https://gateway.test/budget/plaid/webhook'};
  const response=await createBankLink({PLAID_CLIENT_ID:'test',PLAID_SECRET:'test',PLAID_ENV:'sandbox'},input,boundedJson);assert.equal(response.nonOAuthSandbox,true);assert.equal(response.result.link_token,'test-link');assert.equal(calls.length,2);const {redirect_uri,...expected}=calls[0];assert.deepEqual(calls[1],expected);
});
test('production and existing-item Link updates never omit the OAuth redirect or retry validation errors',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error_code:'INVALID_FIELD',error_message:'redirect URI is not configured.'},{status:400});});
  for(const [environment,access_token] of [['production',undefined],['sandbox','private-item-token']]){await assert.rejects(createBankLink({PLAID_CLIENT_ID:'test',PLAID_SECRET:'test',PLAID_ENV:environment},{redirect_uri:'https://dashboard.test/HomePage/',access_token},boundedJson),error=>error.details.field==='redirect_uri');}assert.equal(calls,2);
});
test('an oversized or malformed emailed price is reviewable and cannot stop the mailbox backfill',()=>{
  const result=parseBudgetMessage({id:'abcdef',internalDate:String(Date.now()),payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Socket bill'},{name:'From',value:'billing@socket.net'}],body:{data:Buffer.from('Amount due: $999999999999999999999999999999999.00. Due date: October 25, 2026.').toString('base64url')}}},'owner@example.com','source');assert.equal(result.amountCents,null);assert.ok(result.conflicts.some(c=>c.includes('supported range')));
});
