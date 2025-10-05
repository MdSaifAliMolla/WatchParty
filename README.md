### How it works

1. When a user signs up, Fireplace sends a magic link using Supabase's authentication service.
2. All uploaded videos are stored in AWS S3.
3. Playback controls are synced in real time with the help of a websocket server.
4. Voice chat is enabled using Dolby's APIs. The voice chat features spatial audio, allowing multiple participants to be heard clearly even when speaking at the same time.

Vercel has been used to host the next.js app and AWS to deploy the websocket server.



