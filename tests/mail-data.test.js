import test from 'node:test';
import assert from 'node:assert/strict';
import {mailRecord,receiptRecord,personalIdentity,INBOX_QUERIES,uniqueConversations} from '../js/mail-data.js';
const email=(from,subject,body='',id='abc',threadId='aabb')=>({id,threadId,internalDate:'1792000000000',snippet:'A source snippet',payload:{mimeType:'text/plain',headers:[{name:'From',value:from},{name:'Subject',value:subject}],body:{data:Buffer.from(body).toString('base64url')}}});
test('personal inbox identity requires matching verified identity and actual mailbox',()=>{
 const identity={email:'abdickers@gmail.com',email_verified:true};
 assert.equal(personalIdentity(identity,{emailAddress:'abdickers@gmail.com'}),true);
 assert.equal(personalIdentity({...identity,email_verified:false},{emailAddress:identity.email}),false);
 assert.equal(personalIdentity(identity,{emailAddress:'dickersona@76fireworks.com'}),false);
 assert.equal(personalIdentity({email:'dickersona@76fireworks.com',email_verified:true},{emailAddress:'dickersona@76fireworks.com'}),false);
 assert.equal(INBOX_QUERIES.primary,'in:inbox category:primary is:unread');assert.equal(INBOX_QUERIES.updates,'in:inbox category:updates is:unread');
});
test('email permalinks use the personal account and message content stays plain data',()=>{
 const row=mailRecord(email('Sender <a@example.com>','<script>alert(1)</script>'));
 assert.equal(new URL(row.href).searchParams.get('authuser'),'abdickers@gmail.com');assert.equal(new URL(row.href).hash,'#all/aabb');
 assert.equal(row.subject,'<script>alert(1)</script>');assert.equal(mailRecord({id:'../../evil',threadId:'aabb'}),null);
 assert.equal(uniqueConversations([email('a','one'),email('a','duplicate')]).length,1);
});
test('real receipts accept retailer domains and extract only explicitly labelled, unambiguous totals',()=>{
 const row=receiptRecord(email('Amazon <auto-confirm@amazon.com>','Your order 123-1234567-1234567','Order total: $41.23'));
 assert.equal(row.retailer,'amazon');assert.equal(row.orderId,'123-1234567-1234567');assert.equal(row.total,'$41.23');assert.equal(row.event,'Order email');
 assert.equal(receiptRecord(email('Walmart <help@walmart.com>','Order delivered','Subtotal: $9.00\nShipping: $4.00')).total,null);
 assert.equal(receiptRecord(email('Walmart <help@walmart.com>','Order delivered','Order total: $9.00\nGrand total: $14.00')).total,null);
 const walmart=receiptRecord(email('Walmart <orders@info.walmart.com>','Your order has shipped','Order #123456789012\nTotal paid: $59.99'));
 assert.equal(walmart.orderId,'123456789012');assert.equal(walmart.event,'Shipping email');
 for(const sender of ['evil@amazon.com.attacker.test','evil@fakeamazon.com','Amazon <evil@attacker.test>'])assert.equal(receiptRecord(email(sender,'Your order','Order total: $9.00')),null);
 assert.equal(receiptRecord(email('sale@amazon.com','A great deal','Order total: $9.00')),null);
});
