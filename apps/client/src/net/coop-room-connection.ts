/**
 * Minimal transport-agnostic room interface shared by Colyseus `Room` (LAN / WebSocket)
 * and PeerJS `PeerHostRoom` / `PeerClientRoom` (Serverless WebRTC DataChannel).
 */
export interface CoopRoomConnection {
  readonly roomId: string;
  readonly reconnectionToken?: string;
  send(type: string, message?: unknown): void;
  onMessage<T = unknown>(type: string, callback: (message: T) => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
  leave(consented?: boolean): Promise<unknown>;
}
