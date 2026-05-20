/**
 * IPC message queue for backend disconnect resilience. Fixes #826.
 * Buffers RPC calls when backend is down, flushes on reconnect.
 */
import { Observable, Subject } from 'rxjs';

interface QueuedMessage {
  id: string;
  method: string;
  params: unknown[];
  timestamp: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

const MAX_QUEUE_SIZE = 100;
const MESSAGE_TTL_MS = 30_000;

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private connectionStateSubject = new Subject<ConnectionState>();
  private _state: ConnectionState = 'disconnected';

  /** Observable that emits connection state changes */
  get connectionState$(): Observable<ConnectionState> {
    return this.connectionStateSubject.asObservable();
  }

  get state(): ConnectionState {
    return this._state;
  }

  get size(): number {
    return this.queue.length;
  }

  /** Enqueue a message. Returns a promise that resolves when the message is processed. */
  enqueue<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        // Drop oldest message
        const oldest = this.queue.shift();
        if (oldest) {
          oldest.reject(new Error('Dropped: queue full'));
        }
      }

      this.queue.push({
        id: crypto.randomUUID(),
        method,
        params,
        timestamp: Date.now(),
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  /** Set connection state and flush queue on reconnect */
  setConnected(connected: boolean): void {
    const newState: ConnectionState = connected ? 'connected' : 'disconnected';
    if (this._state !== newState) {
      this._state = newState;
      this.connectionStateSubject.next(newState);
    }

    if (connected) {
      this.flush();
    }
  }

  /** Flush all queued messages in FIFO order */
  flush(): QueuedMessage[] {
    const now = Date.now();
    const valid: QueuedMessage[] = [];
    const expired: QueuedMessage[] = [];

    for (const msg of this.queue) {
      if (now - msg.timestamp > MESSAGE_TTL_MS) {
        expired.push(msg);
      } else {
        valid.push(msg);
      }
    }

    // Reject expired messages with TimeoutError
    for (const msg of expired) {
      msg.reject(Object.assign(new Error('Message expired'), { name: 'TimeoutError' }));
    }

    this.queue = [];
    return valid;
  }

  /** Expire old messages (call periodically) */
  expireOldMessages(): number {
    const now = Date.now();
    const before = this.queue.length;
    this.queue = this.queue.filter(msg => {
      if (now - msg.timestamp > MESSAGE_TTL_MS) {
        msg.reject(Object.assign(new Error('Message expired (TTL)'), { name: 'TimeoutError' }));
        return false;
      }
      return true;
    });
    return before - this.queue.length;
  }

  /** Clear all messages */
  clear(): void {
    for (const msg of this.queue) {
      msg.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}
