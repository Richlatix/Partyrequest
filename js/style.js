// ==========================================
// PARTYREQUEST - CENTRAAL STYLE & LOGIC (style.js)
// ==========================================

// 1. Dynamisch CSS injecteren in de <head> van elke pagina
const globalStyles = `
    :root {
        --primary-color: #ff3366;
        --secondary-color: #1a1a2e;
        --background-color: #0f0e17;
        --card-background: #161622;
        --text-color: #ffffff;
        --accent-color: #2cb67d;
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
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
    }

    .btn-primary {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: opacity 0.2s;
        width: 100%;
    }

    .btn-primary:hover {
        opacity: 0.9;
    }

    input, select, textarea {
        width: 100%;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #333;
        background-color: #0f0e17;
        color: white;
        margin-top: 5px;
        margin-bottom: 15px;
    }

    label {
        font-size: 14px;
        font-weight: 600;
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
