# WatchParty (Fireplace)

A real-time watch party application for synchronized video viewing with friends.

## How it works

1. When a user signs up, the app sends a magic link using Supabase's authentication service.
2. All uploaded videos are stored in AWS S3.
3. Playback controls are synced in real time with the help of a WebSocket server.
4. Voice chat is enabled using WebRTC peer-to-peer connections with free STUN servers.

## Getting Started

### Prerequisites
- Node.js >= 16.0.0
- npm

### Running the Backend (WebSocket Server)

```bash
cd server
npm install
npm run dev
```

The server runs on `http://localhost:6969` by default.

### Running the Frontend (Next.js App)

```bash
cd web
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

### Environment Variables

**Frontend (`web/.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `NEXT_PUBLIC_WEBSOCKET_URL` - WebSocket server URL (default: `ws://localhost:6969`)
- `NEXT_PUBLIC_SERVER_URL` - Server URL (default: `http://localhost:6969`)
- `NEXT_PUBLIC_SITE_URL` - Your site URL for share links

## Deployment

- Frontend: Vercel
- Backend: AWS or any Node.js hosting platform
