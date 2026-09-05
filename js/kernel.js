/* Zen OS kernel-like browser simulation. No backend, no real kernel claims. */
(function (global) {
  'use strict';

  class ZenError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = 'ZenError';
      this.code = code;
      this.details = details || {};
    }
  }

  const STATES = Object.freeze({
    NEW: 'NEW', READY: 'READY', RUNNING: 'RUNNING', SLEEPING: 'SLEEPING',
    SUSPENDED: 'SUSPENDED', TERMINATED: 'TERMINATED', ZOMBIE: 'ZOMBIE'
  });
  const PERMISSIONS = ['filesystem.read', 'filesystem.write', 'filesystem.delete', 'process.spawn', 'process.control', 'network', 'audio', 'clipboard', 'notifications', 'storage'];
  const subscribers = new Map();
  const eventHistory = [];
  const processes = new Map();
  const memoryBlocks = new Map();
  const devices = new Map();
  const services = new Map();
  const workers = new Map();
  let stateRef = null;
  let nextPid = 100;
  let nextAddress = 4096;
  let nextFd = 3;
  let schedulerTimer = null;
  let bootAt = 0;
  let eventCount = 0;
  const fds = new Map();
  let ipcChannel = null;

  const kernel = {
    version: '0.1.0-sim',
    states: STATES,
    config: { totalMemory: 512 * 1024 * 1024 },
    scheduler: { algorithm: 'round-robin', timeSlice: 100, readyQueue: [], sleepingQueue: [], terminated: [], runningPid: null, ticks: 0 },
    error: ZenError,
    boot: boot,
    shutdown: shutdown,
    process: {
      create: createProcess,
      spawn: spawnProcess,
      terminate: terminateProcess,
      kill: function (pid) { return terminateProcess(pid, 137); },
      suspend: suspendProcess,
      resume: resumeProcess,
      list: function () { return Array.from(processes.values()).map(publicProcess); },
      get: function (pid) { return publicProcess(processes.get(Number(pid))); },
      priority: setPriority,
      stats: processStats
    },
    schedulerControl: { configure: configureScheduler, status: function () { return Object.assign({}, kernel.scheduler); } },
    memory: { allocate: allocate, free: free, read: readMemory, write: writeMemory, stats: memoryStats },
    fs: { open: fsOpen, read: fsRead, write: fsWrite, close: fsClose, mkdir: fsMkdir, touch: fsTouch, delete: fsDelete, rename: fsRename, copy: fsCopy, move: fsMove, stat: fsStat, readdir: fsReaddir, chmod: fsChmod, chown: fsChown, normalize: normalizePath, usage: fsUsage },
    events: { emit: emit, subscribe: subscribe, unsubscribe: unsubscribe, history: function () { return eventHistory.slice(-100); } },
    permissions: { request: requestPermission, grant: grantPermission, revoke: revokePermission, check: checkPermission, list: permissionList },
    packages: { install: installPackage, uninstall: uninstallPackage, update: updatePackages, list: listPackages, info: packageInfo },
    devices: { register: registerDevice, unregister: unregisterDevice, list: function () { return Array.from(devices.values()).map(function (d) { return Object.assign({}, d); }); } },
    services: { list: function () { return Array.from(services.values()).map(function (item) { return publicProcess(typeof item === 'number' ? processes.get(item) : item); }); } },
    workers: { spawn: spawnWorker, terminate: terminateWorker, list: function () { return Array.from(workers.values()).map(function (w) { return { pid: w.pid, status: w.status, heartbeats: w.heartbeats, lastMessage: w.lastMessage }; }); } },
    debug: { processes: function () { return kernel.process.list(); }, memory: function () { return kernel.memory.stats(); }, events: function () { return kernel.events.history(); }, devices: function () { return kernel.devices.list(); }, services: function () { return kernel.services.list(); }, packages: function () { return kernel.packages.list(); }, filesystem: function () { return filesystemTree(requireState().fs); } },
    syscall: syscall,
    snapshot: snapshot,
    doctor: doctor
  };

  function requireState() {
    if (!stateRef) throw new ZenError('EINIT', 'Kernel has not been booted');
    return stateRef;
  }
  function persist() {
    if (typeof global.saveState === 'function') global.saveState();
  }
  function emit(type, data) {
    const event = { type: type, data: data || {}, at: Date.now() };
    eventHistory.push(event);
    if (eventHistory.length > 200) eventHistory.shift();
    eventCount += 1;
    const listeners = subscribers.get(type) || [];
    listeners.slice().forEach(function (handler) { try { handler(event); } catch (error) { console.error(error); } });
    const wildcard = subscribers.get('*') || [];
    wildcard.slice().forEach(function (handler) { try { handler(event); } catch (error) { console.error(error); } });
    if (ipcChannel) { try { ipcChannel.postMessage(event); } catch (error) { /* unavailable in file contexts */ } }
    return event;
  }
  function subscribe(type, handler) {
    if (!subscribers.has(type)) subscribers.set(type, []);
    subscribers.get(type).push(handler);
    return function () { unsubscribe(type, handler); };
  }
  function unsubscribe(type, handler) {
    const list = subscribers.get(type) || [];
    subscribers.set(type, list.filter(function (item) { return item !== handler; }));
  }

  function boot(nextState) {
    stateRef = nextState || requireState();
    bootAt = Date.now();
    schedulerTimer = schedulerTimer || setInterval(schedulerTick, kernel.scheduler.timeSlice);
    registerDefaultDevices();
    registerService('StorageService', 'storage');
    registerService('NotificationService', 'notifications');
    registerService('ProcessService', 'process');
    registerService('SchedulerService', 'scheduler');
    registerService('PackageService', 'packages');
    registerService('ClipboardService', 'clipboard');
    registerService('WindowService', 'window');
    registerService('AudioService', 'audio');
    registerService('NetworkService', 'network');
    if (typeof global.BroadcastChannel === 'function' && !ipcChannel) {
      ipcChannel = new global.BroadcastChannel('zen-os-ipc');
      ipcChannel.onmessage = function (event) { if (event.data && event.data.type) emit('ipc:message', event.data); };
    }
    emit('kernel:boot', { at: bootAt });
    return snapshot();
  }
  function shutdown() {
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = null;
    Array.from(workers.keys()).forEach(terminateWorker);
    emit('kernel:shutdown', {});
  }
  function registerDefaultDevices() {
    [['display', 'ready'], ['keyboard', 'ready'], ['mouse', 'ready'], ['audio', 'ready'], ['storage', 'ready'], ['network', 'ready'], ['clipboard', 'ready']].forEach(function (item) { registerDevice(item[0], item[1]); });
  }
  function registerDevice(name, status) {
    const item = { id: name, name: name, status: status || 'ready', registeredAt: Date.now() };
    devices.set(name, item);
    return Object.assign({}, item);
  }
  function unregisterDevice(name) { return devices.delete(name); }
  function registerService(name, appId) {
    if (services.has(name)) return services.get(name).pid;
    const process = createProcess(name, { appId: appId || name.toLowerCase(), priority: 10, permissions: PERMISSIONS.slice(), isService: true });
    services.set(name, process);
    return process.pid;
  }

  function createProcess(name, options) {
    options = options || {};
    const parentPid = options.parentPid == null ? null : Number(options.parentPid);
    const process = { pid: nextPid++, name: name || 'process', appId: options.appId || name || 'process', state: STATES.READY, priority: Number(options.priority || 5), createdAt: Date.now(), cpuTime: 0, memoryUsed: 0, memoryLimit: Number(options.memoryLimit || 64 * 1024 * 1024), parentPid: parentPid, children: [], permissions: (options.permissions || ['filesystem.read', 'filesystem.write', 'filesystem.delete', 'process.spawn', 'process.control', 'storage', 'notifications']).slice(), handles: [], exitCode: null, threads: Number(options.threads || 1), isService: !!options.isService, worker: !!options.worker };
    processes.set(process.pid, process);
    allocate(process.pid, Number(options.memory || 1024 * 1024));
    if (parentPid && processes.has(parentPid)) processes.get(parentPid).children.push(process.pid);
    kernel.scheduler.readyQueue.push(process.pid);
    emit('process:created', publicProcess(process));
    return process.pid;
  }
  function spawnProcess(name, options) { return createProcess(name, options); }
  function publicProcess(process) {
    if (!process) return null;
    return { pid: process.pid, name: process.name, appId: process.appId, state: process.state, priority: process.priority, createdAt: process.createdAt, cpuTime: process.cpuTime, memoryUsed: process.memoryUsed, memoryLimit: process.memoryLimit, parentPid: process.parentPid, children: process.children.slice(), permissions: process.permissions.slice(), handles: process.handles.slice(), exitCode: process.exitCode, threads: process.threads, worker: process.worker, isService: process.isService };
  }
  function terminateProcess(pid, exitCode) {
    const process = processes.get(Number(pid));
    if (!process) throw new ZenError('ESRCH', 'Process not found', { pid: pid });
    process.state = STATES.TERMINATED;
    process.exitCode = exitCode == null ? 0 : exitCode;
    kernel.scheduler.readyQueue = kernel.scheduler.readyQueue.filter(function (item) { return item !== process.pid; });
    kernel.scheduler.sleepingQueue = kernel.scheduler.sleepingQueue.filter(function (item) { return item !== process.pid; });
    if (kernel.scheduler.runningPid === process.pid) kernel.scheduler.runningPid = null;
    kernel.scheduler.terminated.push(process.pid);
    freeProcessMemory(process.pid);
    emit('process:terminated', publicProcess(process));
    return publicProcess(process);
  }
  function suspendProcess(pid) {
    const process = processes.get(Number(pid));
    if (!process || process.state === STATES.TERMINATED) throw new ZenError('ESRCH', 'Process not found or terminated', { pid: pid });
    process.state = STATES.SUSPENDED;
    kernel.scheduler.readyQueue = kernel.scheduler.readyQueue.filter(function (item) { return item !== process.pid; });
    if (kernel.scheduler.runningPid === process.pid) kernel.scheduler.runningPid = null;
    emit('process:suspended', publicProcess(process));
    return publicProcess(process);
  }
  function resumeProcess(pid) {
    const process = processes.get(Number(pid));
    if (!process || process.state === STATES.TERMINATED) throw new ZenError('ESRCH', 'Process not found or terminated', { pid: pid });
    process.state = STATES.READY;
    if (!kernel.scheduler.readyQueue.includes(process.pid)) kernel.scheduler.readyQueue.push(process.pid);
    emit('process:resumed', publicProcess(process));
    return publicProcess(process);
  }
  function setPriority(pid, priority) {
    const process = ensureProcess(pid);
    const value = Number(priority);
    if (!Number.isInteger(value) || value < 0 || value > 20) throw new ZenError('EINVAL', 'Priority must be an integer from 0 to 20');
    process.priority = value;
    emit('process:priority', { pid: process.pid, priority: value });
    return publicProcess(process);
  }
  function configureScheduler(options) {
    options = options || {};
    if (options.algorithm !== undefined && !['round-robin', 'priority', 'fcfs'].includes(options.algorithm)) throw new ZenError('EINVAL', 'Unknown scheduler algorithm');
    if (options.timeSlice !== undefined && (!Number.isInteger(Number(options.timeSlice)) || Number(options.timeSlice) < 10)) throw new ZenError('EINVAL', 'Time slice must be at least 10ms');
    if (options.algorithm !== undefined) kernel.scheduler.algorithm = options.algorithm;
    if (options.timeSlice !== undefined) {
      kernel.scheduler.timeSlice = Number(options.timeSlice);
      if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = setInterval(schedulerTick, kernel.scheduler.timeSlice); }
    }
    emit('scheduler:configured', { algorithm: kernel.scheduler.algorithm, timeSlice: kernel.scheduler.timeSlice });
    return Object.assign({}, kernel.scheduler);
  }
  function schedulerTick() {
    const candidates = kernel.scheduler.readyQueue.map(function (pid) { return processes.get(pid); }).filter(function (process) { return process && process.state === STATES.READY; });
    if (!candidates.length) { kernel.scheduler.runningPid = null; return; }
    let chosen;
    if (kernel.scheduler.algorithm === 'priority') chosen = candidates.slice().sort(function (a, b) { return b.priority - a.priority || a.createdAt - b.createdAt; })[0];
    else if (kernel.scheduler.algorithm === 'fcfs') chosen = candidates.slice().sort(function (a, b) { return a.createdAt - b.createdAt; })[0];
    else { const currentIndex = kernel.scheduler.readyQueue.indexOf(kernel.scheduler.runningPid); chosen = candidates[(currentIndex + 1 + candidates.length) % candidates.length]; }
    processes.forEach(function (process) { if (process.state === STATES.RUNNING) process.state = STATES.READY; });
    chosen.state = STATES.RUNNING;
    chosen.cpuTime += kernel.scheduler.timeSlice;
    kernel.scheduler.runningPid = chosen.pid;
    kernel.scheduler.ticks += 1;
    if (kernel.scheduler.algorithm === 'round-robin') {
      kernel.scheduler.readyQueue = kernel.scheduler.readyQueue.filter(function (pid) { return pid !== chosen.pid; });
      kernel.scheduler.readyQueue.push(chosen.pid);
    }
    emit('scheduler:tick', { pid: chosen.pid, ticks: kernel.scheduler.ticks, algorithm: kernel.scheduler.algorithm });
  }
  function processStats() {
    const list = Array.from(processes.values());
    return { total: list.length, active: list.filter(function (p) { return p.state !== STATES.TERMINATED; }).length, runningPid: kernel.scheduler.runningPid, ticks: kernel.scheduler.ticks, algorithm: kernel.scheduler.algorithm, timeSlice: kernel.scheduler.timeSlice };
  }

  function ensureProcess(pid) {
    const process = processes.get(Number(pid));
    if (!process) throw new ZenError('ESRCH', 'Process not found', { pid: pid });
    return process;
  }
  function allocate(pid, size) {
    const process = ensureProcess(pid); size = Number(size);
    if (!Number.isFinite(size) || size <= 0) throw new ZenError('EINVAL', 'Memory size must be positive');
    if (process.memoryUsed + size > process.memoryLimit) throw new ZenError('ENOMEM', 'Process memory limit exceeded', { pid: pid, size: size });
    if (memoryStats().free < size) throw new ZenError('ENOMEM', 'Not enough simulated memory', { size: size });
    const address = nextAddress; nextAddress += size + 16;
    memoryBlocks.set(address, { address: address, pid: process.pid, size: size, allocatedAt: Date.now(), data: new Uint8Array(Math.min(size, 1024 * 1024)) });
    process.memoryUsed += size;
    emit('memory:allocated', { pid: process.pid, address: address, size: size });
    return address;
  }
  function free(pid, address) {
    const block = memoryBlocks.get(Number(address));
    if (!block || block.pid !== Number(pid)) throw new ZenError('EINVAL', 'Memory block not owned by process');
    const process = ensureProcess(pid); process.memoryUsed = Math.max(0, process.memoryUsed - block.size); memoryBlocks.delete(Number(address)); emit('memory:freed', { pid: process.pid, address: Number(address) }); return true;
  }
  function freeProcessMemory(pid) { Array.from(memoryBlocks.values()).filter(function (block) { return block.pid === pid; }).forEach(function (block) { memoryBlocks.delete(block.address); }); const process = processes.get(pid); if (process) process.memoryUsed = 0; }
  function readMemory(pid, address, length) { const block = memoryBlocks.get(Number(address)); if (!block || block.pid !== Number(pid)) throw new ZenError('EACCES', 'Memory block is not owned by process'); return Array.from(block.data.slice(0, Number(length) || block.data.length)); }
  function writeMemory(pid, address, data) { const block = memoryBlocks.get(Number(address)); if (!block || block.pid !== Number(pid)) throw new ZenError('EACCES', 'Memory block is not owned by process'); const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data); block.data = bytes.slice(0, Math.min(bytes.length, block.size)); return block.data.length; }
  function memoryStats() { const used = Array.from(memoryBlocks.values()).reduce(function (sum, block) { return sum + block.size; }, 0); const free = kernel.config.totalMemory - used; const blocks = Array.from(memoryBlocks.values()).map(function (block) { return { address: block.address, pid: block.pid, size: block.size, allocatedAt: block.allocatedAt }; }); return { total: kernel.config.totalMemory, used: used, free: free, allocatedBlocks: blocks, freeBlocks: free > 0 ? [{ size: free }] : [], fragmentation: blocks.length > 1 ? Math.round((blocks.length / (blocks.length + 1)) * 100) / 100 : 0 }; }

  function normalizePath(path, cwd) {
    path = String(path || ''); cwd = cwd || '/';
    const combined = path.charAt(0) === '/' ? path : String(cwd).replace(/\/$/, '') + '/' + path;
    const parts = combined.split('/'); const normalized = [];
    parts.forEach(function (part) { if (!part || part === '.') return; if (part === '..') normalized.pop(); else normalized.push(part); });
    return '/' + normalized.join('/');
  }
  function nodeAt(path) { const root = requireState().fs; const normalized = normalizePath(path); if (normalized === '/') return root; const parts = normalized.slice(1).split('/'); let node = root; for (let i = 0; i < parts.length; i += 1) { node = (node.children || []).find(function (child) { return child.name === parts[i]; }); if (!node) return null; } return node; }
  function parentAt(path) { const normalized = normalizePath(path); const cut = normalized.lastIndexOf('/'); return { parent: nodeAt(cut <= 0 ? '/' : normalized.slice(0, cut)), name: normalized.slice(cut + 1) }; }
  function ensureMetadata(node) { if (!node) return; node.owner = node.owner || 'root'; node.group = node.group || 'users'; node.permissions = node.permissions || 'rw-r--r--'; node.createdAt = node.createdAt || Date.now(); node.modifiedAt = node.modifiedAt || node.createdAt; node.accessedAt = node.accessedAt || node.modifiedAt; node.size = node.type === 'file' ? new Blob([node.content || '']).size : (node.children || []).length; }
  function checkFs(pid, permission) { if (pid == null) return true; return checkPermission(pid, permission); }
  function fsOpen(path, options) { options = options || {}; let node = nodeAt(path); if (!node && options.create) { fsTouch(path, options.pid); node = nodeAt(path); } if (!node) throw new ZenError('ENOENT', 'Path not found', { path: path }); ensureMetadata(node); const fd = nextFd++; fds.set(fd, { fd: fd, path: normalizePath(path), node: node, mode: options.mode || 'r', pid: options.pid || null }); if (options.pid) ensureProcess(options.pid).handles.push(fd); return fd; }
  function handle(fd) { const item = fds.get(Number(fd)); if (!item) throw new ZenError('EBADF', 'Invalid file descriptor', { fd: fd }); return item; }
  function fsRead(fd) { const item = handle(fd); ensureMetadata(item.node); item.node.accessedAt = Date.now(); return item.node.content || ''; }
  function fsWrite(fd, content) { const item = handle(fd); if (!['w', 'rw', 'a'].includes(item.mode)) throw new ZenError('EACCES', 'File descriptor is not writable'); if (item.pid && !checkFs(item.pid, 'filesystem.write')) throw new ZenError('EACCES', 'Process lacks filesystem.write'); item.node.content = item.mode === 'a' ? (item.node.content || '') + String(content) : String(content); ensureMetadata(item.node); item.node.modifiedAt = Date.now(); persist(); emit('file:written', { path: item.path, size: item.node.size }); return item.node.size; }
  function fsClose(fd) { const item = handle(fd); fds.delete(Number(fd)); return item.fd; }
  function fsMkdir(path, options) { const target = parentAt(path); if (!target.parent || target.parent.type !== 'folder') throw new ZenError('ENOENT', 'Parent directory not found'); if ((target.parent.children || []).some(function (child) { return child.name === target.name; })) throw new ZenError('EEXIST', 'Path already exists'); const node = { id: 'vfs_' + Date.now().toString(36), name: target.name, type: 'folder', children: [], owner: 'root', group: 'users', permissions: 'rwxr-xr-x', createdAt: Date.now(), modifiedAt: Date.now(), accessedAt: Date.now() }; target.parent.children = target.parent.children || []; target.parent.children.push(node); persist(); emit('file:created', { path: normalizePath(path), type: 'folder' }); return statNode(node, path); }
  function fsTouch(path, pid) { if (!checkFs(pid, 'filesystem.write')) throw new ZenError('EACCES', 'Process lacks filesystem.write'); const target = parentAt(path); if (!target.parent || target.parent.type !== 'folder') throw new ZenError('ENOENT', 'Parent directory not found'); let node = (target.parent.children || []).find(function (child) { return child.name === target.name; }); if (!node) { node = { id: 'vfs_' + Date.now().toString(36), name: target.name, type: 'file', content: '', owner: 'root', group: 'users', permissions: 'rw-r--r--', createdAt: Date.now(), modifiedAt: Date.now(), accessedAt: Date.now() }; target.parent.children = target.parent.children || []; target.parent.children.push(node); emit('file:created', { path: normalizePath(path), type: 'file' }); } else { node.modifiedAt = Date.now(); } ensureMetadata(node); persist(); return statNode(node, path); }
  function fsDelete(path, pid) { if (!checkFs(pid, 'filesystem.delete')) throw new ZenError('EACCES', 'Process lacks filesystem.delete'); const target = parentAt(path); if (!target.parent) throw new ZenError('ENOENT', 'Parent directory not found'); const index = (target.parent.children || []).findIndex(function (child) { return child.name === target.name; }); if (index < 0) throw new ZenError('ENOENT', 'Path not found'); const removed = target.parent.children.splice(index, 1)[0]; const s = requireState(); s.trash = s.trash || []; s.trash.push({ removed: removed, path: normalizePath(path), deletedAt: Date.now() }); persist(); emit('file:deleted', { path: normalizePath(path) }); return true; }
  function fsRename(path, nextName, pid) { if (!checkFs(pid, 'filesystem.write')) throw new ZenError('EACCES', 'Process lacks filesystem.write'); const target = parentAt(path); const node = target.parent && (target.parent.children || []).find(function (child) { return child.name === target.name; }); if (!node) throw new ZenError('ENOENT', 'Path not found'); node.name = String(nextName); node.modifiedAt = Date.now(); persist(); emit('file:renamed', { path: normalizePath(path), name: node.name }); return statNode(node, normalizePath(path)); }
  function fsCopy(source, destination, pid) { if (!checkFs(pid, 'filesystem.read') || !checkFs(pid, 'filesystem.write')) throw new ZenError('EACCES', 'Filesystem permission denied'); const sourceNode = nodeAt(source); const target = parentAt(destination); if (!sourceNode || !target.parent) throw new ZenError('ENOENT', 'Copy path not found'); const copy = JSON.parse(JSON.stringify(sourceNode)); copy.id = 'vfs_' + Date.now().toString(36); copy.name = target.name; target.parent.children.push(copy); persist(); emit('file:created', { path: normalizePath(destination), copiedFrom: normalizePath(source) }); return statNode(copy, destination); }
  function fsMove(source, destination, pid) { const result = fsCopy(source, destination, pid); fsDelete(source, pid); return result; }
  function statNode(node, path) { ensureMetadata(node); return { id: node.id, name: node.name, path: normalizePath(path), type: node.type, size: node.size, owner: node.owner, group: node.group, permissions: node.permissions, mime: node.mime || '', assetPath: node.assetPath || '', createdAt: node.createdAt, modifiedAt: node.modifiedAt, accessedAt: node.accessedAt }; }
  function fsStat(path) { const node = nodeAt(path); if (!node) throw new ZenError('ENOENT', 'Path not found'); return statNode(node, path); }
  function fsReaddir(path) { const node = nodeAt(path); if (!node || node.type !== 'folder') throw new ZenError('ENOTDIR', 'Not a directory'); return (node.children || []).map(function (child) { return statNode(child, normalizePath(path) + '/' + child.name); }); }
  function fsChmod(path, permissions, pid) { const node = nodeAt(path); if (!node) throw new ZenError('ENOENT', 'Path not found'); if (pid && node.owner !== 'root' && !checkPermission(pid, 'filesystem.write')) throw new ZenError('EPERM', 'Permission denied'); node.permissions = String(permissions); node.modifiedAt = Date.now(); persist(); return statNode(node, path); }
  function fsChown(path, owner, pid) { const node = nodeAt(path); if (!node) throw new ZenError('ENOENT', 'Path not found'); if (pid && !checkPermission(pid, 'filesystem.write')) throw new ZenError('EPERM', 'Permission denied'); node.owner = String(owner); persist(); return statNode(node, path); }
  function fsUsage() { let files = 0; let bytes = 0; function visit(node) { ensureMetadata(node); if (node.type === 'file') { files += 1; bytes += node.size; } (node.children || []).forEach(visit); } visit(requireState().fs); return { files: files, bytes: bytes, quota: 64 * 1024 * 1024 }; }
  function filesystemTree(node) { ensureMetadata(node); return { name: node.name, type: node.type, size: node.size, owner: node.owner, permissions: node.permissions, children: (node.children || []).map(filesystemTree) }; }

  function permissionList(pid) { const process = ensureProcess(pid); return process.permissions.slice(); }
  function checkPermission(pid, permission) { const process = ensureProcess(pid); return process.permissions.includes(permission); }
  function requestPermission(pid, permission) { if (!PERMISSIONS.includes(permission)) throw new ZenError('EINVAL', 'Unknown permission'); return checkPermission(pid, permission); }
  function grantPermission(pid, permission) { const process = ensureProcess(pid); if (!PERMISSIONS.includes(permission)) throw new ZenError('EINVAL', 'Unknown permission'); if (!process.permissions.includes(permission)) process.permissions.push(permission); emit('permission:granted', { pid: process.pid, permission: permission }); return true; }
  function revokePermission(pid, permission) { const process = ensureProcess(pid); process.permissions = process.permissions.filter(function (item) { return item !== permission; }); emit('permission:revoked', { pid: process.pid, permission: permission }); return true; }

  function syscall(name, args, callerPid) {
    args = args || [];
    const parts = String(name).split('.'); const group = parts[0]; const method = parts[1];
    const target = kernel[group]; if (!target || typeof target[method] !== 'function') throw new ZenError('ENOSYS', 'Unknown system call', { name: name });
    const permissionMap = { write: 'filesystem.write', delete: 'filesystem.delete', mkdir: 'filesystem.write', kill: 'process.control', suspend: 'process.control', resume: 'process.control', spawn: 'process.spawn' };
    if (callerPid && permissionMap[method] && !checkPermission(callerPid, permissionMap[method])) throw new ZenError('EPERM', 'System call permission denied', { name: name, pid: callerPid });
    return target[method].apply(null, args);
  }

  function spawnWorker(name, task, options) {
    options = options || {}; const pid = createProcess(name, Object.assign({}, options, { worker: true })); const source = typeof task === 'string' ? task : 'self.onmessage=function(e){ if(e.data&&e.data.type==="run"){ var end=Date.now()+Number(e.data.ms||10); while(Date.now()<end){} self.postMessage({type:"complete"}); }}'; const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' })); const worker = new Worker(url); const item = { pid: pid, worker: worker, status: 'running', heartbeats: 0, lastMessage: null }; workers.set(pid, item); worker.onmessage = function (event) { item.lastMessage = event.data; item.heartbeats += 1; emit('worker:message', { pid: pid, message: event.data }); }; worker.onerror = function (event) { item.status = 'error'; emit('worker:error', { pid: pid, message: event.message }); }; worker.postMessage({ type: 'run', ms: options.workMs || 8 }); return pid; }
  function terminateWorker(pid) { const item = workers.get(Number(pid)); if (!item) return false; item.worker.terminate(); item.status = 'terminated'; workers.delete(Number(pid)); if (processes.has(Number(pid))) terminateProcess(Number(pid), 0); return true; }

  function compareVersions(left, right) { return String(left).split('.').map(Number).reduce(function (value, part, index) { return value || (part - (Number(String(right).split('.')[index]) || 0)); }, 0); }
  function installPackage(manifest) { const s = requireState(); const packageData = Object.assign({ version: '1.0.0', dependencies: [], permissions: ['filesystem.read'], size: 0 }, manifest); if (!packageData.id) throw new ZenError('EINVAL', 'Package id is required'); s.packages = s.packages || {}; (packageData.dependencies || []).forEach(function (dependency) { if (!s.packages[dependency]) throw new ZenError('ENOENT', 'Missing package dependency', { dependency: dependency }); }); if (s.packages[packageData.id] && compareVersions(s.packages[packageData.id].version, packageData.version) >= 0) throw new ZenError('EEXIST', 'Package version is already installed'); s.packages[packageData.id] = packageData; s.installedApps = Array.from(new Set((s.installedApps || []).concat(packageData.id))); persist(); emit('package:installed', packageData); return packageData; }
  function uninstallPackage(id) { const s = requireState(); s.packages = s.packages || {}; if (!s.packages[id]) throw new ZenError('ENOENT', 'Package not installed'); delete s.packages[id]; s.installedApps = (s.installedApps || []).filter(function (item) { return item !== id; }); persist(); emit('package:uninstalled', { id: id }); return true; }
  function listPackages() { const s = requireState(); return Object.values(s.packages || {}); }
  function packageInfo(id) { const item = listPackages().find(function (pkg) { return pkg.id === id; }); if (!item) throw new ZenError('ENOENT', 'Package not found'); return item; }
  function updatePackages() { return listPackages().map(function (pkg) { const next = Object.assign({}, pkg, { updatedAt: Date.now() }); requireState().packages[pkg.id] = next; return next; }); }

  function snapshot() { return { status: stateRef ? 'online' : 'offline', version: kernel.version, bootTime: bootAt, uptime: bootAt ? Date.now() - bootAt : 0, process: processStats(), memory: memoryStats(), filesystem: stateRef ? fsUsage() : null, scheduler: Object.assign({}, kernel.scheduler), devices: kernel.devices.list(), services: kernel.services.list(), packages: listPackages(), eventCount: eventCount }; }
  function doctor() {
    const checks = [['Kernel', !!stateRef], ['Process Manager', processes.size > 0], ['Scheduler', !!schedulerTimer], ['Memory Manager', memoryStats().free >= 0], ['VFS', !!(stateRef && stateRef.fs)], ['Permissions', PERMISSIONS.length > 0], ['IPC', subscribers instanceof Map], ['Package Manager', !!stateRef], ['Devices', devices.size >= 7], ['Services', services.size >= 5], ['Persistence', typeof global.saveState === 'function'], ['Shell', typeof global.ZenShell !== 'undefined']];
    return checks.map(function (item) { return { name: item[0], pass: !!item[1] }; });
  }

  global.ZenError = ZenError;
  global.ZenKernel = kernel;
}(window));
