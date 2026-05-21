# Multi-Monitor Workout System

A comprehensive workout management system with web-based administration and Electron-based multi-monitor playback.

## Project Structure

This is a monorepo containing three main packages:

- `packages/web-app` - React web application for workout management
- `packages/api-server` - Node.js/Express API server with PostgreSQL database
- `packages/electron-app` - Electron application for multi-monitor workout playback

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
cd packages/api-server
cp .env.example .env
# Edit .env with your database credentials
npm run db:generate
npm run db:migrate
```

3. Start development servers:
```bash
# Terminal 1 - API Server
npm run dev:api

# Terminal 2 - Web App  
npm run dev:web

# Terminal 3 - Electron App (optional)
npm run dev:electron
```

## Development

- Web app runs on http://localhost:3000
- API server runs on http://localhost:3001
- Electron app launches as desktop application

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```