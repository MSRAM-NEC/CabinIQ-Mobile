/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Network Transport Service — CabinIQ Mobile
 *
 * Receives raw TI AWR6843 binary frames over WebSocket.
 * Performs the same sync-pattern search and packet reassembly as UsbSerialService.
 * Includes auto-reconnect with exponential backoff.
 */

import { parseSerializedFrame } from './radarPipeline';
import { Point3D, VitalSigns, RawPacketLog } from '../types';

export type NetworkCallback = (
  frameNum: number,
  points: Point3D[],
  vitals: VitalSigns,
  log: RawPacketLog,
  parseError: boolean
) => void;

class NetworkService {
  private isConnected = false;
  private ws: WebSocket | null = null;
  private buffer = new Uint8Array(32768);
  private bufferLength = 0;
  private readonly SYNC_PATTERN = new Uint8Array([0x02, 0x01, 0x04, 0x03, 0x06, 0x05, 0x08, 0x07]);

  // Callbacks
  public onData: NetworkCallback | null = null;
  public onDisconnect: (() => void) | null = null;
  public onStatusChange: ((status: string) => void) | null = null;

  // Reconnect state
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private targetUrl = '';
  private intentionalDisconnect = false;

  // Diagnostics counters
  private _parseErrors = 0;
  private _crcErrors = 0;
  private _framesReceived = 0;
  private _packetsReceived = 0;

  async connect(url: string): Promise<void> {
    this.targetUrl = url;
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;
    this._parseErrors = 0;
    this._crcErrors = 0;
    this._framesReceived = 0;
    this._packetsReceived = 0;

    return this._connect(url);
  }

  private _connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        const connectTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('WebSocket connection timed out after 10s'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.bufferLength = 0;
          this.reconnectAttempts = 0;
          this.onStatusChange?.('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this.appendBuffer(new Uint8Array(event.data));
            this.processBuffer();
          } else if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              this.appendBuffer(new Uint8Array(reader.result as ArrayBuffer));
              this.processBuffer();
            };
            reader.readAsArrayBuffer(event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Network] WebSocket error:', error);
          if (!this.isConnected) {
            clearTimeout(connectTimeout);
            reject(new Error('WebSocket connection failed'));
          }
        };

        this.ws.onclose = () => {
          const wasConnected = this.isConnected;
          this.isConnected = false;

          if (wasConnected && !this.intentionalDisconnect) {
            // Try reconnect first — only notify disconnect if all attempts fail
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.onStatusChange?.('reconnecting');
              this.attemptReconnect();
            } else {
              // All reconnect attempts exhausted — now notify disconnect
              this.onStatusChange?.('disconnected');
              this.onDisconnect?.();
            }
          }
        };

      } catch (e) {
        reject(e);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Network] Max reconnect attempts reached');
      this.onStatusChange?.('disconnected');
      this.onDisconnect?.();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    this.onStatusChange?.(`reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this._connect(this.targetUrl);
      } catch {
        // Will trigger onclose → attemptReconnect again
      }
    }, delay);
  }

  disconnect(): void {
    this.isConnected = false;
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional disconnect
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  // ─── Buffer Management (identical to UsbSerialService) ────────────────

  private appendBuffer(newBytes: Uint8Array): void {
    const needed = this.bufferLength + newBytes.length;
    if (needed > this.buffer.length) {
      const newBuffer = new Uint8Array(Math.max(this.buffer.length * 2, needed));
      newBuffer.set(this.buffer.subarray(0, this.bufferLength));
      this.buffer = newBuffer;
    }
    this.buffer.set(newBytes, this.bufferLength);
    this.bufferLength += newBytes.length;
  }

  private processBuffer(): void {
    while (this.bufferLength >= 48) {
      const syncIdx = this.findSyncPattern();
      if (syncIdx === -1) {
        if (this.bufferLength > 7) {
          this.buffer.copyWithin(0, this.bufferLength - 7, this.bufferLength);
          this.bufferLength = 7;
        } else {
          this.bufferLength = 0;
        }
        break;
      }

      if (syncIdx > 0) {
        this.buffer.copyWithin(0, syncIdx, this.bufferLength);
        this.bufferLength -= syncIdx;
      }

      if (this.bufferLength < 16) break;

      const dv = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.bufferLength);
      const packetLength = dv.getUint32(12, true);

      if (packetLength < 48 || packetLength > 8192) {
        this.buffer.copyWithin(0, 8, this.bufferLength);
        this.bufferLength -= 8;
        this._parseErrors++;
        continue;
      }

      if (this.bufferLength < packetLength) break;

      const packetBytes = this.buffer.slice(0, packetLength);
      this.buffer.copyWithin(0, packetLength, this.bufferLength);
      this.bufferLength -= packetLength;

      this._packetsReceived++;

      try {
        const parsed = parseSerializedFrame(packetBytes.buffer, false);
        this._framesReceived++;
        if (this.onData) {
          this.onData(parsed.frameNum, parsed.points, parsed.vitals, parsed.log, false);
        }
      } catch (err: any) {
        if (err?.message?.includes('Checksum')) {
          this._crcErrors++;
        } else {
          this._parseErrors++;
        }

        if (this.onData) {
          const errorLog: RawPacketLog = {
            timestamp: new Date().toLocaleTimeString(),
            frameNum: -1, size: packetLength, numTLVs: 0,
            syncValid: true, checksumValid: false,
            pointsParsed: 0, rawHexPrefix: 'PARSE ERROR'
          };
          this.onData(-1, [], { driverPresent: false, heartRate: 0, breathingRate: 0 }, errorLog, true);
        }
      }
    }
  }

  private findSyncPattern(): number {
    const limit = this.bufferLength - 7;
    for (let i = 0; i <= limit; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (this.buffer[i + j] !== this.SYNC_PATTERN[j]) { match = false; break; }
      }
      if (match) return i;
    }
    return -1;
  }
}

export const networkService = new NetworkService();
