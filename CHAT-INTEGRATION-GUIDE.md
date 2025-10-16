# AWS IVS Chat Integration Guide

## Changes Made

### 1. Backend Changes

#### New Files:
- **`server/routes/chat.js`**: New endpoint to generate IVS Chat tokens
  - POST `/api/chat/token` - Generate chat token for a room

#### Modified Files:
- **`server/server.js`**: Added chat routes
- **`server/routes/stream.js`**: 
  - Added IVS Chat room creation when creating a stream
  - Returns `chatRoomArn` in stream data
  - Added necessary AWS SDK imports for IVS Chat

### 2. Frontend Changes

#### Modified Files:
- **`client/index.html`**: Added IVS Chat SDK script tag
  ```html
  <script src="https://player.live-video.net/1.8.0/amazon-ivs-chat-messaging.min.js"></script>
  ```

- **`client/js/chat.js`**: Completely rewritten to use IVS Chat SDK
  - Removed WebSocket-based implementation
  - Added IVS Chat SDK integration
  - `connectToChat(chatRoomArn)` - Connect to an IVS Chat room
  - `sendMessage()` - Send messages using IVS Chat API
  - `handleMessage()` - Receive and display messages from IVS Chat

- **`client/js/stream.js`**: Added auto-connect to chat when stream loads
  - Connects to chat room automatically when `chatRoomArn` is available

- **`client/js/auth.js`**: Added chat disconnect on logout

### 3. Dependencies
Added to `package.json`:
- `@aws-sdk/client-ivschat`

## Deployment Steps

### ✅ Local Development (COMPLETED):
1. ✅ Installed dependencies: `npm install`
2. ✅ Server running on http://localhost:3000
3. ✅ IVS Chat SDK loaded in frontend

### On EC2 (98.91.28.43):

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Integrate AWS IVS Chat API"
   git push origin main
   ```

2. **SSH to EC2 and deploy:**
   ```bash
   ssh ubuntu@98.91.28.43
   cd /home/ubuntu/IVS
   git pull origin main
   npm install
   pm2 restart ivs-app
   pm2 logs ivs-app
   ```

3. **Verify deployment:**
   - Visit http://98.91.28.43:3000
   - Check PM2 logs for any errors
   - Test chat functionality

## How It Works

### Stream Creation Flow:
1. User creates a stream
2. Backend creates:
   - AWS IVS Channel (for video streaming)
   - AWS IVS Chat Room (for chat)
3. Backend saves `chatRoomArn` in DynamoDB along with stream data
4. Backend returns stream data including `chatRoomArn`

### Chat Connection Flow:
1. Frontend loads stream data (which includes `chatRoomArn`)
2. Frontend calls `/api/chat/token` to get a chat token
3. Backend generates token using AWS IVS Chat `CreateChatTokenCommand`
4. Frontend initializes IVS Chat SDK with the token
5. Frontend connects to the chat room
6. Users can send and receive messages in real-time

### Message Flow:
1. User types message and clicks Send
2. Frontend calls `chatRoom.sendMessage()` (IVS Chat SDK)
3. Message is sent to AWS IVS Chat service
4. AWS IVS Chat broadcasts message to all connected users
5. All users receive message via IVS Chat SDK event listener
6. Frontend displays message in chat UI

## Environment Variables Required

Make sure these are in your `.env` file:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Testing

### Local Testing (http://localhost:3000):
1. **Create a stream:** 
   - Log in to your account
   - Click "Bắt đầu Stream"
   - Copy the Stream Key and Ingest Server
   
2. **Start streaming from OBS:**
   - Open OBS Studio
   - Go to Settings > Stream
   - Service: Custom
   - Server: `rtmps://xxxxx.global-contribute.live-video.net:443/app/`
   - Stream Key: (paste your stream key)
   - Click OK and Start Streaming

3. **Test chat (open 2 browser windows):**
   - Window 1: Log in with Account A
   - Window 2: Log in with Account B
   - Both should see the video stream
   - Send messages from both windows
   - Verify messages appear in both windows in real-time

### After EC2 Deployment:
Same testing steps but use http://98.91.28.43:3000

### Expected Behavior:
- ✅ Chat connects automatically when stream loads
- ✅ Messages appear instantly for all connected users
- ✅ Username displays correctly (from Cognito userId)
- ✅ Timestamps show local time
- ✅ Chat disconnects on logout
- ✅ "User not authenticated" if trying to chat without login

## Troubleshooting

### Chat not connecting:
- Check browser console for errors
- Verify IVS Chat SDK loaded: `window.IVSChatRoom` should be defined
- Verify chat token endpoint returns valid token
- Check AWS credentials have IVS Chat permissions

### Messages not appearing:
- Check if user is authenticated
- Verify `chatRoomArn` is present in stream data
- Check browser console for chat errors
- Verify AWS IVS Chat room exists in AWS Console

### Backend errors:
- Check PM2 logs: `pm2 logs ivs-app`
- Verify AWS SDK installed: `@aws-sdk/client-ivschat`
- Check AWS credentials and permissions

## AWS Permissions Required

Your AWS IAM user/role needs these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivschat:CreateRoom",
        "ivschat:GetRoom",
        "ivschat:DeleteRoom",
        "ivschat:CreateChatToken"
      ],
      "Resource": "*"
    }
  ]
}
```

## API Endpoints

### POST /api/chat/token
Generate IVS Chat token for authenticated user

**Request:**
```json
{
  "roomIdentifier": "arn:aws:ivschat:us-east-1:123456789:room/xxxxx"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "sessionExpirationTime": "2025-01-17T12:00:00Z",
  "tokenExpirationTime": "2025-01-17T12:00:00Z"
}
```

## Notes

- IVS Chat has a free tier with limits (check AWS documentation)
- Chat messages are not persisted by default (ephemeral)
- Consider implementing message moderation/filtering
- The profanity filter Lambda can be integrated later
- Chat rooms are automatically created when streams are created
- Chat rooms should be deleted when streams are deleted (TODO)

## Next Steps

1. ✅ Backend IVS Chat integration
2. ✅ Frontend IVS Chat SDK integration
3. ✅ Auto-connect to chat when stream loads
4. 🔲 Delete chat rooms when streams are deleted
5. 🔲 Integrate profanity filter Lambda with IVS Chat
6. 🔲 Add message moderation features
7. 🔲 Add user roles (moderator, viewer, etc.)
8. 🔲 Add chat history persistence (optional)
