/* =====================================================================
   ZEN OS — frontend-only simulated desktop environment
   All state persisted to localStorage. Zero backend / network calls,
   EXCEPT for the apps noted below, which use real, live services:
     - PlayTube    → embeds the real YouTube iframe player (youtube.com)
     - Wavelength  → embeds the real Spotify iframe player (open.spotify.com)
     - Zen Browse → iframes the real live web (subject to sites that
       block embedding via X-Frame-Options/CSP — a hard browser platform
       limit, not a bug here; those sites open in a new tab instead)
===================================================================== */

const LS_KEY = 'zenos_state_v1';

const APP_REGISTRY = {
    filemanager:{name:'File Manager', icon:'🗂️', color:'#7c6cff', system:true, pinned:true},
    browser:    {name:'Zen Browse', icon:'🧭', svgKey:'browser', color:'#2fe6c9', system:true, pinned:true},
    texteditor: {name:'Text Editor',  icon:'📝', color:'#ffb35c', system:true, pinned:true},
    notes:      {name:'Notes',        icon:'🗒️', color:'#ffd166', system:true, pinned:false},
    calculator: {name:'Calculator',   icon:'🧮', svgKey:'calc', color:'#4ade80', system:true, pinned:true},
    calendar:   {name:'Calendar',     icon:'📅', color:'#ff6b6b', system:true, pinned:false},
    terminal:   {name:'Terminal',     icon:'⌨️', color:'#0f1117', color2:'#2fe6c9', system:true, pinned:false},
    settings:   {name:'Settings',     icon:'⚙️', color:'#a7afc0', system:true, pinned:true},
    taskmanager:{name:'Task Manager', icon:'📊', svgKey:'appmanager', color:'#ff9f5c', system:true, pinned:false},
    softwarehub:{name:'Software Hub', icon:'🛍️', svgKey:'apps', color:'#7c6cff', system:true, pinned:true},
    youtube:    {name:'PlayTube',     icon:'▶️', color:'#ff5c5c', system:true, pinned:false},
    spotify:    {name:'Wavelength',   icon:'🎧', color:'#1ed760', system:true, pinned:false},
    games:      {name:'Games',        icon:'🎮', color:'#7c6cff', system:true, pinned:false},
};

const SOFTWARE_CATALOG = [
    {id:'sw-pixelpaint', name:'PixelPaint', cat:'Graphics', icon:'🎨', color:'#ff8fa3', size:'84 MB', rating:4.6, desc:'A lightweight raster & vector sketchpad for quick mockups and doodles.'},
    {id:'sw-codeforge', name:'CodeForge', cat:'Developer Tools', icon:'🧑‍💻', color:'#5cc8ff', size:'212 MB', rating:4.8, desc:'A minimalist code editor with syntax highlighting and snippet support.'},
    
]
