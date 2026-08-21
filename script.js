/* ============================================================
   ZenOS – Window Manager + Action System + Zen Assistant
   Milestone: Controlled Action Layer for Zen
   ============================================================ */

const MENU_BAR_HEIGHT = 28;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

/* ============================================================
   WINDOW MANAGER
   ============================================================ */
class WindowManager {
    constructor() {
        this.windows = new Map();
        this.zCounter = 100;
        this.focusedId = null;
        this.dragState = null;
        this.resizeState = null;
        this._bindGlobalEvents();
    }

    register(id, element, options = {}) {
        if (this.windows.has(id)) return;
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
        if (!state) return false;
        state.minimized = false;
        state.el.classList.remove('minimized');
        state.el.classList.add('active');
        this.focus(id);
        this._updateDockIndicator(id, true);
        this._applyState(state);
        return true;
    }

    close(id) {
        const state = this.windows.get(id);
        if (!state) return false;
        state.el.classList.remove('active', 'focused', 'minimized', 'maximized');
        state.minimized = false;
        state.maximized = false;
        this._updateDockIndicator(id, false);
        if (this.focusedId === id) {
            this.focusedId = null;
            let next = null, highest = 0;
            for (const [wid, s] of this.windows) {
                if (s.el.classList.contains('active') && !s.minimized && s.zIndex > highest) {
                    highest = s.zIndex;
                    next = wid;
                }
            }
            if (next) this.focus(next);
        }
        return true;
    }

    minimize(id) {
        const state = this.windows.get(id);
        if (!state || state.minimized) return false;
        state.minimized = true;
        state.el.classList.add('minimized');
        state.el.classList.remove('focused');
        this._updateDockIndicator(id, true);
        if (this.focusedId === id) this.focusedId = null;
        return true;
    }

    restore(id) {
        const state = this.windows.get(id);
        if (!state) return false;
        if (state.minimized) {
            state.minimized = false;
            state.el.classList.remove('minimized');
            state.el.classList.add('active');
            this.focus(id);
            return true;
        }
        if (state.maximized) {
            this._restoreFromMaximize(state);
            return true;
        }
        return false;
    }

    maximize(id) {
        const state = this.windows.get(id);
        if (!state) return false;
        if (state.maximized) {
            this._restoreFromMaximize(state);
        } else {
            state.prevBounds = { x: state.x, y: state.y, width: state.width, height: state.height };
            state.maximized = true;
            state.el.classList.add('maximized');
            state.x = 0;
            state.y = MENU_BAR_HEIGHT;
            state.width = window.innerWidth;
            state.height = window.innerHeight - MENU_BAR_HEIGHT;
            this._applyState(state);
            this.focus(id);
        }
        return true;
    }

    focus(id) {
        const state = this.windows.get(id);
        if (!state || state.minimized) return false;
        for (const [wid, s] of this.windows) {
            s.el.classList.toggle('focused', wid === id);
        }
        state.zIndex = ++this.zCounter;
        state.el.style.zIndex = state.zIndex;
        this.focusedId = id;
        state.el.classList.add('active');
        this._updateDockActive(id);
        return true;
    }

    isOpen(id) {
        const s = this.windows.get(id);
        return s && s.el.classList.contains('active') && !s.minimized;
    }

    isMinimized(id) {
        const s = this.windows.get(id);
        return s && s.minimized;
    }

    listOpen() {
        const list = [];
        for (const [id, s] of this.windows) {
            if (s.el.classList.contains('active') && !s.minimized) list.push(id);
        }
        return list;
    }

    _applyState(state) {
        state.el.style.left = state.x + 'px';
        state.el.style.top = state.y + 'px';
        state.el.style.width = state.width + 'px';
        state.el.style.height = state.height + 'px';
        state.el.style.zIndex = state.zIndex;
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
        Object.assign(state, state.prevBounds);
        state.prevBounds = null;
        this._applyState(state);
    }

