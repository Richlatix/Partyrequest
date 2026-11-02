// Alleen de strepen voor de landingspagina (geen Supabase nodig)
function stripesSvg(w, color) {
  const h = Math.round(w * 1.25), id = 'g' + Math.random().toString(36).slice(2, 7);
  const grad = `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="325" r="640"><stop offset="0.35" stop-color="#7DFF00"/><stop offset="0.7" stop-color="#5CBC00"/><stop offset="1" stop-color="#458C00"/></radialGradient></defs>`;
  const a = `url(#${id})`;
  return `<svg class="stripes" viewBox="0 0 520 650" width="${w}" height="${h}" aria-hidden="true">${grad}
<polygon class="s1" points="0,0 67,0 518,650 274,650 0,254" fill="${a}"/>
<polygon class="s2" points="115,0 148,0 314,240 281,240" fill="#ffffff"/>
<polygon class="s3" points="189,0 222,0 388,240 354,240" fill="${a}"/>
<polygon class="s4" points="0,361 0,440 144,650 199,650" fill="${a}"/></svg>`;
}
document.getElementById('logo-s').innerHTML = stripesSvg(130);
document.getElementById('hero-stripes').innerHTML = stripesSvg(420);
