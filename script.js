/* ============================================================
   ZenOS – Window Manager + core desktop logic
   Milestone 1: Real window ownership (position, size, z, focus,
   minimize, maximize, resize) while preserving existing apps.
   ============================================================ */

const MENU_BAR_HEIGHT = 28;
const DOCK_CLEARANCE = 90;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

/* ---------- Window Manager ---------- */
class WindowManager {
    constructor() {
        this.windows = new Map(); // id -> state
        this.zCounter = 100;
        this.focusedId = null;
        this.dragState = null;
        this.resizeState = null;

        this._bindGlobalEvents();
    }

    register(id, element, options = {}) {
        if (this.windows.has(id)) return;

        const rect = element.getBoundingClientRect();
        const state = {
            id,
            el: element,
            x: parseInt(element.style.left) || 100,
            y: parseInt(element.style.top) || 60,
            width: parseInt(element.style.width) || 700,
            height: parseInt(element.style.height) || 500,
            minimized: false,
            maximized: false,
            prevBounds: null,
            zIndex: ++this.zCounter,
            title: options.title || id
        };

        this.windows.set(id, state);
        this._applyState(state);
        this._ensureResizeHandles(element);
        this._wireHeader(element, id);
    }

    open(id) {
        const state = this.windows.get(id);
        if (!state) return;

        state.minimized = false;
        state.el.classList.remove('minimized');
        state.el.classList.add('active');
        this.focus(id);
        this._updateDockIndicator(id, true);
        this._applyState(state);
    }

    close(id) {
        const state = this.windows.get(id);
        if (!state) return;

        state.el.classList.remove('active', 'focused', 'minimized', 'maximized');
        state.minimized = false;
        state.maximized = false;
        this._updateDockIndicator(id, false);

        if (this.focusedId === id) {
            this.focusedId = null;
            // focus next highest
            let next = null;
            let highest = 0;
            for (const [wid, s] of this.windows) {
                if (s.el.classList.contains('active') && !s.minimized && s.zIndex > highest) {
                    highest = s.zIndex;
                    next = wid;
                }
            }
            if (next) this.focus(next);
        }
    }

    minimize(id) {
        const state = this.windows.get(id);
        if (!state || state.minimized) return;

        state.minimized = true;
        state.el.classList.add('minimized');
        state.el.classList.remove('focused');
        this._updateDockIndicator(id, true);

        if (this.focusedId === id) {
            this.focusedId = null;
        }
    }

    restore(id) {
        const state = this.windows.get(id);
        if (!state) return;

        if (state.minimized) {
            state.minimized = false;
            state.el.classList.remove('minimized');
            state.el.classList.add('active');
            this.focus(id);
        } else if (state.maximized) {
            this._restoreFromMaximize(state);
        }
    }

    maximize(id) {
        const state = this.windows.get(id);
        if (!state) return;

        if (state.maximized) {
            this._restoreFromMaximize(state);
        } else {
            state.prevBounds = {
                x: state.x,
                y: state.y,
                width: state.width,
                height: state.height
            };
            state.maximized = true;
            state.el.classList.add('maximized');
            state.x = 0;
            state.y = MENU_BAR_HEIGHT;
            state.width = window.innerWidth;
            state.height = window.innerHeight - MENU_BAR_HEIGHT;
            this._applyState(state);
            this.focus(id);
        }
    }

    focus(id) {
        const state = this.windows.get(id);
        if (!state || state.minimized) return;

        // unfocus others
        for (const [wid, s] of this.windows) {
            s.el.classList.toggle('focused', wid === id);
        }

        state.zIndex = ++this.zCounter;
        state.el.style.zIndex = state.zIndex;
        this.focusedId = id;
        state.el.classList.add('active');
        this._updateDockActive(id);
    }

    setPosition(id, x, y) {
        const state = this.windows.get(id);
        if (!state || state.maximized) return;
        state.x = x;
        state.y = y;
        this._clamp(state);
        this._applyState(state);
    }

    setSize(id, width, height) {
        const state = this.windows.get(id);
        if (!state || state.maximized) return;
        state.width = Math.max(MIN_WIDTH, width);
        state.height = Math.max(MIN_HEIGHT, height);
        this._clamp(state);
        this._applyState(state);
    }

    isOpen(id) {
        const state = this.windows.get(id);
        return state && state.el.classList.contains('active') && !state.minimized;
    }

    isMinimized(id) {
        const state = this.windows.get(id);
        return state && state.minimized;
    }

