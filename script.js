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

const { Children } = require("react");

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
    browser: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
	<g fill="none">
		<path fill="#2f80ed" d="M29.393 14.393a27.717 27.717 0 1 1 21.214 51.214a27.717 27.717 0 0 1-21.214-51.214" />
		<path fill="#6fcf97" fill-rule="evenodd" d="M23.687 17.587q.908-.66 1.87-1.248l2.066 2.834l-1.917.052zm-10.64 15.966A27.7 27.7 0 0 1 19.07 21.83l1.688 1.797l2.675-.28l.483-3.394l1.511 1.534l2.297.277l.574 1.863l-6.66 6.977l.23 2.998l-1.876-2.284h-3.215v2.655l2.832.833l2.258 2.577l4.476.198l2.223 2.497l2.45.766v3.476l-7.885 8.245v5.708l-1.79-1.302l-1.004-2.701v-6.7l-2.526-3.25l-.154-4.757l1.761-1.982l-1.531-1.903l-3.448-.566zm17.29-19.538q1.088-.405 2.198-.715l7.137-.418l.316 5.625l-5.41 5.385l-2.474-2.991l.075-2.063l-2.24-2.424zm26.276 3.786q.81.608 1.575 1.271l-2.732 2.422l-.589-1.961zm1.757 1.43l.596.742l-1.668 1.805l-.124 1.392l-3.535.077l-2.474 2.266l-1.569-5.98l-3.725 2.934l-.197 2.877l5.49.17l-1.273 2.749l-2.195.712l.229 1.482l2.278.242l2.166-2.114l1.444.025l1.69 1.966l1.296-.12l1.296-.118l.896-.902l1.718-.104l2.315 2.63l-1.842 1.831l-2.76-.094l-.4.732l-3.493-1.246l-.134-1.107l-3.42.116l-.546-.684l-2.215 2.848l-.575 5.417l3.585 3.61l4.182.052l.096 5.378l1.771 1.403l.15 4.744l1.195 1.65l2.365.052l3.186-3.352l.025-7.761l2.913-2.991l-.498-1.908l-4.481-4.641l.996-.67l3.012 3.17l1.55.065a27.7 27.7 0 0 0-2.049-9.13l-.59.55l-1.655-.942l-2.683.278l1.092-2.364l2.567-.193a27.7 27.7 0 0 0-5.998-7.543" clip-rule="evenodd" />
	</g>
