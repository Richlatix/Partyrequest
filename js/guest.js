// js/guest.js
let currentParty = null;
let currentLibrary = [];

// 1. Inloggen met Partycode op index.html
async function joinParty(partyCode) {
  const cleanCode = partyCode.trim().toUpperCase();

  // Zoek actieve party op
  const { data: party, error } = await supabase
    .from('active_parties')
    .select(`
      id,
      party_code,
      djs (
        id,
        welcome_message,
        profiles (
          name, bg_color, accent_color, text_color
        ),
        dj_libraries ( tracks )
      )
    `)
    .eq('party_code', cleanCode)
    .eq('is_active', true)
    .single();

  if (error || !party) {
    alert('Ongeldige of verlopen partycode!');
    return false;
  }

  currentParty = party;
  currentLibrary = party.djs.dj_libraries?.tracks || [];

  // 2. Huisstijl van de DJ instellen op de pagina
  applyCustomBranding(party.djs.profiles);

  // 3. Start Realtime luisteraar voor live verzoekjes & stemmen
  listenToLiveRequests(party.id);

  // Initialiseer verzoekjeslijst
  fetchRequests(party.id);

  return true;
}

// Dynamic Branding toepassen via CSS Variabelen
function applyCustomBranding(profile) {
  if (!profile) return;
  document.documentElement.style.setProperty('--bg-color', profile.bg_color || '#121212');
  document.documentElement.style.setProperty('--accent-color', profile.accent_color || '#FF4081');
  document.documentElement.style.setProperty('--text-color', profile.text_color || '#FFFFFF');
}

// 4. Verzoekje Indienen (uit library of handmatig)
async function submitRequest(artist, title, message = '') {
  if (!currentParty) return;

  const { error } = await supabase
    .from('requests')
    .insert({
      party_id: currentParty.id,
      artist: artist,
      title: title,
      message: message,
      votes: 1
    });

  if (error) {
    alert('Fout bij versturen: ' + error.message);
  } else {
    alert('Verzoekje verstuurd! 🎵');
  }
}

// 5. Upvoten (+1 stem) met 1x stemlimiet per browser
async function voteRequest(requestId) {
  const voteKey = `voted_${requestId}`;

  if (localStorage.getItem(voteKey)) {
    alert('Je hebt al gestemd op dit nummer!');
    return;
  }

  // Roep de SQL function aan die we in Supabase hebben gemaakt
  const { error } = await supabase.rpc('increment_vote', { request_id: requestId });

  if (!error) {
    localStorage.setItem(voteKey, 'true');
  } else {
    alert('Stemmen mislukt: ' + error.message);
  }
}

// 6. Realtime Updates via Supabase
function listenToLiveRequests(partyId) {
  supabase
    .channel(`party-${partyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'requests', filter: `party_id=eq.${partyId}` },
      () => {
        // Herlaad het verzoekjesoverzicht live bij elke verandering/stem
        fetchRequests(partyId);
      }
    )
    .subscribe();
}

// 7. Verzoekjes ophalen en sorteren op stemmen (Hoogste eerst)
async function fetchRequests(partyId) {
  const { data: requests, error } = await supabase
    .from('requests')
    .select('*')
    .eq('party_id', partyId)
    .order('votes', { ascending: false });

  if (!error && typeof renderRequestsList === 'function') {
    renderRequestsList(requests);
  }
}
