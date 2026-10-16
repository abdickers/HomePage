// Presentation of the existing gateway projection: mode, hvac, online.
// Google reports HVAC idle as OFF, separately from thermostat mode OFF.
export const THERMOSTAT_STALE_MS = 3 * 60 * 1000;
const modeNames = {HEAT:'Heat mode', COOL:'Cool mode', HEATCOOL:'Auto', OFF:'Off'};
const activities = {HEATING:'Heating now', COOLING:'Cooling now', OFF:'Idle'};

export function thermostatPresentation(device, {updatedAt, now=Date.now(), stale=false, pending=false, failed=false}={}) {
  const mode = device?.mode === 'AUTO' ? 'HEATCOOL' : device?.mode;
  const online = device?.online === 'ONLINE';
  const known = online && Object.hasOwn(modeNames, mode);
  const checked = Date.parse(updatedAt);
  const outdated = stale || !Number.isFinite(checked) || now-checked > THERMOSTAT_STALE_MS || checked-now > 60000;
  let art = known ? mode==='HEAT'?'heat':mode==='COOL'?'cool':mode==='HEATCOOL'&&device.hvac==='HEATING'?'heat':mode==='HEATCOOL'&&device.hvac==='COOLING'?'cool':'neutral' : 'neutral';
  let modeText = known ? modeNames[mode] : 'Status unavailable';
  let activity = known ? activities[device.hvac] || 'Activity unavailable' : device && !online ? 'Device offline or unavailable' : 'Activity unavailable';
  const conflict = known && ((mode==='HEAT'&&device.hvac==='COOLING') || (mode==='COOL'&&device.hvac==='HEATING') || (mode==='OFF'&&['HEATING','COOLING'].includes(device.hvac)));
  if (conflict) activity = (device.hvac==='HEATING'?'Heating reported':'Cooling reported')+' · mode/activity mismatch';
  if (known && outdated) {
    modeText = 'Last known '+modeNames[mode];
    activity = device.hvac==='HEATING'?'Last reported: Heating':device.hvac==='COOLING'?'Last reported: Cooling':device.hvac==='OFF'?'Last reported: Idle':'Activity unavailable';
    if (conflict) activity += ' · mode/activity mismatch';
  }
  const note = failed ? 'Change failed. Showing the last confirmed device state.' : pending ? 'Change requested. Waiting for confirmed device state.' : '';
  return {art,mode:modeText,activity,stale:known&&outdated,checkedAt:Number.isFinite(checked)?new Date(checked).toISOString():null,
    temperatureLabel:!online || outdated?'Last reported temperature':'Ambient temperature',note};
}

export function paintThermostat(doc, device, options) {
  const view=thermostatPresentation(device,options), get=id=>doc.getElementById(id);
  if (!get('nestConfirmedMode')) return view;
  get('nestConfirmedMode').textContent=view.mode;
  get('nestActivity').textContent=view.activity;
  get('nestTemperatureLabel').textContent=view.temperatureLabel;
  get('nestTemperatureUnit').textContent=device?.scale==='CELSIUS'?'°C':'°F';
  const image=get('nestModeArt');
  image.hidden=view.art==='neutral';get('nestNeutralGlyph').hidden=view.art!=='neutral';
  if(view.art!=='neutral') {
    const name=view.art==='heat'?'hobbit-heating-fireplace':'hobbit-cooling-open-window';
    image.setAttribute('src','assets/expansion/'+name+'.webp');
    image.setAttribute('srcset','assets/expansion/'+name+'-small.webp 192w, assets/expansion/'+name+'.webp 288w');
  }
  const checked=get('nestLastChecked');checked.hidden=!device;
  checked.textContent=device?(view.stale?'Stale · ':'')+(view.checkedAt?'Last checked '+new Date(view.checkedAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Check time unavailable'):'';
  get('nestStateNote').textContent=view.note;get('nestStateNote').hidden=!view.note;
  return view;
}
