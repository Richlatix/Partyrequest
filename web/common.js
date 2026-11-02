// Gedeelde hulpfuncties voor alle pagina's
const CFG = window.APP_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// HTML-escaping: ALTIJD gebruiken voor tekst die van gebruikers komt
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Alleen veilige link-protocollen toestaan
function safeUrl(u) {
  try {
    const x = new URL(String(u).trim(), location.href);
    return ['https:', 'http:', 'mailto:'].includes(x.protocol) ? x.href : '#';
  } catch { return '#'; }
}

let _toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(_toastTimer); _toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// Klik-afhandeling via data-act, zodat er nooit gebruikersdata in onclick-attributen komt
function onAct(root, handlers) {
  root.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (!fn) return;
    if (el.disabled) return;
    el.disabled = true;
    try { await fn(el, e); } catch (err) { toast(err?.message || 'Er ging iets mis'); console.error(err); }
    finally { el.disabled = false; }
  });
}

async function getSession() { return (await sb.auth.getSession()).data.session; }
async function getMyProfile() {
  const s = await getSession();
  if (!s) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
  return data;
}

// Edge Function aanroepen (met de sessie van de ingelogde gebruiker)
async function callFn(name, body, withAuth = true) {
  const headers = { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_PUBLISHABLE_KEY };
  if (withAuth) {
    const s = await getSession();
    if (!s) throw new Error('Niet ingelogd');
    headers.Authorization = 'Bearer ' + s.access_token;
  }
  const res = await fetch(`${CFG.SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
  return data;
}

function compressImage(file, max = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Afbeelding verwerken mislukt')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Dit is geen geldige afbeelding')); };
    img.src = url;
  });
}

function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// CSV-cel veilig maken (ook tegen formule-injectie in Excel)
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('nl-NL') : '–'; }

// ---------- Huisstijl-hulpen ----------
const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
};

// Strepen (SVG). Zonder kleur = huisstijl-groen met verloop; met kleur = witlabel.
let _sid = 0;
function stripesSvg(w, color) {
  const h = Math.round(w * 1.25), id = 'g' + (++_sid);
  const grad = `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="325" r="640"><stop offset="0.35" stop-color="#7DFF00"/><stop offset="0.7" stop-color="#5CBC00"/><stop offset="1" stop-color="#458C00"/></radialGradient></defs>`;
  const a = color || `url(#${id})`, op = color ? ' fill-opacity="0.75"' : '';
  return `<svg class="stripes" viewBox="0 0 520 650" width="${w}" height="${h}" aria-hidden="true">${color ? '' : grad}
<polygon class="s1" points="0,0 67,0 518,650 274,650 0,254" fill="${a}"/>
<polygon class="s2" points="115,0 148,0 314,240 281,240" fill="#ffffff"/>
<polygon class="s3" points="189,0 222,0 388,240 354,240" fill="${a}"${op}/>
<polygon class="s4" points="0,361 0,440 144,650 199,650" fill="${a}"${op}/></svg>`;
}

// Witlabel: accentkleur + automatisch zwarte of witte tekst op knoppen (WCAG-contrast)
function applyAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  const n = parseInt(hex.slice(1), 16);
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
  const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const dark = 0.006;
  const useDark = cr(L, dark) >= cr(L, 1);
  const r = document.documentElement.style;
  r.setProperty('--accent', hex);
  r.setProperty('--on-accent', useDark ? '#121212' : '#FFFFFF');
  r.setProperty('--accent-text', cr(L, dark) >= 4.5 ? hex : '#FFFFFF');
  r.setProperty('--accent-soft', '#1A1A1A');
  return hex;
}

// XML-bibliotheek van een DJ importeren. Ondersteunt Rekordbox-XML en andere XML-lijsten met
// TRACK/ENTRY/SONG-elementen (titel en artiest als attribuut of als kind-element).
function parseTracks(doc) {
  const names = new Set(['track', 'entry', 'song']);
  const out = [];
  const pick = (el, keys) => {
    for (const a of el.attributes) if (keys.includes(a.name.toLowerCase()) && a.value.trim()) return a.value.trim();
    for (const c of el.children) if (keys.includes(c.tagName.toLowerCase()) && c.textContent.trim()) return c.textContent.trim();
    return '';
  };
  for (const el of doc.getElementsByTagName('*')) {
    if (!names.has(el.tagName.toLowerCase())) continue;
    const title = pick(el, ['name', 'title', 'trackname', 'songname']);
    if (!title) continue;
    out.push({ title, artist: pick(el, ['artist', 'artistname', 'performer']) || 'Onbekend' });
  }
  return out;
}
async function importLibraryXml(file, companyId, djId, onProgress) {
  const doc = new DOMParser().parseFromString(await file.text(), 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Dit is geen geldig XML-bestand');
  const name = file.name.slice(0, 200);
  const rows = parseTracks(doc).map(t => ({ company_id: companyId, dj_id: djId || null, title: t.title.slice(0, 300), artist: t.artist.slice(0, 300), source_file: name }));
  if (!rows.length) throw new Error('Geen nummers gevonden in dit bestand. Is het een XML uit Rekordbox of je DJ-software?');
  let del = sb.from('library_songs').delete().eq('company_id', companyId).eq('source_file', name);
  del = djId ? del.eq('dj_id', djId) : del.is('dj_id', null);
  const d = await del; if (d.error) throw d.error;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('library_songs').insert(rows.slice(i, i + 500));
    if (error) throw error;
    if (onProgress) onProgress(Math.min(i + 500, rows.length), rows.length);
  }
  return rows.length;
}
async function deleteLibraryFile(companyId, djId, file) {
  let q = sb.from('library_songs').delete().eq('company_id', companyId);
  q = file ? q.eq('source_file', file) : q.is('source_file', null);
  q = djId ? q.eq('dj_id', djId) : q.is('dj_id', null);
  const { error } = await q; if (error) throw error;
}
