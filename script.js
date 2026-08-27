/* =====================================================================
ZEN OS -frontend-only simulated desktop environment
All state persisted to localStorage. Zero backend / network calls,
EXCEPT for the apps noted below, which use real, live services:
- PlayTube  → embeds the real YouTube iframe player (youtube.com)
-Wavelength → embeds the real Spotify iframe player (open.spotify.com)
-Zen Browse → iframes the real live web (subject to sites that block embedding via X-Frame-Options/CSP - a hard browser platform limit, not a bug here: those sites open in a new tab instead)
===================================================================== */

const LS_KEY = 'zenos_state_v1';

const APP_REGISTRY = {
    filemanager:{name:'File Manager', icon:'🗂️', color:'#7c6cff', system:true, pinned:true},
    browser:    {name:'Aurora Browse', icon:'🧭', svgKey:'browser', color:'#2fe6c9', system:true, pinned:true},
    texteditor: {name:'Text Editor',  icon:'📝', color:'#ffb35c', system:true, pinned:true},
    notes:      {name:'Notes',        icon:'🗒️', color:'#ffd166', system:true, pinned:false},
    calculator: {name:'Calculator', icon:'🧮', svgKey:'calc', color:'#4ade80', system:true, pinned:true},
    calender:   {name:'Calender', icon:'📅',}
}
