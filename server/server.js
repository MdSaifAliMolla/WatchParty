const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const url = require("url");

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || "*");
    },
    credentials: true,
  })
);
app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Store watchparties
const watchparties = new Map();

// Client class
class Client {
  constructor(id, ws, party) {
    this.id = id;
    this.ws = ws;
    this.nickname = "";
    this.party = party;
    this.isAlive = true;
    this.voiceEnabled = false;
  }
}

// PartyInfo structure
class PartyInfo {
  constructor(id, ownerId, src) {
    this.id = id;
    this.ownerId = ownerId;
    this.src = src;
    this.playhead = 0;
    this.isPlaying = false;
  }
}

// Party class
class Party {
  constructor(id, ownerId, src) {
    this.party = new PartyInfo(id, ownerId, src);
    this.clients = new Map();
  }

  run() {
    console.log(`watchparty ${this.party.id} live.`);
    this.broadcastStatus();
  }

  addClient(client) {
    console.log(`${client.nickname} joined ${this.party.id}.`);
    this.clients.set(client, true);
    this.handleJoin(this.party, client);
    this.broadcastJoinOrLeave("new", client);
  }

  removeClient(client) {
    if (this.clients.has(client)) {
      this.clients.delete(client);
      this.broadcastJoinOrLeave("leave", client);

      if (client.voiceEnabled) {
        const voiceDisabledMsg = {
          method: "voice-disabled",
          userId: client.id,
          partyId: this.party.id,
        };
        this.broadcast(JSON.stringify(voiceDisabledMsg), null);
      }
    }
  }

  broadcast(message, senderId) {
    this.clients.forEach((_, client) => {
      if (client.ws.readyState === WebSocket.OPEN && client.id !== senderId) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error("Error sending message:", error);
          this.clients.delete(client);
        }
      }
    });
  }

  // Broadcast to specific client
  sendToClient(clientId, message) {
    this.clients.forEach((_, client) => {
      if (client.id === clientId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error("Error sending message to client:", error);
        }
      }
    });
  }

  handleJoin(party, client) {
    const joinResp = {
      method: "join",
      party: party,
    };

    try {
      client.ws.send(JSON.stringify(joinResp));
    } catch (error) {
      console.error("Error sending join response:", error);
    }
  }

  broadcastJoinOrLeave(method, client) {
    const broadcastMessage = {
      method,
      nickname: client.nickname,
    };

    const msg = JSON.stringify(broadcastMessage);

    this.clients.forEach((_, c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        try {
          c.ws.send(msg);
        } catch (error) {
          console.error("Error broadcasting join/leave:", error);
          this.clients.delete(c);
        }
      }
    });
  }

  broadcastChatMessage(msg, client) {
    const data = {
      method: "chat",
      clientId: client.id,
      nickname: client.nickname,
      partyId: msg.partyId,
      message: msg.message,
      timestamp: Date.now(),
    };

    const resp = JSON.stringify(data);

    // Send to everyone, including sender
    this.clients.forEach((_, c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        try {
          c.ws.send(resp);
        } catch (error) {
          console.error("Error sending chat message:", error);
          this.clients.delete(c);
        }
      }
    });
  }

  broadcastWatchpartyStatus() {
    const data = {
      method: "status",
      id: this.party.id,
      clientId: this.party.ownerId,
      isPlaying: this.party.isPlaying,
      playhead: this.party.playhead,
    };

    const resp = JSON.stringify(data);
    this.broadcast(resp, null);
  }

  broadcastStatus() {
    setInterval(() => {
      this.broadcastWatchpartyStatus();
    }, 2000);
  }

  // WebRTC signaling methods
  handleVoiceEnabled(client) {
    console.log(`${client.nickname} enabled voice chat`);
    client.voiceEnabled = true;

    // Broadcast to all other clients that this user enabled voice
    const voiceEnabledMsg = {
      method: "voice-enabled",
      userId: client.id,
      partyId: this.party.id,
    };

    this.broadcast(JSON.stringify(voiceEnabledMsg), client.id);
  }

  handleVoiceDisabled(client) {
    console.log(`${client.nickname} disabled voice chat`);
    client.voiceEnabled = false;

    // Broadcast to all other clients that this user disabled voice
    const voiceDisabledMsg = {
      method: "voice-disabled",
      userId: client.id,
      partyId: this.party.id,
    };

    this.broadcast(JSON.stringify(voiceDisabledMsg), client.id);
  }

  handleWebRTCSignaling(msg, client) {
    // Forward WebRTC signaling messages to the intended recipient
    const targetClientId = msg.to;

    if (targetClientId) {
      this.sendToClient(targetClientId, JSON.stringify(msg));
    }
  }
}

