let me = null, isAdmin = false, plans = [], cid = null, tab = 'djs', adminTab = 'companies';
const view = () => $('#view');
$('#logo-s').innerHTML = stripesSvg(120);
const PLAN_LABEL = { active: 'Actief', paused: 'Gepauzeerd', cancelled: 'Opgezegd' };

// ---------- Inloggen ----------
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault(); e.submitter.disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pw').value });
    if (error) throw new Error('Onjuiste inloggegevens');
    await start();
  } catch (err) { toast(err.message); } finally { e.submitter.disabled = false; }
});

async function start() {
  me = await getMyProfile();
  if (!me || !['admin', 'owner'].includes(me.role) || !me.active) {
    if (me) { await sb.auth.signOut(); toast('Dit account heeft geen beheerrechten'); }
    return;
  }
  isAdmin = me.role === 'admin';
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#btn-out').classList.remove('hidden');
  $('#who').textContent = isAdmin ? 'Beheer · MXT Productions' : (me.display_name || 'Bedrijf');
  const { data } = await sb.from('plans').select('*').order('max_djs');
  plans = data || [];
  if (isAdmin) showAdminHome(); else { cid = me.company_id; tab = 'djs'; showCompany(); }
}

// ---------- Modal ----------
function modal(html) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-box').innerHTML = ''; }
function showSecret(title, code, note = 'Deze code is maar één keer zichtbaar. Geef hem nu aan de DJ.') {
  modal(`<div class="once"><div class="t">${esc(title)}</div><div class="bigcode" style="margin-top:8px">${esc(code)}</div><p class="sub2" style="margin-top:8px;font-size:14px">${esc(note)}</p></div>
    <div class="row" style="margin-top:16px"><button class="btn sm" data-act="copy-code" data-code="${esc(code)}">Kopieer code</button><button class="btn sm primary" data-act="close-modal">Klaar</button></div>`);
}
const tabsHtml = (items, cur, act) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="${act}" data-tab="${k}">${l}</button>`).join('')}</div>`;
const isActiveSub = s => s && s.status === 'active' && (!s.ends_at || new Date(s.ends_at) > new Date());

// ---------- Admin: overzicht ----------
async function showAdminHome() {
  cid = null;
  view().innerHTML = `<div class="top"><div><div class="kick">Beheer</div><h1 style="margin-top:8px">${adminTab === 'companies' ? 'Bedrijven' : 'Abonnementen'}</h1></div>
    ${tabsHtml([['companies', 'Bedrijven'], ['plans', 'Abonnementen']], adminTab, 'atab')}</div><div id="admin-body"></div>`;
  adminTab === 'companies' ? await renderCompanies() : renderPlans();
}

