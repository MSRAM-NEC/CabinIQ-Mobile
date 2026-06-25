/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerPlugin } from '@capacitor/core';
import { parseSerializedFrame } from './radarPipeline';
import { Point3D, VitalSigns, RawPacketLog, UsbDeviceInfo, KNOWN_RADAR_DEVICES } from '../types';

export interface RadarPlugin {
  connect(options: { vendorId: number; productId: number }): Promise<void>;
  sendConfig(options: { payload: string }): Promise<void>;
  startRadar(): Promise<void>;
  disconnect(): Promise<void>;
  listUsbDevices(): Promise<{ devices: Array<{
    vendorId: number; productId: number;
    deviceName: string; productName: string; hasDriver: boolean;
  }> }>;
  addListener(eventName: string, listenerFunc: (info: any) => void): any;
}

const Radar = registerPlugin<RadarPlugin>('Radar');

export type UsbSerialCallback = (
  frameNum: number,
  points: Point3D[],
  vitals: VitalSigns,
  log: RawPacketLog,
  parseError: boolean
) => void;

export type UsbDiagnosticsUpdate = (updates: Partial<{
  framesReceived: number;
  packetsReceived: number;
  parseErrors: number;
  crcErrors: number;
}>) => void;

export type UsbScanResult = {
  devices: UsbDeviceInfo[];
  permissionGranted: boolean;
  grantedDevice: UsbDeviceInfo | null;
};

class UsbSerialService {
  private isConnected = false;

  // Callbacks
  public onData: UsbSerialCallback | null = null;
  public onDiagnostics: UsbDiagnosticsUpdate | null = null;
  public onDisconnect: (() => void) | null = null;
  /** Called with native status messages — wire this up for debug logging. */
  public onStatus: ((msg: string) => void) | null = null;

  // Internal diagnostics counters
  private _parseErrors = 0;
  private _crcErrors = 0;
  private _framesReceived = 0;
  private _packetsReceived = 0;

  /** Sensor tilt from sensorPosition config — set by App before connect */
  private _sensorTiltDeg = 0;

  setSensorTilt(tilt: number) {
    this._sensorTiltDeg = tilt;
    console.log('[RadarPlugin] Sensor tilt set to', tilt, '°');
  }

  private listener: any = null;
  private disconnectListener: any = null;
  private statusListener: any = null;
  private errorListener: any = null;

  // Track which device we connected to
  private connectedDevice: UsbDeviceInfo | null = null;

  async scanForDevices(): Promise<UsbScanResult> {
    try {
      // Query actual USB devices from native layer
      const result = await Radar.listUsbDevices();
      const nativeDevices = result.devices ?? [];

      console.log('[RadarPlugin] Real USB scan result:', JSON.stringify(nativeDevices));

      const detected: UsbDeviceInfo[] = [];

      for (const nd of nativeDevices) {
        // Only include devices that have a serial driver (skip LAN adapters etc.)
        if (!nd.hasDriver) {
          console.log('[RadarPlugin] Skipping non-serial device:', nd.productName,
            'VID=' + nd.vendorId.toString(16), 'PID=' + nd.productId.toString(16));
          continue;
        }

        // Check if it's a known radar device
        const knownMatch = KNOWN_RADAR_DEVICES.find(
          k => k.vendorId === nd.vendorId && k.productId === nd.productId
        );

        detected.push({
          deviceId:          nd.vendorId * 0x10000 + nd.productId,
          vendorId:          nd.vendorId,
          productId:         nd.productId,
          deviceName:        knownMatch?.deviceName ?? nd.productName ?? 'Unknown Serial Device',
          productName:       knownMatch?.description ?? nd.productName ?? '',
          isKnownRadarDevice: !!knownMatch,
        });
      }

      // If no serial devices found, fall back to first KNOWN_RADAR_DEVICES entry so UI isn't blank
      if (detected.length === 0) {
        console.warn('[RadarPlugin] No serial devices detected via native scan.');
        return { devices: [], permissionGranted: false, grantedDevice: null };
      }

      const grantedDevice = detected[0];
      return { devices: detected, permissionGranted: true, grantedDevice };

    } catch (e) {
      // listUsbDevices not available (web/desktop) — return empty
      console.warn('[RadarPlugin] listUsbDevices failed (non-native env):', e);
      return { devices: [], permissionGranted: false, grantedDevice: null };
    }
  }

