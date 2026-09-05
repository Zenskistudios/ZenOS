Zen OS is a browser-based operating-system simulator built with HTML, CSS and vanilla JavaScript.

## Architecture

The existing desktop and application UI remains in `index.html`. The kernel-like runtime is split into:

- `js/kernel.js`: process table, round-robin scheduler, simulated memory blocks, VFS facade, permissions, syscalls, IPC events, devices, services, packages, and Web Worker management.
- `js/shell.js`: lexer/parser, pipes and redirection syntax, environment expansion, built-in commands, and `zen doctor`.

The runtime is frontend-only. Persistent state remains in browser storage, while processes, workers, scheduler state, memory allocations, and open handles are rebuilt on every boot.

## Diagnostics

Open Terminal and run:

```text
ps
free
df
zen doctor
```

System Monitor reads the kernel process table and memory/filesystem counters. Browser APIs and cross-origin iframe services remain subject to normal browser security and embedding limitations.