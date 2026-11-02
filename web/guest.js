// Gastenscherm + DJ-inlog op dezelfde pagina
let party = null, reqs = [], picked = null, channel = null, pollTimer = null, brand = {};
const votedKey = () => 'pr_voted_' + (party?.id || '');
const voted = () => { try { return JSON.parse(localStorage.getItem(votedKey())) || []; } catch { return []; } };
const markVoted = id => { const v = voted(); if (!v.includes(id)) { v.push(id); try { localStorage.setItem(votedKey(), JSON.stringify(v)); } catch {} } };

// ---------- Kop met strepen ----------
function renderHeader(opts = {}) {
  const small = !!opts.small;
  const w = small ? 150 : 180, h = small ? 104 : 150;
  const hdr = $('#hdr');
  hdr.style.height = h + 'px';
  const name = opts.name || 'PartyRequest';
  const logo = opts.logo ? `<img class="logo" alt="" src="${esc(safeUrl(opts.logo))}">` : '';
  const sub = opts.sub ?? 'by MXT Productions';
  hdr.innerHTML = stripesSvg(w, opts.color) +
    `<div class="txt" style="left:${w + 16}px;top:${small ? 26 : 44}px">${logo}<div style="min-width:0"><div class="brandname" style="font-size:${small ? 19 : 24}px">${esc(name)}</div>${sub ? `<div class="brandsub">${esc(sub)}</div>` : ''}</div></div>`;
}
renderHeader();

// ---------- Inloggen ----------
let mode = 'guest';
function setMode(m) {
  mode = m;
  $('#form-guest').classList.toggle('hidden', m !== 'guest');
  $('#form-dj').classList.toggle('hidden', m !== 'dj');
  $('#login-kick').textContent = m === 'guest' ? 'Feestcode' : 'DJ-login';
  $('#login-h').innerHTML = m === 'guest' ? 'Vul hier de<br>feestcode in' : 'Welkom<br>terug.';
  $('#login-p').textContent = 'Log in met je e-mailadres en de code die je van je bedrijf hebt gekregen.';
  $('#login-p').classList.toggle('hidden', m === 'guest');
  $('#switch').textContent = m === 'guest' ? 'Ben je de DJ? Log hier in' : 'Ben je gast? Naar de feestcode';
}
$('#switch').addEventListener('click', e => { e.preventDefault(); setMode(mode === 'guest' ? 'dj' : 'guest'); });
$('#djcode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

$('#form-guest').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('#code').value.trim();
  if (!/^\d{4}$/.test(code)) return toast('De feestcode bestaat uit 4 cijfers');
  const btn = e.submitter; btn.disabled = true;
  try {
    if (!await getSession()) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    const { data, error } = await sb.rpc('join_party', { p_code: code });
    if (error) throw error;
    localStorage.setItem('pr_party', data[0].party_id);
    await enterParty(data[0].party_id, true);
  } catch (err) { toast(err.message || 'Inloggen mislukt'); }
  finally { btn.disabled = false; }
});

$('#form-dj').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  try {
    const out = await callFn('dj-login', { email: $('#djmail').value, code: $('#djcode').value }, false);
    const { error } = await sb.auth.setSession({ access_token: out.access_token, refresh_token: out.refresh_token });
    if (error) throw error;
    location.href = 'dj.html';
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; }
});

// ---------- Feest betreden ----------
async function enterParty(id, fresh) {
  const { data, error } = await sb.from('parties').select('*').eq('id', id).maybeSingle();
  if (error || !data || data.status !== 'active') { localStorage.removeItem('pr_party'); toast('Dit feest is afgelopen'); return; }
  party = data;
  $('#login').classList.add('hidden');
  $('#guest').classList.remove('hidden');
  await loadBranding();
  applyParty();
  if (!fresh) $('#g-kick').textContent = party.name;
  else $('#g-kick').textContent = 'Binnen · ' + party.name;
  await loadRequests();
  subscribe();
}

