// web/components/sidebar/Sidebar.js
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Chat from "./Chat";

import styles from "../../styles/Sidebar.module.css";
import Tabs from "./Tabs";

import { handleClick, handleMouseUp } from "../../functions/sidebar";
import { 
  XMarkIcon, 
  MicrophoneIcon, 
  SpeakerWaveIcon,
  UserGroupIcon 
} from "@heroicons/react/24/solid";

/**
 * @param {object} props
 * @param {import('@supabase/supabase-js').Session} props.session
 * @param {React.MutableRefObject<WebSocket | null>} props.ws
 * @param {string | null} props.partyId
 * @param {any[]} props.messageList
 * @param {React.Dispatch<React.SetStateAction<any[]>>} props.setMessageList
 * @param {boolean} props.wsConnected
 * @param {boolean} props.showSidebar
 * @param {React.Dispatch<React.SetStateAction<boolean>>} props.setShowSidebar
 * @param {boolean} props.voiceChatEnabled
 * @param {React.Dispatch<React.SetStateAction<boolean>>} props.setVoiceChatEnabled
 * @param {boolean} props.voiceConnected
 * @param {boolean} props.isMuted
 * @param {() => void} props.toggleMute
 * @param {string[]} props.participants
 */
const Sidebar = ({
  session,
  ws,
  partyId,
  messageList,
  setMessageList,
  wsConnected,
  showSidebar,
  setShowSidebar,
  voiceChatEnabled,
  setVoiceChatEnabled,
  voiceConnected,
  isMuted,
  toggleMute,
  participants = [],
}) => {
  const [selectedTab, setSelectedTab] = useState("Chat");

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const handleVoiceToggle = () => {
    if (voiceChatEnabled && voiceConnected) {
      // Ask for confirmation before disabling
      if (window.confirm("Leave voice chat?")) {
        setVoiceChatEnabled(false);
      }
    } else {
      setVoiceChatEnabled(true);
    }
  };

  return (
    <div
      onMouseDown={(e) => handleClick(e)}
      id="border"
      className={styles.container}
    >
      <div className={styles.window}>
        <div className="flex items-center justify-between pr-2 pb-2 border-b border-neutral-700">
          <Tabs selectedTab={selectedTab} setSelectedTab={setSelectedTab} />

          <div className="flex items-center space-x-2">
            {/* Voice Chat Controls */}
            <div className="flex items-center space-x-2 px-2 py-1 bg-neutral-800 rounded">
              {/* Enable/Disable Voice Chat Button */}
              <button
                onClick={handleVoiceToggle}
                className={`p-1.5 rounded transition-all duration-150 ${
                  voiceConnected
                    ? "bg-teal-500 hover:bg-teal-600"
                    : "bg-neutral-600 hover:bg-neutral-500"
                }`}
                title={voiceConnected ? "Leave voice chat" : "Join voice chat"}
              >
                <SpeakerWaveIcon className="w-4 h-4 text-white" />
              </button>

              {/* Mute/Unmute Button (only visible when connected) */}
              {voiceConnected && (
                <button
                  onClick={toggleMute}
                  className={`p-1.5 rounded transition-all duration-150 ${
                    isMuted
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-teal-500 hover:bg-teal-600"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <MicrophoneIcon 
                    className={`w-4 h-4 text-white ${isMuted ? 'opacity-50' : ''}`}
                  />
                </button>
              )}

              {/* Participant Count (only visible when connected) */}
              {voiceConnected && participants.length > 0 && (
                <div 
                  className="flex items-center space-x-1 px-2 py-1 bg-neutral-700 rounded"
                  title={`${participants.length + 1} in voice chat (including you)`}
                >
                  <UserGroupIcon className="w-3 h-3 text-teal-400" />
                  <span className="text-xs text-teal-400 font-mono">
                    {participants.length + 1}
                  </span>
                </div>
              )}
            </div>

            {/* WebSocket status indicator */}
            <div
              title={wsConnected ? "Connected" : "Disconnected"}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                wsConnected ? "bg-teal-400" : "bg-red-500"
              }`}
            ></div>

            {/* Close sidebar button */}
            {showSidebar && (
              <button 
                className="ml-1" 
                onClick={() => setShowSidebar(false)}
                title="Hide sidebar"
              >
                <XMarkIcon
                  width={25}
                  className="text-neutral-400 hover:text-neutral-200 duration-150"
                />
              </button>
            )}
          </div>
        </div>

        {/* Voice Chat Status Banner */}
        {voiceConnected && (
          <div className="px-3 py-2 bg-teal-900/30 border-b border-teal-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <p className="text-xs text-teal-300">
                  {isMuted ? "Voice chat (muted)" : "Voice chat active"}
                </p>
              </div>
            </div>
          </div>
        )}

        <main>
          <AnimatePresence mode="wait">
            <motion.div
              className={styles.motionDiv}
              key={selectedTab}
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: -20 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
            >
              {selectedTab === "Chat" ? (
                <Chat
                  session={session}
                  ws={ws}
                  partyId={partyId}
                  messageList={messageList}
                  setMessageList={setMessageList}
                />
              ) : (
                "Settings"
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Sidebar;