    _ensureResizeHandles(el) {
        if (el.querySelector('.resize-handle')) return;
        ['n','s','e','w','ne','nw','se','sw'].forEach(dir => {
            const h = document.createElement('div');
            h.className = `resize-handle ${dir}`;
            h.dataset.dir = dir;
            el.appendChild(h);
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
                id, startX: e.clientX, startY: e.clientY,
                origX: state.x, origY: state.y
            };
            e.preventDefault();
        });
        el.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.focus(id);
                const state = this.windows.get(id);
                if (state.maximized) return;
                this.resizeState = {
                    id, dir: handle.dataset.dir,
                    startX: e.clientX, startY: e.clientY,
                    origX: state.x, origY: state.y,
                    origW: state.width, origH: state.height
                };
                e.preventDefault();
            });
        });
        el.addEventListener('mousedown', () => this.focus(id));
    }

    _bindGlobalEvents() {
        document.addEventListener('mousemove', (e) => {
            if (this.dragState) {
                const s = this.windows.get(this.dragState.id);
                if (!s) return;
                s.x = this.dragState.origX + (e.clientX - this.dragState.startX);
                s.y = this.dragState.origY + (e.clientY - this.dragState.startY);
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

const wm = new WindowManager();

/* ============================================================
   ACTION SYSTEM  –  the only way Zen may affect the system
   ============================================================ */
const ActionSystem = {
    registry: new Map(),

    register(name, handler, meta = {}) {
        this.registry.set(name, {
            handler,
            description: meta.description || '',
            params: meta.params || []
        });
    },

    /**
     * Execute a registered action.
     * Returns { ok: boolean, result?: any, error?: string }
     */
    execute(name, params = {}) {
        const entry = this.registry.get(name);
        if (!entry) {
            return { ok: false, error: `Unknown action: ${name}` };
        }
        try {
            const result = entry.handler(params);
            return { ok: true, result };
        } catch (err) {
            return { ok: false, error: err.message || String(err) };
        }
    },

    list() {
        return Array.from(this.registry.entries()).map(([name, entry]) => ({
            name,
            description: entry.description,
            params: entry.params
        }));
    },

    has(name) {
        return this.registry.has(name);
    }
};

/* Register the core safe actions */
function registerCoreActions() {
    // App lifecycle
    ActionSystem.register('app.open', ({ id }) => {
        if (!id) throw new Error('Missing app id');
        const success = openApp(id);
        if (!success && !wm.windows.has(id)) throw new Error(`App not found: ${id}`);
        return { opened: id };
    }, { description: 'Open an application', params: ['id'] });

    ActionSystem.register('app.close', ({ id }) => {
        if (!id) throw new Error('Missing app id');
        wm.close(id);
        return { closed: id };
    }, { description: 'Close an application', params: ['id'] });

    ActionSystem.register('app.focus', ({ id }) => {
        if (!id) throw new Error('Missing app id');
        if (!wm.focus(id)) throw new Error(`Cannot focus: ${id}`);
        return { focused: id };
    }, { description: 'Focus an application window', params: ['id'] });

    ActionSystem.register('app.list', () => {
        return {
            available: ['zen','textedit','notes','paint','calculator','calendar','videoEditor','preferences','terminal','preview'],
            open: wm.listOpen()
        };
    }, { description: 'List available and open applications' });

    // Window controls
    ActionSystem.register('window.minimize', ({ id }) => {
        if (!id) throw new Error('Missing window id');
        wm.minimize(id);
        return { minimized: id };
    }, { description: 'Minimize a window', params: ['id'] });

    ActionSystem.register('window.maximize', ({ id }) => {
        if (!id) throw new Error('Missing window id');
        wm.maximize(id);
        return { maximized: id };
    }, { description: 'Maximize / restore a window', params: ['id'] });

    ActionSystem.register('window.restore', ({ id }) => {
        if (!id) throw new Error('Missing window id');
        wm.restore(id);
        return { restored: id };
    }, { description: 'Restore a minimized or maximized window', params: ['id'] });

    // System
    ActionSystem.register('system.time', () => {
        return { time: new Date().toLocaleTimeString(), iso: new Date().toISOString() };
    }, { description: 'Get current time' });

    ActionSystem.register('system.date', () => {
        const d = new Date();
        return {
            date: d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            iso: d.toISOString()
        };
    }, { description: 'Get current date' });

    ActionSystem.register('system.status', () => {
        return {
            openWindows: wm.listOpen(),
            focused: wm.focusedId,
            time: new Date().toLocaleTimeString()
        };
    }, { description: 'Get basic system status' });

    // Notifications
    ActionSystem.register('system.notify', ({ title, message }) => {
        showNotification(title || 'Zen', message || '');
        return { shown: true };
    }, { description: 'Show a system notification', params: ['title', 'message'] });

    // Terminal
    ActionSystem.register('terminal.open', () => {
        openApp('terminal');
        return { opened: 'terminal' };
    }, { description: 'Open the Terminal' });
}

/* ============================================================
   COMPATIBILITY LAYER (existing HTML still works)
   ============================================================ */
function openApp(appId) {
    if (!wm.windows.has(appId)) {
        const el = document.getElementById(appId + 'Window');
        if (el) wm.register(appId, el);
    }
    if (wm.isMinimized(appId)) {
        wm.restore(appId);
        return true;
    }
    if (wm.isOpen(appId)) {
        wm.focus(appId);
        return true;
    }
    return wm.open(appId);
}

function closeApp(appId) { wm.close(appId); }
function minimizeApp(appId) {
    wm.minimize(appId);
    showNotification('Minimized', `${appId} minimized to Dock`);
}
function maximizeApp(appId) { wm.maximize(appId); }

/* ============================================================
   DESKTOP INIT
   ============================================================ */
function initDesktop() {
    registerCoreActions();

    const appIds = [
        'zen', 'textedit', 'notes', 'paint', 'calculator',
        'calendar', 'videoEditor', 'preferences', 'terminal', 'preview'
    ];

    appIds.forEach(id => {
        const el = document.getElementById(id + 'Window');
        if (el) {
            wm.register(id, el, { title: id });
            el.classList.remove('active');
        }
    });

    updateTime();
    setInterval(updateTime, 1000);
    initializePaint();
    initializeCalendar();
    setupKeyboardShortcuts();
    setupZenInput();

    openApp('zen');

    setTimeout(() => {
        showNotification('ZenOS', 'Action System online. Zen can now control the desktop safely.');
    }, 900);
}

function updateTime() {
    const el = document.getElementById('desktopTime');
    if (el) {
        el.textContent = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    }
}

/* ============================================================
   MENUS / SPOTLIGHT / NOTIFICATIONS
   ============================================================ */
function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    document.querySelectorAll('.menu-dropdown').forEach(m => {
        if (m.id !== menuId) m.classList.remove('active');
    });
    menu.classList.toggle('active');
}

function showNotification(title, message) {
    const n = document.getElementById('notification');
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3000);
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
        item.onclick = () => { openApp(app.id); deactivateSpotlight(); };
        container.appendChild(item);
    });
}