function applyParty() {
  $('#closed-msg').classList.toggle('hidden', !party.requests_disabled);
  $('#req-form').classList.toggle('hidden', party.requests_disabled);
  const t = (party.welcome_title || '').trim(), x = (party.welcome_text || '').trim();
  $('#welcome').classList.toggle('hidden', !t && !x);
  $('#welcome-title').textContent = t || 'Welkom op het feest';
  $('#welcome-text').textContent = x;
}

async function refreshParty() {
  const { data } = await sb.from('parties').select('*').eq('id', party.id).maybeSingle();
  if (!data || data.status !== 'active') { toast('Het feest is afgelopen. Bedankt.'); return leave(); }
  party = data; applyParty();
}

async function loadBranding() {
  const { data } = await sb.rpc('party_branding', { p_party: party.id });
  brand = data || {};
  const color = applyAccent(brand.accent);
  renderHeader({ small: true, name: brand.brand_name || 'PartyRequest', logo: brand.logo_url, color, sub: brand.remove_mxt ? (brand.brand_name ? '' : 'by MXT Productions') : (brand.brand_name ? 'DJ voor feesten' : 'by MXT Productions') });
  $('#by').textContent = brand.remove_mxt ? (brand.brand_name || 'PartyRequest') : 'PartyRequest by MXT Productions';
  document.title = (brand.brand_name || 'PartyRequest');
  $('#promo-title').textContent = brand.promo_title || brand.brand_name || 'Jouw DJ';
  $('#promo-text').textContent = brand.promo_text || '';
  const links = [['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook']].filter(([k]) => brand[k + '_active'] && brand[k]);
  $('#promo-links').innerHTML = links.map(([k, label]) => {
    let u = String(brand[k]).trim();
    if (k === 'email' && !/^mailto:/i.test(u)) u = 'mailto:' + u;
    else if (k !== 'email' && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    return `<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(u))}">${label}</a>`;
  }).join('');
  $('#gtab-dj').classList.toggle('hidden', !brand.promo_title && !brand.promo_text && !links.length);
}

// ---------- Wachtrij ----------
async function loadRequests() {
  const { data } = await sb.from('requests').select('*').eq('party_id', party.id);
  reqs = data || [];
  const queue = reqs.filter(r => r.status === 'requested').sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
  const played = reqs.filter(r => r.status === 'done');
  const v = voted();
  $('#qcount').textContent = queue.length === 1 ? '1 nummer in de wachtrij' : queue.length + ' nummers in de wachtrij';
  $('#queue').innerHTML = queue.length ? queue.map((r, i) => `
    <li class="li"><div class="main">${i === 0 ? '<div class="kick" style="font-size:11px">Nu aan de beurt</div>' : ''}<div class="t">${esc(r.title)}</div><div class="s">${esc(r.artist)}</div>${r.note ? `<div class="n">${esc(r.note)}</div>` : ''}</div>
    <button class="votebtn ${v.includes(r.id) ? 'voted' : ''}" data-act="vote" data-id="${r.id}" ${v.includes(r.id) ? 'disabled' : ''} aria-label="Stem op ${esc(r.title)}">${ICON.up}${r.votes}</button></li>`).join('')
    : '<li class="sub" style="padding:16px 0">Nog niets aangevraagd. Jij mag de eerste zijn.</li>';
  $('#played').innerHTML = played.length ? played.map(r => `<li class="li" style="opacity:.6"><div class="main"><div class="t" style="font-size:15px">${esc(r.title)}</div><div class="s">${esc(r.artist)}</div></div></li>`).join('')
    : '<li class="sub" style="padding:10px 0">Nog niets gedraaid.</li>';
}

// ---------- Zoeken en versturen ----------
let searchTimer;
function setPicked(p) {
  picked = p;
  $('#send').disabled = !p && !manualFilled();
  $$('#results .pick').forEach(b => b.classList.toggle('on', p && String(p.id) === b.dataset.id));
}
const manualFilled = () => !$('#manual').classList.contains('hidden') && $('#m-title').value.trim().length > 0;

$('#q').addEventListener('input', e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $('#results').innerHTML = ''; setPicked(null); return; }
  searchTimer = setTimeout(async () => {
    const { data } = await sb.rpc('search_library', { p_party: party.id, p_query: q });
    const rows = data || [];
    $('#results').innerHTML = rows.map(s => `<li><button type="button" class="pick ${picked && picked.id === s.id ? 'on' : ''}" data-act="pick" data-id="${s.id}" data-title="${esc(s.title)}" data-artist="${esc(s.artist)}" aria-pressed="${picked && picked.id === s.id}">
      <span style="flex:1;min-width:0"><span class="tt" style="display:block">${esc(s.title)}</span><span class="aa" style="display:block">${esc(s.artist)}</span></span><span class="dot">${ICON.check}</span></button></li>`).join('')
      || '<li class="sub" style="padding:8px 14px">Niets gevonden. Typ hem zelf in.</li>';
  }, 250);
});