// Create watchparty
function createParty(id, ownerId, src) {
  return new Party(id, ownerId, src);
}

// Routes
app.get("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send("hello\n");
});

app.get("/create", (req, res) => {
  const { ownerId, partyId, src } = req.query;

  if (!ownerId) {
    console.log("Owner ID not provided");
    return res.status(403).send("Owner ID not provided");
  }

  if (!partyId || !src) {
    console.log("Party ID or video source not provided");
    return res.status(404).send("Incomplete watchparty details provided\n");
  }

  const party = createParty(partyId, ownerId, src);
  watchparties.set(partyId, party);
  party.run();

  res.send("Success");
});

// WebSocket upgrade handler
server.on("upgrade", (request, socket, head) => {
  const query = url.parse(request.url, true).query;
  const userId = query.userId;
  const partyId = query.partyId;

  if (!userId || !partyId) {
    console.log("User ID or Party ID not provided in WebSocket connection");
    socket.destroy();
    return;
  }

  const party = watchparties.get(partyId);
  if (!party) {
    console.log(`Party ${partyId} not found`);
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// WebSocket handling
wss.on("connection", (ws, req) => {
  const query = url.parse(req.url, true).query;
  const userId = query.userId;
  const partyId = query.partyId;

  if (!userId || !partyId) {
    console.log("User ID or Party ID not provided");
    ws.close();
    return;
  }

  const party = watchparties.get(partyId);
  if (!party) {
    console.log(`Party ${partyId} not found for WebSocket connection`);
    ws.close();
    return;
  }

  const client = new Client(userId, ws, party);

  // Heartbeat
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.method) {
        case "join":
          client.nickname = msg.nickname;
          party.addClient(client);
          break;

        case "play":
          party.broadcast(message.toString(), client.id);
          party.party.isPlaying = true;
          break;

        case "pause":
          party.broadcast(message.toString(), client.id);
          party.party.isPlaying = false;
          break;

        case "seeked":
          party.party.playhead = msg.playhead;
          party.broadcast(message.toString(), client.id);
          break;

        case "update":
          party.party.playhead = msg.playhead;
          break;

        case "chat":
          party.broadcastChatMessage(msg, client);
          break;

        case "keepAlive":
          // Client heartbeat - no action needed
          break;

        // WebRTC Voice Chat signaling
        case "voice-enabled":
          party.handleVoiceEnabled(client);
          break;

        case "voice-disabled":
          party.handleVoiceDisabled(client);
          break;

        case "voice-offer":
        case "voice-answer":
        case "voice-ice-candidate":
          party.handleWebRTCSignaling(msg, client);
          break;

        case "end":
          if (client.id === party.party.ownerId) {
            const endMsg = JSON.stringify({ method: "party-ended", partyId: party.party.id });
            party.clients.forEach((_, c) => {
              if (c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(endMsg);
              }
            });
            watchparties.delete(partyId);
            console.log(`Watchparty ${partyId} ended by owner.`);
          }
          break;

        default:
          console.log("Unknown message method:", msg.method);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket connection closed for user ${userId}`);
    party.removeClient(client);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    party.removeClient(client);
  });
});

// Heartbeat interval
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});