// Storage layer. Everything in Giterdun is an "item": { id, owner, type, data }.
// owner is 'a' | 'b' | 'shared'. Works against localStorage or Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const LS_KEY = 'giterdun-v1';
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let items = new Map();
let sb = null;
let channel = null;
const changeFns = new Set();
const errorFns = new Set();

const emit = () => changeFns.forEach((f) => f());
const fail = (msg, err) => {
  console.error(msg, err);
  errorFns.forEach((f) => f(msg));
};
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...items.values()]));
  } catch (err) {
    fail('This browser is out of storage space. Try fewer/smaller stickers, or set up Supabase.', err);
  }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    items = new Map((raw ? JSON.parse(raw) : []).map((r) => [r.id, r]));
  } catch {
    items = new Map();
  }
}
const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

/* ---- cloud saving with an outbox ----
   Every change goes into an outbox (also kept in localStorage) and is only removed once
   Supabase confirms it. If the network drops or the login token is stale, it retries
   instead of losing the change. */
const OUTBOX_KEY = 'giterdun-outbox';
let outbox = new Map(); // id -> row, or { id, deleted: true }
let flushing = null;
let retryTimer = 0;
let warned = false;

function saveOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()]));
  } catch {}
}
function loadOutbox() {
  try {
    outbox = new Map((JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []).map((r) => [r.id, r]));
  } catch {
    outbox = new Map();
  }
}
function applyOutbox() {
  for (const [id, r] of outbox) r.deleted ? items.delete(id) : items.set(id, r);
}
async function pushRow(row) {
  const { error } = row.deleted ? await sb.from('items').delete().eq('id', row.id) : await sb.from('items').upsert(row);
  return error;
}
async function flush() {
  if (!configured) return;
  if (flushing) return flushing;
  flushing = (async () => {
    let failed = false;
    while (outbox.size && !failed) {
      for (const [id, row] of [...outbox]) {
        const error = await pushRow(row);
        if (error) {
          failed = true;
          console.error('Giterdun save failed, will retry', error);
          if (/jwt|token|auth/i.test(error.message || '')) await sb.auth.refreshSession().catch(() => {});
          break;
        }
        if (outbox.get(id) === row) outbox.delete(id); // a newer edit may have queued meanwhile
      }
      saveOutbox();
    }
    clearTimeout(retryTimer);
    if (failed) {
      retryTimer = setTimeout(flush, 8000);
      if (!warned) fail("Couldn't reach the cloud. Your changes are kept on this device and will keep retrying.");
      warned = true;
    } else {
      warned = false;
    }
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
}
async function persist(row) {
  if (!configured) return saveLocal();
  outbox.set(row.id, row);
  saveOutbox();
  await flush();
}

// Re-download everything (after waking up or reconnecting, live updates may have been missed).
async function refresh() {
  const { data, error } = await sb.from('items').select('*').limit(5000);
  if (error) return console.error(error);
  items = new Map(data.map((r) => [r.id, r]));
  applyOutbox();
  emit();
  flush();
}

async function loadRemote() {
  const { data, error } = await sb.from('items').select('*').limit(5000);
  if (error) {
    fail("Couldn't load your planner from Supabase.", error);
    throw error;
  }
  items = new Map(data.map((r) => [r.id, r]));
  loadOutbox();
  applyOutbox();
  flush();
  if (!channel) {
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 20000) refresh();
    });
    addEventListener('online', () => {
      flush();
      refresh();
    });
    let joinedOnce = false;
    channel = sb
      .channel('items-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, ({ eventType, new: n, old: o }) => {
        const id = eventType === 'DELETE' ? o.id : n.id;
        if (outbox.has(id)) return; // we have a newer local edit still on its way up
        if (eventType === 'DELETE') items.delete(id);
        else items.set(id, n);
        emit();
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (joinedOnce) refresh(); // reconnected: catch up on anything missed
        joinedOnce = true;
      });
  }
}

