# Client Test Script (HTML/CSS/JS)

This folder contains a lightweight browser-based Socket.IO client simulator for Chatter realtime backend.

## Files

- index.html: Test UI with two clients (A/B)
- styles.css: Styling for test dashboard
- app.js: Socket.IO client logic and event flow

## Covered backend features

- Login via backend API (`POST /api/v1/auth/login`)
- Persist login session in `localStorage`
- Display logged-in user and token preview on UI
- Auto-attach access token to authenticated HTTP requests
- Connect with handshake token
- Fallback auth event (`auth:login`)
- Join conversation (`conversation:join`)
- Receive history (`conversation:history`)
- Send message (`message:send`)
- Receive broadcast (`message:new`)
- Typing indicator (`message:typing`)
- Disconnect handling
- Negative test: invalid text payload (validation_failed)

## How to run

1. Ensure backend is running:
    - API at `http://localhost:3000`
    - Socket.IO at `http://localhost:3001` and path `/socket.io`
2. Open `index.html` directly in browser (double click file).
3. Login both clients using email/username and password.
4. Optionally use `GET /conversation (Auth)` to auto-fill conversation id.
5. Run manual actions or use quick E2E button.

## Optional mode (serve over localhost)

- From project root, run: `npm run test:client:serve`
- Then open: `http://localhost:4173`

## Why this is required

- This test page uses a classic script (not ES module), so it can run from `file://`.
- Backend CORS must allow `Origin: null` for login/fetch calls when opened from file.

## Suggested test flow

1. Connect A and B with valid tokens.
2. Emit `auth:login` (optional fallback).
3. Emit `conversation:join` from both clients.
4. Send `message:send` from A.
5. Verify A gets send ack and B receives `message:new`.
6. Emit `message:typing` ON/OFF from A and verify B sees typing updates.
7. Run invalid payload button to verify validation error ack.