</svg>`,
    calc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
	<path fill="#616161" d="M40 16H8v24c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4z" />
	<path fill="#424242" d="M36 4H12C9.8 4 8 5.8 8 8v9h32V8c0-2.2-1.8-4-4-4" />
	<path fill="#9CCC65" d="M36 14H12c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h24c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1" />
	<path fill="#33691E" d="M33 10h2v2h-2zm-4 0h2v2h-2z" />
	<path fill="#FF5252" d="M36 23h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1" />
	<path fill="#E0E0E0" d="M15 23h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1" />
	<path fill="#BDBDBD" d="M36 29h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m0 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1m0 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1" />
</svg>`,
    apps: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<linearGradient id="SVGSluVtcFh" x1="0" x2="221.011" y1="460.167" y2="460.167" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
		<stop offset="0" stop-color="#80a338" />
		<stop offset="1" stop-color="#b3d745" />
	</linearGradient>
	<path fill="url(#SVGSluVtcFh)" d="M92.1 9L0 55c15.1 42.7 64.5 64.5 110.5 46L221 55C205.9 12.1 143.5-15.1 92.1 9" />
	<linearGradient id="SVGAUMond5t" x1="-.018" x2="220.992" y1="459.209" y2="459.209" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
		<stop offset="0" stop-color="#95bd27" />
		<stop offset="1" stop-color="#bae038" />
	</linearGradient>
	<path fill="url(#SVGAUMond5t)" d="m11.8 59.6l83.8-41.9c24.7-10.6 51.6-7.5 72.9.2c18.3 6.6 32.5 18 40.3 32.5L107 92.8c-38.7 15.4-79.1-.7-95.2-33.2" />
	<linearGradient id="SVGWck7IemC" x1="212.816" x2="80.473" y1="475.544" y2="492.758" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
		<stop offset="0" stop-color="#d1f56e" stop-opacity="0" />
		<stop offset=".286" stop-color="#d1f56e" />
		<stop offset="1" stop-color="#d1f56e" stop-opacity="0" />
	</linearGradient>
	<path fill="url(#SVGWck7IemC)" d="M54.9 39.7L99.3 14c24.7-10.6 51.6-7.5 72.9.2c18.3 6.6 32.5 18 40.3 32.5c-58-28.5-67.4-38.8-157.6-7" />
	<radialGradient id="SVGXRCc0dgH" cx="-705.862" cy="871.903" r="18.286" gradientTransform="rotate(-64.852 -3716.439 16100.6)scale(-17.6305 14.9182)" gradientUnits="userSpaceOnUse">
		<stop offset="0" stop-color="#fffb98" />
		<stop offset=".505" stop-color="#ffd84c" />
		<stop offset="1" stop-color="#e6b534" />
	</radialGradient>
	<path fill="url(#SVGXRCc0dgH)" d="M236.3 47.5C137.5 82.4 85.8 191.1 120.5 290.2l22.9 65.1c25.7 72.9 91.2 120.4 163.3 126.3c13.6 1.1 26.3 7 36.5 16.2c14.6 13.2 35.6 18.1 55.3 11.1s33.1-24 36.3-43.4c2.1-13.6 8.3-25.9 18.2-35.5c52.4-50.2 73.8-128.2 48.1-201.2l-22.9-65.1C443.5 64.3 335.1 12.4 236.3 47.5" />
	<radialGradient id="SVGlhyJaduq" cx="-679.252" cy="829.813" r="18.286" gradientTransform="rotate(249.334 2724.65 15623.41)scale(-26.7531 22.6372)" gradientUnits="userSpaceOnUse">
		<stop offset=".522" stop-color="#ffde67" stop-opacity="0" />
		<stop offset=".736" stop-color="#ffa457" stop-opacity=".2" />
		<stop offset=".886" stop-color="#d5676d" stop-opacity=".75" />
		<stop offset=".918" stop-color="#e88257" />
		<stop offset="1" stop-color="#f49754" />
	</radialGradient>
	<path fill="url(#SVGlhyJaduq)" d="M236.3 47.5C137.5 82.4 85.8 191.1 120.5 290.2l22.9 65.1c25.7 72.9 91.2 120.4 163.3 126.3c13.6 1.1 26.3 7 36.5 16.2c14.6 13.2 35.6 18.1 55.3 11.1s33.1-24 36.3-43.4c2.1-13.6 8.3-25.9 18.2-35.5c52.4-50.2 73.8-128.2 48.1-201.2l-22.9-65.1C443.5 64.3 335.1 12.4 236.3 47.5" />
	<radialGradient id="SVG5yqijddO" cx="-701.727" cy="809.385" r="18.286" gradientTransform="rotate(236.122 8381.207 26975.646)scale(-51.359 43.4576)" gradientUnits="userSpaceOnUse">
		<stop offset=".708" stop-color="#d5b638" />
		<stop offset=".874" stop-color="#d5b638" stop-opacity="0" />
	</radialGradient>
	<path fill="url(#SVG5yqijddO)" d="M236.3 47.5C137.5 82.4 85.8 191.1 120.5 290.2l22.9 65.1c25.7 72.9 91.2 120.4 163.3 126.3c13.6 1.1 26.3 7 36.5 16.2c14.6 13.2 35.6 18.1 55.3 11.1s33.1-24 36.3-43.4c2.1-13.6 8.3-25.9 18.2-35.5c52.4-50.2 73.8-128.2 48.1-201.2l-22.9-65.1C443.5 64.3 335.1 12.4 236.3 47.5" />
