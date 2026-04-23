import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Undefined → socket.io connects to window.location.origin, so the build works
// behind any ALB/reverse proxy without hardcoding its DNS. Set VITE_WS_URL
// locally for dev (e.g. http://localhost:8081) when origin ≠ ws-gateway.
const wsUrl = import.meta.env.VITE_WS_URL || undefined;

export function connectSocket(token: string): Socket {
  // Return existing socket even if still connecting — don't create a second one mid-handshake
  if (socket) return socket;

  socket = io(wsUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