$('#manual-toggle').addEventListener('click', () => {
  const m = $('#manual');
  const open = m.classList.contains('hidden');
  m.classList.toggle('hidden', !open); m.style.display = open ? 'flex' : 'none';
  if (open) { setPicked(null); $('#results').innerHTML = ''; $('#m-title').focus(); }
  $('#send').disabled = !picked && !manualFilled();
});
$('#m-title').addEventListener('input', () => { $('#send').disabled = !picked && !manualFilled(); });

$('#send').addEventListener('click', async e => {
  const btn = e.currentTarget; btn.disabled = true;
  try {
    const name = $('#naam').value.trim(), extra = $('#note').value.trim();
    const note = [name && `${name}`, extra].filter(Boolean).join(': ').slice(0, 300) || null;
    let title, artist, songId = null;
    if (picked) { title = picked.title; artist = picked.artist; songId = picked.id; }
    else { title = $('#m-title').value.trim(); artist = $('#m-artist').value.trim(); }
    const { error } = await sb.rpc('submit_request', { p_party: party.id, p_title: title, p_artist: artist || null, p_note: note, p_song_id: songId });
    if (error) throw error;
    toast(`"${title}" is doorgegeven`);
    $('#q').value = ''; $('#results').innerHTML = ''; $('#m-title').value = ''; $('#m-artist').value = ''; $('#note').value = '';
    setPicked(null);
    await loadRequests();
    gotoTab('queue');
  } catch (err) { toast(err.message); btn.disabled = false; }
});

// ---------- Realtime + terugval ----------
function subscribe() {
  unsubscribe();
  channel = sb.channel('party-' + party.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `party_id=eq.${party.id}` }, loadRequests)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'parties', filter: `id=eq.${party.id}` }, refreshParty)
    .subscribe();
  pollTimer = setInterval(() => { loadRequests(); refreshParty(); }, 10000);
}
function unsubscribe() { if (channel) sb.removeChannel(channel); channel = null; clearInterval(pollTimer); }
function leave() { unsubscribe(); party = null; localStorage.removeItem('pr_party'); location.href = location.pathname; }

function gotoTab(tab) {
  $$('#gnav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  for (const t of ['req', 'queue', 'dj']) $('#pane-' + t).classList.toggle('hidden', t !== tab);
  window.scrollTo({ top: 0 });
}

onAct(document, {
  gtab: el => gotoTab(el.dataset.tab),
  pick: el => {
    const id = Number(el.dataset.id);
    setPicked(picked && picked.id === id ? null : { id, title: el.dataset.title, artist: el.dataset.artist });
  },
  vote: async el => {
    const id = Number(el.dataset.id);
    const { error } = await sb.rpc('vote_request', { p_request: id });
    if (error) throw error;
    markVoted(id); await loadRequests();
  },
  leave,
});

// ---------- Start ----------
(async () => {
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) $('#code').value = urlCode.replace(/\D/g, '').slice(0, 4);
  const saved = localStorage.getItem('pr_party');
  if (saved && await getSession()) await enterParty(saved, false);
})();
