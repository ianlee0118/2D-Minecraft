export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this._listeners = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (typeof io === 'undefined') { reject(new Error('Socket.IO not loaded')); return; }
      this.socket = io();
      this.socket.on('connect', () => { this.connected = true; resolve(); });
      this.socket.on('connect_error', reject);
    });
  }

  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
    this._listeners.push({ event, callback });
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  emit(event, data) {
    if (!this.socket) return;
    this.socket.emit(event, data);
  }

  get id() {
    return this.socket?.id;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  removeAllGameListeners() {
    for (const { event, callback } of this._listeners) {
      this.socket?.off(event, callback);
    }
    this._listeners = [];
  }
}
