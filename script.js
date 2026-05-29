const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const links = {
  ai: [
    ['ChatGPT','🟢','https://chatgpt.com/'], ['Claude','✹','https://claude.ai/'], ['Gemini','◆','https://gemini.google.com/app'], ['Perplexity','✧','https://www.perplexity.ai/'],
    ['Copilot','▣','https://copilot.microsoft.com/'], ['Grok','⊙','https://grok.com/'], ['Midjourney','⛵','https://www.midjourney.com/'], ['Runway','R','https://runwayml.com/']
  ],
  google: [
    ['Gmail','📧','https://mail.google.com/'], ['Drive','▲','https://drive.google.com/'], ['Docs','📘','https://docs.google.com/'], ['Sheets','📗','https://sheets.google.com/'],
    ['Slides','📙','https://slides.google.com/'], ['Calendar','🗓️','https://calendar.google.com/'], ['Keep','💡','https://keep.google.com/'], ['Meet','🎥','https://meet.google.com/']
  ],
  sage: [
    ['NetSuite','💼','https://system.netsuite.com/'], ['BigCommerce','🛒','https://login.bigcommerce.com/'], ['GitHub','⌘','https://github.com/abdickers/HomePage'], ['Slack','💬','https://slack.com/signin'],
    ['Canva','C','https://www.canva.com/'], ['Notion','N','https://www.notion.so/'], ['Obsidian','◆','https://obsidian.md/'], ['Add Tool','＋','#']
  ]
};

function renderTiles(target, items){
  $(target).innerHTML = items.map(([name, icon, url]) => `<a class="tile" href="${url}" target="_blank" rel="noopener"><i>${icon}</i><span>${name}</span></a>`).join('');
}
renderTiles('#aiTiles', links.ai); renderTiles('#googleTiles', links.google); renderTiles('#sageTiles', links.sage);

function clock(){
  const now = new Date();
  const hour = now.getHours();
  $('#greeting').textContent = `${hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'}, Sage`;
  $('#dateLine').textContent = now.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  $('#timeLine').textContent = now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  $('#weekday').textContent = now.toLocaleDateString([], {weekday:'long'});
  $('#dayNum').textContent = now.toLocaleDateString([], {day:'numeric'});
  $('#monthYear').textContent = now.toLocaleDateString([], {month:'long', year:'numeric'});
}
clock(); setInterval(clock, 1000 * 30);

const agenda = [
  ['9:00 AM','Team Standup','30m'], ['10:30 AM','Client Strategy Call','1h'], ['1:00 PM','Content Review','1h'], ['3:00 PM','Project Planning','1h'], ['5:00 PM','Gym','1h']
];
$('#agendaList').innerHTML = agenda.map(a=>`<div class="agenda-item"><b><i class="dot"></i>${a[0]}</b><span>${a[1]}</span><em>${a[2]}</em></div>`).join('');
$('#todayBtn').onclick = () => window.open('https://calendar.google.com/calendar/u/0/r/day','_blank');

