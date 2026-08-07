// ==========================================
// PARTYREQUEST - CENTRAAL STYLE & LOGIC (style.js)
// ==========================================

// 1. Dynamisch CSS injecteren in de <head> van elke pagina (Donkerblauwe Huisstijl)
const globalStyles = `
    :root {
        --primary-color: #3b82f6;     /* Helder elektrisch blauw */
        --secondary-color: #1e3a8a;   /* Diep koningsblauw */
        --background-color: #0a0f1d;  /* Zeer donker midnight blue */
        --card-background: #131b2e;   /* Strakke donkerblauwe kaartkleur */
        --text-color: #f8fafc;        /* Helder wit/lichtgrijs voor leesbaarheid */
        --accent-color: #10b981;      /* Frisse groen/teal kleur voor stemmen/successen */
    }

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        background-color: var(--background-color);
        color: var(--text-color);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        width: 100%;
    }

    .card {
        background-color: var(--card-background);
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(59, 130, 246, 0.1);
    }

    .btn-primary {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: opacity 0.2s, background-color 0.2s;
        width: 100%;
    }

    .btn-primary:hover {
        opacity: 0.9;
        background-color: #2563eb;
    }

    input, select, textarea {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #1e293b;
        background-color: #090d16;
        color: white;
        margin-top: 5px;
        margin-bottom: 15px;
        font-family: inherit;
    }

    input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: var(--primary-color);
    }

    label {
        font-size: 14px;
        font-weight: 600;
        color: #cbd5e1;
    }

    h1, h2, h3 {
        color: var(--text-color);
    }
`;

// Maak een <style> element aan en voeg het toe aan de pagina
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = globalStyles;
document.head.appendChild(styleSheet);

// 2. Centrale PartyApp App-logica & Huisstijl Beheerder
const PartyApp = {
    // Huidige ingelogde gebruiker ophalen
    getCurrentUser: function() {
        return JSON.parse(localStorage.getItem('party_current_user')) || null;
    },

    // Huisstijl dynamisch overschrijven (bijv. via bedrijfsprofiel of solo DJ instellingen)
    applyBranding: function(branding) {
        if (!branding) return;
        const root = document.documentElement;
        if (branding.primaryColor) root.style.setProperty('--primary-color', branding.primaryColor);
        if (branding.secondaryColor) root.style.setProperty('--secondary-color', branding.secondaryColor);
        if (branding.backgroundColor) root.style.setProperty('--background-color', branding.backgroundColor);
    },

    // Uitloggen
    logout: function() {
        localStorage.removeItem('party_current_user');
        window.location.href = 'login.html';
    }
};
