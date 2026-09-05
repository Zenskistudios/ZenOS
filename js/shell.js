(function (global) {
  'use strict';
  const aliases = { ll: 'ls -l' };
  const environment = { HOME: '/', PATH: '/bin:/usr/bin', USER: 'Guest', SHELL: '/bin/zen' };

  function lex(input) {
    const tokens = []; let token = ''; let quote = '';
    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (quote) { if (char === quote) quote = ''; else token += char; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (/\s/.test(char)) { if (token) { tokens.push(token); token = ''; } continue; }
      if ('|&><'.includes(char)) { if (token) { tokens.push(token); token = ''; } if ((char === '>' || char === '&') && input[i + 1] === char) { tokens.push(char + char); i += 1; } else tokens.push(char); continue; }
      token += char;
    }
    if (token) tokens.push(token);
    return tokens;
  }
  function parse(input) {
    const tokens = lex(input); const pipelines = [[]]; let current = pipelines[0];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === '|') { current = []; pipelines.push(current); continue; }
      if (token === '&&' || token === '||') { current.push({ op: token }); continue; }
      if (token === '>' || token === '>>' || token === '<') { current.push({ redirect: token, path: tokens[++i] || '' }); continue; }
      current.push(token);
    }
    return pipelines.map(function (parts) { return { args: parts.filter(function (part) { return typeof part === 'string'; }), redirects: parts.filter(function (part) { return typeof part !== 'string'; }) }; });
  }
  function expand(value, env) { return String(value).replace(/\$([A-Z_][A-Z0-9_]*)/g, function (_, key) { return env[key] == null ? '' : env[key]; }); }
  function execute(raw, context) {
    context = context || {}; const env = Object.assign({}, environment, { USER: (global.state && state.settings && state.settings.username) || 'Guest' }, context.env || {}); const parsed = parse(raw); let output = ''; let status = 0;
    for (let i = 0; i < parsed.length; i += 1) {
      const command = parsed[i]; if (!command.args.length) continue;
      command.args = command.args.map(function (arg) { return expand(arg, env); }); const name = aliases[command.args[0]] || command.args[0];
      const args = name.split(' ').concat(command.args.slice(1)); let result;
      try { result = run(name.split(' ')[0], args.slice(1), context, env, output); status = 0; } catch (error) { result = 'Error [' + (error.code || 'EFAIL') + ']: ' + error.message; status = 1; }
      if (name.split(' ')[0] === 'cd' && result && result.cwd) { context.cwd = result.cwd; result = ''; }
      output = Array.isArray(result) ? result.join('\n') : String(result == null ? '' : result);
      command.redirects.forEach(function (redirect) {
        if (redirect.redirect === '>' || redirect.redirect === '>>') {
          const path = kernelPath(redirect.path, context.cwd || '/'); let fd = ZenKernel.fs.open(path, { mode: redirect.redirect === '>>' ? 'a' : 'w', create: true, pid: context.pid }); ZenKernel.fs.write(fd, output); ZenKernel.fs.close(fd); output = '';
        }
      });
    }
    return { output: output, status: status, cwd: context.cwd || '/' };
  }
  function kernelPath(path, cwd) { return ZenKernel.fs.normalize(path, cwd); }
  function run(name, args, context, env, input) {
    const cwd = context.cwd || '/'; const pid = context.pid;
    if (name === 'help') return 'help clear pwd cd ls cat touch mkdir rm cp mv find grep echo whoami ps kill top free df chmod chown history alias env export uname uptime jobs fg bg sleep zen';
    if (name === 'clear') return '';
    if (name === 'pwd') return cwd;
    if (name === 'cd') return { cwd: kernelPath(args[0] || '/', cwd) };
    if (name === 'echo') return args.join(' ');
    if (name === 'whoami') return env.USER;
    if (name === 'env' || name === 'set') return Object.keys(env).sort().map(function (key) { return key + '=' + env[key]; });
    if (name === 'export') { const pair = args.join(' ').split('='); if (pair.length > 1) env[pair[0]] = pair.slice(1).join('='); return ''; }
    if (name === 'uname') return 'ZenOS browser simulator kernel-like architecture';
    if (name === 'date') return new Date().toString();
    if (name === 'uptime') return Math.round(ZenKernel.snapshot().uptime / 1000) + ' seconds';
    if (name === 'ls') return ZenKernel.fs.readdir(kernelPath(args[0] || '.', cwd)).map(function (item) { return args.includes('-l') ? item.permissions + ' ' + item.owner + ' ' + item.size + ' ' + item.name : item.name + (item.type === 'folder' ? '/' : ''); });
    if (name === 'cat') { const fd = ZenKernel.fs.open(kernelPath(args[0], cwd), { mode: 'r', pid: pid }); const value = ZenKernel.fs.read(fd); ZenKernel.fs.close(fd); return value; }
    if (name === 'mkdir') return ZenKernel.fs.mkdir(kernelPath(args[0], cwd), { pid: pid }).name;
    if (name === 'touch') { return ZenKernel.fs.touch(kernelPath(args[0], cwd), pid).name; }
    if (name === 'rm') return ZenKernel.fs.delete(kernelPath(args[0], cwd), pid);
    if (name === 'cp') return ZenKernel.fs.copy(kernelPath(args[0], cwd), kernelPath(args[1], cwd), pid).name;
    if (name === 'mv') return ZenKernel.fs.move(kernelPath(args[0], cwd), kernelPath(args[1], cwd), pid).name;
    if (name === 'chmod') return ZenKernel.fs.chmod(kernelPath(args[1], cwd), args[0], pid).permissions;
    if (name === 'chown') return ZenKernel.fs.chown(kernelPath(args[1], cwd), args[0], pid).owner;
    if (name === 'ps' || name === 'top') return ZenKernel.process.list().map(function (process) { return process.pid + ' ' + process.state + ' ' + process.name + ' cpu=' + process.cpuTime + 'ms mem=' + process.memoryUsed; });
    if (name === 'kill') return ZenKernel.process.kill(Number(args[0])).pid;
    if (name === 'free') { const stats = ZenKernel.memory.stats(); return 'total=' + stats.total + ' used=' + stats.used + ' free=' + stats.free; }
    if (name === 'df') { const stats = ZenKernel.fs.usage(); return 'files=' + stats.files + ' bytes=' + stats.bytes + ' quota=' + stats.quota; }
    if (name === 'zen') {
      if (args[0] === 'doctor') return ZenKernel.doctor().map(function (check) { return '[' + (check.pass ? 'PASS' : 'FAIL') + '] ' + check.name; });
      if (args[0] === 'list') return ZenKernel.packages.list().map(function (pkg) { return pkg.id + '@' + pkg.version; });
      if (args[0] === 'info') return JSON.stringify(ZenKernel.packages.info(args[1]));
      if (args[0] === 'install') { const item = (global.SOFTWARE_CATALOG || []).find(function (pkg) { return pkg.id === args[1] || pkg.name.toLowerCase() === String(args[1]).toLowerCase(); }); if (!item) throw new ZenError('ENOENT', 'Package not found'); return ZenKernel.packages.install({ id: item.id, name: item.name, version: '1.0.0', description: item.desc, size: item.size, dependencies: [], permissions: ['filesystem.read', 'notifications'], entryPoint: item.id }).id; }
      if (args[0] === 'remove') return ZenKernel.packages.uninstall(args[1]);
      if (args[0] === 'update') return ZenKernel.packages.update().map(function (pkg) { return pkg.id + '@' + pkg.version; });
      if (args[0] === 'search') return (global.SOFTWARE_CATALOG || []).filter(function (pkg) { return (pkg.name + ' ' + pkg.desc).toLowerCase().includes(String(args[1] || '').toLowerCase()); }).map(function (pkg) { return pkg.id + ' ' + pkg.name; });
      return 'zen install|remove|update|list|info|search|doctor';
    }
    if (name === 'grep') return String(input || '').split('\n').filter(function (line) { return line.includes(args[0] || ''); });
    if (name === 'find') return findFiles(kernelPath(args[0] || '.', cwd));
    if (name === 'history') return (context.history || []).join('\n');
    if (name === 'alias') return Object.keys(aliases).map(function (key) { return key + '=' + aliases[key]; });
    if (name === 'sleep') return 'sleep ' + (args[0] || '0') + 's';
    throw new ZenError('ENOSYS', 'command not found: ' + name);
  }
  function findFiles(path) { const results = []; function visit(item, itemPath) { results.push(itemPath); (item.children || []).forEach(function (child) { visit(child, itemPath + '/' + child.name); }); } visit(ZenKernel.fs.stat(path), path); return results; }
  global.ZenShell = { lex: lex, parse: parse, execute: execute, environment: environment };
}(window));
