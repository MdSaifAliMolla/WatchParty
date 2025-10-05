// web/hooks/useWebRTCVoice.ts
import { useEffect, useRef, useState } from 'react';

interface UseWebRTCVoiceProps {
  ws: React.MutableRefObject<WebSocket | null>;
  userId: string;
  partyId: string;
  enabled: boolean;
}

export const useWebRTCVoice = ({ ws, userId, partyId, enabled }: UseWebRTCVoiceProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Free STUN servers from Google
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!enabled || !ws.current) return;

    const initializeVoice = async () => {
      try {
        console.log('Requesting microphone access...');
        // Get local audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        });

        localStreamRef.current = stream;
        setIsConnected(true);
        console.log('✅ Microphone access granted');

        // Notify server that voice is enabled
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            method: 'voice-enabled',
            userId: userId,
            partyId: partyId,
          }));
          console.log('Sent voice-enabled notification');
        }

      } catch (error) {
        console.error('❌ Failed to get audio stream:', error);
        alert('Please allow microphone access to use voice chat');
        setIsConnected(false);
      }
    };

    initializeVoice();

    // Store original onmessage handler
    const originalOnMessage = ws.current.onmessage;

    // Wrap the original handler
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle WebRTC signaling messages
      if (data.method?.startsWith('voice-')) {
        handleWebRTCMessage(data);
      }

      // Call original handler for other messages
      if (originalOnMessage) {
        originalOnMessage.call(ws.current, event);
      }
    };

    return () => {
      leaveVoiceChat();
      // Restore original handler
      if (ws.current && originalOnMessage) {
        ws.current.onmessage = originalOnMessage;
      }
    };
  }, [enabled, ws.current, userId, partyId]);

  const handleWebRTCMessage = (data: any) => {
    switch (data.method) {
      case 'voice-enabled':
        if (data.userId !== userId && data.partyId === partyId) {
          console.log('User enabled voice:', data.userId);
          // Small delay to ensure both sides are ready
          setTimeout(() => {
            createPeerConnection(data.userId, true);
          }, 500);
        }
        break;

      case 'voice-offer':
        if (data.to === userId) {
          handleOffer(data.from, data.offer);
        }
        break;

      case 'voice-answer':
        if (data.to === userId) {
          handleAnswer(data.from, data.answer);
        }
        break;

      case 'voice-ice-candidate':
        if (data.to === userId) {
          handleIceCandidate(data.from, data.candidate);
        }
        break;

      case 'voice-disabled':
        if (data.userId !== userId) {
          console.log('User disabled voice:', data.userId);
          closePeerConnection(data.userId);
        }
        break;
    }
  };

  const createPeerConnection = async (remoteUserId: string, createOffer: boolean = false) => {
    try {
      console.log('Creating peer connection with:', remoteUserId);

      const pc = new RTCPeerConnection(iceServers);
      peerConnectionsRef.current.set(remoteUserId, pc);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && ws.current) {
          ws.current.send(JSON.stringify({
            method: 'voice-ice-candidate',
            to: remoteUserId,
            from: userId,
            partyId: partyId,
            candidate: event.candidate,
          }));
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${remoteUserId}:`, pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          closePeerConnection(remoteUserId);
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('✅ Received remote track from:', remoteUserId);

        // Create or get audio element for this user
        let audio = audioElementsRef.current.get(remoteUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.volume = 1.0;
          audioElementsRef.current.set(remoteUserId, audio);
        }

        audio.srcObject = event.streams[0];

        // Play the audio (important for some browsers)
        audio.play().then(() => {
          console.log('🔊 Playing audio from:', remoteUserId);
        }).catch(e => {
          console.error('Failed to play audio:', e);
        });

        // Update participants list
        if (!participants.includes(remoteUserId)) {
          setParticipants(prev => [...prev, remoteUserId]);
        }
      };

      // Create and send offer if initiator
      if (createOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (ws.current) {
          ws.current.send(JSON.stringify({
            method: 'voice-offer',
            to: remoteUserId,
            from: userId,
            partyId: partyId,
            offer: offer,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to create peer connection:', error);
    }
  };

  const handleOffer = async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log('Handling offer from:', remoteUserId);

      // Create peer connection if it doesn't exist
      let pc = peerConnectionsRef.current.get(remoteUserId);
      if (!pc) {
        await createPeerConnection(remoteUserId, false);
        pc = peerConnectionsRef.current.get(remoteUserId);
      }

      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws.current) {
        ws.current.send(JSON.stringify({
          method: 'voice-answer',
          to: remoteUserId,
          from: userId,
          partyId: partyId,
          answer: answer,
        }));
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  };

  const handleAnswer = async (remoteUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      console.log('Handling answer from:', remoteUserId);

      const pc = peerConnectionsRef.current.get(remoteUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  };

  const handleIceCandidate = async (remoteUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionsRef.current.get(remoteUserId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  };

  const closePeerConnection = (remoteUserId: string) => {
    console.log('Closing connection with:', remoteUserId);

    const pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteUserId);
    }

    const audio = audioElementsRef.current.get(remoteUserId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(remoteUserId);
    }

    setParticipants(prev => prev.filter(id => id !== remoteUserId));
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      console.log('Muted:', !audioTrack.enabled);
    }
  };

  const leaveVoiceChat = () => {
    console.log('🔇 Leaving voice chat');

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, userId) => {
      closePeerConnection(userId);
    });
    peerConnectionsRef.current.clear();

    // Stop all audio elements
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track:', track.kind);
      });
      localStreamRef.current = null;
    }

    // Notify server
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        method: 'voice-disabled',
        userId: userId,
        partyId: partyId,
      }));
      console.log('Sent voice-disabled notification');
    }

    setIsConnected(false);
    setIsMuted(false);
    setParticipants([]);
  };

  return {
    isConnected,
    isMuted,
    participants,
    toggleMute,
    leaveVoiceChat,
  };
};