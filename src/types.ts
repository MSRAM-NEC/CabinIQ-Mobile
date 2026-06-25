/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DriveMode = 'rhd' | 'lhd';

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connected' | 'permission_denied';

export type TransportType = 'serial' | 'network';

export type SeatClassification = 'empty' | 'child' | 'adult';

export interface ZoneDefinition {
  id: number;
  name: string;
  seatLabel: string;  // Human-readable seat name for UI
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface AlgParams {
  alphaSmoothing: number;
  occupiedThreshold: number;
  emptyThreshold: number;
  minPointsForScore: number;
  voteWindow: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  snr: number;
  doppler: number;
}

export interface ZoneFeature {
  numPoints: number;
  avgSnr: number;
  pointDensity: number;
  centroidX: number;
  centroidY: number;
  centroidZ: number;
  zMean: number;
  zSpread: number;
  velocitySpread: number;
}

export interface ZoneState {
  occupied: boolean;
  confidence: number;
  classification: SeatClassification;
  features: ZoneFeature;
  voteUpCount: number;
  voteDownCount: number;
  lastState: 'empty' | 'occupied';
  freezeRemaining: number;
}

export interface VitalSigns {
  driverPresent: boolean;
  heartRate: number;
  breathingRate: number;
}

export interface RawPacketLog {
  timestamp: string;
  frameNum: number;
  size: number;
  numTLVs: number;
  syncValid: boolean;
  checksumValid: boolean;
  pointsParsed: number;
  rawHexPrefix: string;
}

/** Known TI AWR6843 family USB adapter VID/PID pairs */
export interface KnownUsbDevice {
  vendorId: number;
  productId: number;
  deviceName: string;
  description: string;
}

export const KNOWN_RADAR_DEVICES: KnownUsbDevice[] = [
  { vendorId: 0x0451, productId: 0xBEF3, deviceName: 'TI XDS110',        description: 'Texas Instruments XDS110 Debug Probe' },
  { vendorId: 0x10C4, productId: 0xEA60, deviceName: 'CP210x UART Bridge', description: 'Silicon Labs CP2102/CP2109 USB-UART' },
  { vendorId: 0x10C4, productId: 0xEA70, deviceName: 'CP2105 Dual USB-UART', description: 'Silicon Labs CP2105 Dual USB to UART Bridge' },
  { vendorId: 0x0403, productId: 0x6001, deviceName: 'FTDI FT232R',       description: 'FTDI FT232 USB-UART Bridge' },
  { vendorId: 0x0403, productId: 0x6010, deviceName: 'FTDI FT2232',       description: 'FTDI FT2232 Dual USB-UART' },
  { vendorId: 0x0451, productId: 0xBEF4, deviceName: 'TI XDS110 Aux',    description: 'TI XDS110 Auxiliary Port' },
];

export interface UsbDeviceInfo {
  deviceId: number;
  productId: number;
  vendorId: number;
  deviceName: string;
  productName: string;
  isKnownRadarDevice: boolean;
}

export interface ConnectionDiagnostics {
  deviceName: string;
  vendorId: string;
  productId: string;
  baudRate: number;
  framesReceived: number;
  packetsReceived: number;
  packetLoss: number;
  parseErrors: number;
  crcErrors: number;
  reconnectAttempts: number;
  lastFrameTimestamp: number | null;
  avgFps: number;
  avgSnr: number;
}

export const DEFAULT_DIAGNOSTICS: ConnectionDiagnostics = {
  deviceName: '—',
  vendorId: '—',
  productId: '—',
  baudRate: 921600,
  framesReceived: 0,
  packetsReceived: 0,
  packetLoss: 0,
  parseErrors: 0,
  crcErrors: 0,
  reconnectAttempts: 0,
  lastFrameTimestamp: null,
  avgFps: 0,
  avgSnr: 0,
};

/** Single time-stamped value for sparkline charts */
export interface ChartDataPoint {
  t: number;   // epoch ms
  v: number;   // value
}