</svg>`,
    appmanager: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<path fill="#dcaf74" d="M11.783.249c-.075 0-.142.038-.197.127c-.208 1.515-.182 1.451-.53 3.616c-.045.35-.244 1.257-.36 1.806c-.109.55-.372 1.312-.561 2.06q-.27 1.106-.77 2.47a43 43 0 0 1-1.148 2.81q-.648 1.43-1.66 3.078a31 31 0 0 1-2.201 3.146q-.54.675-1.122 1.27c-.966 1.008-1.647 1.624-3.131 2.88c-.536.573 1.167-.066 1.53-.24c.842-.402.99-.493 1.71-.986c.668-.514 1.292-1.123 1.593-1.411q.5-.473 1.567-1.783c1.611-.8 5.132-1.44 6.994-1.387c2.984.076 4.214.741 5.137 2.548c.207.468.458 1.004.683 1.5q.35.743.838 1.363q.5.635.931.635q.42 0 1.148-.419q.73-.405 1.283-.904c.378-.324.483-.515.483-.668q0-.067-.04-.094q-.028-.027-.095-.014a.6.6 0 0 0-.122.014c-.045.009-.01-.026-.064-.008a.6.6 0 0 1-.122.013q-.648 0-1.66-1.58q-1-1.593-2.12-4.078a356 356 0 0 1-2.215-5.077c-.729-1.728-1.557-3.372-2.313-5.029q-1.134-2.484-1.876-3.605c-.366-.562-1.131-2.049-1.59-2.053m.916 6.615c-.007.122.825 1.594 2.149 4.612q2.025 4.618 2.025 4.767l-.027.014q-.04 0-.405-.068a11.6 11.6 0 0 0-2.336-.243q-3.173 0-6.414 1.58q1.093-1.485 1.998-3.133q.918-1.647 1.432-2.93q.526-1.283.877-2.363q.365-1.08.514-1.661c.093-.335.173-.537.187-.575" />
</svg>`,
    about: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
	<circle cx="24" cy="24" r="21" fill="#2196F3" />
	<path fill="#fff" d="M22 22h4v11h-4z" />
	<circle cx="24" cy="16.5" r="2.5" fill="#fff" />
</svg>`,
    airplane: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<path fill="#e6e7e8" d="M19.994 28.658c0 1.138-.744 2.058-1.661 2.058s-1.659-.92-1.659-2.058v-5.612c0-1.139.742-2.06 1.659-2.06s1.661.921 1.661 2.06zM14.186 33c0 1.111-.744 2.02-1.659 2.02s-1.659-.905-1.659-2.02v-5.492c0-1.114.744-2.02 1.659-2.02s1.659.903 1.659 2.02zm29.904-4.184c0 1.136.744 2.06 1.66 2.06s1.657-.924 1.657-2.06v-5.613c0-1.137-.742-2.059-1.657-2.059c-.916 0-1.66.922-1.66 2.059zm5.805 4.344c0 1.116.742 2.02 1.656 2.02c.917 0 1.661-.9 1.661-2.02v-5.491c0-1.112-.744-2.02-1.661-2.02c-.914 0-1.656.903-1.656 2.02z" />
	<path fill="#27aae1" d="m32.15 17.614l-.028.009l-.029-.009L.003 37.329c.455 1.938 2.612 3.418 5.225 3.434l22.13-6.146l4.657 3.553l.021.004h.02l4.737-3.672l22.03 6.538c2.608.016 4.782-1.443 5.25-3.378l-31.918-20.05" />
	<path fill="#24a2ce" d="m2.547 40.17l29.547-18.16l.029.009l.028-.009l29.391 18.463c1.304-.598 2.26-1.61 2.55-2.814l-31.919-20.05l-.029.009l-.028-.009L.026 37.324c.282 1.205 1.224 2.231 2.524 2.842" />
	<path fill="#aaacad" d="m32.359 8.197l3.533-.394s-1.745-6.757-3.684-6.801L32.207 1l-.004.002h-.008c-1.939.023-3.741 6.764-3.741 6.764l3.529.428v.044l.184-.022l.19.022z" />
	<path fill="#c0c5c8" d="M32.24 6.59a12 12 0 0 1-3.298-.468c-1.428 4.321-2.673 11.736-2.217 24.324c0 0 1.077 7.279 2.273 14.825l1.318 16.431c.771.278 1.543.008 1.543.008c.023-.035.043-.102.066-.163l.055.163s.775.282 1.547.008l1.48-16.407c1.27-7.532 2.417-14.803 2.417-14.803c.579-12.56-.596-19.988-1.979-24.329c-.949.273-2.02.421-3.205.411" />
	<path fill="#aaacad" d="m33.14 61.717l-1.318-16.423a1666 1666 0 0 1-2.274-14.833c-.446-12.207.717-19.54 2.088-23.916c-.968-.051-1.878-.184-2.695-.424c-1.428 4.321-2.673 11.736-2.217 24.324c0 0 1.077 7.279 2.273 14.825l1.318 16.431c.771.278 1.543.008 1.543.008c.023-.035.043-.102.066-.163l.055.163s.65.227 1.357.061a1.4 1.4 0 0 1-.196-.053" />
	<path fill="#27aae1" d="M40.815 58.17c-.004.633-.666 1.146-1.477 1.14l-7.402-.789l-7.395.705c-.814-.004-1.473-.521-1.469-1.155l.016-3.02c0-.631.662-1.144 1.477-1.142l7.399-1.079l7.402 1.167c.811.004 1.469.528 1.465 1.163z" />
	<path fill="#24a2ce" d="m39.37 54.01l-7.402-1.167l-7.399 1.079c-.814-.002-1.477.511-1.477 1.142l-.012 1.919c.002-.639.666-1.147 1.479-1.14l7.399-1.087l7.396 1.169c.818.004 1.477.527 1.469 1.159l.012-1.911c.004-.635-.654-1.159-1.465-1.163" />
	<path fill="#fff" d="M28.18 11.572s3.981-5.19 7.978-.03c0 0-3.869-2.464-7.978.03" />
</svg>`,
    bluetooth: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<path fill="#0a3d91" d="M240.8 0h30.4c84.3 0 152.7 68.3 152.7 152.7v206.7c0 84.3-68.3 152.7-152.7 152.7h-30.4c-84.3 0-152.7-68.3-152.7-152.7V152.7C88.1 68.3 156.5 0 240.8 0" />
	<path fill="#fff" d="M239.5 466.2V291.8l-59.3 58.1l-19.4-19.9l74-72.5l-74.1-74.6l19.7-19.6l59.1 59.5V56.6l110.1 127.3l-75.4 73.9l75.1 75.5zm27.8-175.9v98.6l44.5-53.9zm0-159.1v94.4l44.2-43.3z" />
