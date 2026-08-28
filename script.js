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
    {id:'sw-inkflow', name:'InkFlow', cat:'Productivity', icon:'🖋️', color:'#ffd166', size:'46 MB', rating:4.4, desc:'Distraction-free long-form writing with focus mode and word goals.'},
    {id:'sw-cipherbox', name:'CipherBox', cat:'Utilities', icon:'🔐', color:'#9b8cff', size:'18 MB', rating:4.7, desc:'Encrypt and organize sensitive local notes and credentials.'},
    {id:'sw-tempo', name:'Tempo', cat:'Multimedia', icon:'🎚️', color:'#2fe6c9', size:'130 MB', rating:4.3, desc:'A simple multitrack audio mixer for podcasts and voice memos.'},
    {id:'sw-atlas', name:'Atlas Maps', cat:'Internet', icon:'🗺️', color:'#4ade80', size:'96 MB', rating:4.5, desc:'Offline-friendly map viewer with saved pins and routes.'},
    {id:'sw-studybuddy', name:'StudyBuddy', cat:'Education', icon:'🎓', color:'#ff9f5c', size:'58 MB', rating:4.2, desc:'Flashcards and spaced-repetition study sessions. '},
    {id:'sw-vaultsync', name:'VaultSync', cat:'System Tools', icon:'💾', color:'#a7afc0', size:'12 MB', rating:4.1, desc:'Local backup snapshots for your files and settings.'},
    {id:'sw-lumen', name:'Lumen Notes', cat:'Productivity', icon:'💡', color:'#ffe066', size:'38 MB', rating:4.6, desc:'Mind-mapping and sketch notes with a warm paper aesthetic.'},
    {id:'sw-frameit', name:'FrameIt', cat:'Graphics', icon:'🖼️', color:'#ff6b6b', size:'71 MB', rating:4.3, desc:'Quick screenshot annotation and frame mockups.'},
];

const GAME_CATALOG = [
    {id:'gm-nebulacrash', name:'Nebula Crash', icon:'🚀', color:'#7c6cff', size:'600 MB', rating:4.7, desc:'Arcade dodger through asteroid fields with rising difficulty.'},
    
]
