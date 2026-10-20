// Private, per-page memory only. No timers, prefetching, or persistent financial cache.
export function createBudgetDemand(load) {
  let active=false;const cache=new Map(),pending=new Map();
  function cancel(){for(const entry of pending.values())entry.controller.abort();pending.clear();}
  return {
    get active(){return active;},
    open(){active=true;},
    close(){active=false;cancel();},
    invalidate(){cache.clear();cancel();},
    read(key,{force=false}={}){
      if(!active)return Promise.reject(Error('Open the Treasury to load budget data.'));
      if(pending.has(key))return pending.get(key).promise;
      if(!force&&cache.has(key))return Promise.resolve(cache.get(key));
      // A new date/page supersedes an old read rather than letting both scan D1.
      cancel();const controller=new AbortController(),entry={controller,promise:null};
      entry.promise=Promise.resolve().then(()=>{if(controller.signal.aborted)throw new DOMException('Budget read cancelled.','AbortError');return load(key,controller.signal);}).then(data=>{
        if(controller.signal.aborted)throw new DOMException('Budget read cancelled.','AbortError');
        cache.set(key,data);if(cache.size>4)cache.delete(cache.keys().next().value);return data;
      }).finally(()=>{if(pending.get(key)===entry)pending.delete(key);});
      pending.set(key,entry);return entry.promise;
    },
  };
}