async function renderCompanies() {
  const [{ data: companies }, { data: subs }, { data: djs }, { data: parties }] = await Promise.all([
    sb.from('companies').select('*').order('created_at', { ascending: false }),
    sb.from('subscriptions').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('company_id').eq('role', 'dj').eq('active', true),
    sb.from('parties').select('company_id').eq('status', 'active'),
  ]);
  const cs = companies || [];
  const planName = id => plans.find(p => p.id === id)?.name || '–';
  const subOf = id => (subs || []).find(s => s.company_id === id);
  const count = (arr, id) => (arr || []).filter(d => d.company_id === id).length;
  const soon = cs.filter(c => { const s = subOf(c.id); return isActiveSub(s) && s.ends_at && new Date(s.ends_at) < new Date(Date.now() + 30 * 864e5); }).length;
  $('#admin-body').innerHTML = `
    <div class="stats">
      <div class="card"><div class="kick grey">Bedrijven</div><div class="stat">${cs.length}</div></div>
      <div class="card"><div class="kick grey">Actieve abonnementen</div><div class="stat">${cs.filter(c => isActiveSub(subOf(c.id))).length}</div></div>
      <div class="card"><div class="kick grey">Loopt binnen 30 dagen af</div><div class="stat" style="color:var(--warn)">${soon}</div></div>
      <div class="card"><div class="kick grey">Feesten nu live</div><div class="stat">${(parties || []).length}</div></div>
    </div>
    <div class="grid">
      <section class="card wide"><div class="row" style="justify-content:space-between"><h2>Alle bedrijven</h2></div>
        <ul class="list" style="margin-top:12px;border-top:1px solid var(--line)">${cs.map(c => { const s = subOf(c.id), ok = isActiveSub(s); return `
          <li class="li" style="flex-wrap:wrap"><div class="main" style="flex:1 1 200px"><div class="t">${esc(c.name)}${c.active ? '' : ' <span class="pill plain">Uit</span>'}</div>
            <div class="s">${count(djs, c.id)} DJ's · ${count(parties, c.id)} actieve feesten</div></div>
            <span class="pill plain">${s ? esc(planName(s.plan_id)) : 'Geen plan'}</span>
            <span class="pill plain ${ok ? 'ok' : 'warn'}">${s ? (ok ? 'Actief tot ' + fmtDate(s.ends_at) : 'Verlopen') : 'Geen abonnement'}</span>
            <button class="btn sm" data-act="open-company" data-id="${esc(c.id)}">Beheer</button></li>`; }).join('') || '<li class="sub" style="padding:16px 0">Nog geen bedrijven. Maak er rechts één aan.</li>'}</ul></section>
      <aside class="side"><section class="card"><h3>Nieuw bedrijf</h3>
        <form id="f-company">
          <label class="f" for="c-name">Bedrijfsnaam</label><input id="c-name" required>
          <label class="f" for="c-slug">Korte naam (a-z, 0-9, -)</label><input id="c-slug" required>
          <label class="f" for="c-email">E-mailadres van de eigenaar</label><input id="c-email" type="email" required>
          <label class="f" for="c-pw">Startwachtwoord (min. 10 tekens)</label><input id="c-pw" minlength="10" required>
          <label class="f" for="c-plan">Abonnement</label><select id="c-plan"><option value="">Geen abonnement</option>${plans.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
          <label class="f" for="c-end">Loopt tot (leeg = doorlopend)</label><input id="c-end" type="date">
          <button class="btn primary block" type="submit" style="margin-top:20px">Maak bedrijf aan</button></form></section></aside>
    </div>`;
  $('#c-name').addEventListener('input', e => { if (!$('#c-slug').dataset.touched) $('#c-slug').value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
  $('#c-slug').addEventListener('input', e => e.target.dataset.touched = '1');
  $('#f-company').addEventListener('submit', async e => {
    e.preventDefault(); e.submitter.disabled = true;
    try {
      const pw = $('#c-pw').value, name = $('#c-name').value;
      await callFn('manage', { action: 'create_company', name, slug: $('#c-slug').value, owner_email: $('#c-email').value, owner_password: pw, plan_id: $('#c-plan').value || null, ends_at: $('#c-end').value || null });
      showSecret(`Wachtwoord voor ${name}`, pw, 'Geef dit wachtwoord door aan de eigenaar. Daarna kan hij het zelf wijzigen.');
      renderCompanies();
    } catch (err) { toast(err.message); } finally { e.submitter.disabled = false; }
  });
}

function renderPlans() {
  $('#admin-body').innerHTML = `
    <div class="grid"><section class="card wide"><h2>Abonnementsplannen</h2>
      <p class="sub" style="margin:6px 0 12px">Dit zijn de limieten per plan. De prijzen staan op de landingspagina en komen later in Stripe.</p>
      <div style="overflow-x:auto"><table><thead><tr><th>Naam</th><th>Max. DJ's</th><th>Max. feesten</th><th>Zonder "by MXT"</th><th></th></tr></thead><tbody>
      ${plans.map(p => `<tr data-plan="${esc(p.id)}"><td><input value="${esc(p.name)}" data-f="name" aria-label="Naam"></td><td><input type="number" min="1" value="${p.max_djs}" data-f="max_djs" aria-label="Max. DJ's"></td><td><input type="number" min="1" value="${p.max_active_parties}" data-f="max_active_parties" aria-label="Max. feesten"></td><td><input type="checkbox" ${p.remove_branding ? 'checked' : ''} data-f="remove_branding" aria-label="Zonder by MXT" style="width:24px;height:24px"></td><td><button class="btn sm primary" data-act="save-plan" data-id="${esc(p.id)}">Opslaan</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <aside class="side"><section class="card"><h3>Nieuw plan</h3><form id="f-plan">
      <label class="f" for="n-name">Naam</label><input id="n-name" required>
      <label class="f" for="n-djs">Max. DJ's</label><input id="n-djs" type="number" min="1" value="1" required>
      <label class="f" for="n-parties">Max. feesten tegelijk</label><input id="n-parties" type="number" min="1" value="1" required>
      <label class="row sub" style="margin-top:14px"><input id="n-rb" type="checkbox" style="width:24px;height:24px"> Zonder "by MXT Productions"</label>
      <button class="btn primary block" style="margin-top:18px" type="submit">Plan toevoegen</button></form></section></aside></div>`;
  $('#f-plan').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.from('plans').insert({ name: $('#n-name').value.trim(), max_djs: +$('#n-djs').value, max_active_parties: +$('#n-parties').value, remove_branding: $('#n-rb').checked });
    if (error) return toast(error.message);
    await reloadPlans(); renderPlans(); toast('Plan toegevoegd');
  });
}
async function reloadPlans() { const { data } = await sb.from('plans').select('*').order('max_djs'); plans = data || []; }

// ---------- Bedrijfspagina (eigenaar én admin) ----------
async function showCompany() {
  const { data: c } = await sb.from('companies').select('*').eq('id', cid).single();
  if (c?.branding?.accent && !isAdmin) { applyAccent(c.branding.accent); $('#logo-s').innerHTML = stripesSvg(120, c.branding.accent); }
  view().innerHTML = `
    ${isAdmin ? '<button class="btn sm" data-act="home" style="margin-bottom:18px">Alle bedrijven</button>' : ''}
    <div class="top"><div><div class="kick">${esc(c.name)}</div><h1 style="margin-top:8px">Overzicht</h1></div>
      ${tabsHtml([['djs', "DJ's"], ['parties', 'Feesten'], ['library', 'Bibliotheek'], ['sub', 'Abonnement'], ['brand', 'Branding']], tab, 'ctab')}</div>
    ${isAdmin ? `<div class="row" style="margin-top:14px"><button class="btn sm ${c.active ? 'danger' : 'green'}" data-act="toggle-company" data-active="${c.active}">${c.active ? 'Bedrijf uitzetten' : 'Bedrijf aanzetten'}</button><button class="btn sm" data-act="owner-pw">Nieuw wachtwoord eigenaar</button></div>` : ''}
    <div id="usage" class="stats"></div><div id="cbody" style="margin-top:24px"></div>`;
  loadUsage();
  ({ djs: tabDjs, parties: tabParties, library: tabLibrary, sub: tabSub, brand: tabBrand }[tab])(c);
}

async function loadUsage() {
  const [{ data: subs }, { data: djs }, { data: parties }] = await Promise.all([
    sb.from('subscriptions').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(1),
    sb.from('profiles').select('id').eq('company_id', cid).eq('role', 'dj').eq('active', true),
    sb.from('parties').select('id').eq('company_id', cid).eq('status', 'active'),
  ]);
  const s = (subs || [])[0], plan = s && plans.find(p => p.id === s.plan_id);
  $('#usage').innerHTML = `
    <div class="card"><div class="kick grey">DJ's</div><div class="stat">${(djs || []).length} <small>van ${plan ? plan.max_djs : '–'}</small></div></div>
    <div class="card"><div class="kick grey">Actieve feesten</div><div class="stat">${(parties || []).length} <small>van ${plan ? plan.max_active_parties : '–'}</small></div></div>
    <div class="card"><div class="kick grey">Abonnement</div><div class="stat">${plan ? esc(plan.name) : 'Geen'}</div><div class="sub2" style="margin-top:6px;font-size:14px">${s ? (isActiveSub(s) ? 'Actief tot ' + fmtDate(s.ends_at) : PLAN_LABEL[s.status] || 'Verlopen') : 'Nog geen abonnement'}</div></div>`;
}

async function tabDjs() {
  const { data } = await sb.from('profiles').select('*').eq('company_id', cid).eq('role', 'dj').order('created_at');
  $('#cbody').innerHTML = `<div class="grid" style="margin-top:0">
    <section class="card wide"><h2>DJ's</h2>
      <ul class="list" style="margin-top:12px;border-top:1px solid var(--line)">${(data || []).map(d => `
        <li class="li" style="flex-wrap:wrap"><div class="main" style="flex:1 1 180px"><div class="t" style="${d.active ? '' : 'color:var(--sub)'}">${esc(d.display_name)}</div><div class="s">Sinds ${fmtDate(d.created_at)}</div></div>
        <span class="pill plain ${d.active ? 'ok' : ''}">${d.active ? 'Actief' : 'Uit'}</span>
        <button class="btn sm" data-act="reset-code" data-id="${esc(d.id)}" data-name="${esc(d.display_name)}">Nieuwe code</button>
        <button class="btn sm" data-act="dj-active" data-id="${esc(d.id)}" data-active="${d.active ? 0 : 1}">${d.active ? 'Uitzetten' : 'Aanzetten'}</button></li>`).join('') || '<li class="sub" style="padding:16px 0">Nog geen DJ\'s. Maak er rechts één aan.</li>'}</ul></section>
    <aside class="side"><section class="card"><h3>Nieuwe DJ</h3><form id="f-dj">
      <label class="f" for="dj-name">Naam van de DJ</label><input id="dj-name" required maxlength="60">
      <button class="btn primary block" style="margin-top:18px" type="submit">Nieuwe DJ</button></form>
      <p class="sub" style="margin-top:12px">De DJ krijgt een persoonlijke code. Daarmee logt hij in op de startpagina, via "Ben je de DJ? Log hier in".</p></section></aside></div>`;
  $('#f-dj').addEventListener('submit', async e => {
    e.preventDefault(); e.submitter.disabled = true;
    try {
      const out = await callFn('manage', { action: 'create_dj', name: $('#dj-name').value, company_id: cid });
      showSecret(`Code voor ${out.name}`, out.code); tabDjs(); loadUsage();
    } catch (err) { toast(err.message); } finally { e.submitter.disabled = false; }
  });
}

async function tabParties() {
  const [{ data: parties }, { data: djs }] = await Promise.all([
    sb.from('parties').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(100),
    sb.from('profiles').select('id,display_name').eq('company_id', cid).eq('role', 'dj').eq('active', true),
  ]);
  const dj = id => (djs || []).find(d => d.id === id)?.display_name || '–';
  $('#cbody').innerHTML = `<div class="grid" style="margin-top:0">
    <section class="card wide"><h2>Feesten</h2><ul class="list" style="margin-top:12px;border-top:1px solid var(--line)">${(parties || []).map(p => `
      <li class="li" style="flex-wrap:wrap"><div class="main" style="flex:1 1 200px"><div class="t">${esc(p.name)}</div><div class="s">${esc(dj(p.dj_id))} · ${fmtDate(p.created_at)}</div></div>
      ${p.status === 'active' ? `<span style="font-weight:800;font-size:22px;letter-spacing:.12em">${esc(p.party_code)}</span><button class="btn sm danger" data-act="close-party" data-id="${esc(p.id)}">Sluit</button>` : '<span class="pill plain">Afgesloten</span>'}</li>`).join('') || '<li class="sub" style="padding:16px 0">Nog geen feesten.</li>'}</ul></section>
    <aside class="side"><section class="card"><h3>Feest starten voor een DJ</h3><form id="f-party">
      <label class="f" for="pp-name">Naam van het feest</label><input id="pp-name" required maxlength="100">
      <label class="f" for="pp-dj">DJ</label><select id="pp-dj" required>${(djs || []).map(d => `<option value="${esc(d.id)}">${esc(d.display_name)}</option>`).join('')}</select>
      <button class="btn primary block" style="margin-top:18px" type="submit">Start feest</button></form></section></aside></div>`;
  $('#f-party').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.rpc('create_party', { p_name: $('#pp-name').value, p_dj_id: $('#pp-dj').value });
    if (error) return toast(error.message);
    toast('Feest gestart'); tabParties(); loadUsage();
  });
}

async function tabLibrary() {
  const { data } = await sb.rpc('library_files', { p_company: cid });
  const total = (data || []).reduce((a, f) => a + Number(f.songs), 0);
  $('#cbody').innerHTML = `<div class="grid" style="margin-top:0">
    <section class="card wide"><h2>Bestanden</h2><ul class="list" style="margin-top:12px;border-top:1px solid var(--line)">${(data || []).map(f => `
      <li class="li"><div class="main"><div class="t">${esc(f.source_file || '(zonder bestand)')}</div><div class="s">${f.songs} nummers</div></div>
      <button class="btn sm danger" data-act="del-file" data-file="${esc(f.source_file || '')}">Wis</button></li>`).join('') || '<li class="sub" style="padding:16px 0">Nog geen bibliotheek.</li>'}</ul></section>
    <aside class="side"><section class="card"><h3>Bibliotheek</h3><p class="sub2" style="margin:6px 0 14px;font-size:14px">${total} nummers. Upload een VirtualDJ- of Rekordbox-XML. Gasten en DJ's van dit bedrijf kunnen er direct in zoeken.</p>
      <input id="xml" type="file" accept=".xml" class="hidden"><button class="btn" data-act="pick-xml">Upload XML</button><div id="xml-prog" class="sub" style="margin-top:10px;color:var(--accent-text)"></div></section></aside></div>`;
  $('#xml').addEventListener('change', importXml);
}

async function importXml(e) {
  const file = e.target.files[0]; if (!file) return;
  const prog = $('#xml-prog');
  try {
    prog.textContent = 'Bestand inlezen…';
    const doc = new DOMParser().parseFromString(await file.text(), 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('Dit is geen geldig XML-bestand');
    const rows = [...doc.getElementsByTagName('TRACK')].map(t => ({ company_id: cid, title: (t.getAttribute('Name') || '').slice(0, 300), artist: (t.getAttribute('Artist') || 'Onbekend').slice(0, 300), source_file: file.name.slice(0, 200) })).filter(r => r.title);
    if (!rows.length) throw new Error('Geen nummers gevonden in dit bestand');
    await sb.from('library_songs').delete().eq('company_id', cid).eq('source_file', file.name.slice(0, 200));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from('library_songs').insert(rows.slice(i, i + 500));
      if (error) throw error;
      prog.textContent = `Uploaden… ${Math.min(i + 500, rows.length)} van ${rows.length}`;
    }
    toast(`${rows.length} nummers geïmporteerd`); tabLibrary();
  } catch (err) { prog.textContent = ''; toast(err.message); }
  e.target.value = '';
}

async function tabSub() {
  const { data: subs } = await sb.from('subscriptions').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(1);
  const s = (subs || [])[0], plan = s && plans.find(p => p.id === s.plan_id);
  if (!isAdmin) {
    $('#cbody').innerHTML = `<section class="card" style="max-width:640px"><h2>Jouw abonnement</h2>${s ? `<p style="margin-top:12px"><b>${esc(plan?.name || '–')}</b> · ${esc(PLAN_LABEL[s.status] || s.status)} · loopt tot ${fmtDate(s.ends_at)}</p><p class="sub" style="margin-top:6px">${plan ? `Tot ${plan.max_djs} DJ's en ${plan.max_active_parties} feesten tegelijk.` : ''}</p>` : '<p class="sub" style="margin-top:12px">Geen abonnement.</p>'}<p class="sub" style="margin-top:14px">Wil je wijzigen of opzeggen? Stuur een bericht naar MXT Productions.</p></section>`;
    return;
  }
  $('#cbody').innerHTML = `<section class="card" style="max-width:640px"><h2>Abonnement</h2>
    <label class="f" for="s-plan">Plan</label><select id="s-plan">${plans.map(p => `<option value="${esc(p.id)}" ${s?.plan_id === p.id ? 'selected' : ''}>${esc(p.name)} (${p.max_djs} DJ's, ${p.max_active_parties} feesten)</option>`).join('')}</select>
    <label class="f" for="s-status">Status</label><select id="s-status">${Object.entries(PLAN_LABEL).map(([k, l]) => `<option value="${k}" ${s?.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="f" for="s-end">Einddatum (leeg = doorlopend)</label><input id="s-end" type="date" value="${s?.ends_at ? s.ends_at.slice(0, 10) : ''}">
    <button class="btn primary block" style="margin-top:20px" data-act="save-sub" data-id="${esc(s?.id || '')}">Opslaan</button></section>`;
}

async function tabBrand(c) {
  const b = c.branding || {};
  const f = (id, label, v, ph = '') => `<label class="f" for="${id}">${label}</label><input id="${id}" value="${esc(v || '')}" placeholder="${esc(ph)}" maxlength="300">`;
  const link = (k, label) => `<div class="row" style="align-items:flex-end"><div class="grow">${f('b-' + k, label, b[k])}</div><label class="row sub" style="height:50px"><input type="checkbox" id="b-${k}-on" ${b[k + '_active'] ? 'checked' : ''} style="width:24px;height:24px"> Tonen</label></div>`;
  $('#cbody').innerHTML = `<section class="card" style="max-width:720px"><h2>Branding</h2>
    ${f('b-name', 'Merknaam (bovenin de gastenpagina)', b.brand_name)}
    <label class="f" for="b-accent">Accentkleur (strepen en knoppen)</label>
    <div class="row"><input id="b-accent" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(b.accent || '') ? b.accent : '#7dff00')}" style="width:72px;padding:4px"><button class="btn sm" data-act="reset-accent">Standaard groen</button><span class="sub" id="b-accent-note"></span></div>
    <label class="f">Logo</label><div class="row">${b.logo_url ? `<img src="${esc(safeUrl(b.logo_url))}" alt="" style="max-height:48px;background:#000;border-radius:8px">` : ''}<input id="b-logo" type="file" accept="image/*" class="hidden"><button class="btn sm" data-act="pick-logo">Logo kiezen</button>${b.logo_url ? '<button class="btn sm danger" data-act="rm-logo">Verwijder</button>' : ''}</div>
    <h3 style="margin-top:28px">Promokaart voor gasten</h3>
    ${f('b-ptitle', 'Titel', b.promo_title, 'Boek ons voor jouw feest')}${f('b-ptext', 'Tekst', b.promo_text)}
    ${link('whatsapp', 'WhatsApp-link (https://wa.me/31…)')}${link('email', 'E-mailadres')}${link('instagram', 'Instagram-link')}${link('tiktok', 'TikTok-link')}${link('facebook', 'Facebook-link')}
    <button class="btn primary block" style="margin-top:22px" data-act="save-brand">Opslaan</button></section>`;
  $('#b-logo').addEventListener('change', async ev => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      const blob = await compressImage(file, 600, 0.85);
      const path = `${cid}/logo_${Date.now()}.jpg`;
      const up = await sb.storage.from('branding').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      await saveBranding({ logo_url: sb.storage.from('branding').getPublicUrl(path).data.publicUrl });
      toast('Logo opgeslagen'); showCompany();
    } catch (err) { toast(err.message); }
  });
}
async function saveBranding(patch) {
  const { data: c } = await sb.from('companies').select('branding').eq('id', cid).single();
  const branding = { ...(c.branding || {}), ...patch };
  const { error } = await sb.from('companies').update({ branding }).eq('id', cid);
  if (error) throw error;
}

// ---------- Kliks ----------
onAct(document, {
  logout: async () => { await sb.auth.signOut(); location.reload(); },
  'close-modal': closeModal,
  'copy-code': async el => { await navigator.clipboard.writeText(el.dataset.code); toast('Gekopieerd'); },
  atab: el => { adminTab = el.dataset.tab; return showAdminHome(); },
  home: () => showAdminHome(),
  'open-company': el => { cid = el.dataset.id; tab = 'djs'; return showCompany(); },
  ctab: el => { tab = el.dataset.tab; return showCompany(); },
  'toggle-company': async el => {
    const { error } = await sb.from('companies').update({ active: el.dataset.active !== 'true' }).eq('id', cid);
    if (error) throw error; showCompany();
  },
  'owner-pw': async () => {
    const pw = prompt('Nieuw wachtwoord voor de eigenaar van dit bedrijf (min. 10 tekens):');
    if (!pw) return;
    await callFn('manage', { action: 'reset_owner_password', company_id: cid, password: pw }); toast('Wachtwoord gewijzigd');
  },
  'save-plan': async el => {
    const tr = el.closest('tr'); const v = f => tr.querySelector(`[data-f=${f}]`);
    const { error } = await sb.from('plans').update({ name: v('name').value.trim(), max_djs: +v('max_djs').value, max_active_parties: +v('max_active_parties').value, remove_branding: v('remove_branding').checked }).eq('id', el.dataset.id);
    if (error) throw error;
    await reloadPlans(); toast('Plan opgeslagen');
  },
  'reset-code': async el => {
    if (!confirm('Nieuwe code maken? De oude code werkt dan niet meer.')) return;
    const out = await callFn('manage', { action: 'reset_dj_code', dj_id: el.dataset.id, company_id: cid });
    showSecret(`Nieuwe code voor ${el.dataset.name}`, out.code);
  },
  'dj-active': async el => { await callFn('manage', { action: 'set_dj_active', dj_id: el.dataset.id, active: el.dataset.active === '1', company_id: cid }); tabDjs(); loadUsage(); },
  'close-party': async el => { const { error } = await sb.rpc('close_party', { p_party: el.dataset.id }); if (error) throw error; tabParties(); loadUsage(); },
  'pick-xml': () => $('#xml').click(),
  'del-file': async el => {
    if (!confirm('Alle nummers uit dit bestand wissen?')) return;
    let q = sb.from('library_songs').delete().eq('company_id', cid);
    q = el.dataset.file ? q.eq('source_file', el.dataset.file) : q.is('source_file', null);
    const { error } = await q; if (error) throw error; tabLibrary();
  },
  'save-sub': async el => {
    const row = { company_id: cid, plan_id: $('#s-plan').value, status: $('#s-status').value, ends_at: $('#s-end').value ? new Date($('#s-end').value + 'T23:59:59').toISOString() : null };
    const { error } = el.dataset.id ? await sb.from('subscriptions').update(row).eq('id', el.dataset.id) : await sb.from('subscriptions').insert(row);
    if (error) throw error; toast('Abonnement opgeslagen'); showCompany();
  },
  'pick-logo': () => $('#b-logo').click(),
  'rm-logo': async () => { await saveBranding({ logo_url: '' }); showCompany(); },
  'reset-accent': () => { $('#b-accent').value = '#7dff00'; $('#b-accent').dataset.reset = '1'; },
  'save-brand': async () => {
    const p = { brand_name: $('#b-name').value.trim(), promo_title: $('#b-ptitle').value.trim(), promo_text: $('#b-ptext').value.trim() };
    const a = $('#b-accent');
    p.accent = (a.dataset.reset || a.value.toLowerCase() === '#7dff00') ? '' : a.value;
    for (const k of ['whatsapp', 'email', 'instagram', 'tiktok', 'facebook']) { p[k] = $('#b-' + k).value.trim(); p[k + '_active'] = $('#b-' + k + '-on').checked; }
    await saveBranding(p); toast('Opgeslagen');
  },
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
(async () => { if (await getSession()) await start(); })();
