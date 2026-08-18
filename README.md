# ZenOS

> A browser-based desktop environment built from scratch.

ZenOS is an experimental WebOS-style desktop environment designed to
provide a complete, interactive operating-system experience inside the
browser.

The project is being rebuilt from scratch as the final version.

## Vision

ZenOS aims to provide:

- A complete desktop environment
- A modular Window Manager
- An Application Manager
- Persistent files and application data
- Customizable desktop and themes
- Built-in productivity applications
- Terminal and developer tools
- Media integrations
- Games
- Device integration where browser APIs and permissions allow
- A backend for online services
- An integrated AI assistant called Zen

## Development Philosophy

ZenOS is a new implementation.

Previous versions are references rather than codebases to merge.

- V1 → feature and experimentation reference
- V2 → UI/UX and design reference
- J.A.R.V.I.S.-OS → inspiration and architectural research
- ZenOS → new architecture and new implementation

Features from previous versions may be redesigned and reimplemented,
but their existing implementation will not be directly merged into ZenOS.

## Core Architecture

ZenOS will be organized around several core systems:

- Window Manager
- Application Manager
- Storage / File System
- Settings Manager
- Permission Manager
- Device Manager
- Event System
- Zen AI
- Backend Services

## Planned Applications

### Core

- File Manager
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
- Music / Spotify integration
- Gallery
- Video Player

### Creative

- Paint
- Video Editor

### Entertainment

- Game Hub
- ZenOS Games

### AI

- Zen Assistant

## Device Integration

ZenOS will use supported browser APIs and explicit user permissions
to interact with the user's device.

Potential integrations include:

- Bluetooth
- Audio
- Camera
- Microphone
- Files
- Clipboard
- Notifications
- Game controllers
- Fullscreen

Unsupported capabilities must have graceful fallbacks.

## Zen AI

Zen is the integrated AI assistant for ZenOS.

Zen will eventually interact with the operating environment through
controlled ZenOS system APIs.

Example:

User:
> Zen, open Terminal.

Zen:
> Calls the ZenOS application API.

Application Manager:
> Launches Terminal.

Window Manager:
> Creates and focuses the Terminal window.

Zen should not directly manipulate arbitrary application DOM elements.

## Backend

The backend will eventually provide services such as:

- AI gateway
- Authentication
- Cloud synchronization
- User data
- Database services
- API services

ZenOS should retain useful local functionality when backend services
are unavailable.

## Development Roadmap

1. Project foundation
2. ZenOS Core
3. Window Manager
4. Desktop Environment
5. Application Manager
6. Storage / File System
7. Core Applications
8. Customization
9. Media and Games
10. Device Integration
11. Backend
12. Zen AI
13. Testing
14. Performance Optimization
15. Final UI/UX Polish

## Status

🚧 Active development

ZenOS is currently being rebuilt from scratch.