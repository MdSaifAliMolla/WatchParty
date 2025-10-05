"use client";

import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import VideoPlayer from "../../../../../components/VideoPlayer";
import Loader from "../../../../../components/Loading";
import Sidebar from "../../../../../components/sidebar/Sidebar";
import { updatePlayhead, keepAlive } from "../../../../../functions/watchparty";
import { useWebRTCVoice } from "../../../../../hooks/useVoice";

import styles from "../../../../../styles/Watch.module.css";
import { videoNameWithoutExtension } from "../../../../../functions/utils";

interface ClientProps {
  params: {
    creatorId: string;
    id: string;
    nickname: string;
  };
  session: Session;
}

export default function ClientComponent({ params, session }: ClientProps) {
  const ws = useRef<globalThis.WebSocket | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [videoName, setVideoName] = useState("");
  const [autoplay, setAutoplay] = useState(false);
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [creator, setCreator] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playheadStart, setPlayheadStart] = useState(0);
  const [denied, setDenied] = useState(true);
  const [messageList, setMessageList] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [waitTime, setWaitTime] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const [unreadIndicator, setUnreadIndicator] = useState(false);
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false);

  // WebRTC Voice Chat Hook
  const { isConnected: voiceConnected, isMuted, participants, toggleMute, leaveVoiceChat } =
    useWebRTCVoice({
      ws: ws,
      userId: session.user.id,
      partyId: params.id,
      enabled: voiceChatEnabled,
    });

  const sleep = async (time: number) => {
    return new Promise((res) => {
      setTimeout(res, time);
    });
  };

  const reconnect = async (wait: number) => {
    console.log("Reconnecting");
    await sleep(wait);
    setWaitTime((prev) => 2 * prev);
    setupWsConnection();
  };

  const setupWsConnection = () => {
    const { id, nickname } = params;
    const clientId = session.user.id;
    const isCreator = params.creatorId === clientId;

    if (ws.current && ws.current.readyState === globalThis.WebSocket.OPEN) {
      ws.current.close();
    }

    const websocketBaseUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:6969";

    const socket = new globalThis.WebSocket(
      `${websocketBaseUrl}?userId=${clientId}&partyId=${id}`
    );

    ws.current = socket;

    socket.onopen = () => {
      const payload = {
        method: "join",
        clientId: clientId,
        nickname: decodeURIComponent(nickname),
        partyId: id,
      };

      if (socket.readyState === globalThis.WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }

      setWsConnected(true);
      setWaitTime(1);
    };

    socket.onerror = (event: any) => {
      console.error("onerror", event);
    };

    socket.onclose = (event: any) => {
      console.log("onclose", event);
      if (ws.current !== socket) return;
      if (!event.wasClean) {
        setWsConnected(false);
        reconnect(waitTime);
      }
    };

    socket.onmessage = (message: any) => {
      if (ws.current !== socket) return;
      const response = JSON.parse(message.data as string);
      const vid = document.getElementById("video") as HTMLVideoElement;

      if (response.method === "join") {
        setVideoSrc(response.party.src);
        setLoading(false);
        setPlayheadStart(response.party.playhead);
        setDenied(false);

        if (response.party.isPlaying) {
          setAutoplay(true);
        }

        if (isCreator) {
          const partyId = response.party.id;
          updatePlayhead(partyId, ws);
        } else {
          keepAlive(clientId, ws);
        }
      }

      if (response.method === "new") {
        toast(`${response.nickname} joined!`, {
          icon: "✌️",
          position: "top-right",
          style: {
            background: "#333",
            color: "#fff",
          },
        });
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "event",
            message: `${response.nickname} joined`,
          },
        ]);
      }

      if (response.method === "leave") {
        toast(`${response.nickname} left!`, {
          icon: "👋",
          position: "top-right",
          style: {
            background: "#333",
            color: "#fff",
          },
        });
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "event",
            message: `${response.nickname} left`,
          },
        ]);
      }

      // Video playback sync - only non-creators should respond
      if (response.method === "play") {
        if (!isCreator && vid) {
          vid.play().catch(e => console.error('Play failed:', e));
        }
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "event",
            message: "Video playing",
          },
        ]);
      }

      if (response.method === "pause") {
        if (!isCreator && vid) {
          vid.pause();
        }
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "event",
            message: "Video paused",
          },
        ]);
      }

      if (response.method === "seeked") {
        if (!isCreator && vid) {
          // Pause video during seek for smoother sync
          const wasPlaying = !vid.paused;
          vid.pause();
          vid.currentTime = response.playhead;
          // Resume if it was playing
          if (wasPlaying) {
            vid.play().catch(e => console.error('Play after seek failed:', e));
          }
        }
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "event",
            message: "Video seeked",
          },
        ]);
      }

      // Periodic status updates from server for sync
      if (response.method === "status") {
        if (!isCreator && vid && !vid.seeking) {
          const timeDiff = Math.abs(vid.currentTime - response.playhead);

          // Sync if difference is more than 1 second (tighter sync)
          // This ensures members stay close to creator's position
          if (timeDiff > 1 && response.isPlaying) {
            console.log(`Syncing video: ${timeDiff.toFixed(2)}s difference`);
            // Add small buffer ahead for streaming compensation
            vid.currentTime = response.playhead + 0.2;
          }

          // Sync play/pause state
          if (response.isPlaying && vid.paused) {
            vid.play().catch(e => console.error('Auto-play failed:', e));
          } else if (!response.isPlaying && !vid.paused) {
            vid.pause();
          }
        }
      }

      if (response.method === "chat") {
        setMessageList((oldArr) => [
          ...oldArr,
          {
            type: "message",
            message: response.message,
            clientId: response.clientId,
            nickname: response.nickname,
            timestamp: response.timestamp,
          },
        ]);
      }

      if (response.method === "party-ended") {
        toast("The watchparty has been ended by the creator.", {
          icon: "🏁",
          position: "top-right",
          style: {
            background: "#333",
            color: "#fff",
          },
        });
        setTimeout(() => {
          router.push("/app");
        }, 2000);
      }
    };
  };

  const fetchVideoName = async () => {
    const resp = await fetch(
      `/api/watchparty/get-video-name?watchpartyId=${params.id}`
    );
    const { name } = await resp.json();
    setVideoName(videoNameWithoutExtension(name));
  };

  const handleEndParty = async () => {
    if (!creator) {
      console.log("Not creator, cannot end party");
      return;
    }

    console.log("Ending party with ID:", params.id);
    const confirmEnd = window.confirm("Are you sure you want to end this watchparty for everyone?");
    if (!confirmEnd) return;

    const loadingToast = toast.loading("Ending watchparty...");

    try {
      // 1. Notify server to kick everyone
      if (ws.current && ws.current.readyState === globalThis.WebSocket.OPEN) {
        console.log("Sending 'end' message to WebSocket server");
        ws.current.send(JSON.stringify({ method: "end" }));
      } else {
        console.warn("WebSocket not open, cannot send 'end' message");
      }

      // 2. Delete from Supabase via server-side API (to bypass RLS if needed)
      console.log("Deleting watchparty via API...");
      const response = await fetch("/api/watchparty/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: params.id,
          creatorId: session.user.id
        }),
      });

      const result = await response.json();
      console.log("API response:", result);

      if (!response.ok) {
        console.error("Error deleting watchparty via API:", result.error);
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        // Even if DB delete fails, we might still want to redirect the creator
      } else {
        console.log("Watchparty deleted successfully via API");
        toast.success("Watchparty ended successfully", { id: loadingToast });
      }

      // 3. Redirect
      console.log("Redirecting to dashboard (/app)");
      router.push("/app");
    } catch (err: any) {
      console.error("Failed to end party:", err);
      toast.error(`Failed to end watchparty: ${err.message || 'Unknown error'}`, { id: loadingToast });
    }
  };

  useEffect(() => {
    if (!showSidebar) {
      setUnreadIndicator(true);
    }
  }, [messageList, showSidebar]);

  useEffect(() => {
    const { creatorId, id } = params;
    setPartyId(id);

    if (creatorId === session.user.id) {
      setCreator(true);
      setCreatorUserId(creatorId);
    } else {
      setCreator(false);
      setCreatorUserId(null);
    }

    setupWsConnection();
    fetchVideoName();

    return () => {
      if (ws.current && ws.current.readyState === globalThis.WebSocket.OPEN) {
        console.log("Closing connection");
        ws.current.close();
      }
      if (voiceConnected) {
        leaveVoiceChat();
      }
    };
  }, []);

  return (
    <>
      <div>
        {loading ? (
          <Loader loading={loading} />
        ) : (
          <div ref={screenRef} className={styles.container}>
            {creator ? (

              <VideoPlayer
                src={videoSrc}
                name={videoName}
                controls={true}
                partyId={partyId}
                creatorId={creatorUserId}
                ws={ws}
                playheadStart={playheadStart}
                screenRef={screenRef}
                autoplay={autoplay}
                unreadIndicator={unreadIndicator}
                setUnreadIndicator={setUnreadIndicator}
                showSidebar={showSidebar}
                setShowSidebar={setShowSidebar}
                onEndParty={handleEndParty}
              />
            ) : (
              // @ts-ignore
              <VideoPlayer
                src={videoSrc}
                name={videoName}
                controls={false}
                playheadStart={playheadStart}
                screenRef={screenRef}
                partyId=""
                creatorId=""
                ws={null}
                autoplay={autoplay}
                unreadIndicator={unreadIndicator}
                setUnreadIndicator={setUnreadIndicator}
                showSidebar={showSidebar}
                setShowSidebar={setShowSidebar}
                onEndParty={undefined}
              />
            )}

            {showSidebar && (
              // @ts-ignore
              <Sidebar
                session={session}
                ws={ws}
                partyId={partyId}
                messageList={messageList}
                setMessageList={setMessageList}
                wsConnected={wsConnected}
                showSidebar={showSidebar}
                setShowSidebar={setShowSidebar}
                voiceChatEnabled={voiceChatEnabled}
                setVoiceChatEnabled={setVoiceChatEnabled}
                voiceConnected={voiceConnected}
                isMuted={isMuted}
                toggleMute={toggleMute}
                participants={participants}
              />
            )}

            <Toaster
              toastOptions={{
                style: {
                  minWidth: "300px",
                },
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}