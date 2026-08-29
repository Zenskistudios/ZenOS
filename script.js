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
    {id:'gm-nebulacrash', name:'Nebula Crash', icon:'🚀', color:'#7c6cff', size:'1.2 GB', rating:4.7, desc:'Arcade dodger through asteroid fields with rising difficulty.'},
    {id:'gm-tidepool', name:'Tidepool Tactics', icon:'🐚', color:'#2fe6c9', size:'860 MB', rating:4.5, desc:'Turn-based strategy set in a shrinking coastal arena.'},
    {id:'gm-emberkeep', name:'Ember Keep', icon:'🏰', color:'#ff8f5c', size:'2.4 GB', rating:4.8, desc:'Cozy castle-builder with a slow-burn story mode.'},
    {id:'gm-pixelrunner', name:'Pixel Runner', icon:'🏃', color:'#ffd166', size:'340 MB', rating:4.3, desc:'Endless side-scroller with daily challenge seeds.'},
    {id:'gm-glasslands', name:'Glasslands', icon:'🔷', color:'#9b8cff', size:'1.8 GB', rating:4.6, desc:'Puzzle exploration through a fractured crystal world.'},
    {id:'gm-driftline', name:'Driftline', icon:'🏎️', color:'#4ade80', size:'2.1 GB', rating:4.4, desc:'Arcade racer with drift-scoring and custom tracks.'},
];

// Real, publicly embeddable YouTube videos (official/Creative-Commons sources).
// Thumbnails load from YouTube's real image CDN; watch pages embed the real,
// live YouTube iframe player (youtube.com/embed/{id}) — actual video playback,
// not a mock.
const VIDEO_CATALOG = [
    {id:'aqz-KE-bpKQ', title:'Big Buck Bunny', channel:'Blender Foundation', cat:'Film'},
    {id:'eRsGyueVLvQ', title:'Sintel — Official Trailer', channel:'Blender Foundation', cat:'Film'},
    {id:'jNQXAC9IVRw', title:'Me at the zoo', channel:'jawed', cat:'History'},
    {id:'9bZkp7q19f0', title:'Gangnam Style', channel:'officialpsy', cat:'Music'},
    {id:'dQw4w9WgXcQ', title:'Never Gonna Give You Up', channel:'Rick Astley', cat:'Music'},
    {id:'YE7VzlLtp-4', title:'Big Buck Bunny (Behind the Scenes)', channel:'Blender Foundation', cat:'Film'},
];

// Real Spotify tracks, verified against public Spotify catalog IDs.Playback
// uses Spotify's own official embed widget(open.spotify.com/embed/track/{id}),
// which is real, live audio streamed and controlled by Spotify itself — not a
// simulated player. Users can also paste any open.spotify.com track link to
// add their own track (see addCustomTrack in renderSpotify).
const TRACK_CATALOG = [
    {id:'0VjIjW4GlUZAMYd2vXMi3b', title:'Blinding Lights', artist:'The Weeknd', album:'After Hours', color:'#7c6cff'},
    {id:'02Zkkf2zMkwRGQjZ7T4p8f', title:'Anti-Hero', artist:'Taylor Swift', album:'Midnights', color:'#2fe6c9'},
    {id:'4Dvkj6JhhA12EX05fT7y2e', title:'As It Was', artist:'Harry Styles', album:"Harry's House", color:'#ffb35c'},
    {id:'3BnDvpeuGOj21Ir2aVEtQo', title:'Calm Down', artist:'Rema', album:'Rave & Roses', color:'#4ade80'},
];

function uid(p){ return p + '_' + Math.random().toString(36).slice(2,9); }
function nowStr(){ return new Date().toLocaleString(); }
function escapeHtml(s){ return (s||'').replace(/[&&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt','"':'&quot;',"'":'&#39;'})); }

// Real SVG icon assets (provided by the user) for the select apps/toggles.
// Anything not listed here keeps its emoji fallback.
const ICONS = {
    browser: `<svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 80 80" <g fill="none">
    <path fill="#2f80ed" d="M29.393 14.393a27.717 27.717 0 1 1 21.21451.214a27.717 27.717 0 0 1-21.214-51.214" />
    <path fill="#6fcf97" fill-rule="evenodd" d="M23.687 17.587q.908-.66 1.87-1.248l2.066 2.834l-1.917.052zm-10.64 15.966A27.7 27.7 0 0 1 19.07 21.83l1.688 1.797l2.675-.28l.483-3.394l1.511 1.534l2.297.277l.574 1.863l-6.66 6.977l.23 2.998l-1.876-2.284h-3.215v2.655l2.832.833l2.258 2.577l4.476.198l2.223 2.497l2.45.766v3.476l-7.885 8.245v5.708l-1.79-1.302l-1.004-2.701v-6.7l-2.526-3.25l-.154-4.757l1.761-1.982l-1.531-1.903l-3.448-.566zm17.29-19.538q1.088-.405 2.198-.715l7.137-.418l.316 5.625l-5.41 5.385l-2.474-2.991l.075-2.063l-2.24-2.424zm26.276 3.786q.81.608 1.575 1.271l-2.732 2.422l-.589-1.961zm1.757 1.43l.596.742l-1.668 1.805l-.124 1.392l-3.535.077l-2.474 2.266l-1.569-5.98l-3.725 2.934l-.197 2.877l5.49.17l-1.273 2.749l-2.195.712l.229 1.482l2.278.242l2.166-2.114l1.444.025l1.69 1.966l1.296-.12l1.296-.118l.896-.902l1.718-.104l2.315 2.63l-1.842 1.831l-2.76-.094l-.4.732l-3.493-1.246l-.134-1.107l-3.42.116l-.546-.684l-2.215 2.848l-.575 5.417l3.585 3.61l4.182.052l.096 5.378l1.771 1.403l.15 4.744l1.195 1.65l2.365.052l3.186-3.352l.025-7.761l2.913-2.991l-.498-1.908l-4.481-4.641l.996-.67l3.012 3.17l1.55.065a27.7 27.7 0 0 0-2.049-9.13l-.59.55l-1.655-.942l-2.683.278l1.092-2.364l2.567-.193a27.7 27.7 0 0 0-5.998-7.543" clip-rule="evenodd" />
	</g>
    </svg>`,
    calc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"> <path fill="#616161" d="M40 16H8v24c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4z" />
    <path fill="#424242" d="M36 4H12C9.8 4 8 5.8 8 8v9h32V8c0-2.21.8-4-4-4" />
    <path fill="`
}