</svg>`,
    brightness: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
	<g fill="none">
		<path fill="#ffef5e" d="m20.094 15.352l2.59-2.59a1.08 1.08 0 0 0 0-1.526l-2.59-2.59v-3.66a1.08 1.08 0 0 0-1.08-1.08h-3.659l-2.59-2.59a1.08 1.08 0 0 0-1.526 0l-2.59 2.59H4.985a1.08 1.08 0 0 0-1.079 1.08v3.662l-2.59 2.59a1.08 1.08 0 0 0 0 1.526l2.59 2.59v3.66c0 .597.483 1.08 1.08 1.08h3.662l2.59 2.59a1.08 1.08 0 0 0 1.526 0l2.59-2.59h3.663a1.08 1.08 0 0 0 1.08-1.08z" />
		<path fill="#ffbc44" d="M11.46 5.525c4.317 0 6.476 2.899 6.476 6.475s-2.159 6.475-6.476 6.475z" />
		<path stroke="#191919" stroke-linecap="round" stroke-linejoin="round" d="m20.094 15.352l2.59-2.59a1.08 1.08 0 0 0 0-1.526l-2.59-2.59v-3.66a1.08 1.08 0 0 0-1.08-1.08h-3.659l-2.59-2.59a1.08 1.08 0 0 0-1.526 0l-2.59 2.59H4.985a1.08 1.08 0 0 0-1.079 1.08v3.662l-2.59 2.59a1.08 1.08 0 0 0 0 1.526l2.59 2.59v3.66c0 .597.483 1.08 1.08 1.08h3.662l2.59 2.59a1.08 1.08 0 0 0 1.526 0l2.59-2.59h3.663a1.08 1.08 0 0 0 1.08-1.08z" />
		<path stroke="#191919" stroke-linecap="round" stroke-linejoin="round" d="M11.46 5.525c4.317 0 6.476 2.899 6.476 6.475s-2.159 6.475-6.476 6.475z" />
	</g>
</svg>`,
};
function iconHtml(key, fallback){
	return ICONS[key]? `<span class="icon-svg">${ICONS[key]}</span>`:(fallback||'');
}

/* ---------------------- STATE ---------------------- */
let state = loadState();

