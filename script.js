let currentWindow = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let terminalHistory = [];
let terminalIndex = 0;
let calculatorState = {
    currentNumber: '0',
    previousNumber: '',
    operation: null,
    waitingForOperand: false
};
let calendarDate = new Date();
let paintTool = 'brush';
let paintColor = '#000000';
let paintSize = 5;
let isDrawing = false;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let openWindows = new Set();

function initDesktop() {
    updateTime();
    setInterval(updateTime, 1000);
    initializePaint();
    initializeCalendar();
    initializeWindowDrag();
    setupKeyboardShortcuts();

    openApp('finder');

    setTimeout(() => {
        showNotification('Welcome to WebOS', 'Your Mac OS experience is ready! Press Cmd+Space for Spotlight search.');
    }, 1000);
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    document.getElementById('desktopTime').textContent = timeString;
}

function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const allMenus = document.querySelectorAll('.menu-dropdown');
    allMenus.forEach(m => {
        if (m.id !== menuId) m.classList.remove('active');
    });

    menu.classList.toggle('active');
}

function setDockActive(appId) {
    document.querySelectorAll('.dock-item').forEach(item => {
        item.classList.toggle('active', item.dataset.app === appId);
    });
}

function openApp(appId) {
    const window = document.getElementById(appId + 'Window');
    if (!window) return;

    window.classList.add('active');
    window.style.zIndex = getHighestZIndex() + 1;
    currentWindow = appId;
    openWindows.add(appId);

    setDockActive(appId);

    positionWindow(window);

    if (appId === 'terminal') {
        const input = document.getElementById('terminalInput');
        if (input) input.focus();
    }
}

function closeApp(appId) {
    const window = document.getElementById(appId + 'Window');
    if (window) {
        window.classList.remove('active');
        openWindows.delete(appId);
    }

    if (currentWindow === appId) {
        currentWindow = null;
    }

    const activeWindows = document.querySelectorAll('.window.active');
    if (activeWindows.length > 0) {
        currentWindow = activeWindows[activeWindows.length - 1].id.replace('Window', '');
    } else {
        currentWindow = null;
    }

    setDockActive(currentWindow);
}

function minimizeApp(appId) {
    const window = document.getElementById(appId + 'Window');
    if (window) {
        closeApp(appId);
        showNotification('Window Minimized', `${appId.charAt(0).toUpperCase() + appId.slice(1)} has been minimized to dock`);
    }
}

function maximizeApp(appId) {
    const window = document.getElementById(appId + 'Window');
    if (!window) return;

    const isMaximized = window.style.width === '100%';
    if (isMaximized) {
        window.style.width = '800px';
        window.style.height = '600px';
        window.style.top = '100px';
        window.style.left = '200px';
    } else {
        window.style.width = '100%';
        window.style.height = 'calc(100% - 28px)';
        window.style.top = '28px';
        window.style.left = '0px';
    }
}

function positionWindow(window) {
    if (!window.style.top || window.style.top === '50px') {
        const desktopRect = document.getElementById('desktop').getBoundingClientRect();
        const openAppsCount = document.querySelectorAll('.window.active').length;

        window.style.top = (80 + openAppsCount * 30) + 'px';
        window.style.left = (150 + openAppsCount * 30) + 'px';

        const rect = window.getBoundingClientRect();
        if (rect.right > desktopRect.width) {
            window.style.left = (desktopRect.width - rect.width - 50) + 'px';
        }
        if (rect.bottom > desktopRect.height) {
            window.style.top = (desktopRect.height - rect.height - 100) + 'px';
        }
    }
}

