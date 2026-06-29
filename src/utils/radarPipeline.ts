/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ZoneDefinition,
  AlgParams,
  Point3D,
  ZoneFeature,
  ZoneState,
  VitalSigns,
  RawPacketLog,
  DriveMode,
  SeatClassification
} from '../types';

export const DEFAULT_ZONES: ZoneDefinition[] = [
  {
    id: 0, name: 'R1 Driver (Front)',       seatLabel: 'Driver',
    xMin: 0.0,  xMax: 0.8,  yMin: 0.0, yMax: 1.0, zMin: 0.0, zMax: 1.4
  },
  {
    id: 1, name: 'R1 Passenger (Front)',    seatLabel: 'Front Passenger',
    xMin: -0.8, xMax: 0.0,  yMin: 0.0, yMax: 1.0, zMin: 0.0, zMax: 1.4
  },
  {
    id: 2, name: 'R2 Rear Left',            seatLabel: 'Rear Left',
    xMin: 0.3,  xMax: 0.8,  yMin: 1.2, yMax: 2.2, zMin: 0.0, zMax: 1.2
  },
  {
    id: 3, name: 'R2 Rear Center',          seatLabel: 'Rear Center',
    xMin: -0.3, xMax: 0.3,  yMin: 1.2, yMax: 2.2, zMin: 0.0, zMax: 1.2
  },
  {
    id: 4, name: 'R2 Rear Right',           seatLabel: 'Rear Right',
    xMin: -0.8, xMax: -0.3, yMin: 1.2, yMax: 2.2, zMin: 0.0, zMax: 1.2
  },
];

/**
 * Parses sensorPosition tilt angle (degrees) from config text.
 * Used to determine if sensor is overhead-mounted (Z points down).
 * `sensorPosition <id> <x> <y> <tiltDeg> <azRotDeg> <elevRotDeg>`
 */
export function parseSensorTiltFromConfig(configText: string): number {
  const lines = configText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('%') || trimmed.length === 0) continue;
    const tokens = trimmed.split(/\s+/);
    // sensorPosition <id> <x> <y> <tiltDeg> ...
    if (tokens[0] === 'sensorPosition' && tokens.length >= 5) {
      const tilt = parseFloat(tokens[4]);
      if (!isNaN(tilt)) return tilt;
    }
  }
  return 0; // default: upright sensor, no tilt
}

/**
 * Parses cuboid bounds from the active config file text and maps them to zones.
 * Assigns labels geometrically (left/right/center relative to vehicle).
 */