function defaultState(){
	return {
		onboarded:false,
		avatarEmoji:'🧑',
		settings:{ theme:'aurora', wallpaper:'default', volume:64, brightness:80, wifi:true, bluetooth:true, dnd:true, airplane:true, username:'Guest' },
		installedApps:[], // extra apps from software hub
		installedGames:[],
		notification:[],
		recents:[],
		notes:[
			{id:uid('note'), title:'Welcome to Zen OS', content:'This is your notes app. Everything you write is saved locally in your browser.',
				pinned:true, category:'General', updated:nowStr()}
		],
		events:[],
		fs:{
		name:'Home', type:'folder', id:'root', children:[
			{id:uid('f'), name:'Documents', type:'folder', children:[
				{id:uid('f'), name:'Getting Started.txt', type:'file', content:'Welcome to Zen OS! \n\nThis whole environment runs in your browser — no servers, no accounts, just local state.\n\nTry the Terminal, install something from the Software Hub, or open a game.'}
			]},
			{id:uid('f'), name:'Pictures', type:'folder', children:[]},
			{id:uid('f'), name:'Downloads', type:'folder', children:[]},
		]
		},
		calcHistory:[],
		browserHistory:[],
		browserBookmarks:[{title:'Wikipedia', url:'https://www.wikipedia.org'},{title:'Example.com', url:'https://example.com'}],
		customTracks:[],
		likedTracks:[],
	};
}

function loadState(){
	try{
		const raw = localStorage.getItem(LS_KEY);
		if(raw) return Object.assign(defaultState(), JSON.parse(raw));
	} catch(e){}
	return defaultState();
}
function saveState(){
	try{localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
}

/* ---------------------- WINDOW MANAGER ---------------------- */
let windows = []; //{id, appId, title, icon, x,y,w,h, minimized, maximized, prevRect, Z}
let zTop = 10;
let activeWinId = null;
const winInstances = {}; //per-window app-local runtime data (e.g. terminal history)

const windowLayer = document.getElementById('window-layer');

function openApp(appId, opts){
	opts = opts || {};
	// bring to front if singleton already open (for simple apps) unless opts.multi
	if(!opts.multi){
		const existing = windows.find(w=>w.appId===appId && !opts.forceNew);
		if(existing){ focusWindow(existing.id); if(existing.minimized) restoreWindow(existing.id); return existing.id; }
	}
	const meta = APP_REGISTRY[appId] || {name:appId, icon:'❔'};
	const id = uid('win');
	const count = windows.length;
	const w = { id, appId, title: opts.title || meta.name, icon: meta.icon, svgKey: meta.svgKey,
		x: 90 + (count%6)*36, y: 60 + (count%6)*30, w: opts.w||760, h:opts.h||520,
		minimized:false, maximized:false, z: ++zTop, data: opts.data||{} };
		windows.push(w);
		winInstances[id] = {cwd:['root'] };
		pushRecent(appId);
		renderWindow(w);
		renderWindow(w);
		focusWindow(id);
		return id;
}

function closeWindow(id){
	const el = document.getElementById(id);
	if(el){ el.classList.add('closing'); setTimeout(()=>el.remove(), 150); }
	windows = windows.filter(w=>w.id!==id);
	delete winInstances[id];
	renderTaskbarApps();
}
function minimizeWindow(){
	const w = windows.find(x=>x.id===id); if (!w) return;
	w.minimized = true;
	const el = document.getElementById(id); if(el) el.style.display="none";
	renderTaskbarApps();
}
function restorewindow(id){
	const w = windows.find(x=>x.id==id); if(!w) return;
	w.minimized = false;
	const el = document.getElementById(id); if(el) el.style.display='flex';
	focusWindow(id);
}
function toggleMaximize(id){
	const w = windows.find(x=>x.id===id); if(!w) return;
    const el = document.getElementById(id); if(!el) return;
	if(!w.maximized){
		w.prevRct = {x:w.x,y:w.y,w:w,h:w.h};
		w.maximized = true;
		el.classList.add('maximized');
		el.style.left='0px'; el.style.top='0px'; el.style.width='100w'; el.style.height='calc(100vh - 60px)';
	} else {
		w.maximized = false;
		el.classList.remove('maximized');
		const r = w.prevRct || {x:90,y:60, w:760, h:520};
		Object.assign(w, r);
		el.style.left=r.x+'px'; el.style.top=r.y+'px'; el.style.width=r.w+'px'; el.style.height= r.h+'px';
	}
}