/* ============================================================
   ZEN ASSISTANT  –  talks only through ActionSystem
   ============================================================ */
function setupZenInput() {
    const input = document.getElementById('zenInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            zenSend();
        }
    });
}

function zenSend() {
    const input = document.getElementById('zenInput');
    const text = input.value.trim();
    if (!text) return;

    appendZenMessage(text, 'user');
    input.value = '';

    const status = document.getElementById('zenStatus');
    status.textContent = 'Thinking…';
    status.classList.add('thinking');

    setTimeout(() => {
        const reply = zenProcess(text);
        appendZenMessage(reply, 'assistant');
        status.textContent = 'Ready';
        status.classList.remove('thinking');
    }, 350 + Math.random() * 350);
}

function appendZenMessage(html, role) {
    const container = document.getElementById('zenMessages');
    const msg = document.createElement('div');
    msg.className = `zen-message zen-${role}`;
    msg.innerHTML = `<div class="zen-bubble">${html}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

/**
 * Intent → Action mapping.
 * Zen never calls openApp / wm / DOM directly for system control.
 * Everything goes through ActionSystem.execute()
 */
function zenProcess(text) {
    const lower = text.toLowerCase().trim();

    // --- Open app ---
    const openMatch = lower.match(/^(open|launch|start|show)\s+(.+)/i);
    if (openMatch) {
        const raw = openMatch[2].trim();
        const id = resolveAppId(raw);
        if (!id) {
            return `I don’t recognise “${raw}”. Available apps: Terminal, Notes, Calculator, TextEdit, Paint, Calendar, Preferences, Preview, Video Editor.`;
        }
        const res = ActionSystem.execute('app.open', { id });
        if (res.ok) return `Opening <strong>${raw}</strong>.`;
        return `Could not open ${raw}: ${res.error}`;
    }

    // --- Close app ---
    const closeMatch = lower.match(/^(close|quit|exit)\s+(.+)/i);
    if (closeMatch) {
        const id = resolveAppId(closeMatch[2].trim());
        if (!id) return `I don’t know the app “${closeMatch[2]}”.`;
        const res = ActionSystem.execute('app.close', { id });
        return res.ok ? `Closed <strong>${closeMatch[2]}</strong>.` : `Could not close: ${res.error}`;
    }

    // --- Minimize ---
    const minMatch = lower.match(/^(minimize|minimise|hide)\s+(.+)/i);
    if (minMatch) {
        const id = resolveAppId(minMatch[2].trim());
        if (!id) return `Unknown app “${minMatch[2]}”.`;
        const res = ActionSystem.execute('window.minimize', { id });
        return res.ok ? `Minimized <strong>${minMatch[2]}</strong>.` : res.error;
    }

    // --- Maximize ---
    if (lower.match(/^(maximize|maximise|fullscreen)\s+/)) {
        const id = resolveAppId(lower.replace(/^(maximize|maximise|fullscreen)\s+/, ''));
        if (id) {
            ActionSystem.execute('window.maximize', { id });
            return `Toggled maximize for <strong>${id}</strong>.`;
        }
    }

    // --- Time / Date ---
    if (lower.includes('time') || lower === 'what time is it' || lower === 'clock') {
        const res = ActionSystem.execute('system.time');
        return res.ok ? `It’s currently <strong>${res.result.time}</strong>.` : 'Could not get time.';
    }
    if (lower.includes('date') || lower.includes('what day') || lower.includes('today')) {
        const res = ActionSystem.execute('system.date');
        return res.ok ? `Today is <strong>${res.result.date}</strong>.` : 'Could not get date.';
    }

    // --- Status ---
    if (lower.includes('status') || lower.includes('what is open') || lower.includes('running')) {
        const res = ActionSystem.execute('system.status');
        if (!res.ok) return 'Could not get status.';
        const open = res.result.openWindows.length
            ? res.result.openWindows.join(', ')
            : 'nothing';
        return `Open windows: <strong>${open}</strong><br>Focused: <strong>${res.result.focused || 'none'}</strong>`;
    }

    // --- List apps ---
    if (lower.includes('list apps') || lower.includes('what apps') || lower === 'apps') {
        const res = ActionSystem.execute('app.list');
        if (!res.ok) return 'Could not list apps.';
        return `Available: ${res.result.available.join(', ')}<br>Currently open: ${res.result.open.join(', ') || 'none'}`;
    }

    // --- Help ---
    if (lower === 'help' || lower === '?' || lower.includes('what can you do')) {
        return `I can control ZenOS through registered actions only:<br><br>
• <em>Open Terminal</em> / <em>Open Notes</em> …<br>
• <em>Close Calculator</em><br>
• <em>Minimize Paint</em><br>
• <em>What time is it?</em><br>
• <em>What is open?</em> / <em>Status</em><br>
• <em>List apps</em><br><br>
Everything goes through the Action System — I never touch the DOM directly.`;
    }

    // --- Identity ---
    if (lower.includes('who are you') || lower.includes('what are you')) {
        return `I’m <strong>Zen</strong>, the system assistant for ZenOS.<br>
I only perform actions that have been explicitly registered in the Action System.`;
    }

    if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi' || lower.includes('hey')) {
        return 'Hello. How can I help you?';
    }

    // Fallback
    return `I heard “${text}”.<br><br>
Try something like <em>Open Terminal</em>, <em>What time is it?</em>, or <em>Help</em>.`;
}

/** Map natural language names → internal app ids */
function resolveAppId(name) {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = {
        zen: 'zen',
        terminal: 'terminal',
        textedit: 'textedit',
        text: 'textedit',
        notes: 'notes',
        note: 'notes',
        paint: 'paint',
        calculator: 'calculator',
        calc: 'calculator',
        calendar: 'calendar',
        preferences: 'preferences',
        settings: 'preferences',
        prefs: 'preferences',
        preview: 'preview',
        video: 'videoEditor',
        videoeditor: 'videoEditor',
        editor: 'videoEditor'
    };
    return map[n] || null;
}

/* ============================================================
   CALCULATOR
   ============================================================ */
let calculatorState = {
    currentNumber: '0', previousNumber: '', operation: null, waitingForOperand: false
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
function calcClearEntry() { calculatorState.currentNumber = '0'; updateCalcDisplay(); }
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

/* ============================================================
   TEXTEDIT / PAINT / CALENDAR / TERMINAL / STUBS
   ============================================================ */
function textBold() { document.execCommand('bold'); document.getElementById('textContent')?.focus(); }
function textItalic() { document.execCommand('italic'); document.getElementById('textContent')?.focus(); }
function textUnderline() { document.execCommand('underline'); document.getElementById('textContent')?.focus(); }
function textAlign(align) {
    document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
    document.getElementById('textContent')?.focus();
}
function textChangeColor(c) { document.execCommand('foreColor', false, c); }
function textChangeSize(size) {
    document.execCommand('fontSize', false, '7');
    document.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size;
    });
}
function textSave() { showNotification('Saved', 'Document saved'); }
function textOpen() { showNotification('Open', 'Open dialog not yet implemented'); }

let paintTool = 'brush', paintColor = '#000000', paintSize = 5, isDrawing = false;
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
function stopDrawing() { isDrawing = false; }
function paintSelectTool(tool) {
    paintTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (typeof event !== 'undefined' && event.target) {
        event.target.closest('.tool-btn')?.classList.add('active');
    }
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

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
function initializeCalendar() { updateCalendarDisplay(); }
function updateCalendarDisplay() {
    const monthYear = document.getElementById('calendarMonthYear');
    const view = document.getElementById('calendarView');
    if (!monthYear || !view) return;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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
            resp.innerHTML = `help  clear  date  ls  pwd  echo  apps  open  exit`;
            break;
        case 'clear':
            [...body.querySelectorAll('div')].forEach((d, i, arr) => { if (i < arr.length - 1) d.remove(); });
            return;
        case 'date':
            resp.textContent = new Date().toString();
            break;
        case 'ls':
            resp.innerHTML = 'Desktop  Documents  Downloads<br>Pictures  Movies  Music';
            break;
        case 'pwd':
            resp.textContent = '/Users/ZenOS';
            break;
        case 'apps':
            resp.textContent = 'zen textedit notes paint calculator calendar videoEditor preferences terminal preview';
            break;
        case 'exit':
            closeApp('terminal');
            return;
        default:
            if (cmd.startsWith('echo ')) resp.textContent = command.slice(5);
            else if (cmd.startsWith('open ')) {
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

function videoNewProject() { showNotification('Video', 'New project'); }
function videoImport() { showNotification('Video', 'Import'); }
function videoExport() { showNotification('Video', 'Export'); }
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

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.code === 'Space') { e.preventDefault(); activateSpotlight(); }
        if (meta && e.key === 'w') { e.preventDefault(); if (wm.focusedId) closeApp(wm.focusedId); }
        if (meta && e.key === 'm') { e.preventDefault(); if (wm.focusedId) minimizeApp(wm.focusedId); }
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

window.addEventListener('load', initDesktop);