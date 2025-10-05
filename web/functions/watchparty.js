// Handle video play
export const handlePlay = (id, creatorId, ws) => {
  const payload = {
    method: "play",
    partyId: id,
    clientId: creatorId,
  };

  if (!ws?.current || ws.current.readyState !== WebSocket.OPEN) return;
  ws.current.send(JSON.stringify(payload));
};

// Handle video pause
export const handlePause = (id, creatorId, ws) => {
  const payload = {
    method: "pause",
    partyId: id,
    clientId: creatorId,
  };

  if (!ws?.current || ws.current.readyState !== WebSocket.OPEN) return;
  ws.current.send(JSON.stringify(payload));
};

// Handle video seek
export const handleSeeked = (id, creatorId, ws) => {
  const vid = document.getElementById("video");
  const playhead = vid.currentTime;

  const payload = {
    method: "seeked",
    partyId: id,
    clientId: creatorId,
    playhead: playhead,
  };

  if (!ws?.current || ws.current.readyState !== WebSocket.OPEN) return;
  ws.current.send(JSON.stringify(payload));
};

// Load start position of video
export const loadStartPosition = (playheadStart) => {
  const vid = document.getElementById("video");
  if (!vid) return;
  vid.currentTime = Number(playheadStart) || 0;
};

// Periodically update playhead status
export const updatePlayhead = (partyId, ws) => {
  const vid = document.getElementById("video");
  const playhead = vid?.currentTime;

  const payload = {
    method: "update",
    partyId: partyId,
    playhead: playhead || 0,
  };

  if (ws?.current && ws.current.readyState === WebSocket.OPEN) {
    ws.current.send(JSON.stringify(payload));
  }

  setTimeout(() => updatePlayhead(partyId, ws), 300);
};

export const keepAlive = (userId, ws) => {
  const payload = {
    method: "keepAlive",
    clientId: userId,
  };

  if (ws?.current && ws.current.readyState === WebSocket.OPEN) {
    ws.current.send(JSON.stringify(payload));
  }

  setTimeout(() => keepAlive(userId, ws), 25000);
};