export function parseZonesFromConfig(configText: string, driveMode: DriveMode = 'rhd'): ZoneDefinition[] {
  const zonesMap: { [id: number]: {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
  } } = {};

  const lines = configText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('%') || trimmed.length === 0) continue;
    const tokens = trimmed.split(/\s+/);
    if (tokens[0] === 'cuboidDef' && tokens.length >= 9) {
      const zoneId = parseInt(tokens[1], 10);
      const xMin = parseFloat(tokens[3]);
      const xMax = parseFloat(tokens[4]);
      const yMin = parseFloat(tokens[5]);
      const yMax = parseFloat(tokens[6]);
      const zMin = parseFloat(tokens[7]);
      const zMax = parseFloat(tokens[8]);

      // Ignore placeholder/unused cuboids (often set to all 0s)
      if (xMin === 0 && xMax === 0 && yMin === 0 && yMax === 0) continue;

      if (!zonesMap[zoneId]) {
        zonesMap[zoneId] = { xMin, xMax, yMin, yMax, zMin, zMax };
      } else {
        const z = zonesMap[zoneId];
        z.xMin = Math.min(z.xMin, xMin);
        z.xMax = Math.max(z.xMax, xMax);
        z.yMin = Math.min(z.yMin, yMin);
        z.yMax = Math.max(z.yMax, yMax);
        z.zMin = Math.min(z.zMin, zMin);
        z.zMax = Math.max(z.zMax, zMax);
      }
    }
  }

  const parsedZones: ZoneDefinition[] = Object.keys(zonesMap).map(key => {
    const id = parseInt(key, 10);
    const z = zonesMap[id];
    const avgX = (z.xMin + z.xMax) / 2;
    const avgY = (z.yMin + z.yMax) / 2;

    // Categorise row based on Y centroid distance from sensor
    let rowName = 'R2';
    if (avgY < 1.3) rowName = 'R1';
    else if (avgY >= 2.3) rowName = 'R3';

    // Categorise side based on X coordinate (positive is left, negative is right in backward-facing sensor)
    let sideName = 'Center';
    if (avgX < -0.15) {
      sideName = driveMode === 'rhd' ? 'Driver Side' : 'Passenger Side';
    } else if (avgX > 0.15) {
      sideName = driveMode === 'rhd' ? 'Passenger Side' : 'Driver Side';
    }

    let seatLabel = `${rowName} ${sideName}`;
    if (rowName === 'R1') {
      if (sideName === 'Driver Side') seatLabel = 'Driver';
      else if (sideName === 'Passenger Side') seatLabel = 'Front Pass.';
    } else if (rowName === 'R2') {
      if (sideName === 'Driver Side') seatLabel = 'Rear Right'; // Right hand side of vehicle
      else if (sideName === 'Passenger Side') seatLabel = 'Rear Left';  // Left hand side of vehicle
      else seatLabel = 'Rear Center';
    } else if (rowName === 'R3') {
      if (sideName === 'Driver Side') seatLabel = 'Row 3 Right';
      else if (sideName === 'Passenger Side') seatLabel = 'Row 3 Left';
      else seatLabel = 'Row 3 Center';
    }

    return {
      id,
      name: `${rowName} ${sideName}`,
      seatLabel,
      xMin: z.xMin, xMax: z.xMax,
      yMin: z.yMin, yMax: z.yMax,
      zMin: z.zMin, zMax: z.zMax
    };
  });

  return parsedZones.sort((a, b) => a.id - b.id);
}



export const DEFAULT_ALG_PARAMS: AlgParams = {
  alphaSmoothing:    0.50,
  occupiedThreshold: 0.50,  // lowered from 0.60 for real hardware signal levels
  emptyThreshold:    0.20,  // lowered from 0.25 to match
  minPointsForScore: 2,     // lowered from 3: overhead sensors see fewer pts/zone
  voteWindow:        3
};

// TI AWR6843 UART stream sync pattern
const SYNC_PATTERN = [0x02, 0x01, 0x04, 0x03, 0x06, 0x05, 0x08, 0x07];

// ─── Mock Frame Generator ────────────────────────────────────────────────────

/**
 * Generates a mock binary packet exactly matching the TI UART TLV stream format.
 * Used for simulation mode only — real hardware uses usbSerialService/networkService.
 */