  async connect(configPayload?: string): Promise<UsbScanResult> {
    this._parseErrors = 0;
    this._crcErrors = 0;
    this._framesReceived = 0;
    this._packetsReceived = 0;
    this.connectedDevice = null;

    const scanResult = await this.scanForDevices();
    const device = scanResult.devices[0];
    this.connectedDevice = device;

    console.log('[RadarPlugin] Connecting to', device.deviceName,
      'VID=' + device.vendorId.toString(16).toUpperCase(),
      'PID=' + device.productId.toString(16).toUpperCase());

    try {
      // 0. Attach status/error listeners BEFORE connect so we capture all logs
      this.statusListener = await Radar.addListener('serialStatus', (event: { status: string }) => {
        console.log('[RadarPlugin] STATUS:', event.status);
        this.onStatus?.(event.status);
      });

      this.errorListener = await Radar.addListener('serialError', (event: { error: string }) => {
        console.error('[RadarPlugin] NATIVE ERROR:', event.error);
        this.onStatus?.('ERROR: ' + event.error);
      });

      // 1. Connect via native plugin (handles permissions & dual ports)
      await Radar.connect({ vendorId: device.vendorId, productId: device.productId });
      console.log('[RadarPlugin] connect() resolved OK');

      // 2. Send config if provided
      if (configPayload && configPayload.trim().length > 0) {
        console.log('[RadarPlugin] Sending config payload…');
        await Radar.sendConfig({ payload: configPayload });
        console.log('[RadarPlugin] Config sent.');
      } else {
        console.log('[RadarPlugin] No config payload — skipping sendConfig.');
      }

      // 3. Start reading frames
      await Radar.startRadar();
      console.log('[RadarPlugin] startRadar() resolved — data stream active.');
      this.isConnected = true;

      // 4. Attach binary frame listener (receives 1 complete frame per event)
      this.listener = await Radar.addListener('serialRead', (event: { data: string }) => {
        try {
          const frameBytes = this.base64ToUint8Array(event.data);
          this._packetsReceived++;
          this.onDiagnostics?.({ packetsReceived: this._packetsReceived });

          const parsed = parseSerializedFrame(frameBytes.buffer, false, this._sensorTiltDeg);
          this._framesReceived++;
          this.onDiagnostics?.({ framesReceived: this._framesReceived });

          if (this.onData) {
            this.onData(parsed.frameNum, parsed.points, parsed.vitals, parsed.log, false);
          }
        } catch (err: any) {
          console.warn('[RadarPlugin] Frame parse error:', err?.message);
          if (err?.message?.includes('Checksum') || err?.message?.includes('checksum')) {
            this._crcErrors++;
            this.onDiagnostics?.({ crcErrors: this._crcErrors });
          } else {
            this._parseErrors++;
            this.onDiagnostics?.({ parseErrors: this._parseErrors });
          }
        }
      });

      this.disconnectListener = await Radar.addListener('serialDisconnect', () => {
        console.warn('[RadarPlugin] serialDisconnect event received.');
        this.isConnected = false;
        this.connectedDevice = null;
        if (this.onDisconnect) this.onDisconnect();
      });

      return scanResult;

    } catch (e: any) {
      console.error('[RadarPlugin] Connection failed:', e);
      this.isConnected = false;
      this.connectedDevice = null;
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.connectedDevice = null;

    for (const l of [this.listener, this.disconnectListener, this.statusListener, this.errorListener]) {
      try { l?.remove(); } catch (_) {}
    }
    this.listener = null;
    this.disconnectListener = null;
    this.statusListener = null;
    this.errorListener = null;

    try {
      await Radar.disconnect();
    } catch (e) {
      console.error('[RadarPlugin] Error closing connection:', e);
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get device(): UsbDeviceInfo | null {
    return this.connectedDevice;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

export const usbSerialService = new UsbSerialService();
