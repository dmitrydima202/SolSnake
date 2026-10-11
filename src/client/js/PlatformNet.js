import Net from './Net.js';
import { createIDosGamesClient } from '@idosgames/core';
import { RealtimeSession } from '@idosgames/core/realtime';
import { Room } from '../../server/Room.js';
import { decodeClientMessage, C2S } from '../../shared/protocol.js';
import { IDOS_TITLE_ID } from '../../idos.title.js';

// Keep the original simulation and binary protocol. The browser hosting the
// iDosGames room takes the place of the Node WebSocket server.
export default class PlatformNet extends Net {
  constructor() {
    super();
    this.room = null;
    this.sockets = new Map();
    this.session = null;
    this.lastJoin = null;
    this.client = createIDosGamesClient({ titleID: IDOS_TITLE_ID, throttleMs: 0 });
    this.busy = false;
  }

  connect() {
    this.startWorld();
    this.connected = true;
    this._emit('open');
  }

  startWorld() {
    this.stopWorld();
    this.room = new Room();
    this.socketFor('self');
  }

  stopWorld() {
    if (this.room) clearInterval(this.room._tickInterval);
    this.room = null;
    this.sockets.clear();
  }

  socketFor(id) {
    if (this.sockets.has(id)) return this.sockets.get(id);
    const socket = {
      OPEN: 1, readyState: 1,
      send: bytes => {
        if (id === 'self') this._onMessage({ data: bytes });
        else this.session?.send(id, 'rel', bytes);
      },
      close: () => this.removePeer(id),
    };
    this.sockets.set(id, socket);
    this.room.addPlayer(socket);
    return socket;
  }

  removePeer(id) {
    const socket = this.sockets.get(id);
    if (socket) { this.room?.removePlayer(socket); socket.readyState = 3; }
    this.sockets.delete(id);
  }

  dispatch(id, bytes) {
    if (!this.room || bytes.length > 2048) return;
    const msg = decodeClientMessage(bytes);
    if (!msg) return;
    const player = this.room.players.get(this.socketFor(id));
    player.touch();
    switch (msg.op) {
      case C2S.JOIN:
        // Reconnects may repeat JOIN; never leave a previous snake behind.
        if (player.joined && player.alive) return;
        this.room.handleJoin(player, msg); player.username = player.name; break;
      case C2S.INPUT: this.room.handleInput(player, msg); break;
      case C2S.RESPAWN:
        if (!player.alive) this.room.handleRespawn(player); break;
      case C2S.PING: this.room.handlePing(player, msg); break;
      case C2S.CHAT: this.room.handleChat(player, msg); break;
    }
  }

  _send(bytes) {
    if (!this.connected) return;
    if (bytes[0] === C2S.JOIN) this.lastJoin = bytes;
    if (!this.session || this.session.isHost) this.dispatch('self', bytes);
    else this.session.send(this.session.hostId, 'rel', bytes);
  }

  async findRoom(code) {
    for (let page = 0; ; page++) {
      const listed = await this.client.multiplayer.listRooms(page, 50);
      if (!listed.ok) throw new Error(listed.error || listed.reason);
      const room = (listed.data.Rooms || []).find(r => r.Name === `SolSnake ${code}`);
      if (room) return room;
      if (!listed.data.HasMore) return null;
    }
  }

  async playOnline(code = null) {
    if (this.busy || this.session) throw new Error('Leave your current room first.');
    code = code?.trim().toUpperCase().replace(/[\s-]/g, '') || null;
    if (code && !/^[A-Z2-9]{8}$/.test(code)) throw new Error('Enter the 8-character room code.');
    this.busy = true;
    try {
      const login = await this.client.auth.loginWithDeviceID();
      if (!login.ok) throw new Error(login.error || `Platform login: ${login.reason}`);
      const available = code ? await this.findRoom(code) : null;
      if (code && !available) throw new Error('Room not found. Check the code or ask your friend to create a new room.');
      if (available && available.MemberCount >= available.MaxPlayers) throw new Error('Room is full (8 players).');
      if (!code) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
          code = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => alphabet[n % 32]).join('');
        } while (await this.findRoom(code));
      }
      const enter = () => available
        ? RealtimeSession.join(this.client, available.RoomID)
        : RealtimeSession.create(this.client, `SolSnake ${code}`, {
            topology: 'Host', chatMode: 'P2P', visibility: 'Public', maxPlayers: 8, mode: 'solsnake',
          });
      let result = await enter();
      // A closed tab can leave a stale membership behind. Reclaim it only
      // when this adapter has no active session and the user requests a room.
      const staleRoom = !result.ok && /already in room ([a-z0-9-]+)\./i.exec(result.error || '');
      if (staleRoom) {
        const left = await this.client.multiplayer.leaveRoom(staleRoom[1]);
        if (!left.ok) throw new Error(left.error || left.reason);
        result = await enter();
      }
      if (!result.ok) throw new Error(result.error || result.reason);
      this.session = result.data;
      const session = this.session;
      this.roomCode = code;
      this.lastJoin = null;
      this.stopWorld();
      this.connected = this.session.isHost;
      if (this.session.isHost) this.startWorld();
      this.session.on('peerOpen', ({ peerId }) => {
        if (this.session !== session) return;
        if (this.session.isHost) this.socketFor(peerId);
        else if (peerId === this.session.hostId) {
          this.connected = true; this._emit('open');
          if (this.lastJoin) this._send(this.lastJoin);
        }
      });
      this.session.on('message', ({ from, data }) => {
        if (this.session !== session) return;
        if (this.session.isHost) this.dispatch(from, data);
        else if (from === this.session.hostId) this._onMessage({ data });
      });
      this.session.on('peerClose', ({ peerId }) => {
        if (this.session !== session) return;
        if (this.session.isHost) this.removePeer(peerId);
        else if (peerId === this.session.hostId) { this.connected = false; this._emit('close'); }
      });
      this.session.on('hostChanged', ({ hostId }) => {
        if (this.session !== session) return;
        // A new host starts a fresh round; no stale state is treated as authoritative.
        this.stopWorld();
        this.connected = hostId === this.session.selfId;
        if (this.connected) { this.startWorld(); if (this.lastJoin) this._send(this.lastJoin); this._emit('open'); }
      });
      this.session.on('roomClosed', () => { if (this.session === session) this.endOnline(); });
      this.session.on('removed', () => { if (this.session === session) this.endOnline(); });
      if (this.connected) this._emit('open');
      // A channel may already have opened during session startup.
      if (!this.connected && this.session.isOpen(this.session.hostId)) {
        this.connected = true; this._emit('open');
      }
      return code;
    } finally { this.busy = false; }
  }

  endOnline() {
    const session = this.session;
    this.session = null; this.roomCode = null; this.lastJoin = null;
    void session?.leave();
    this.stopWorld(); this.connected = false; this._emit('roomEnded');
    this.connect();
  }

  async leaveOnline() {
    if (this.busy) return;
    this.busy = true;
    const session = this.session;
    this.session = null;
    try { await session?.leave(); }
    finally {
      this.session = null; this.roomCode = null; this.lastJoin = null;
      this.busy = false;
      this.connect();
      this._emit('roomEnded');
    }
  }
}