export const store = {
  get mode() {
    return configured ? 'supabase' : 'local';
  },

  async init() {
    if (!configured) {
      loadLocal();
      window.addEventListener('storage', (e) => {
        if (e.key === LS_KEY) {
          loadLocal();
          emit();
        }
      });
      return 'ready';
    }
    if (!sb) {
      const { createClient } = await import(SUPABASE_CDN);
      sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      sb.auth.onAuthStateChange((ev) => {
        if (ev === 'SIGNED_OUT') location.reload();
      });
    }
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return 'login';
    await loadRemote();
    return 'ready';
  },

  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return !!data.session;
  },
  async signOut() {
    await sb.auth.signOut();
  },

  all(type) {
    const out = [];
    for (const i of items.values()) if (!type || i.type === type) out.push(i);
    return out;
  },
  get(id) {
    return items.get(id);
  },
  dump() {
    return [...items.values()];
  },

  async put(item) {
    const now = new Date().toISOString();
    const row = {
      id: item.id || uid(),
      owner: item.owner,
      type: item.type,
      data: item.data || {},
      created_at: item.created_at || now,
      updated_at: now,
    };
    items.set(row.id, row);
    emit();
    await persist(row);
    return row;
  },
  async patch(id, part) {
    const cur = items.get(id);
    if (!cur) return;
    return this.put({ ...cur, data: { ...cur.data, ...part } });
  },
  async remove(id) {
    if (!items.has(id)) return;
    items.delete(id);
    emit();
    if (!configured) return saveLocal();
    outbox.set(id, { id, deleted: true });
    saveOutbox();
    await flush();
  },
  async bulkPut(rows) {
    const now = new Date().toISOString();
    const clean = rows
      .filter((r) => r && r.id && r.type && r.owner)
      .map((r) => ({ id: r.id, owner: r.owner, type: r.type, data: r.data || {}, created_at: r.created_at || now, updated_at: now }));
    clean.forEach((r) => items.set(r.id, r));
    emit();
    if (!configured) return saveLocal();
    const { error } = await sb.from('items').upsert(clean);
    if (error) fail("Couldn't restore everything to Supabase.", error);
  },

  async uploadImage(blob) {
    if (!configured) return blobToDataURL(blob);
    const ext = blob.type === 'image/webp' ? 'webp' : 'png';
    const path = `${uid()}.${ext}`;
    const { error } = await sb.storage.from('stickers').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (error) throw error;
    return sb.storage.from('stickers').getPublicUrl(path).data.publicUrl;
  },

  onChange(fn) {
    changeFns.add(fn);
  },
  onError(fn) {
    errorFns.add(fn);
  },

  /* ---- live presence: cursors, pokes, who's online. Nothing here is saved. ---- */
  get liveKey() {
    return liveKey;
  },
  liveJoin(handlers, state) {
    liveH = handlers;
    liveState = { ...state, key: liveKey };
    if (configured) {
      liveCh = sb.channel('giterdun-live', { config: { broadcast: { self: false }, presence: { key: liveKey } } });
      for (const ev of LIVE_EVENTS) liveCh.on('broadcast', { event: ev }, ({ payload }) => liveH[ev]?.(payload));
      liveCh
        .on('presence', { event: 'sync' }, () => {
          livePeers = new Map(Object.entries(liveCh.presenceState()).map(([k, v]) => [k, v[0]]));
          emitPeers();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            liveReady = true;
            liveCh.track(liveState);
          }
        });
    } else if ('BroadcastChannel' in window) {
      // Browser-only mode: tabs of this browser can still see each other (handy for testing).
      bc = new BroadcastChannel('giterdun-live');
      bc.onmessage = ({ data: { event, payload } }) => {
        if (event === 'hello' || event === 'here') {
          livePeers.set(payload.key, { ...payload, seen: Date.now() });
          if (event === 'hello') bc.postMessage({ event: 'here', payload: liveState });
          return emitPeers();
        }
        if (event === 'bye') {
          livePeers.delete(payload.key);
          return emitPeers();
        }
        liveH[event]?.(payload);
      };
      liveReady = true;
      livePeers.set(liveKey, liveState);
      bc.postMessage({ event: 'hello', payload: liveState });
      setInterval(() => {
        bc.postMessage({ event: 'here', payload: liveState });
        for (const [k, p] of livePeers) if (k !== liveKey && Date.now() - p.seen > 15000) livePeers.delete(k);
        emitPeers();
      }, 5000);
      addEventListener('pagehide', () => bc.postMessage({ event: 'bye', payload: { key: liveKey } }));
    }
  },
  liveTrack(state) {
    liveState = { ...state, key: liveKey };
    if (configured) {
      if (liveReady) liveCh.track(liveState);
    } else if (bc) {
      livePeers.set(liveKey, liveState);
      bc.postMessage({ event: 'here', payload: liveState });
      emitPeers();
    }
  },
  liveSend(event, payload) {
    if (!liveReady) return;
    if (configured) liveCh.send({ type: 'broadcast', event, payload });
    else bc?.postMessage({ event, payload });
  },
};

const LIVE_EVENTS = ['cursor', 'gone', 'poke'];
const liveKey = uid();
let liveH = null;
let liveState = null;
let liveCh = null;
let bc = null;
let liveReady = false;
let livePeers = new Map();
const emitPeers = () => liveH?.peers?.([...livePeers.values()]);
