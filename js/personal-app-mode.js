// Runs before first paint; ordinary website visits retain every existing section.
if(new URLSearchParams(location.search).get('app')==='personal'){
 document.documentElement.dataset.dashboardApp='personal';
}
