# ZenOS

ZenOS is a WebOS-style desktop environment that I'm building from
scratch to experiment with what an operating system could feel like
inside a browser.

This is a long-term project and the current version is still being
worked on.

## What I'm building

The main idea is to create a browser-based desktop where I can open
different applications, move windows around, customize the system,
manage files, and eventually interact with the system through an AI
assistant called Zen.

Some of the things I want ZenOS to have are:

- Desktop and dock
- Window management
- Applications
- File management
- Settings and customization
- Terminal
- Notes and tasks
- Calculator
- Media apps
- Games
- AI assistant
- Device connections
- Backend services

## Starting from scratch

ZenOS is not a direct continuation of my old code.

I have previous versions of the project that I use to see what worked,
what didn't work, and what features are worth bringing into the new
version.

V1 is mainly useful for the features and ideas I experimented with.

V2 helped me explore the UI and the overall desktop experience.

I'm also taking some inspiration from projects such as J.A.R.V.I.S.-OS
while designing my own system.

The final ZenOS code is being written separately instead of merging the
old codebases together.

## How I want ZenOS to work

One of the biggest things I want to improve is how the different parts
of the system communicate.

For example, if I tell Zen:

> Open Terminal

Zen should be able to ask the ZenOS application system to open
Terminal, and the Window Manager should handle displaying and focusing
the window.

This means applications won't have to manage the whole desktop
themselves.

The main systems I'm currently planning are:

- Window Manager
- Application Manager
- Storage
- Settings
- Permissions
- Device Manager
- Event system
- Zen AI
- Backend

## Apps

I don't want every application to be built at once. I'll add them as
the core of ZenOS becomes stable.

### Core apps

- Files
- Terminal
- Settings

### Productivity

- Notes
- Tasks
- Calculator
- Calendar
- Text Editor

### Media

- YouTube
- Music / Spotify
- Gallery
- Video Player

### Creative

- Paint
- Video Editor

### Games

- Game Hub
- ZenOS games

## Zen

Zen is the AI assistant I'm planning to build into ZenOS.

The goal is for Zen to be more than a chat box. I want it to eventually
be able to interact with parts of the operating environment through
specific system functions.

For example:

> "Zen, open Settings."

Zen would send the request to the ZenOS application system, which would
open Settings through the Window Manager.

I'm still working out exactly how the AI and system will communicate.

## Devices

I also want ZenOS to interact with the device it's running on where
the browser allows it.

Some of the areas I'm experimenting with include:

- Bluetooth
- Audio
- Camera
- Microphone
- Files
- Clipboard
- Notifications
- Game controllers
- Fullscreen

Some of these features depend on browser support and user permissions,
so they may not work on every device.

## Backend

A backend will be added as the project grows.

Possible backend features include:

- AI requests
- User accounts
- Cloud storage
- Synchronization
- Database services
- Other online services

The goal is to keep basic parts of ZenOS usable locally even when an
online service isn't available.

## Development plan

I'm building this in stages rather than trying to build everything
at once.

Current plan:

1. Project foundation
2. ZenOS core
3. Window Manager
4. Desktop
5. Application Manager
6. Storage
7. Core apps
8. Customization
9. Media and games
10. Device features
11. Backend
12. Zen AI
13. Testing and optimization
14. Final UI polish

The order can change as I build and discover what needs to be changed.

## Status

🚧 **Work in progress**

ZenOS is still being actively developed.

This is not the final version yet. The architecture, UI, and features
will continue to change as I build and test the system.