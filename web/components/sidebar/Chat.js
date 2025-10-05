// web/components/sidebar/Chat.js
import { useEffect, useState } from "react"
import Image from "next/image"
import ChatMessage from "./ChatMessage"

import styles from "../../styles/Chat.module.css"

const Chat = ({ session, ws, partyId, messageList, setMessageList }) => {
  const [message, setMessage] = useState("")

  const addMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return;

    if (ws.current) {
      const payload = {
        "method": "chat",
        "clientId": session ? session.user.id : "sus",
        "partyId": partyId,
        "message": message
      }
      ws.current.send(JSON.stringify(payload))
    }

    // REMOVED: Don't add message locally - wait for server broadcast
    // This prevents duplicate messages since the server will broadcast
    // the message back to all clients including the sender
    
    setMessage("")
  }

  // Auto scroll to bottom of chat whenever new message is added
  useEffect(() => {
    const chat = document.getElementById("chat")
    if (chat) {
      chat.scrollTop = chat.scrollHeight
    }
  }, [messageList])

  return (
    <div className={styles.container}> 
      <div id="chat"
        className={styles.chat}
      >
        {messageList.map((messageObj, index) => (
          <ChatMessage 
            messageObj={messageObj} 
            key={index}
            currentUserId={session?.user.id}
          />
        ))}
      </div>
      <form className={styles.inputWrapper} onSubmit={addMessage}>
        <input 
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          type="text"
          placeholder="Enter message"
          className="text-sm text-neutral-200"
        />
        <button
          type="submit"
          className={styles.sendIcon}
        >
          <Image src="/arrow-icon.svg"
            alt="Send message icon"
            width={28} height={28} 
          />
        </button>
      </form>
    </div>
  )
}

export default Chat