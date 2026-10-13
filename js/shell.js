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
      if ('|&><;'.includes(char)) { if (token) { tokens.push(token); token = ''; } if ((char === '>' || char === '&') && input[i + 1] === char) { tokens.push(char + char); i += 1; } else tokens.push(char); continue; }
      token += char;
    }
    if (token) tokens.push(token);
    return tokens;
  }

  // Splits a full command line into statements joined by ; && || and trailing &
  function parseStatements(input) {
    const tokens = lex(input);
    const statements = []; let current = []; let gate = null;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === ';') { statements.push({ tokens: current, gate: gate, background: false }); current = []; gate = null; continue; }
      if (token === '&&' || token === '||') { statements.push({ tokens: current, gate: gate, background: false }); current = []; gate = token; continue; }
      if (token === '&') { statements.push({ tokens: current, gate: gate, background: true }); current = []; gate = null; continue; }
      current.push(token);
    }
    if (current.length) statements.push({ tokens: current, gate: gate, background: false });
    return statements.filter(function (statement) { return statement.tokens.length; });
  }

  // Splits one statement's tokens into pipeline stages (| separated) with redirects
  function parsePipeline(tokens) {
    const pipelines = [[]]; let current = pipelines[0];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === '|') { current = []; pipelines.push(current); continue; }
      if (token === '>' || token === '>>' || token === '<') { current.push({ redirect: token, path: tokens[++i] || '' }); continue; }
      current.push(token);
    }
    return pipelines.map(function (parts) { return { args: parts.filter(function (part) { return typeof part === 'string'; }), redirects: parts.filter(function (part) { return typeof part !== 'string'; }) }; });
  }

  function expand(value, env) { return String(value).replace(/\$(\?|[A-Z_][A-Z0-9_]*)/g, function (_, key) { return env[key] == null ? '' : env[key]; }); }
  function kernelPath(path, cwd) { return ZenKernel.fs.normalize(path, cwd); }

  function runPipeline(tokens, context, env) {
    const parsed = parsePipeline(tokens);
    let output = ''; let status = 0;
    for (let i = 0; i < parsed.length; i += 1) {
      const command = parsed[i];
      const inRedirect = command.redirects.find(function (r) { return r.redirect === '<'; });
      if (inRedirect) {
        try {
          const fd = ZenKernel.fs.open(kernelPath(inRedirect.path, context.cwd || '/'), { mode: 'r', pid: context.pid });
          output = ZenKernel.fs.read(fd);
          ZenKernel.fs.close(fd);
        } catch (error) { output = ''; status = 1; }
      }
      if (!command.args.length) continue;
      command.args = command.args.map(function (arg) { return expand(arg, env); });
      const name = aliases[command.args[0]] || command.args[0];
      const nameParts = name.split(' ');
      const args = nameParts.concat(command.args.slice(1));
      let result;
      try { result = run(nameParts[0], args.slice(1), context, env, output); status = 0; }
      catch (error) { result = 'zen-shell: ' + nameParts[0] + ': ' + (error.message || (ZenKernel.strerror && ZenKernel.strerror(error.code)) || 'error'); status = 1; }
      if (nameParts[0] === 'cd' && result && result.cwd) { context.cwd = result.cwd; result = ''; }
      output = Array.isArray(result) ? result.join('\n') : String(result == null ? '' : result);
      const outRedirect = command.redirects.find(function (r) { return r.redirect === '>' || r.redirect === '>>'; });
      if (outRedirect) {
        try {
          const path = kernelPath(outRedirect.path, context.cwd || '/');
          const fd = ZenKernel.fs.open(path, { mode: outRedirect.redirect === '>>' ? 'a' : 'w', create: true, pid: context.pid });
          ZenKernel.fs.write(fd, output);
          ZenKernel.fs.close(fd);
        } catch (error) { status = 1; }
        output = '';
      }
    }
    return { output: output, status: status };
  }

  // Runs a single-stage pipeline asynchronously when it's a real blocking
  // command (currently: sleep). The command runs on an actual Worker thread
  // that busy-waits for the real duration, so it takes genuine wall-clock
  // time and can be truly killed mid-flight via SIGINT/SIGTERM/SIGKILL —
  // Worker.terminate() stops it instantly regardless of where it is in its
  // loop. Everything else resolves immediately via the existing sync path.
  function runPipelineAsync(tokens, context, env) {
    const parsed = parsePipeline(tokens);
    const isSingleStage = parsed.length === 1 && parsed[0].args.length > 0;
    const commandName = isSingleStage ? (aliases[parsed[0].args[0]] || parsed[0].args[0]).split(' ')[0] : null;
    if (isSingleStage && commandName === 'sleep' && context.pid) {
      const seconds = Number(expand(parsed[0].args[1] || '0', env)) || 0;
      const ms = Math.max(0, seconds * 1000);
      if (ms <= 0) return Promise.resolve(runPipeline(tokens, context, env));
      return new Promise(function (resolve) {
        const workerPid = ZenKernel.workers.spawn('sleep', undefined, { parentPid: context.pid, workMs: ms, priority: 3 });
        ZenKernel.process.sleep(workerPid, ms);
        context.foregroundPid = workerPid;
        let settled = false;
        const offMsg = ZenKernel.events.subscribe('worker:message', function (event) {
          if (settled || event.data.pid !== workerPid) return;
          settled = true; offMsg(); offTerm();
          try { ZenKernel.process.terminate(workerPid, 0); } catch (error) { /* already gone */ }
          try { ZenKernel.process.wait(workerPid); } catch (error) { /* nothing to reap */ }
          if (context.foregroundPid === workerPid) context.foregroundPid = null;
          resolve({ output: 'slept ' + seconds + 's', status: 0 });
        });
        const offTerm = ZenKernel.events.subscribe('process:terminated', function (event) {
          if (settled || event.data.pid !== workerPid) return;
          settled = true; offMsg(); offTerm();
          try { ZenKernel.process.wait(workerPid); } catch (error) { /* nothing to reap */ }
          if (context.foregroundPid === workerPid) context.foregroundPid = null;
          resolve({ output: 'sleep: interrupted', status: event.data.exitCode || 130 });
        });
      });
    }
    return Promise.resolve(runPipeline(tokens, context, env));
  }

  function runInBackground(tokens, context, env) {
    context.jobSeq = (context.jobSeq || 0) + 1;
    const jobId = context.jobSeq;
    const cmdString = tokens.join(' ');
    const pid = ZenKernel.process.spawn(cmdString, { parentPid: context.pid, priority: 3 });
    const job = { id: jobId, pid: pid, cmd: cmdString, status: 'running', output: '' };
    context.jobs = context.jobs || [];
    context.jobs.push(job);
    global.setTimeout(function () {
      try {
        const result = runPipeline(tokens, Object.assign({}, context), env);
        job.output = result.output; job.status = result.status === 0 ? 'done' : 'failed';
      } catch (error) { job.status = 'failed'; job.output = String(error.message || error); }
      try { ZenKernel.process.terminate(pid, job.status === 'done' ? 0 : 1); } catch (error) { /* already gone */ }
      try { ZenKernel.process.wait(pid); } catch (error) { /* nothing to reap */ }
    }, 50);
    return job;
  }

  function execute(raw, context) {
    context = context || {};
    context.history = context.history || [];
    context.jobs = context.jobs || [];
    if (String(raw).trim()) context.history.push(String(raw));
    const env = Object.assign({}, environment, { USER: (global.state && state.settings && state.settings.username) || 'Guest', '?': '0' }, context.env || {});
    context.env = env;
    const statements = parseStatements(raw);
    let status = 0; let output = '';
    for (let s = 0; s < statements.length; s += 1) {
      const statement = statements[s];
      if (statement.gate === '&&' && status !== 0) continue;
      if (statement.gate === '||' && status === 0) continue;
      if (statement.background) {
        const job = runInBackground(statement.tokens, context, env);
        output = '[' + job.id + '] ' + job.pid;
        status = 0;
        continue;
      }
      const result = runPipeline(statement.tokens, context, env);
      output = result.output; status = result.status; env['?'] = String(status);
    }
    return { output: output, status: status, cwd: context.cwd || '/' };
  }

  // Real interrupt: if a foreground async command is running (see
  // runPipelineAsync), kill that specific process/worker. Otherwise fall
  // back to whatever the scheduler currently reports as running.
  function interrupt(context) {
    const pid = (context && context.foregroundPid) || ZenKernel.snapshot().process.runningPid;
    if (!pid) return null;
    try { ZenKernel.process.signal(pid, 'INT'); } catch (error) { /* process may already be gone */ }
    return pid;
  }

  // Async execution: same statement chaining (; && ||) and backgrounding
  // (&) as execute(), but foreground pipelines run through
  // runPipelineAsync so a genuinely time-consuming command (sleep) really
  // takes that long and can be interrupted mid-flight. Use this from an
  // interactive terminal UI; execute() remains available for instant,
  // non-blocking, synchronous use (e.g. scripted/programmatic calls).
  function executeAsync(raw, context) {
    context = context || {};
    context.history = context.history || [];
    context.jobs = context.jobs || [];
    if (String(raw).trim()) context.history.push(String(raw));
    const env = Object.assign({}, environment, { USER: (global.state && state.settings && state.settings.username) || 'Guest', '?': '0' }, context.env || {});
    context.env = env;
    const statements = parseStatements(raw);
    let status = 0; let output = '';
    return statements.reduce(function (chain, statement) {
      return chain.then(function () {
        if (statement.gate === '&&' && status !== 0) return;
        if (statement.gate === '||' && status === 0) return;
        if (statement.background) {
          const job = runInBackground(statement.tokens, context, env);
          output = '[' + job.id + '] ' + job.pid; status = 0;
          return;
        }
        return runPipelineAsync(statement.tokens, context, env).then(function (result) {
          output = result.output; status = result.status; env['?'] = String(status);
        });
      });
    }, Promise.resolve()).then(function () {
      return { output: output, status: status, cwd: context.cwd || '/' };
    });
  }

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
    if (name === 'kill') {
      let sig = 'TERM'; let target = args[0];
      if (String(args[0] || '').startsWith('-')) { sig = args[0].slice(1); target = args[1]; }
      if (sig === '9') sig = 'KILL'; if (sig === '15') sig = 'TERM'; if (sig === '2') sig = 'INT';
      return ZenKernel.process.signal(Number(target), sig).pid;
    }
    if (name === 'free') { const stats = ZenKernel.memory.stats(); return 'total=' + stats.total + ' used=' + stats.used + ' free=' + stats.free; }
    if (name === 'df') { const stats = ZenKernel.fs.usage(); return 'files=' + stats.files + ' bytes=' + stats.bytes + ' quota=' + stats.quota; }
    if (name === 'jobs') return context.jobs.map(function (job) { return '[' + job.id + '] ' + job.status + '\t' + job.cmd; });
    if (name === 'fg') {
      const jobId = Number(String(args[0] || '').replace('%', '')) || (context.jobs.length ? context.jobs[context.jobs.length - 1].id : null);
      const job = context.jobs.find(function (j) { return j.id === jobId; });
      if (!job) throw new ZenError('ESRCH', 'no such job');
      if (job.status === 'stopped') { ZenKernel.process.resume(job.pid); job.status = 'running'; }
      return job.output || '';
    }
    if (name === 'bg') {
      const jobId = Number(String(args[0] || '').replace('%', ''));
      const job = context.jobs.find(function (j) { return j.id === jobId; });
      if (!job) throw new ZenError('ESRCH', 'no such job');
      ZenKernel.process.resume(job.pid); job.status = 'running';
      return '[' + job.id + '] ' + job.cmd + ' &';
    }
    if (name === 'zen') {
      if (args[0] === 'doctor') return ZenKernel.doctor().map(function (check) { return '[' + (check.pass ? 'PASS' : 'FAIL') + '] ' + check.name; });
      if (args[0] === 'dmesg') { const boot = ZenKernel.snapshot().bootTime; return ZenKernel.dmesg().map(function (entry) { return '[' + (((entry.at - boot) / 1000).toFixed(3)) + '] ' + entry.message; }); }
      if (args[0] === 'list') return ZenKernel.packages.list().map(function (pkg) { return pkg.id + '@' + pkg.version; });
      if (args[0] === 'info') return JSON.stringify(ZenKernel.packages.info(args[1]));
      if (args[0] === 'install') { const item = (global.SOFTWARE_CATALOG || []).find(function (pkg) { return pkg.id === args[1] || pkg.name.toLowerCase() === String(args[1]).toLowerCase(); }); if (!item) throw new ZenError('ENOENT', 'Package not found'); return ZenKernel.packages.install({ id: item.id, name: item.name, version: '1.8.1', description: item.desc, size: item.size, dependencies: [], permissions: ['filesystem.read', 'notifications'], entryPoint: item.id }).id; }
      if (args[0] === 'remove') return ZenKernel.packages.uninstall(args[1]);
      if (args[0] === 'update') return ZenKernel.packages.update().map(function (pkg) { return pkg.id + '@' + pkg.version; });
      if (args[0] === 'search') return (global.SOFTWARE_CATALOG || []).filter(function (pkg) { return (pkg.name + ' ' + pkg.desc).toLowerCase().includes(String(args[1] || '').toLowerCase()); }).map(function (pkg) { return pkg.id + ' ' + pkg.name; });
      return 'zen install|remove|update|list|info|search|doctor|dmesg';
    }
    if (name === 'grep') return String(input || '').split('\n').filter(function (line) { return line.includes(args[0] || ''); });
    if (name === 'find') return findFiles(kernelPath(args[0] || '.', cwd));
    if (name === 'history') return context.history.map(function (cmd, index) { return (index + 1) + '\t' + cmd; });
    if (name === 'alias') return Object.keys(aliases).map(function (key) { return key + '=' + aliases[key]; });
    if (name === 'sleep') return 'sleep ' + (args[0] || '0') + 's (use ZenShell.executeAsync for real blocking/interruptible sleep)';
    throw new ZenError('ENOSYS', 'command not found: ' + name);
  }
  function findFiles(path) { const results = []; function visit(item, itemPath) { results.push(itemPath); (item.children || []).forEach(function (child) { visit(child, itemPath + '/' + child.name); }); } visit(ZenKernel.fs.stat(path), path); return results; }
  global.ZenShell = { lex: lex, parseStatements: parseStatements, parsePipeline: parsePipeline, execute: execute, executeAsync: executeAsync, interrupt: interrupt, environment: environment };
}(window));