export function generateMockSerializedFrame(
  frameNum: number,
  occupiedScenario: { [zoneId: number]: { active: boolean; type: 'child' | 'adult' } },
  vitals: VitalSigns,
  driveMode: DriveMode,
  zones: ZoneDefinition[] = DEFAULT_ZONES
): { buffer: ArrayBuffer; points: Point3D[] } {
  const points: Point3D[] = [];

  // Baseline ambient noise (1–4 stray points)
  const noiseCount = Math.floor(Math.random() * 4) + 1;
  for (let i = 0; i < noiseCount; i++) {
    points.push({
      x: (Math.random() - 0.5) * 2.0,
      y: Math.random() * 2.5,
      z: Math.random() * 1.5,
      snr: Math.random() * 4.0 + 1.0,
      doppler: (Math.random() - 0.5) * 0.2
    });
  }

  zones.forEach((zone) => {
    const sc = occupiedScenario[zone.id];
    if (sc && sc.active) {
      const isChild = sc.type === 'child';
      const numPoints = isChild
        ? Math.floor(Math.random() * 10) + 8
        : Math.floor(Math.random() * 20) + 15;

      const zMeanOffset = isChild ? 0.2  : 0.55;
      const zSpreadVal  = isChild ? 0.08 : 0.18;
      const xySpreadVal = isChild ? 0.09 : 0.16;

      const cx = (zone.xMin + zone.xMax) / 2;
      const cy = (zone.yMin + zone.yMax) / 2;
      const sideFactor = driveMode === 'lhd' ? -1 : 1;

      for (let j = 0; j < numPoints; j++) {
        const breathingOsc = Math.sin(frameNum * 0.1 + zone.id) * 0.015;
        const speedOsc     = Math.cos(frameNum * 0.15 + zone.id) * 0.05;

        const dx = (Math.random() + Math.random() - 1) * xySpreadVal;
        const dy = (Math.random() + Math.random() - 1) * xySpreadVal;
        const dz = (Math.random() + Math.random() - 1) * zSpreadVal;

        const px = (cx + dx) * sideFactor;
        const py = cy + dy;
        const pz = zone.zMin + zMeanOffset + dz + breathingOsc;

        const snr = isChild
          ? Math.random() * 8  + 6
          : Math.random() * 18 + 12;

        points.push({
          x: px, y: py, z: pz, snr,
          doppler: speedOsc + (Math.random() - 0.5) * 0.03
        });
      }
    }
  });

  // Build binary packet
  const pointCloudBytes   = 20 + points.length * 8;
  const pointCloudTlvSize = 8  + pointCloudBytes;
  const vitalsTlvSize     = 8  + 12;
  const packetLength      = 48 + pointCloudTlvSize + vitalsTlvSize;

  const arrayBuffer = new ArrayBuffer(packetLength);
  const dv    = new DataView(arrayBuffer);
  const uint8 = new Uint8Array(arrayBuffer);

  // Sync pattern (bytes 0–7)
  SYNC_PATTERN.forEach((b, idx) => (uint8[idx] = b));

  // Frame header (bytes 8–47)
  dv.setUint32(8,  0x00060002, true); // Version
  dv.setUint32(12, packetLength, true);
  dv.setUint32(16, 6843,       true); // Platform = AWR6843
  dv.setUint32(20, frameNum,   true);
  dv.setUint32(24, 0,          true); // Subframe
  dv.setUint32(28, 12000,      true); // Chirp margin
  dv.setUint32(32, 45,         true); // Frame processing time
  dv.setUint32(36, 15,         true); // Tracking processing time
  dv.setUint32(40, 5,          true); // TX time
  dv.setUint16(44, 2,          true); // numTLVs

  // Checksum (one's complement of 16-bit word sum, not counting checksum word itself)
  dv.setUint16(46, 0, true);
  let checksumSum = 0;
  for (let s = 0; s < 24; s++) checksumSum += dv.getUint16(s * 2, true);
  while (checksumSum > 0xFFFF) checksumSum = (checksumSum & 0xFFFF) + (checksumSum >> 16);
  dv.setUint16(46, (~checksumSum) & 0xFFFF, true);

  // TLV 1: Point Cloud (type = 6)
  let offset = 48;
  dv.setUint32(offset,     6,                true); // type
  dv.setUint32(offset + 4, pointCloudTlvSize, true); // length (includes this 8-byte header)
  offset += 8;

  // Units (5 × float32)
  dv.setFloat32(offset + 0,  0.01,  true); // elevation unit (rad/lsb)
  dv.setFloat32(offset + 4,  0.01,  true); // azimuth unit (rad/lsb)
  dv.setFloat32(offset + 8,  0.005, true); // doppler unit (m/s/lsb)
  dv.setFloat32(offset + 12, 0.005, true); // range unit (m/lsb)
  dv.setFloat32(offset + 16, 0.1,   true); // SNR unit (dB/lsb)
  offset += 20;

  // Point records (8 bytes each)
  points.forEach((pt) => {
    const range     = Math.sqrt(pt.x * pt.x + pt.y * pt.y + pt.z * pt.z);
    const azimuth   = Math.atan2(pt.x, pt.y);
    const elevation = Math.asin(pt.z / Math.max(0.01, range));

    dv.setInt8  (offset,     Math.max(-128, Math.min(127,   Math.round(elevation / 0.01))));
    dv.setInt8  (offset + 1, Math.max(-128, Math.min(127,   Math.round(azimuth   / 0.01))));
    dv.setInt16 (offset + 2, Math.max(-32768, Math.min(32767, Math.round(pt.doppler / 0.005))), true);
    dv.setUint16(offset + 4, Math.max(0, Math.min(65535,    Math.round(range      / 0.005))), true);
    dv.setUint16(offset + 6, Math.max(0, Math.min(65535,    Math.round(pt.snr     / 0.1))),  true);
    offset += 8;
  });

  // TLV 2: Vital Signs (type = 12)
  dv.setUint32(offset,     12,           true);
  dv.setUint32(offset + 4, vitalsTlvSize, true);
  offset += 8;
  dv.setUint8  (offset,     vitals.driverPresent ? 1 : 0);
  dv.setFloat32(offset + 4, vitals.breathingRate, true);
  dv.setFloat32(offset + 8, vitals.heartRate,     true);

  return { buffer: arrayBuffer, points };
}

