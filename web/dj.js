let me = null, party = null, reqs = [], channel = null, poll = null;
$('#logo-s').innerHTML = stripesSvg(120);

async function init() {
  me = await getMyProfile();
  if (!me || me.role !== 'dj' || !me.active) { location.replace('index.html'); return; }
  $('#who').textContent = me.display_name || 'DJ';
  // Eigen kleur van het bedrijf ook in het dashboard
  const { data: c } = await sb.from('companies').select('branding').eq('id', me.company_id).maybeSingle();
  if (c?.branding?.accent) { applyAccent(c.branding.accent); $('#logo-s').innerHTML = stripesSvg(120, c.branding.accent); }
  loadParties(); loadLibrary();
}

async function loadParties() {
  const { data, error } = await sb.from('parties').select('*').order('created_at', { ascending: false });
  if (error) return toast(error.message);
  $('#parties').innerHTML = (data || []).map(p => `
    <li class="li"><div class="main"><div class="t">${esc(p.name)}</div><div class="s">${fmtDate(p.created_at)}${p.status === 'active' ? ' · code ' + esc(p.party_code) : ''}</div></div>
    <span class="pill plain ${p.status === 'active' ? 'ok' : ''}">${p.status === 'active' ? 'Actief' : 'Afgesloten'}</span>
    ${p.status === 'active' ? `<button class="btn sm green" data-act="open" data-id="${esc(p.id)}">Open</button>` : ''}</li>`).join('')
    || '<li class="sub" style="padding:14px 0">Nog geen feesten. Start er rechts één.</li>';
}

$('#new-party').addEventListener('submit', async e => {
  e.preventDefault(); e.submitter.disabled = true;
  try {
    const { data, error } = await sb.rpc('create_party', { p_name: $('#np-name').value });
    if (error) throw error;
    $('#np-name').value = ''; await loadParties(); await openParty(data.id);
  } catch (err) { toast(err.message); } finally { e.submitter.disabled = false; }
});