    /* ----- internal helpers ----- */
    _applyState(state) {
        const el = state.el;
        el.style.left = state.x + 'px';
        el.style.top = state.y + 'px';
        el.style.width = state.width + 'px';
        el.style.height = state.height + 'px';
        el.style.zIndex = state.zIndex;
    }

    _clamp(state) {
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 60;
        state.x = Math.max(0, Math.min(state.x, maxX));
        state.y = Math.max(MENU_BAR_HEIGHT, Math.min(state.y, maxY));
        state.width = Math.min(state.width, window.innerWidth);
        state.height = Math.min(state.height, window.innerHeight - MENU_BAR_HEIGHT);
    }

    _restoreFromMaximize(state) {
        if (!state.prevBounds) return;
        state.maximized = false;
        state.el.classList.remove('maximized');
        state.x = state.prevBounds.x;
        state.y = state.prevBounds.y;
        state.width = state.prevBounds.width;
        state.height = state.prevBounds.height;
        state.prevBounds = null;
        this._applyState(state);
    }

    _ensureResizeHandles(el) {
        if (el.querySelector('.resize-handle')) return;
        const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        dirs.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${dir}`;
            handle.dataset.dir = dir;
            el.appendChild(handle);
        });
    }

    _wireHeader(el, id) {
        const header = el.querySelector('.window-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-control')) return;
            this.focus(id);
            const state = this.windows.get(id);
            if (state.maximized) return;

            this.dragState = {
                id,
                startX: e.clientX,
                startY: e.clientY,
                origX: state.x,
                origY: state.y
            };
            e.preventDefault();
        });

        // resize handles
        el.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.focus(id);
                const state = this.windows.get(id);
                if (state.maximized) return;

                this.resizeState = {
                    id,
                    dir: handle.dataset.dir,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: state.x,
                    origY: state.y,
                    origW: state.width,
                    origH: state.height
                };
                e.preventDefault();
            });
        });

        // click anywhere on window focuses it
        el.addEventListener('mousedown', () => this.focus(id));
    }

    _bindGlobalEvents() {
        document.addEventListener('mousemove', (e) => {
            if (this.dragState) {
                const s = this.windows.get(this.dragState.id);
                if (!s) return;
                const dx = e.clientX - this.dragState.startX;
                const dy = e.clientY - this.dragState.startY;
                s.x = this.dragState.origX + dx;
                s.y = this.dragState.origY + dy;
                this._clamp(s);
                this._applyState(s);
            }

            if (this.resizeState) {
                const s = this.windows.get(this.resizeState.id);
                if (!s) return;
                const dx = e.clientX - this.resizeState.startX;
                const dy = e.clientY - this.resizeState.startY;
                const dir = this.resizeState.dir;
                let { origX, origY, origW, origH } = this.resizeState;

                if (dir.includes('e')) s.width = Math.max(MIN_WIDTH, origW + dx);
                if (dir.includes('s')) s.height = Math.max(MIN_HEIGHT, origH + dy);
                if (dir.includes('w')) {
                    const newW = Math.max(MIN_WIDTH, origW - dx);
                    s.x = origX + (origW - newW);
                    s.width = newW;
                }
                if (dir.includes('n')) {
                    const newH = Math.max(MIN_HEIGHT, origH - dy);
                    s.y = origY + (origH - newH);
                    s.height = newH;
                }
                this._clamp(s);
                this._applyState(s);
            }
        });

        document.addEventListener('mouseup', () => {
            this.dragState = null;
            this.resizeState = null;
        });

        window.addEventListener('resize', () => {
            for (const state of this.windows.values()) {
                if (state.maximized) {
                    state.width = window.innerWidth;
                    state.height = window.innerHeight - MENU_BAR_HEIGHT;
                    this._applyState(state);
                } else {
                    this._clamp(state);
                    this._applyState(state);
                }
            }
        });
    }

    _updateDockIndicator(id, hasWindow) {
        const item = document.querySelector(`.dock-item[data-app="${id}"]`);
        if (item) item.classList.toggle('has-window', hasWindow);
    }

    _updateDockActive(id) {
        document.querySelectorAll('.dock-item').forEach(item => {
            item.classList.toggle('active', item.dataset.app === id);
        });
    }
}

/* ---------- Global instance ---------- */
const wm = new WindowManager();

/* ---------- Compatibility API (keeps existing HTML working) ---------- */
function openApp(appId) {
    if (!wm.windows.has(appId)) {
        const el = document.getElementById(appId + 'Window');
        if (el) wm.register(appId, el);
    }

    if (wm.isMinimized(appId)) {
        wm.restore(appId);
    } else if (wm.isOpen(appId)) {
        wm.focus(appId);
    } else {
        wm.open(appId);
    }

    // special focus for terminal
    if (appId === 'terminal') {
        const input = document.getElementById('terminalInput');
        if (input) setTimeout(() => input.focus(), 50);
    }
}

function closeApp(appId) {
    wm.close(appId);
}

function minimizeApp(appId) {
    wm.minimize(appId);
    showNotification('Minimized', `${appId} minimized to Dock`);
}

function maximizeApp(appId) {
    wm.maximize(appId);
}

/* ---------- Desktop init ---------- */
function initDesktop() {
    // Register all existing windows
    const appIds = [
        'zen', 'textedit', 'notes', 'paint', 'calculator',
    'calendar', 'videoEditor', 'preferences', 'terminal', 'preview'
    ];

    appIds.forEach(id => {
        const el = document.getElementById(id + 'Window');
        if (el) {
            wm.register(id, el, { title: id });
            // start closed except finder
            el.classList.remove('active');
        }
    });

    updateTime();
    setInterval(updateTime, 1000);
    initializePaint();
    initializeCalendar();
    setupKeyboardShortcuts();

    // Open Zen by default
    openApp('zen');

    setTimeout(() => {
        showNotification('Welcome to ZenOS', 'Window Manager is now active. Drag, resize, minimize and maximize freely.');
    }, 800);
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const el = document.getElementById('desktopTime');
    if (el) el.textContent = timeString;
}

/* ---------- Menus / Spotlight / Notifications (unchanged logic) ---------- */
function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    document.querySelectorAll('.menu-dropdown').forEach(m => {
        if (m.id !== menuId) m.classList.remove('active');
    });
    menu.classList.toggle('active');
}

function showNotification(title, message) {
    const notification = document.getElementById('notification');
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function activateSpotlight() {
    const spotlight = document.getElementById('spotlight');
    const search = document.getElementById('spotlightSearch');
    spotlight.classList.add('active');
    search.value = '';
    search.focus();
    spotlightSearch('');
}

function deactivateSpotlight() {
    document.getElementById('spotlight').classList.remove('active');
}

function spotlightSearch(query) {
    const apps = [
        { name: 'Zen', id: 'zen', icon: '☯️' },
        { name: 'TextEdit', id: 'textedit', icon: '📝' },
        { name: 'Notes', id: 'notes', icon: '📋' },
        { name: 'Paint', id: 'paint', icon: '🎨' },
        { name: 'Calculator', id: 'calculator', icon: '🔢' },
        { name: 'Calendar', id: 'calendar', icon: '📅' },
        { name: 'Video Editor', id: 'videoEditor', icon: '🎬' },
        { name: 'Terminal', id: 'terminal', icon: '💻' },
        { name: 'Preview', id: 'preview', icon: '🖼️' },
        { name: 'System Preferences', id: 'preferences', icon: '⚙️' }
    ];
    const filtered = query
        ? apps.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
        : apps;
    updateSpotlightResults(filtered);
}

function updateSpotlightResults(apps) {
    const container = document.getElementById('spotlightResults');
    container.innerHTML = '';
    apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'spotlight-item';
        item.innerHTML = `<span class="spotlight-icon">${app.icon}</span><span>${app.name}</span>`;
        item.onclick = () => {
            openApp(app.id);
            deactivateSpotlight();
        };
        container.appendChild(item);
    });
}

/* ---------- Calculator ---------- */
let calculatorState = {
    currentNumber: '0',
    previousNumber: '',
    operation: null,
    waitingForOperand: false
};

function calcNumber(num) {
    if (calculatorState.waitingForOperand) {
        calculatorState.currentNumber = num;
        calculatorState.waitingForOperand = false;
    } else {
        calculatorState.currentNumber =
            calculatorState.currentNumber === '0' ? num : calculatorState.currentNumber + num;
    }
    updateCalcDisplay();
}

function calcOperation(op) {
    calculatorState.operation = op;
    calculatorState.waitingForOperand = true;
    calculatorState.previousNumber = calculatorState.currentNumber;
}

function calcAdd() { calcOperation('+'); }
function calcSubtract() { calcOperation('-'); }
function calcMultiply() { calcOperation('*'); }
function calcDivide() { calcOperation('/'); }

function calcEquals() {
    if (!calculatorState.operation) return;
    const prev = parseFloat(calculatorState.previousNumber);
    const current = parseFloat(calculatorState.currentNumber);
    let result;
    switch (calculatorState.operation) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '*': result = prev * current; break;
        case '/': result = current !== 0 ? prev / current : 'Error'; break;
        default: return;
    }
    calculatorState.currentNumber = String(result);
    calculatorState.operation = null;
    calculatorState.previousNumber = '';
    calculatorState.waitingForOperand = true;
    updateCalcDisplay();
}

function calcClear() {
    calculatorState = { currentNumber: '0', previousNumber: '', operation: null, waitingForOperand: false };
    updateCalcDisplay();
}

function calcClearEntry() {
    calculatorState.currentNumber = '0';
    updateCalcDisplay();
}

function calcPercent() {
    calculatorState.currentNumber = String(parseFloat(calculatorState.currentNumber) / 100);
    updateCalcDisplay();
}

function calcDecimal() {
    if (calculatorState.waitingForOperand) {
        calculatorState.currentNumber = '0.';
        calculatorState.waitingForOperand = false;
    } else if (!calculatorState.currentNumber.includes('.')) {
        calculatorState.currentNumber += '.';
    }
    updateCalcDisplay();
}

function updateCalcDisplay() {
    document.getElementById('calcDisplay').textContent = calculatorState.currentNumber || '0';
}

/* ---------- TextEdit helpers ---------- */
function textBold() { document.execCommand('bold'); document.getElementById('textContent').focus(); }
function textItalic() { document.execCommand('italic'); document.getElementById('textContent').focus(); }
function textUnderline() { document.execCommand('underline'); document.getElementById('textContent').focus(); }
function textAlign(align) {
    document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
    document.getElementById('textContent').focus();
}
function textChangeColor(color) { document.execCommand('foreColor', false, color); }
function textChangeSize(size) {
    document.execCommand('fontSize', false, '7');
    document.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size;
    });
}
function textSave() { showNotification('Saved', 'Document saved'); }
function textOpen() { showNotification('Open', 'Open dialog (not yet implemented)'); }

/* ---------- Paint ---------- */
let paintTool = 'brush';
let paintColor = '#000000';
let paintSize = 5;
let isDrawing = false;

function initializePaint() {
    const canvas = document.getElementById('paintCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const canvas = document.getElementById('paintCanvas');
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
    if (!isDrawing) return;
    const canvas = document.getElementById('paintCanvas');
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = paintSize;
    ctx.lineCap = 'round';
    if (paintTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = paintColor;
    } else {
        ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function paintSelectTool(tool) {
    paintTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.closest('.tool-btn')?.classList.add('active');
}

function paintChangeColor(c) { paintColor = c; }
function paintChangeSize(s) { paintSize = parseInt(s); }
function paintClear() {
    const canvas = document.getElementById('paintCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function paintSave() { showNotification('Saved', 'Drawing saved'); }

/* ---------- Calendar ---------- */
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function initializeCalendar() {
    updateCalendarDisplay();
}

function updateCalendarDisplay() {
    const monthYear = document.getElementById('calendarMonthYear');
    const view = document.getElementById('calendarView');
    if (!monthYear || !view) return;

    const names = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    monthYear.textContent = `${names[currentMonth]} ${currentYear}`;

    const headers = [...view.querySelectorAll('.calendar-day-header')];
    view.innerHTML = '';
    headers.forEach(h => view.appendChild(h));

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();
    const today = new Date();
    const isCurrent = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

    for (let i = firstDay - 1; i >= 0; i--) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.textContent = daysInPrev - i;
        view.appendChild(d);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const d = document.createElement('div');
        d.className = 'calendar-day';
        if (isCurrent && day === today.getDate()) d.classList.add('today');
        d.textContent = day;
        d.onclick = () => {
            view.querySelectorAll('.calendar-day').forEach(x => x.classList.remove('selected'));
            d.classList.add('selected');
        };
        view.appendChild(d);
    }

    const total = view.children.length - 7;
    for (let day = 1; total + day <= 35; day++) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.textContent = day;
        view.appendChild(d);
    }
}

function calendarPreviousMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateCalendarDisplay();
}

function calendarNextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateCalendarDisplay();
}

/* ---------- Terminal ---------- */
let terminalHistory = [];
let terminalIndex = 0;

function terminalKeyPress(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('terminalInput');
        const cmd = input.value.trim();
        if (cmd) {
            executeCommand(cmd);
            terminalHistory.push(cmd);
            terminalIndex = terminalHistory.length;
            input.value = '';
        }
    } else if (e.key === 'ArrowUp') {
        if (terminalIndex > 0) {
            terminalIndex--;
            document.getElementById('terminalInput').value = terminalHistory[terminalIndex];
        }
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        if (terminalIndex < terminalHistory.length - 1) {
            terminalIndex++;
            document.getElementById('terminalInput').value = terminalHistory[terminalIndex];
        } else {
            terminalIndex = terminalHistory.length;
            document.getElementById('terminalInput').value = '';
        }
        e.preventDefault();
    }
}

function executeCommand(command) {
    const body = document.getElementById('terminalBody');
    const line = document.createElement('div');
    line.textContent = `zenos@localhost:~$ ${command}`;
    body.insertBefore(line, body.lastElementChild);

    const resp = document.createElement('div');
    resp.style.marginLeft = '12px';

    const cmd = command.toLowerCase();
    switch (cmd) {
        case 'help':
            resp.innerHTML = `Available commands:<br>
  help     – this message<br>
  clear    – clear terminal<br>
  date     – current date/time<br>
  ls       – list (virtual)<br>
  pwd      – print working directory<br>
  echo …   – print text<br>
  apps     – list applications<br>
  open …   – open an application<br>
  exit     – close terminal`;
            break;
        case 'clear':
            [...body.querySelectorAll('div')].forEach((d, i, arr) => {
                if (i < arr.length - 1) d.remove();
            });
            return;
        case 'date':
            resp.textContent = new Date().toString();
            break;
        case 'ls':
            resp.innerHTML = 'Desktop  Documents  Downloads<br>Pictures  Movies  Music<br>Applications  Utilities';
            break;
        case 'pwd':
            resp.textContent = '/Users/ZenOS';
            break;
        case 'apps':
            resp.textContent = 'finder textedit notes paint calculator calendar videoEditor preferences terminal preview';
            break;
        case 'exit':
            closeApp('terminal');
            return;
        default:
            if (cmd.startsWith('echo ')) {
                resp.textContent = command.slice(5);
            } else if (cmd.startsWith('open ')) {
                const app = command.slice(5).trim();
                openApp(app);
                resp.textContent = `Opening ${app}…`;
            } else {
                resp.textContent = `zenos: command not found: ${command}`;
            }
    }

    body.insertBefore(resp, body.lastElementChild);
    body.scrollTop = body.scrollHeight;
}

/* ---------- Finder stubs ---------- */
function finderNavigateBack() { showNotification('Finder', 'Back'); }
function finderNavigateForward() { showNotification('Finder', 'Forward'); }
function finderNavigateUp() { showNotification('Finder', 'Up'); }
function finderNavigateToPath(p) { showNotification('Finder', `Path: ${p}`); }
function finderCreateFolder() { showNotification('Finder', 'New Folder'); }
function finderChangeView() { showNotification('Finder', 'View changed'); }
function finderSelectFavorite(el, folder) {
    document.querySelectorAll('.favorites-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const paths = {
        desktop: '/Users/ZenOS/Desktop',
        documents: '/Users/ZenOS/Documents',
        downloads: '/Users/ZenOS/Downloads',
        pictures: '/Users/ZenOS/Pictures',
        movies: '/Users/ZenOS/Movies',
        music: '/Users/ZenOS/Music',
        applications: '/Applications',
        utilities: '/Applications/Utilities'
    };
    const input = document.querySelector('.finder-path');
    if (input) input.value = paths[folder] || '/Users/ZenOS';
}
function finderSelectFile(el) {
    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
}

/* ---------- Video / Preview / Prefs stubs ---------- */
function videoNewProject() { showNotification('Video', 'New project'); }
function videoImport() { showNotification('Video', 'Import'); }
function videoExport() { showNotification('Video', 'Export'); }
function videoCut() { showNotification('Video', 'Cut'); }
function videoCopy() { showNotification('Video', 'Copy'); }
function videoPaste() { showNotification('Video', 'Paste'); }
function videoAddTransition() { showNotification('Video', 'Transition'); }
function videoAddText() { showNotification('Video', 'Text'); }
function videoAddEffect() { showNotification('Video', 'Effect'); }
function videoPlay() { showNotification('Video', 'Play'); }
function videoPause() { showNotification('Video', 'Pause'); }
function videoStop() { showNotification('Video', 'Stop'); }
function selectTimelineTrack(t) {
    document.querySelectorAll('.timeline-track').forEach(x => x.style.background = '#555');
    t.style.background = '#007aff';
}

function selectPrefsSection(section) {
    document.querySelectorAll('.prefs-section').forEach(s => s.classList.remove('active'));
    section.classList.add('active');
}
function toggleSwitch(el) { el.classList.toggle('active'); }

function previewOpen() { showNotification('Preview', 'Open image'); }
function previewZoomIn() { showNotification('Preview', 'Zoom +'); }
function previewZoomOut() { showNotification('Preview', 'Zoom -'); }
function previewFit() { showNotification('Preview', 'Fit'); }
function previewRotate() { showNotification('Preview', 'Rotate'); }
function previewCrop() { showNotification('Preview', 'Crop'); }

function minimizeAllWindows() {
    for (const id of wm.windows.keys()) {
        if (wm.isOpen(id)) wm.minimize(id);
    }
    showNotification('Windows', 'All minimized');
}

function showAllWindows() {
    for (const id of wm.windows.keys()) {
        if (wm.isMinimized(id)) wm.restore(id);
    }
    showNotification('Windows', 'All restored');
}

/* ---------- Keyboard ---------- */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const meta = e.metaKey || e.ctrlKey;

        if (meta && e.code === 'Space') {
            e.preventDefault();
            activateSpotlight();
        }
        if (meta && e.key === 'w') {
            e.preventDefault();
            if (wm.focusedId) closeApp(wm.focusedId);
        }
        if (meta && e.key === 'm') {
            e.preventDefault();
            if (wm.focusedId) minimizeApp(wm.focusedId);
        }
        if (e.key === 'Escape') {
            deactivateSpotlight();
            document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('active'));
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-item') && !e.target.closest('.menu-dropdown')) {
        document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('active'));
    }
    if (!e.target.closest('#spotlight') && !e.target.closest('.menu-item')) {
        deactivateSpotlight();
    }
});

/* ---------- Zen Assistant ---------- */
function zenSend() {
    const input = document.getElementById('zenInput');
    const text = input.value.trim();
    if (!text) return;

    appendZenMessage(text, 'user');
    input.value = '';

    const status = document.getElementById('zenStatus');
    status.textContent = 'Thinking...';
    status.classList.add('thinking');

    //Simple local intent handling (no external AI yet)
    setTimeout(() => {
        const reply = zenProcess(text);
        appendZenMessage(reply, 'assistant');
        status.textContent = 'Ready';
        status.classList.remove('thinking');
    }, 400 + Math.random() * 400) ;

}

function appendZenMessage(text, role) {
    const container = document.getElementById('zenMessages');
    const msg = document.createElement('div');
    msg.className = `zen-message zen-${role}`;
    msg.innerHTML = `<div class="zen-bulle">${text}</div>`;
    container.appendChild(msg);
    container.scrollTop=container.scrollHeight;
}

function zenProcess(text) {
    const lower = text.toLowerCase().trim();

    //Open apps
    const openMatch = lower.match(/^(open|launch|start)\s+(.+)/);
    if (openMatch) {
        const appName = openMatch[2].replace(/[^a-z0-9]/g, '');
        const map = {
            terminal: 'terminal',
            textedit: 'textedit',
            notes: 'notes',
            paint: 'paint',
            calculator: 'calculator',
            calendar: 'calendar',
            preferences: 'preferences',
            settings: 'preferences',
            preview: 'preview',
            video: 'videoEditor',
            videoeditor: 'videoEditor'
        };
        const id = map[appName];
        if (id) {
            openApp(id);
            return `Opening ${openMatch[2]} for you.`;
        }
        return `I don't recognise the app "${openMatch[2]}". Try Terminal, Notes, Calculator, etc.`;
    }

    if (lower.includes('time') || lower.includes('what time')) {
        return `It's currently ${new Date().toLocaleTimeString()}.`;
    }
    if (lower.includes('date') || lower.includes('what day')) {
        return `Today is $ {new Date ().toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`; 
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return 'Hello. How can I help you today?';
    }
    if (lower,includes('help') || lower === '?') {
        return `I'm Zen, the built-in assistant for ZenOS. I live inside this desktop environment and can control system actions.`;
    }

    // Fallback
    return `I heard: "${text}".<br><br>I'm still learning. Try asking me to open an app or tell you the time.`;
}

// Allow Enter key in Zen input
document.addEventListener('DOMContentLoaded', () => {
    const zenInput = document.getElementById('zenInput');
    if (zenInput) {
        zenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                zenSend();
            }
        });
    }
});

/* ---------- Boot ---------- */
window.addEventListener('load', initDesktop);