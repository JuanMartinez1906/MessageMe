import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  // Return existing socket even if still connecting — don't create a second one mid-handshake
  if (socket) return socket;

  socket = io('http://localhost:3000', {
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