function initializeWindowDrag() {
    document.querySelectorAll('.window-header').forEach(header => {
        header.addEventListener('mousedown', startDrag);
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function startDrag(e) {
    if (e.target.classList.contains('window-control')) return;

    const window = e.target.closest('.window');
    if (!window) return;

    currentWindow = window.id.replace('Window', '');
    isDragging = true;

    const rect = window.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    window.style.zIndex = getHighestZIndex() + 1;
}

function drag(e) {
    if (!isDragging || !currentWindow) return;

    const activeWindow = document.getElementById(currentWindow + 'Window');
    if (!activeWindow) return;

    const desktopRect = document.getElementById('desktop').getBoundingClientRect();

    let newX = e.clientX - desktopRect.left - dragOffset.x;
    let newY = e.clientY - desktopRect.top - dragOffset.y;

    newX = Math.max(0, Math.min(newX, desktopRect.width - activeWindow.offsetWidth));
    newY = Math.max(28, Math.min(newY, desktopRect.height - activeWindow.offsetHeight));

    activeWindow.style.left = newX + 'px';
    activeWindow.style.top = newY + 'px';
}

function stopDrag() {
    isDragging = false;
    currentWindow = null;
}

function getHighestZIndex() {
    const windows = document.querySelectorAll('.window');
    let highest = 100;

    windows.forEach(window => {
        const zIndex = parseInt(window.style.zIndex) || 0;
        if (zIndex > highest) highest = zIndex;
    });

    return highest;
}

function showNotification(title, message) {
    const notification = document.getElementById('notification');
    const titleElement = document.getElementById('notificationTitle');
    const messageElement = document.getElementById('notificationMessage');

    titleElement.textContent = title;
    messageElement.textContent = message;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function activateSpotlight() {
    const spotlight = document.getElementById('spotlight');
    const search = document.getElementById('spotlightSearch');

    spotlight.classList.add('active');
    search.value = '';
    search.focus();

    const apps = [
        { name: 'Finder', id: 'finder', icon: '🗂️' },
        { name: 'TextEdit', id: 'textedit', icon: '📝' },
        { name: 'Notes', id: 'notes', icon: '📋' },
        { name: 'Paint', id: 'paint', icon: '🎨' },
        { name: 'Calculator', id: 'calculator', icon: '🔢' },
        { name: 'Calendar', id: 'calendar', icon: '📅' },
        { name: 'Video Editor', id: 'videoEditor', icon: '🎬' },
        { name: 'Terminal', id: 'terminal', icon: '💻' },
        { name: 'Preview', id: 'preview', icon: '🖼️' }
    ];

    updateSpotlightResults(apps);
}

function spotlightSearch(query) {
    const apps = [
        { name: 'Finder', id: 'finder', icon: '🗂️' },
        { name: 'TextEdit', id: 'textedit', icon: '📝' },
        { name: 'Notes', id: 'notes', icon: '📋' },
        { name: 'Paint', id: 'paint', icon: '🎨' },
        { name: 'Calculator', id: 'calculator', icon: '🔢' },
        { name: 'Calendar', id: 'calendar', icon: '📅' },
        { name: 'Video Editor', id: 'videoEditor', icon: '🎬' },
        { name: 'Terminal', id: 'terminal', icon: '💻' },
        { name: 'Preview', id: 'preview', icon: '🖼️' }
    ];

    const filtered = apps.filter(app =>
        app.name.toLowerCase().includes(query.toLowerCase())
    );

    updateSpotlightResults(filtered);
}

function updateSpotlightResults(apps) {
    const resultsContainer = document.getElementById('spotlightResults');
    resultsContainer.innerHTML = '';

    apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'spotlight-item';
        item.innerHTML = `
            <span class="spotlight-icon">${app.icon}</span>
            <span>${app.name}</span>
        `;
        item.onclick = () => {
            openApp(app.id);
            deactivateSpotlight();
        };
        resultsContainer.appendChild(item);
    });
}

function deactivateSpotlight() {
    document.getElementById('spotlight').classList.remove('active');
}

function calcNumber(num) {
    if (calculatorState.waitingForOperand) {
        calculatorState.currentNumber = num;
        calculatorState.waitingForOperand = false;
    } else {
        calculatorState.currentNumber = calculatorState.currentNumber === '0' ? num : calculatorState.currentNumber + num;
    }
    updateCalcDisplay();
}

function calcOperation(op) {
    if (calculatorState.currentNumber === '' && calculatorState.previousNumber === '') return;

    calculatorState.operation = op;
    calculatorState.waitingForOperand = true;
    calculatorState.previousNumber = calculatorState.currentNumber;
}

function calcAdd() { calcOperation('+'); }
function calcSubtract() { calcOperation('-'); }
function calcMultiply() { calcOperation('*'); }
function calcDivide() { calcOperation('/'); }

function calcEquals() {
    if (!calculatorState.operation || calculatorState.previousNumber === '') return;

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

    calculatorState.currentNumber = result.toString();
    calculatorState.operation = null;
    calculatorState.previousNumber = '';
    calculatorState.waitingForOperand = true;

    updateCalcDisplay();
}

function calcClear() {
    calculatorState.currentNumber = '0';
    calculatorState.previousNumber = '';
    calculatorState.operation = null;
    calculatorState.waitingForOperand = false;
    updateCalcDisplay();
}

function calcClearEntry() {
    calculatorState.currentNumber = '0';
    updateCalcDisplay();
}

function calcPercent() {
    calculatorState.currentNumber = (parseFloat(calculatorState.currentNumber) / 100).toString();
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

function textBold() {
    document.execCommand('bold', false, null);
    document.getElementById('textContent').focus();
}

function textItalic() {
    document.execCommand('italic', false, null);
    document.getElementById('textContent').focus();
}

function textUnderline() {
    document.execCommand('underline', false, null);
    document.getElementById('textContent').focus();
}

function textAlign(align) {
    document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`, false, null);
    document.getElementById('textContent').focus();
}

function textChangeColor(color) {
    document.execCommand('foreColor', false, color);
    document.getElementById('textContent').focus();
}

function textChangeSize(size) {
    document.execCommand('fontSize', false, '7');
    const fontElements = document.getElementsByTagName('font');
    for (let i = 0; i < fontElements.length; i++) {
        if (fontElements[i].size === '7') {
            fontElements[i].removeAttribute('size');
            fontElements[i].style.fontSize = size;
        }
    }
    document.getElementById('textContent').focus();
}

function textSave() {
    showNotification('Document Saved', 'Your changes have been saved successfully');
}

function textOpen() {
    showNotification('Open Document', 'Opening existing document...');
}

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
    const canvas = document.getElementById('paintCanvas');
    if (!canvas) return;

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;

    const canvas = document.getElementById('paintCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = paintSize;
    ctx.lineCap = 'round';

    if (paintTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = paintColor;
    } else if (paintTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
    const canvas = document.getElementById('paintCanvas');
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
}

function paintSelectTool(tool) {
    paintTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const button = event?.target.closest('.tool-btn');
    if (button) {
        button.classList.add('active');
    }
}

function paintChangeColor(color) {
    paintColor = color;
}

function paintChangeSize(size) {
    paintSize = parseInt(size);
}

function paintClear() {
    const canvas = document.getElementById('paintCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    showNotification('Canvas Cleared', 'Your drawing has been cleared');
}

function paintSave() {
    showNotification('Drawing Saved', 'Your artwork has been saved');
}

function initializeCalendar() {
    updateCalendarDisplay();
}

function updateCalendarDisplay() {
    const monthYear = document.getElementById('calendarMonthYear');
    const calendarView = document.getElementById('calendarView');

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    monthYear.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const headers = calendarView.querySelectorAll('.calendar-day-header');
    calendarView.innerHTML = '';
    headers.forEach(header => calendarView.appendChild(header));

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
    const todayDate = today.getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = daysInPrevMonth - i;
        calendarView.appendChild(day);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        if (isCurrentMonth && day === todayDate) {
            dayElement.classList.add('today');
        }
        dayElement.textContent = day;
        dayElement.onclick = () => calendarSelectDay(dayElement, day);
        calendarView.appendChild(dayElement);
    }

    const totalCells = calendarView.children.length - 7;
    const remainingCells = 35 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day other-month';
        dayElement.textContent = day;
        calendarView.appendChild(dayElement);
    }
}

function calendarPreviousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateCalendarDisplay();
}

function calendarNextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateCalendarDisplay();
}

function calendarSelectDay(element) {
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    element.classList.add('selected');
    showNotification('Date Selected', `Selected ${element.textContent}`);
}

function terminalKeyPress(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('terminalInput');
        const command = input.value.trim();

        if (command) {
            executeCommand(command);
            terminalHistory.push(command);
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
    const terminalBody = document.getElementById('terminalBody');
    const commandLine = document.createElement('div');
    commandLine.textContent = `webos@localhost:~$ ${command}`;
    terminalBody.insertBefore(commandLine, terminalBody.lastElementChild);

    const response = document.createElement('div');
    response.style.marginLeft = '20px';

    switch (command.toLowerCase()) {
        case 'help':
            response.innerHTML = `Available commands:<br>
  help     - Show this help message<br>
  clear    - Clear terminal<br>
  date     - Show current date and time<br>
  ls       - List files<br>
  pwd      - Show current directory<br>
  echo     - Display a message<br>
  calc     - Open calculator<br>
  exit     - Close terminal`;
            break;
        case 'clear':
            const lines = terminalBody.querySelectorAll('div');
            lines.forEach((line, index) => {
                if (index < lines.length - 1) line.remove();
            });
            return;
        case 'date':
            response.textContent = new Date().toString();
            break;
        case 'ls':
            response.innerHTML = `Desktop  Documents  Downloads<br>
Pictures  Movies     Music<br>
Applications  Utilities`;
            break;
        case 'pwd':
            response.textContent = '/Users/WebOS';
            break;
        case 'exit':
            closeApp('terminal');
            return;
        default:
            if (command.startsWith('echo ')) {
                response.textContent = command.substring(5);
            } else if (command === 'calc') {
                openApp('calculator');
                response.textContent = 'Opening Calculator...';
            } else {
                response.textContent = `bash: ${command}: command not found. Type 'help' for available commands.`;
            }
    }

    terminalBody.insertBefore(response, terminalBody.lastElementChild);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function videoNewProject() {
    document.getElementById('timelineTracks').innerHTML = '<div class="timeline-track" onclick="selectTimelineTrack(this)">Timeline Empty</div>';
    showNotification('New Project', 'Created new video project');
}

function videoImport() {
    showNotification('Import Video', 'Select video files to import');
}

function videoExport() {
    showNotification('Export Video', 'Exporting video project...');
}

function videoCut() {
    showNotification('Cut Clip', 'Selected clip cut to clipboard');
}

function videoCopy() {
    showNotification('Copy Clip', 'Selected clip copied to clipboard');
}

function videoPaste() {
    showNotification('Paste Clip', 'Clip pasted to timeline');
}

function videoAddTransition() {
    showNotification('Add Transition', 'Transition added between clips');
}

function videoAddText() {
    showNotification('Add Text', 'Text overlay added to video');
}

function videoAddEffect() {
    showNotification('Add Effect', 'Visual effect applied to clip');
}

function videoPlay() {
    showNotification('Video Playing', 'Video is now playing');
}

function videoPause() {
    showNotification('Video Paused', 'Video playback paused');
}

function videoStop() {
    showNotification('Video Stopped', 'Video playback stopped');
}

function selectTimelineTrack(track) {
    document.querySelectorAll('.timeline-track').forEach(t => {
        t.style.background = '#555';
    });
    track.style.background = '#007aff';
}

function selectPrefsSection(section) {
    document.querySelectorAll('.prefs-section').forEach(s => {
        s.classList.remove('active');
    });
    section.classList.add('active');
}

function toggleSwitch(switchElement) {
    switchElement.classList.toggle('active');
}

function previewOpen() {
    showNotification('Open Image', 'Opening image file...');
}

function previewZoomIn() {
    showNotification('Zoom In', 'Image zoomed in');
}

function previewZoomOut() {
    showNotification('Zoom Out', 'Image zoomed out');
}

function previewFit() {
    showNotification('Fit to Window', 'Image fitted to window');
}

function previewRotate() {
    showNotification('Rotate Image', 'Image rotated 90 degrees');
}

function previewCrop() {
    showNotification('Crop Image', 'Crop tool activated');
}

function finderNavigateBack() {
    showNotification('Navigation', 'Going back to previous folder');
}

function finderNavigateForward() {
    showNotification('Navigation', 'Going to next folder');
}

function finderNavigateUp() {
    showNotification('Navigation', 'Going up to parent folder');
}

function finderNavigateToPath(path) {
    showNotification('Navigation', `Navigating to ${path}`);
}

function finderCreateFolder() {
    showNotification('New Folder', 'Created new folder');
}

function finderChangeView() {
    showNotification('View Changed', 'Switched to list view');
}

function finderSelectFavorite(element, folder) {
    document.querySelectorAll('.favorites-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');

    const pathInput = document.querySelector('.finder-path');
    switch (folder) {
        case 'desktop':
            pathInput.value = '/Users/WebOS/Desktop';
            break;
        case 'documents':
            pathInput.value = '/Users/WebOS/Documents';
            break;
        case 'downloads':
            pathInput.value = '/Users/WebOS/Downloads';
            break;
        case 'pictures':
            pathInput.value = '/Users/WebOS/Pictures';
            break;
        case 'movies':
            pathInput.value = '/Users/WebOS/Movies';
            break;
        case 'music':
            pathInput.value = '/Users/WebOS/Music';
            break;
        case 'applications':
            pathInput.value = '/Applications';
            break;
        case 'utilities':
            pathInput.value = '/Applications/Utilities';
            break;
    }
}

function finderSelectFile(element) {
    if (event && (event.shiftKey || event.metaKey || event.ctrlKey)) {
        element.classList.toggle('selected');
    } else {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');
    }
}

function minimizeAllWindows() {
    showNotification('Minimize All', 'All windows minimized to dock');
}

function showAllWindows() {
    showNotification('Show All', 'All windows restored from dock');
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const isCommandKey = e.metaKey || e.ctrlKey;

        if (isCommandKey && e.code === 'Space') {
            e.preventDefault();
            activateSpotlight();
        }

        if (isCommandKey && e.key === 'w') {
            e.preventDefault();
            if (currentWindow && openWindows.has(currentWindow)) {
                closeApp(currentWindow);
            }
        }

        if (isCommandKey && e.key === 'm') {
            e.preventDefault();
            if (currentWindow && openWindows.has(currentWindow)) {
                minimizeApp(currentWindow);
            }
        }

        if (e.key === 'Escape') {
            deactivateSpotlight();
            document.querySelectorAll('.menu-dropdown').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-item') && !e.target.closest('.menu-dropdown')) {
        document.querySelectorAll('.menu-dropdown').forEach(menu => {
            menu.classList.remove('active');
        });
    }

    if (!e.target.closest('#spotlight') && !e.target.closest('.menu-item')) {
        deactivateSpotlight();
    }
});

window.addEventListener('load', initDesktop);