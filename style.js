// ==========================================
// PARTYREQUEST - SUPABASE & STIJL CONFIGURATIE (style.js)
// ==========================================

// 1. Laad automatisch de Supabase SDK
const scriptTag = document.createElement('script');
scriptTag.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
document.head.appendChild(scriptTag);

// ==========================================
// VUL HIER JOUW SUPABASE GEGEVENS IN:
// ==========================================
const SUPABASE_URL = 'https://vuwrolizqvogvjwhbytc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Yk-N-MiANRyOHXwJtFVkDA_Nd9NUTp5';

let supabaseClient = null;

scriptTag.onload = function() {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};

// 2. Injecteer CSS (Donkerblauwe Huisstijl)
function initPartyStyles() {
    const globalStyles = `
        :root {
            --primary-color: #3b82f6;
            --secondary-color: #1e3a8a;
            --background-color: #0a0f1d;
            --card-background: #131b2e;
            --text-color: #f8fafc;
            --accent-color: #10b981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--background-color);
            color: var(--text-color);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; width: 100%; }
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
        .btn-primary:hover { opacity: 0.9; background-color: #2563eb; }
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
        input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary-color); }
        label { font-size: 14px; font-weight: 600; color: #cbd5e1; }
        h1, h2, h3 { color: var(--text-color); }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPartyStyles);
} else {
    initPartyStyles();
}

// 3. Centrale PartyApp Database Helpers voor Supabase
const PartyApp = {
    getCurrentUser: function() {
        return JSON.parse(localStorage.getItem('party_current_user')) || null;
    },

    applyBranding: function(branding) {
        if (!branding) return;
        const root = document.documentElement;
        if (branding.primaryColor) root.style.setProperty('--primary-color', branding.primaryColor);
        if (branding.backgroundColor) root.style.setProperty('--background-color', branding.backgroundColor);
    },

    logout: function() {
        localStorage.removeItem('party_current_user');
        window.location.href = 'login.html';
    },

    db: {
        async getUsers() {
            if (!supabaseClient) return [];
            const { data, error } = await supabaseClient.from('party_users').select('*');
            if (error) { console.error(error); return []; }
            return data;
        },
        async createUser(userObj) {
            if (!supabaseClient) return false;
            const { error } = await supabaseClient.from('party_users').insert([userObj]);
            if (error) { alert('Fout: ' + error.message); return false; }
            return true;
        },
        async deleteUser(username) {
            if (!supabaseClient) return false;
            const { error } = await supabaseClient.from('party_users').delete().eq('username', username);
            if (error) { alert('Fout: ' + error.message); return false; }
            return true;
        },
        async updatePassword(username, newPassword) {
            if (!supabaseClient) return false;
            const { error } = await supabaseClient.from('party_users').update({ password: newPassword }).eq('username', username);
            if (error) { alert('Fout: ' + error.message); return false; }
            return true;
        },
        async getSession(username) {
            if (!supabaseClient) return null;
            let { data, error } = await supabaseClient.from('party_sessions').select('*').eq('username', username).single();
            if (error || !data) {
                const defaultCode = Math.floor(100000 + Math.random() * 900000).toString();
                const newSession = {
                    username: username,
                    party_code: defaultCode,
                    welcome_text: '',
                    primary_color: '#3b82f6',
                    background_color: '#0a0f1d',
                    library: [],
                    requests: []
                };
                await supabaseClient.from('party_sessions').insert([newSession]);
                return newSession;
            }
            return data;
        },
        async updateSession(username, updateFields) {
            if (!supabaseClient) return false;
            const payload = { ...updateFields, username: username };
            const { error } = await supabaseClient.from('party_sessions').upsert(payload);
            if (error) { 
                console.error('Supabase update fout:', error); 
                alert('Database fout bij opslaan: ' + error.message); 
                return false; 
            }
            return true;
        },
        async getSessionByCode(code) {
            if (!supabaseClient || !code) {
                console.warn('Geen code meegegeven aan getSessionByCode');
                return null;
            }
            const cleanCode = code.toString().trim();
            console.log('Zoeken naar partycode in database:', cleanCode);

            const { data, error } = await supabaseClient
                .from('party_sessions')
                .select('*')
                .eq('party_code', cleanCode)
                .maybeSingle();

            if (error) {
                console.error('Supabase zoekfout:', error);
                return null;
            }

            if (!data) {
                console.warn('Geen sessie gevonden met code:', cleanCode);
                return null;
            }

            console.log('Sessie succesvol gevonden:', data);
            return data;
        }
    }
};
