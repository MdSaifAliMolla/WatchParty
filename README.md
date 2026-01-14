# Bonfire

A real-time watch party application for synchronized video viewing with friends. Experience movies, shows, and videos together with voice chat, synchronized playback controls, and real-time messaging.

<img width="1700" height="700" alt="Screenshot (65)" src="https://github.com/user-attachments/assets/4c9b4865-6d5c-4eb6-8f6c-045fa4a171a0" />
<img width="1700" height="700" alt="Screenshot (62)" src="https://github.com/user-attachments/assets/4c06c0ea-dd8e-4e4f-90ee-df1a675e56df" />
<img width="1700" height="700" alt="Screenshot (63)" src="https://github.com/user-attachments/assets/5b08ad05-a408-4ed5-814c-f9da0fa6b3fd" />
<img width="1700" height="700" alt="Screenshot (66)" src="https://github.com/user-attachments/assets/b4b093ba-e4ad-48f2-b1a5-9544ab18bc59" />


### Features

- **Synchronized Video Playback**: Play, pause, and seek controls are synced across all participants in real-time
- **Voice Chat**: Peer-to-peer WebRTC voice communication during watch parties
- **Real-time Chat**: Text messaging with timestamps for all participants
- **Authentication**: login using Supabase 
- **Cloud Video Storage**: Upload and stream videos directly from AWS S3
- **Shareable Links**: Easy invitation system for friends to join watch parties
- **Responsive Design**: Modern UI built with Next.js and Tailwind CSS

### System Architecture

### Core Components

#### 1. Frontend (Next.js)
- **Framework**: Next.js 13 with App Router
- **Styling**: Tailwind CSS with Headless UI components
- **State Management**: React hooks and SWR for server state
- **Real-time Communication**: WebSocket client and WebRTC peer connections

#### 2. WebSocket Server (Node.js)
- **Framework**: Express.js with HTTP server
- **WebSocket Library**: ws library for real-time communication
- **Core Responsibilities**:
  - Managing watch party sessions
  - Broadcasting playback controls (play/pause/seek)
  - Handling chat messages
  - WebRTC signaling for voice chat
  - Client connection management with heartbeat

#### 3. External Services
- **Authentication**: Supabase Auth with magic link emails
- **Storage**: AWS S3 for video file storage and CDN delivery
- **WebRTC**: Free STUN servers for NAT traversal

### Data Flow

#### Authentication Flow
1. User enters email → Supabase sends magic link
2. User clicks magic link → Supabase authenticates user
3. Frontend receives auth token → User is logged in

#### Watch Party Creation Flow
1. Authenticated user uploads video to AWS S3
2. Frontend requests party creation from WebSocket server
3. Server creates party instance with unique ID
4. Shareable link generated for inviting friends

#### Real-time Synchronization Flow
1. User action (play/pause/seek) → WebSocket message to server
2. Server broadcasts action to all party participants
3. Clients receive message and synchronize video player state
4. Status broadcast every 2 seconds ensures consistency

#### Voice Chat Flow
1. User enables voice chat → WebRTC peer connection setup
2. Server acts as signaling server for WebRTC
3. Direct peer-to-peer audio streams established
4. Server relays signaling messages only

### Database Schema (Supabase)

```sql
-- Users table (handled by Supabase Auth)
users (
  id: uuid (primary key),
  email: text,
  created_at: timestamp
)

-- Watch parties table
watch_parties (
  id: text (primary key),
  owner_id: uuid (foreign key),
  video_src: text,
  created_at: timestamp,
  is_active: boolean
)

-- Party participants table
party_participants (
  id: uuid (primary key),
  party_id: text (foreign key),
  user_id: uuid (foreign key),
  joined_at: timestamp,
  nickname: text
)
```

### API Endpoints

#### WebSocket Server
- `GET /` - Health check endpoint
- `GET /create?ownerId={id}&partyId={id}&src={url}` - Create new watch party
- `WebSocket /?userId={id}&partyId={id}` - Real-time connection

#### WebSocket Message Types
- `join` - User joins party with nickname
- `play/pause` - Playback control synchronization
- `seeked/update` - Video position synchronization
- `chat` - Text messaging
- `voice-enabled/disabled` - Voice chat status
- `voice-offer/answer/ice-candidate` - WebRTC signaling
- `end` - Party termination (owner only)


## Getting Started

### Prerequisites
- Node.js >= 16.0.0
- npm
- Supabase account (for authentication)
- AWS account (for S3 storage)

### Installation

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd Bonfire
```

#### 2. Set Up Backend (WebSocket Server)
```bash
cd server
npm install
```

#### 3. Set Up Frontend (Next.js App)
```bash
cd ../web
npm install
```

### Configuration

#### Environment Variables

**Backend (`server/.env`):**
```env
PORT=6969
NODE_ENV=development
```

**Frontend (`web/.env`):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:6969
NEXT_PUBLIC_SERVER_URL=http://localhost:6969
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

#### External Services Setup

**Supabase Configuration:**
1. Create new Supabase project
2. Enable email authentication
3. Configure redirect URLs for magic links
4. Set up database tables (see schema above)
5. Generate service role key

**AWS S3 Configuration:**
1. Create S3 bucket for video storage
2. Configure CORS policy for bucket access
3. Set up IAM user with S3 permissions
4. Generate access keys for the application

### Running the Application

#### 1. Start the WebSocket Server
```bash
cd server
npm run dev
```
The server runs on `http://localhost:6969` by default.

#### 2. Start the Frontend
```bash
cd web
npm run dev
```
The frontend runs on `http://localhost:3000`.

#### 3. Access the Application
Open `http://localhost:3000` in your browser and start creating watch parties!
