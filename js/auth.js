// js/auth.js

// 1. Inlogfunctie voor login.html
async function handleLogin(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (authError) {
    alert('Inloggen mislukt: ' + authError.message);
    return;
  }

  const user = authData.user;

  // Haal de rol en profielgegevens op
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    alert('Kan gebruikersprofiel niet ophalen.');
    return;
  }

  // Stuur door op basis van de rol
  redirectUserByRole(profile.role);
}

// 2. Doorsturen naar de juiste pagina
function redirectUserByRole(role) {
  switch (role) {
    case 'admin':
      window.location.href = 'admin.html';
      break;
    case 'company':
      window.location.href = 'profiles.html';
      break;
    case 'solo_dj':
    case 'company_dj':
      window.location.href = 'dj.html';
      break;
    default:
      alert('Onbekende rol.');
  }
}

// 3. Beveiligings-check voor dashboards (checkt of er iemand ingelogd is)
async function checkAuthSession(allowedRoles = []) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, djs(*)')
    .eq('id', session.user.id)
    .single();

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    alert('Geen toegang tot deze pagina.');
    redirectUserByRole(profile.role);
    return null;
  }

  return { session, profile };
}

// 4. Uitloggen
async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}