$('#searchForm').addEventListener('submit', e => { e.preventDefault(); const q=$('#searchInput').value.trim(); if(q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`,'_blank'); });
$('#askAi').onclick = () => { const q=$('#searchInput').value.trim(); window.open(q ? `https://chatgpt.com/?q=${encodeURIComponent(q)}` : 'https://chatgpt.com/','_blank'); };
$('#newTaskTop').onclick = () => $('#taskInput').focus();
$('#themeToggle').onclick = () => { document.body.classList.toggle('light'); localStorage.setItem('sage_theme', document.body.classList.contains('light')?'light':'dark'); };
if(localStorage.getItem('sage_theme') === 'light') document.body.classList.add('light');

let tasks = JSON.parse(localStorage.getItem('sage_tasks_v2') || 'null') || [
  {text:'Review open work priorities', done:false}, {text:'Check NetSuite/BigCommerce fires', done:false}, {text:'Plan one useful automation', done:false}
];
function saveTasks(){ localStorage.setItem('sage_tasks_v2', JSON.stringify(tasks)); }
function renderTasks(){
  $('#taskList').innerHTML = tasks.map((t,i)=>`<label class="task-item ${t.done?'done':''}"><input type="checkbox" ${t.done?'checked':''} data-i="${i}"><span>${t.text}</span><button class="resolve" data-r="${i}" type="button">Resolve</button></label>`).join('');
  $$('[data-i]').forEach(ch => ch.onchange = () => { tasks[ch.dataset.i].done = ch.checked; saveTasks(); renderTasks(); });
  $$('[data-r]').forEach(btn => btn.onclick = () => { tasks.splice(btn.dataset.r,1); saveTasks(); renderTasks(); });
}
$('#addTask').onclick = () => { const v=$('#taskInput').value.trim(); if(!v)return; tasks.push({text:v,done:false}); $('#taskInput').value=''; saveTasks(); renderTasks(); };
$('#taskInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#addTask').click(); });
$('#clearDone').onclick = () => { tasks = tasks.filter(t=>!t.done); saveTasks(); renderTasks(); };
renderTasks();

let notes = JSON.parse(localStorage.getItem('sage_notes_v2') || 'null') || [
  ['Content Ideas','LOTR themed productivity systems. AI tool reviews. Middle-earth storytelling.'],
  ['Project Ideas','Build homepage dashboard. Sage brand strategy. Digital product ideas.'],
  ['Quick Notes','Focus on deep work. Protect mornings. Walk daily.']
];
function renderNotes(){ $('#notesGrid').innerHTML = notes.slice(-3).map(n=>`<div class="note-card"><b>${n[0]}</b><p>${n[1]}</p></div>`).join(''); }
$('#addNote').onclick = () => { const v=$('#noteInput').value.trim(); if(!v)return; notes.push(['Note',v]); $('#noteInput').value=''; localStorage.setItem('sage_notes_v2', JSON.stringify(notes)); renderNotes(); };
$('#noteInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#addNote').click(); });
renderNotes();

$$('.prompt-column button').forEach(btn => btn.onclick = () => { $('#searchInput').value = btn.dataset.prompt; $('#searchInput').focus(); });

const feedConfig = {
  fox: {name:'Fox News', source:'https://www.foxnews.com/', rss:'https://moxie.foxnews.com/google-publisher/latest.xml', icon:'🦅'},
  wowhead: {name:'Wowhead', source:'https://www.wowhead.com/news', rss:'https://www.wowhead.com/news/rss/all', icon:'⚔'},
  tech: {name:'Tech', source:'https://news.ycombinator.com/', rss:'https://hnrss.org/frontpage', icon:'⚙'}
};
let activeFeed = 'fox';
async function loadNews(feed=activeFeed){
  activeFeed = feed; const cfg = feedConfig[feed];
  $('#sourceLink').href = cfg.source; $('#newsList').innerHTML = '<div class="news-item"><div class="thumb">◌</div><div><a>Lighting the beacons...</a><div class="news-meta">Fetching fresh tidings</div></div></div>';
  try{
    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(cfg.rss)}`;
    const res = await fetch(endpoint); const data = await res.json(); const items = (data.items || []).slice(0,5);
    if(!items.length) throw new Error('No items');
    $('#newsList').innerHTML = items.map(item=>`<article class="news-item"><div class="thumb">${cfg.icon}</div><div><a href="${item.link}" target="_blank" rel="noopener">${item.title}</a><div class="news-meta">${item.pubDate || cfg.name}</div></div></article>`).join('');
  }catch(err){
    const fallback = {
      fox:['Open Fox News for latest headlines','Politics, markets, and cultural mayhem, because apparently one Mordor was not enough.'],
      wowhead:['Open Wowhead News','WoW updates, class notes, blue posts, and other Azerothian emergencies.'],
      tech:['Open Hacker News','Dev news, startup lore, and arguments about tabs versus spaces.']
    }[feed];
    $('#newsList').innerHTML = `<article class="news-item"><div class="thumb">${cfg.icon}</div><div><a href="${cfg.source}" target="_blank" rel="noopener">${fallback[0]}</a><div class="news-meta">${fallback[1]}</div></div></article>`;
  }
}
$$('.tab').forEach(tab => tab.onclick = () => { $$('.tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); loadNews(tab.dataset.feed); });
$('#refreshNews').onclick = () => loadNews(activeFeed);
loadNews('fox');
