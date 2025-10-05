// web/components/sidebar/ChatMessage.js
import styles from "../../styles/Chat.module.css"

// Format timestamp to readable time
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatMessage = ({ messageObj, currentUserId }) => {
  if (messageObj.type === "event") {
    return (
      <div className="py-2 flex justify-center items-center space-x-2">
        <div className="flex-grow h-px bg-neutral-700"></div>
        <p className="text-neutral-500 text-xs truncate px-2">{messageObj.message}</p>
        <div className="flex-grow h-px bg-neutral-700"></div>
      </div>
    )
  }

  // Determine if message was sent by current user
  const isSent = messageObj.clientId === currentUserId

  return (
    <div
      className={`${styles.wrapper} hover:bg-neutral-800/30 transition-colors duration-150 rounded px-1`}
    >
      <div className={`${isSent ? 'text-right mr-3' : 'text-left'}`}>
        {/* Nickname and time header - only show for received messages */}
        {!isSent && (
          <div className="flex items-center space-x-2 mb-0.5">
            <span className="text-xs font-medium text-teal-400">{messageObj.nickname}</span>
            {messageObj.timestamp && (
              <span className="text-xs text-neutral-500">{formatTime(messageObj.timestamp)}</span>
            )}
          </div>
        )}
        <div
          className={`${isSent ? 'bg-teal-600/80 ml-auto' : 'bg-neutral-700'} break-words inline-block py-2 px-3 rounded-xl max-w-[85%] shadow-sm`}
        >
          <p className="text-neutral-100 text-sm leading-relaxed">{messageObj.message}</p>
        </div>
        {/* Timestamp for sent messages */}
        {isSent && messageObj.timestamp && (
          <p className="text-xs text-neutral-500 mt-0.5">{formatTime(messageObj.timestamp)}</p>
        )}
      </div>
    </div>
  )
}

export default ChatMessage