// ─── Frame Parser ────────────────────────────────────────────────────────────

/**
 * Parses one complete TI AWR6843 UART binary frame.
 * Validates sync pattern and header checksum.
 * Decodes Point Cloud (TLV type 6) and Vital Signs (TLV type 12).
 *
 * @param sensorTiltDeg  Tilt angle from sensorPosition config param (degrees).
 *   ≥ 45° = overhead/rearview mount where radar Z-axis points DOWN.
 *   In that case decoded point Z is negated so it matches the
 *   vehicle-frame zone bounding boxes (positive Z = above seat).
 */
export function parseSerializedFrame(
  buffer: ArrayBufferLike,
  isSimulation: boolean = false,
  sensorTiltDeg: number = 0
): {
  frameNum: number;
  points: Point3D[];
  vitals: VitalSigns;
  log: RawPacketLog;
} {
  if (buffer.byteLength < 48) {
    throw new Error(`Frame too short: ${buffer.byteLength} bytes`);
  }

  const dv    = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // 1. Validate sync pattern
  let syncValid = true;
  for (let i = 0; i < 8; i++) {
    if (uint8[i] !== SYNC_PATTERN[i]) { syncValid = false; break; }
  }

  const packetLength = dv.getUint32(12, true);
  const frameNum     = dv.getUint32(20, true);
  const numTLVs      = dv.getUint16(44, true);
  const rxChecksum   = dv.getUint16(46, true);

  // 2. Validate header checksum
  //    Algorithm: one's complement of 16-bit word sum over bytes 0–47,
  //    with the checksum field (word 23, bytes 46–47) treated as 0 during calculation.
  //    This matches the generator which writes 0 before computing.
  let checksumSum = 0;
  for (let s = 0; s < 24; s++) {
    checksumSum += (s === 23) ? 0 : dv.getUint16(s * 2, true);
  }
  while (checksumSum > 0xFFFF) checksumSum = (checksumSum & 0xFFFF) + (checksumSum >> 16);
  const calcChecksum  = (~checksumSum) & 0xFFFF;
  const checksumValid = calcChecksum === rxChecksum;

  if (!checksumValid && !isSimulation) {
    throw new Error(`Checksum mismatch: calc=0x${calcChecksum.toString(16)} rx=0x${rxChecksum.toString(16)}`);
  }

  // Build hex prefix for diagnostics (first 24 bytes)
  const hexLen = Math.min(buffer.byteLength, 24);
  const hexArr: string[] = [];
  for (let i = 0; i < hexLen; i++) {
    hexArr.push(uint8[i].toString(16).padStart(2, '0').toUpperCase());
  }
  const rawHexPrefix = hexArr.join(' ') + '…';

  // 3. Parse TLVs starting at byte 48
  const decodedPoints: Point3D[] = [];
  let decodedVitals: VitalSigns = { driverPresent: false, breathingRate: 0, heartRate: 0 };

  let offset = 48;
  for (let t = 0; t < numTLVs; t++) {
    if (offset + 8 > buffer.byteLength) break;

    const tlvType   = dv.getUint32(offset,     true);
    const tlvLength = dv.getUint32(offset + 4, true); // includes this 8-byte header
    const valueOffset = offset + 8;

    if (offset + tlvLength > buffer.byteLength) break; // truncated TLV

    if (tlvType === 6) {
      // Point Cloud TLV
      if (tlvLength < 28) { offset += tlvLength; continue; } // need at least units block

      const elevUnit   = dv.getFloat32(valueOffset,      true);
      const azimUnit   = dv.getFloat32(valueOffset + 4,  true);
      const doppUnit   = dv.getFloat32(valueOffset + 8,  true);
      const rangeUnit  = dv.getFloat32(valueOffset + 12, true);
      const snrUnit    = dv.getFloat32(valueOffset + 16, true);

      const payloadBytes = tlvLength - 8 - 20; // subtract header + units block
      const numPoints    = Math.floor(payloadBytes / 8);
      let pOffset        = valueOffset + 20;

      for (let p = 0; p < numPoints; p++) {
        if (pOffset + 8 > buffer.byteLength) break;

        const elev   = dv.getInt8  (pOffset)             * elevUnit;
        const azim   = dv.getInt8  (pOffset + 1)         * azimUnit;
        const dopp   = dv.getInt16 (pOffset + 2, true)   * doppUnit;
        const range  = dv.getUint16(pOffset + 4, true)   * rangeUnit;
        const snr    = Math.min(dv.getUint16(pOffset + 6, true) * snrUnit, 60.0); // clamp: real radar SNR never exceeds ~50 dB

        // Spherical → Cartesian
        const cosElev = Math.cos(elev);
        // For overhead/rearview mounts (tilt ≥ 45°), the sensor's local Z-axis
        // points DOWN toward occupants. Points decode with negative Z, but zone
        // bounding boxes use positive Z (height from seat level). Negate Z to align.
        const flipZ = Math.abs(sensorTiltDeg) >= 45 ? -1 : 1;
        decodedPoints.push({
          x: range * cosElev * Math.sin(azim),
          y: range * cosElev * Math.cos(azim),
          z: flipZ * range * Math.sin(elev),
          snr,
          doppler: dopp
        });
        pOffset += 8;
      }

    } else if (tlvType === 12) {
      // Vital Signs TLV
      if (tlvLength >= 20) {
        decodedVitals = {
          driverPresent: dv.getUint8  (valueOffset)     === 1,
          breathingRate: dv.getFloat32(valueOffset + 4, true),
          heartRate:     dv.getFloat32(valueOffset + 8, true)
        };
      }
    }

    offset += tlvLength;
  }

  const log: RawPacketLog = {
    timestamp:     new Date().toLocaleTimeString(),
    frameNum,
    size:          packetLength,
    numTLVs,
    syncValid,
    checksumValid,
    pointsParsed:  decodedPoints.length,
    rawHexPrefix
  };

  return { frameNum, points: decodedPoints, vitals: decodedVitals, log };
}