async function openParty(id) {
  const { data } = await sb.from('parties').select('*').eq('id', id).single();
  party = data;
  $('#list').classList.add('hidden'); $('#party').classList.remove('hidden'); $('#mnav').classList.remove('hidden');
  $('#p-name').textContent = party.name;
  $('#p-code').textContent = party.party_code;
  const link = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html?code=${party.party_code}`;
  $('#p-link').textContent = link;
  $('#qr').innerHTML = ''; new QRCode($('#qr'), { text: link, width: 112, height: 112 });
  renderOpts(); showTab('queue');
  await loadReqs();
  channel = sb.channel('dj-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `party_id=eq.${id}` }, loadReqs)
    .subscribe();
  poll = setInterval(loadReqs, 12000);
}
function closeView() {
  if (channel) sb.removeChannel(channel); channel = null; clearInterval(poll); party = null;
  $('#party').classList.add('hidden'); $('#mnav').classList.add('hidden'); $('#list').classList.remove('hidden'); loadParties();
}

function showTab(t) {
  $$('[data-act=tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  const q = $('#t-queue'), o = $('#t-opts');
  q.style.display = t === 'queue' ? 'flex' : 'none';
  o.style.display = t === 'opts' ? 'flex' : 'none';
  $('#p-h1').textContent = t === 'queue' ? 'Wachtrij' : 'Opties';
}

function renderOpts() {
  const sw = $('#sw-req'); sw.setAttribute('aria-checked', String(!party.requests_disabled));
  $('#o-wt').value = party.welcome_title; $('#o-wx').value = party.welcome_text; $('#o-cool').value = party.spam_cooldown;
  $('#bl').innerHTML = party.blacklist.map(w => `<span class="pill">${esc(w)}<button class="iconbtn" style="width:30px;height:30px;border:0" data-act="del-bl" data-w="${esc(w)}" aria-label="Verwijder ${esc(w)}">${ICON.x}</button></span>`).join('') || '<span class="sub">Geen woorden.</span>';
}
async function patchParty(fields) {
  const { data, error } = await sb.from('parties').update(fields).eq('id', party.id).select().single();
  if (error) throw error;
  party = data; renderOpts();
}

async function loadReqs() {
  const { data } = await sb.from('requests').select('*').eq('party_id', party.id);
  reqs = data || [];
  const q = reqs.filter(r => r.status === 'requested').sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
  const d = reqs.filter(r => r.status === 'done');
  $('#qn').textContent = '· ' + q.length;
  $('#dn').textContent = '· ' + d.length;
  $('#queue').innerHTML = q.map(r => `<div class="qrow"><div class="main" style="flex:1;min-width:0"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.artist)}</div>${r.note ? `<div class="n">${esc(r.note)}</div>` : ''}</div>
    <span class="votes">${ICON.up}${r.votes}</span>
    <div class="acts"><button class="iconbtn ok" data-act="done" data-id="${r.id}" aria-label="Gedraaid: ${esc(r.title)}">${ICON.check}</button><button class="iconbtn" data-act="del" data-id="${r.id}" aria-label="Verwijder ${esc(r.title)}">${ICON.x}</button></div></div>`).join('')
    || '<p class="sub" style="padding:16px 0">Geen verzoekjes. Rustig, dat komt nog.</p>';
  $('#played').innerHTML = d.map(r => `<div class="qrow"><div class="main" style="flex:1;min-width:0"><div class="t" style="font-size:16px;color:var(--sub2)">${esc(r.title)}</div><div class="s">${esc(r.artist)}</div></div><button class="iconbtn" data-act="undo" data-id="${r.id}" aria-label="Terugzetten: ${esc(r.title)}">${ICON.undo}</button></div>`).join('')
    || '<p class="sub" style="padding:14px 0">Nog niets gedraaid.</p>';
}

let libTimer;
$('#lib-q').addEventListener('input', e => {
  clearTimeout(libTimer);
  const q = e.target.value.trim().replace(/[,()%*\\]/g, ' ');
  if (q.length < 2) { $('#lib-res').innerHTML = ''; return; }
  libTimer = setTimeout(async () => {
    const { data } = await sb.from('library_songs').select('id,title,artist').or(`title.ilike.%${q}%,artist.ilike.%${q}%`).limit(8);
    $('#lib-res').innerHTML = (data || []).map(s => `<li class="li"><div class="main"><div class="t" style="font-size:16px">${esc(s.title)}</div><div class="s">${esc(s.artist)}</div></div>
      <button class="btn sm green" data-act="lib-add" data-id="${s.id}" data-title="${esc(s.title)}" data-artist="${esc(s.artist)}">Toevoegen</button></li>`).join('') || '<li class="sub" style="padding:8px 0">Niets gevonden.</li>';
  }, 250);
});
async function addReq(title, artist, songId) {
  const { error } = await sb.from('requests').insert({ party_id: party.id, title, artist: artist || 'DJ-verzoek', song_id: songId || null, votes: 0 });
  if (error) throw error;
  toast('Toegevoegd'); loadReqs();
}
$('#add-manual').addEventListener('submit', async e => {
  e.preventDefault();
  try { await addReq($('#am-title').value.trim(), $('#am-artist').value.trim()); e.target.reset(); } catch (err) { toast(err.message); }
});

async function loadLibrary() {
  const { data } = await sb.rpc('library_files', { p_company: me.company_id });
  const mine = (data || []).filter(f => f.dj_id === me.id);
  const total = mine.reduce((a, f) => a + Number(f.songs), 0);
  $('#lib-total').textContent = total ? `Nu ${total} nummers.` : 'Nog geen nummers.';
  $('#lib-files').innerHTML = mine.map(f => ({ ...f, own: true })).map(f => `
    <li class="li"><div class="main"><div class="t" style="font-size:16px">${esc(f.source_file || '(zonder bestand)')}</div><div class="s">${f.songs} nummers${f.own ? '' : ' · gedeeld door je bedrijf'}</div></div>
    ${f.own ? `<button class="btn sm danger" data-act="del-file" data-file="${esc(f.source_file || '')}">Wis</button>` : ''}</li>`).join('');
}
$('#xml').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const prog = $('#xml-prog');
  try {
    prog.textContent = 'Bestand inlezen…';
    const n = await importLibraryXml(file, me.company_id, me.id, (a, b) => prog.textContent = `Uploaden… ${a} van ${b}`);
    prog.textContent = ''; toast(`${n} nummers geïmporteerd`); loadLibrary();
  } catch (err) { prog.textContent = ''; toast(err.message); }
  e.target.value = '';
});

onAct(document, {
  'pick-xml': () => $('#xml').click(),
  'del-file': async el => {
    if (!confirm('Alle nummers uit dit bestand wissen?')) return;
    await deleteLibraryFile(me.company_id, me.id, el.dataset.file); loadLibrary();
  },
  logout: async () => { await sb.auth.signOut(); location.href = 'index.html'; },
  open: el => openParty(el.dataset.id),
  back: closeView,
  tab: el => showTab(el.dataset.tab),
  'toggle-add': () => $('#add-box').classList.toggle('hidden'),
  'copy-link': async () => { await navigator.clipboard.writeText($('#p-link').textContent); toast('Link gekopieerd'); },
  'toggle-req': () => patchParty({ requests_disabled: !party.requests_disabled }),
  'save-welcome': async () => { await patchParty({ welcome_title: $('#o-wt').value.trim(), welcome_text: $('#o-wx').value.trim() }); toast('Opgeslagen'); },
  'save-cool': async () => { const v = Math.max(0, Math.min(600, parseInt($('#o-cool').value) || 0)); await patchParty({ spam_cooldown: v }); toast('Opgeslagen'); },
  'add-bl': async () => {
    const w = $('#o-bl').value.trim().toLowerCase(); if (!w) return;
    if (!party.blacklist.includes(w)) await patchParty({ blacklist: [...party.blacklist, w] });
    $('#o-bl').value = '';
  },
  'del-bl': el => patchParty({ blacklist: party.blacklist.filter(w => w !== el.dataset.w) }),
  done: async el => { await sb.from('requests').update({ status: 'done' }).eq('id', el.dataset.id); loadReqs(); },
  undo: async el => { await sb.from('requests').update({ status: 'requested' }).eq('id', el.dataset.id); loadReqs(); },
  del: async el => { await sb.from('requests').delete().eq('id', el.dataset.id); loadReqs(); },
  'lib-add': el => addReq(el.dataset.title, el.dataset.artist, Number(el.dataset.id)),
  csv: () => {
    const rows = reqs.map(r => [r.title, r.artist, r.votes, r.note || '', r.status === 'done' ? 'gedraaid' : 'open'].map(csvCell).join(';'));
    downloadBlob(`Verzoekjes_${party.party_code}.csv`, new Blob(['Titel;Artiest;Stemmen;Opmerking;Status\n' + rows.join('\n')], { type: 'text/csv' }));
  },
  close: async () => {
    if (!confirm('Feest definitief afsluiten?')) return;
    const { error } = await sb.rpc('close_party', { p_party: party.id });
    if (error) throw error;
    toast('Feest afgesloten'); closeView();
  },
});
init();
