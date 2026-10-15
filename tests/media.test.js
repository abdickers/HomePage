import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId} from '../js/media.js';
test('pinned video accepts YouTube IDs only and cannot embed a foreign site',()=>{
 for(const url of ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk&list=LL','https://www.youtube.com/shorts/abcdefghijk'])assert.equal(youtubeId(url),'abcdefghijk');
 for(const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk','javascript:alert(1)','http://youtu.be/abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk','https://youtu.be/not-valid'])assert.equal(youtubeId(url),null);
});