// ─── Occupancy State Machine ─────────────────────────────────────────────────

/**
 * Runs the AWR6843 occupancy detection algorithm on parsed frame data.
 * EMA confidence score → hysteresis voting → classification.
 */
export function updateOccupancyState(
  points: Point3D[],
  prevStates: { [zoneId: number]: ZoneState },
  params: AlgParams,
  baselines: { [zoneId: number]: { density: number; snr: number } } | null,
  zones: ZoneDefinition[] = DEFAULT_ZONES
): { [zoneId: number]: ZoneState } {
  const updatedStates: { [zoneId: number]: ZoneState } = {};

  zones.forEach((zone) => {
    const prevState = prevStates[zone.id] || initZoneState(zone.id);

    // Filter points inside this zone's 3D bounding box
    // Use exclusive upper bounds to avoid overlapping zones at boundaries
    const zonePoints = points.filter(p =>
      p.x >= zone.xMin && p.x < zone.xMax &&
      p.y >= zone.yMin && p.y < zone.yMax &&
      p.z >= zone.zMin && p.z < zone.zMax
    );

    const numPoints   = zonePoints.length;
    const vol         = Math.max(0.01,
      (zone.xMax - zone.xMin) * (zone.yMax - zone.yMin) * (zone.zMax - zone.zMin));
    const pointDensity = numPoints / vol;

    let avgSnr = 0, centroidX = 0, centroidY = 0, centroidZ = 0;
    let zMean = 0, zSpread = 0, velocitySpread = 0;

    if (numPoints > 0) {
      avgSnr    = zonePoints.reduce((s, p) => s + p.snr,     0) / numPoints;
      centroidX = zonePoints.reduce((s, p) => s + p.x,       0) / numPoints;
      centroidY = zonePoints.reduce((s, p) => s + p.y,       0) / numPoints;
      centroidZ = zonePoints.reduce((s, p) => s + p.z,       0) / numPoints;
      zMean     = centroidZ;

      const zSqSum = zonePoints.reduce((s, p) => s + Math.pow(p.z - zMean, 2), 0);
      zSpread = Math.sqrt(zSqSum / numPoints);

      const vMean  = zonePoints.reduce((s, p) => s + p.doppler, 0) / numPoints;
      const vSqSum = zonePoints.reduce((s, p) => s + Math.pow(p.doppler - vMean, 2), 0);
      velocitySpread = Math.sqrt(vSqSum / numPoints);
    }

    const features: ZoneFeature = {
      numPoints, avgSnr, pointDensity,
      centroidX, centroidY, centroidZ,
      zMean, zSpread, velocitySpread
    };

    // ── Overload / Freeze Protection ────────────────────────────────────
    let freezeRemaining = prevState.freezeRemaining;
    if (avgSnr >= 50.0) {
      freezeRemaining = Math.min(8, 2 + Math.floor((avgSnr - 50.0) / 10));
    } else if (freezeRemaining > 0) {
      freezeRemaining--;
    }

    let { occupied, voteUpCount, voteDownCount, lastState } = prevState;
    let confidence = prevState.confidence;

    if (freezeRemaining === 0) {
      // ── Occupancy Score Calculation ──────────────────────────────────
      let rawScore = 0.0;
      if (numPoints >= params.minPointsForScore) {
        const baseDensity   = baselines ? baselines[zone.id].density : 0.1;
        const baseSnr       = baselines ? baselines[zone.id].snr     : 3.0;
        const densityThresh = Math.max(0.08, baseDensity + 0.15);
        const snrThresh     = Math.max(6.0, baseSnr      + 2.0);

        const dScore = Math.min(pointDensity / densityThresh, 1.0);
        const sScore = Math.min(avgSnr / snrThresh, 1.0);
        const vScore = Math.min(velocitySpread / 0.12, 1.0);
        const zScore = Math.min(zMean / 1.2, 1.0);

        rawScore = Math.max(0, Math.min(1.0,
          0.35 * dScore + 0.35 * sScore + 0.20 * vScore + 0.10 * zScore
        ));
      }

      // ── EMA Confidence ───────────────────────────────────────────────
      confidence = params.alphaSmoothing * rawScore + (1 - params.alphaSmoothing) * confidence;

      // ── Hysteresis Voting ────────────────────────────────────────────
      if (confidence >= params.occupiedThreshold) {
        voteUpCount++;
        voteDownCount = 0;
        if (voteUpCount >= params.voteWindow) { lastState = 'occupied'; occupied = true; }
      } else if (confidence <= params.emptyThreshold) {
        voteDownCount++;
        voteUpCount = 0;
        if (voteDownCount >= params.voteWindow) { lastState = 'empty'; occupied = false; }
      } else {
        // Dead-band — decay votes slowly
        voteUpCount   = Math.max(0, voteUpCount   - 1);
        voteDownCount = Math.max(0, voteDownCount - 1);
      }
    }

    // ── Classification: Adult vs Child ───────────────────────────────────
    let classification: SeatClassification = 'empty';
    if (occupied) {
      // Child detection: low centroid height AND compact/weak signal pattern
      const isLowProfile = zMean < 0.50;
      const isCompact = velocitySpread < 0.06 && zSpread < 0.15;
      const isWeakSignal = avgSnr < 12.0;
      classification = (isLowProfile && (isCompact || isWeakSignal)) ? 'child' : 'adult';
    }

    updatedStates[zone.id] = {
      occupied, confidence, classification, features,
      voteUpCount, voteDownCount, lastState, freezeRemaining
    };
  });

  return updatedStates;
}

// ─── Zone State Factory ──────────────────────────────────────────────────────

export function initZoneState(zoneId: number): ZoneState {
  return {
    occupied: false, confidence: 0.0, classification: 'empty',
    features: {
      numPoints: 0, avgSnr: 0, pointDensity: 0,
      centroidX: 0, centroidY: 0, centroidZ: 0,
      zMean: 0, zSpread: 0, velocitySpread: 0
    },
    voteUpCount: 0, voteDownCount: 0, lastState: 'empty', freezeRemaining: 0
  };
}
