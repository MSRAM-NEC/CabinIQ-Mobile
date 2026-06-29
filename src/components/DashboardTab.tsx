/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DashboardTab — Seating + Vitals Screen
 *
 * Phase 3 Improvements:
 *  - Top-down car silhouette SVG with windshield/body outline
 *  - Seat cards with gradient backgrounds, glow rings, micro-animations on state change
 *  - Improved confidence bar (wider, more visible)
 *  - Smooth SVG breathing waveform path instead of discrete bars
 *  - Real-time animated heartbeat line
 *  - Slide-up entry animation on mount
 */

import React, { useEffect, useState, useRef } from 'react';
import { ZoneState, VitalSigns, DriveMode, ZoneDefinition, ConnectionDiagnostics, DEFAULT_DIAGNOSTICS, TransportType } from '../types';
import { Heart, HeartPulse, Activity, Target, User, Baby, Wifi, Usb, Cpu, ShieldCheck } from 'lucide-react';

interface DashboardTabProps {
  zones: ZoneDefinition[];
  zoneStates: { [zoneId: number]: ZoneState };
  vitals: VitalSigns;
  driveMode: DriveMode;
  onTriggerCalibration: () => void;
  isCalibrating: boolean;
  // System health card props (optional, graceful degradation if not passed)
  connectionStatus?: string;
  transportType?: TransportType;
  isSimulationMode?: boolean;
  configName?: string;
  sensorTiltDeg?: number;
  diagnostics?: ConnectionDiagnostics;
  darkMode?: boolean;
}

// ── Premium Seat Card ────────────────────────────────────────────────────────

function SeatCard({ state, label, isDriver = false, animDelay = 0, darkMode = true }: {
  state: ZoneState;
  label: string;
  isDriver?: boolean;
  animDelay?: number;
  key?: React.Key;
  darkMode?: boolean;
}) {
  const isOcc   = state.occupied;
  const isChild = state.classification === 'child';
  const conf    = Math.round(state.confidence * 100);
  const [appeared, setAppeared] = useState(false);
  const [prevOcc, setPrevOcc]   = useState(isOcc);
  const [flash, setFlash]       = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  useEffect(() => {
    if (prevOcc !== isOcc) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      setPrevOcc(isOcc);
      return () => clearTimeout(t);
    }
  }, [isOcc, prevOcc]);

  // Premium color tokens
  const scheme = isOcc
    ? isChild
      ? {
          bg:       darkMode ? 'linear-gradient(160deg,#2d1500 0%,#431f00 50%,#2d1500 100%)' : 'linear-gradient(160deg,#fffbeb 0%,#fef3c7 50%,#fffbeb 100%)',
          glassTop: darkMode ? 'rgba(251,191,36,0.06)' : 'rgba(0,0,0,0.01)',
          border:   '#d97706',
          glow:     darkMode ? 'rgba(217,119,6,0.55)' : 'rgba(217,119,6,0.25)',
          arcColor: '#f59e0b',
          icon:     darkMode ? '#fbbf24' : '#b45309',
          text:     darkMode ? '#fef3c7' : '#78350f',
          badge:    'linear-gradient(135deg,#92400e,#d97706)',
        }
      : {
          bg:       darkMode ? 'linear-gradient(160deg,#060f2a 0%,#0f2055 50%,#060f2a 100%)' : 'linear-gradient(160deg,#eff6ff 0%,#dbeafe 50%,#eff6ff 100%)',
          glassTop: darkMode ? 'rgba(96,165,250,0.07)' : 'rgba(0,0,0,0.01)',
          border:   '#3b82f6',
          glow:     darkMode ? 'rgba(59,130,246,0.55)' : 'rgba(59,130,246,0.25)',
          arcColor: '#60a5fa',
          icon:     darkMode ? '#93c5fd' : '#1d4ed8',
          text:     darkMode ? '#bfdbfe' : '#1e3a8a',
          badge:    'linear-gradient(135deg,#1e40af,#3b82f6)',
        }
    : {
        bg:       darkMode ? 'linear-gradient(160deg,#0e1018 0%,#141720 50%,#0e1018 100%)' : 'linear-gradient(160deg,#f8fafc 0%,#f1f5f9 50%,#e2e8f0 100%)',
        glassTop: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        border:   darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)',
        glow:     'transparent',
        arcColor: darkMode ? '#1f2937' : '#cbd5e1',
        icon:     darkMode ? '#374151' : '#94a3b8',
        text:     darkMode ? '#4b5563' : '#64748b',
        badge:    '',
      };

  // SVG confidence arc (circle stroke)
  const R = 28;
  const C = 2 * Math.PI * R;
  const arcLen = (conf / 100) * C;

  return (
    <div
      className="flex flex-col items-center gap-2 transition-all duration-500"
      style={{ opacity: appeared ? 1 : 0, transform: appeared ? 'translateY(0)' : 'translateY(16px)' }}
    >
      {/* ── Card body ── */}
      <div
        className="relative rounded-2xl flex flex-col items-center justify-center"
        style={{
          width: 76, height: 88,
          background: scheme.bg,
          border: `1.5px solid ${scheme.border}`,
          boxShadow: flash
            ? `0 0 28px ${scheme.glow}, 0 0 10px ${scheme.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : isOcc
            ? `0 0 16px ${scheme.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transform: flash ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.45s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Glass sheen overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: `linear-gradient(160deg, ${scheme.glassTop} 0%, transparent 55%)`,
          }}
        />

        {/* Confidence arc ring */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 76 88"
          style={{ opacity: isOcc ? 0.9 : 0.3 }}
        >
          {/* Track */}
          <circle cx="38" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
          {/* Fill arc */}
          <circle
            cx="38" cy="44" r={R}
            fill="none"
            stroke={scheme.arcColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${C}`}
            transform="rotate(-90 38 44)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 3px ${scheme.arcColor})` }}
          />
        </svg>

        {/* Classification badge (top-right) */}
        {isOcc && (
          <div
            className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[7px] font-extrabold uppercase tracking-wide text-white z-10"
            style={{ background: scheme.badge, boxShadow: `0 2px 8px ${scheme.glow}` }}
          >
            {isChild ? <Baby className="w-2 h-2" /> : <User className="w-2 h-2" />}
            {isChild ? 'Child' : 'Adult'}
          </div>
        )}

        {/* Driver crown */}
        {isDriver && (
          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 flex items-center justify-center z-10">
            <span className="text-[10px]">👑</span>
          </div>
        )}

        {/* Center icon */}
        <div className="flex flex-col items-center gap-1.5 relative z-10">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isOcc ? `rgba(${isChild ? '217,119,6' : '59,130,246'},0.18)` : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${isOcc ? scheme.border : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            {isOcc
              ? isChild
                ? <Baby className="w-5 h-5" style={{ color: scheme.icon }} />
                : <User className="w-5 h-5" style={{ color: scheme.icon }} />
              : <div className="w-4 h-4 rounded-full border-[1.5px] border-dashed border-[#374151]" />
            }
          </div>

          {/* Confidence % */}
          <span
            className="text-[9px] font-mono font-bold leading-none"
            style={{ color: isOcc ? scheme.icon : '#374151' }}
          >
            {conf}%
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-[9.5px] font-semibold tracking-wide text-center leading-tight"
          style={{ color: isOcc ? scheme.text : '#4b5563' }}
        >
          {label}
        </span>
        {isDriver && (
          <span className="text-[7px] font-bold text-amber-600/70 uppercase tracking-widest">
            Driver
          </span>
        )}
      </div>
    </div>
  );
}


// ── Car Silhouette SVG (Top-down view) ───────────────────────────────────────

function CarSilhouette({ isLHD }: { isLHD: boolean }) {
  return (
    <svg
      viewBox="0 0 200 320"
      className="w-full h-full opacity-[0.07] pointer-events-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body outline */}
      <path
        d="M40 60 Q40 20 100 15 Q160 20 160 60 L165 240 Q165 290 100 295 Q35 290 35 240 Z"
        stroke="#0ea5e9"
        strokeWidth="2"
        fill="rgba(14,165,233,0.04)"
        strokeLinejoin="round"
      />
      {/* Windshield */}
      <path
        d="M52 80 Q100 68 148 80 L145 110 Q100 102 55 110 Z"
        stroke="#0ea5e9"
        strokeWidth="1.5"
        fill="rgba(14,165,233,0.06)"
      />
      {/* Rear windshield */}
      <path
        d="M55 225 Q100 217 145 225 L148 255 Q100 262 52 255 Z"
        stroke="#0ea5e9"
        strokeWidth="1.5"
        fill="rgba(14,165,233,0.06)"
      />
      {/* Door seams */}
      <line x1="38" y1="158" x2="162" y2="158" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 3" />
      {/* Roof line */}
      <ellipse cx="100" cy="160" rx="40" ry="55" stroke="#0ea5e9" strokeWidth="1" fill="rgba(14,165,233,0.02)" />
      {/* Steering wheel indicator */}
      {isLHD
        ? <circle cx="65" cy="120" r="8" stroke="#0ea5e9" strokeWidth="1.2" />
        : <circle cx="135" cy="120" r="8" stroke="#0ea5e9" strokeWidth="1.2" />
      }
    </svg>
  );
}

// ── Breathing Waveform (SVG sine wave) ──────────────────────────────────────

function BreathingWave({ active, rate, phase }: { active: boolean; rate: number; phase: number }) {
  const points = Array.from({ length: 48 }, (_, i) => {
    const t = i / 47;
    const y = active
      ? 16 - Math.sin(t * Math.PI * 4 + phase) * 11
      : 16;
    return `${(t * 100).toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 32" className="w-full h-8" preserveAspectRatio="none">
      {active && (
        <polyline
          points={`0,32 ${points} 100,32`}
          fill="rgba(16,185,129,0.08)"
          stroke="none"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={active ? '#10b981' : '#1f2937'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EcgWave({ active, rate, phase }: { active: boolean; rate: number; phase: number }) {
  const points = Array.from({ length: 80 }, (_, i) => {
    const t = i / 79;
    if (!active || rate <= 0) {
      return `${(t * 100).toFixed(1)},16.0`;
    }

    const xPhase = t * 4 - phase;
    let phi = xPhase % 1;
    if (phi < 0) phi += 1;

    let v = 0;
    if (phi >= 0.1 && phi < 0.16) {
      v = Math.sin((phi - 0.1) / 0.06 * Math.PI) * 2.0;
    } else if (phi >= 0.18 && phi < 0.21) {
      v = ((phi - 0.18) / 0.03) * -1.5;
    } else if (phi >= 0.21 && phi < 0.25) {
      v = -1.5 + ((phi - 0.21) / 0.04) * 15.5;
    } else if (phi >= 0.25 && phi < 0.28) {
      v = 14.0 - ((phi - 0.25) / 0.03) * 18.0;
    } else if (phi >= 0.28 && phi < 0.32) {
      v = -4.0 + ((phi - 0.28) / 0.04) * 4.0;
    } else if (phi >= 0.36 && phi < 0.48) {
      v = Math.sin((phi - 0.36) / 0.12 * Math.PI) * 3.5;
    }

    const y = 18 - v;
    return `${(t * 100).toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 32" className="w-full h-8" preserveAspectRatio="none">
      {active && (
        <polyline
          points={`0,32 ${points} 100,32`}
          fill="rgba(244,63,94,0.06)"
          stroke="none"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={active ? '#f43f5e' : '#1f2937'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── System Health Card ───────────────────────────────────────────────────────

function SystemHealthCard({
  connectionStatus = 'disconnected',
  transportType = 'serial',
  isSimulationMode = false,
  configName = '—',
  sensorTiltDeg = 0,
  diagnostics = DEFAULT_DIAGNOSTICS,
  darkMode = true,
}: {
  connectionStatus?: string;
  transportType?: TransportType;
  isSimulationMode?: boolean;
  configName?: string;
  sensorTiltDeg?: number;
  diagnostics?: ConnectionDiagnostics;
  darkMode?: boolean;
}) {
  const isConnected  = connectionStatus === 'connected';
  const totalErrors  = diagnostics.parseErrors + diagnostics.crcErrors;
  const healthStatus = !isConnected ? 'offline'
    : totalErrors > 5  ? 'warn'
    : 'ok';

  const statusColor  = healthStatus === 'ok' ? '#10b981'
    : healthStatus === 'warn' ? '#f59e0b'
    : '#4b5563';
  const statusLabel  = healthStatus === 'ok' ? 'Healthy'
    : healthStatus === 'warn' ? 'Errors Detected'
    : 'Offline';

  const transportIcon = isSimulationMode ? Cpu
    : transportType === 'network' ? Wifi
    : Usb;
  const TransportIcon = transportIcon;
  const transportLabel = isSimulationMode ? 'SIM' : transportType === 'network' ? 'NET' : 'USB';
  const transportColor = isSimulationMode ? '#8b5cf6' : transportType === 'network' ? '#0ea5e9' : '#10b981';

  return (
    <div
      className="rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2"
      style={{
        background: darkMode ? 'linear-gradient(135deg,#0a0e18,#0d1220)' : 'linear-gradient(135deg,#ffffff,#f1f5f9)',
        border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)'
      }}
    >
      {/* Health status dot + label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}99` }} />
          {healthStatus === 'ok' && (
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: statusColor, animation: 'healthPing 2s ease-out infinite' }}
            />
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-neutral-200 leading-none">{statusLabel}</p>
          <p className="text-[8px] text-neutral-600 mt-0.5 leading-none">System health</p>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-[rgba(255,255,255,0.06)]" />

      {/* Transport badge */}
      <div className="flex items-center gap-1.5">
        <TransportIcon className="w-3 h-3" style={{ color: transportColor }} />
        <span className="text-[9px] font-bold" style={{ color: transportColor }}>{transportLabel}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-[rgba(255,255,255,0.06)]" />

      {/* Tilt */}
      <div className="flex flex-col items-center">
        <span className="text-[12px] font-mono font-bold text-neutral-200 leading-none">{sensorTiltDeg}°</span>
        <span className="text-[7px] text-neutral-600 uppercase tracking-wide mt-0.5">Tilt</span>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-[rgba(255,255,255,0.06)]" />

      {/* FPS */}
      <div className="flex flex-col items-center">
        <span className="text-[12px] font-mono font-bold text-neutral-200 leading-none">
          {isConnected ? diagnostics.avgFps.toFixed(1) : '—'}
        </span>
        <span className="text-[7px] text-neutral-600 uppercase tracking-wide mt-0.5">FPS</span>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-[rgba(255,255,255,0.06)]" />

      {/* Errors */}
      <div className="flex flex-col items-center">
        <span
          className="text-[12px] font-mono font-bold leading-none"
          style={{ color: totalErrors > 0 ? '#f59e0b' : '#10b981' }}
        >
          {isConnected ? totalErrors : '—'}
        </span>
        <span className="text-[7px] text-neutral-600 uppercase tracking-wide mt-0.5">Errors</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DashboardTab({
  zones, zoneStates, vitals, driveMode,
  onTriggerCalibration, isCalibrating,
  connectionStatus, transportType, isSimulationMode,
  configName, sensorTiltDeg, diagnostics,
  darkMode = true,
}: DashboardTabProps) {
  // Dynamically find the driver zone — avoid hardcoded Zone 0
  const driverZone = zones.find(z => z.seatLabel.toLowerCase().includes('driver'));
  const driverZoneId = driverZone?.id ?? 0;

  const [heartPhase, setHeartPhase] = useState(0);
  const [breathPhase, setBreathPhase] = useState(0);
  const [pulse, setPulse] = useState(false);
  const animRef = useRef<number>(0);
  const lastBeatRef = useRef(Date.now());

  // Heart beat pulse
  useEffect(() => {
    if (!vitals.driverPresent || vitals.heartRate <= 0) return;
    const ms = Math.max(400, 60000 / vitals.heartRate);
    const id = setInterval(() => setPulse(p => !p), ms);
    return () => clearInterval(id);
  }, [vitals.driverPresent, vitals.heartRate]);

  // Breathing and heartbeat waveforms animation
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setBreathPhase(p => p + 0.025);
      setHeartPhase(p => p + 0.035);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isLHD = driveMode === 'lhd';

  const getZoneState = (id: number): ZoneState =>
    zoneStates[id] || {
      occupied: false, confidence: 0.0, classification: 'empty',
      features: { numPoints:0, avgSnr:0, pointDensity:0, centroidX:0, centroidY:0, centroidZ:0, zMean:0, zSpread:0, velocitySpread:0 },
      voteUpCount:0, voteDownCount:0, lastState:'empty', freezeRemaining:0
    };

  // Group zones by row
  const rows: { [key: string]: ZoneDefinition[] } = {};
  zones.forEach(z => {
    const rowKey = z.name.startsWith('R1') ? 'R1' : z.name.startsWith('R3') ? 'R3' : 'R2';
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push(z);
  });

  const getSortedRow = (rowKey: string) =>
    [...(rows[rowKey] || [])].sort((a, b) => ((b.xMin + b.xMax) / 2) - ((a.xMin + a.xMax) / 2));

  const frontRow  = getSortedRow('R1');
  const middleRow = getSortedRow('R2');
  const backRow   = getSortedRow('R3');

  const totalOccupied = Object.values(zoneStates).filter(z => z.occupied).length;

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3 pb-12 space-y-3 select-none">

      {/* ── System Health Card ──────────────────────────────────────── */}
      <SystemHealthCard
        connectionStatus={connectionStatus}
        transportType={transportType}
        isSimulationMode={isSimulationMode}
        configName={configName}
        sensorTiltDeg={sensorTiltDeg}
        diagnostics={diagnostics}
        darkMode={darkMode}
      />

      {/* ── Status Bar + Calibration ─────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: darkMode ? 'linear-gradient(135deg,#0d111a,#111520)' : 'linear-gradient(135deg,#ffffff,#f1f5f9)',
          border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)'
        }}
      >
        {/* Top row */}
        <div className="p-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-neutral-200">
              {isCalibrating ? 'Calibrating Baseline…' : 'Continuous Monitoring'}
            </h2>
            <p className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isCalibrating ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isCalibrating ? 'Sampling ambient radar environment' : `${totalOccupied} of ${zones.length} seats occupied`}
            </p>
          </div>
          {/* Calibration ring indicator */}
          {isCalibrating ? (
            <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="3" />
                <circle
                  cx="20" cy="20" r="16" fill="none"
                  stroke="#f59e0b" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset="25"
                  className="calib-ring-pulse"
                />
              </svg>
              <Target className="w-4 h-4 text-amber-400 absolute animate-spin" style={{ animationDuration: '2s' }} />
            </div>
          ) : (
            <button
              onClick={onTriggerCalibration}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all border active:scale-95 ${
                darkMode
                  ? 'bg-[#1a1d28] text-neutral-300 border-[rgba(255,255,255,0.10)]'
                  : 'bg-white text-neutral-700 border-[rgba(0,0,0,0.12)]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Reset Baseline
            </button>
          )}
        </div>

        {/* Calibration progress strip */}
        {isCalibrating && (
          <div
            className="mx-3.5 mb-3 p-2.5 rounded-xl flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)' }}
          >
            <div className="flex-1 h-[3px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg,#d97706,#f59e0b)',
                  width: '60%',
                  animation: 'calibProgress 3s ease-in-out infinite alternate',
                }}
              />
            </div>
            <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-wider flex-shrink-0">
              Sampling…
            </span>
          </div>
        )}
      </div>


      {/* ── Vehicle Cabin Layout (Premium) ─────────────────────────── */}
      {/* ── Cabin Occupancy Grid ────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: darkMode ? 'linear-gradient(160deg,#060b18 0%,#080e1c 40%,#050810 100%)' : 'linear-gradient(160deg,#ffffff 0%,#f8fafc 40%,#f1f5f9 100%)',
          border: darkMode ? '1px solid rgba(14,165,233,0.14)' : '1px solid rgba(14,165,233,0.22)',
          boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(14,165,233,0.07)' : '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* Subtle corner glow */}
        <div
          className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, rgba(14,165,233,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none"
          style={{ background: 'radial-gradient(circle at bottom left, rgba(59,130,246,0.04) 0%, transparent 70%)' }}
        />

        {/* Premium Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#0ea5e9,#3b82f6)' }} />
            <h3 className="text-[11px] font-bold text-neutral-200 uppercase tracking-widest">Cabin Occupancy</h3>
            {/* Live count badge */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold"
              style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.22)', color: '#38bdf8' }}
            >
              <span className="w-1 h-1 rounded-full bg-sky-400" style={{ animation: 'ping-dot 1.4s ease-in-out infinite' }} />
              {totalOccupied}/{zones.length}
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-[8px] text-neutral-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" style={{ boxShadow: '0 0 4px rgba(59,130,246,0.6)' }} />
              Adult
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" style={{ boxShadow: '0 0 4px rgba(245,158,11,0.6)' }} />
              Child
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#1a1d24] border border-neutral-700 inline-block" />
              Empty
            </span>
          </div>
        </div>

        {/* Cabin area: car silhouette + seats overlaid */}
        <div className="relative px-3 pb-5">
          {/* Car silhouette */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[150px] h-full max-h-[340px]">
              <CarSilhouette isLHD={isLHD} />
            </div>
          </div>


          {/* Direction labels */}
          <div className="flex items-center gap-1.5 justify-center mb-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-[8px] text-neutral-600 font-medium uppercase tracking-widest">Front</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Front Row */}
          {frontRow.length > 0 && (
            <div className="flex items-start justify-around mb-4">
              {frontRow.map((z, i) => (
                <SeatCard
                  key={z.id}
                  state={getZoneState(z.id)}
                  label={z.seatLabel}
                  isDriver={z.seatLabel.toLowerCase().includes('driver')}
                  animDelay={i * 80}
                  darkMode={darkMode}
                />
              ))}
            </div>
          )}

          {/* Rear divider */}
          {(middleRow.length > 0 || backRow.length > 0) && (
            <div className="flex items-center gap-2 my-3 px-2">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-[8px] text-neutral-600 font-medium uppercase tracking-widest">Rear Row</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>
          )}

          {/* Rear Row (R2) */}
          {middleRow.length > 0 && (
            <div className="flex items-start justify-around mb-4">
              {middleRow.map((z, i) => (
                <SeatCard key={z.id} state={getZoneState(z.id)} label={z.seatLabel} animDelay={150 + i * 80} darkMode={darkMode} />
              ))}
            </div>
          )}

          {/* Third Row (R3) */}
          {backRow.length > 0 && (
            <>
              <div className="flex items-center gap-2 my-3 px-2">
                <div className="flex-1 h-px bg-neutral-800" />
                <span className="text-[8px] text-neutral-600 font-medium uppercase tracking-widest">Row 3</span>
                <div className="flex-1 h-px bg-neutral-800" />
              </div>
              <div className="flex items-start justify-around">
                {backRow.map((z, i) => (
                  <SeatCard key={z.id} state={getZoneState(z.id)} label={z.seatLabel} animDelay={280 + i * 80} darkMode={darkMode} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Driver Vitals ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg,#0d111a,#120a10)', border: '1px solid rgba(255,255,255,0.07)' }}>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.20)' }}>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-neutral-200">Driver Vitals</h3>
            <span className="text-[10px] text-neutral-500 font-medium">
              Zone {driverZoneId} · {vitals.driverPresent ? 'Active' : 'No occupant'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Presence */}
          <div className="p-3 rounded-xl flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[8px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Presence</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${vitals.driverPresent ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-neutral-700'}`} />
              <span className={`text-[13px] font-bold ${vitals.driverPresent ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {vitals.driverPresent ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Heart Rate */}
          <div className="p-3 rounded-xl flex flex-col relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[8px] font-medium text-neutral-500 uppercase tracking-wider mb-1">HR</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[22px] font-bold font-mono text-white leading-none">
                {vitals.heartRate > 0 ? Math.round(vitals.heartRate) : '—'}
              </span>
              <span className="text-[8px] text-rose-400 font-medium">BPM</span>
            </div>
            {vitals.driverPresent && (
              <Heart
                className={`absolute right-2 bottom-2 w-4 h-4 text-rose-500/30 transition-all duration-300 ${pulse ? 'scale-150 text-rose-500/50' : 'scale-90'}`}
              />
            )}
          </div>

          {/* Respiration */}
          <div className="p-3 rounded-xl flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[8px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Resp.</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-[22px] font-bold font-mono leading-none ${vitals.driverPresent ? 'text-emerald-400' : 'text-neutral-600'}`}>
                {vitals.driverPresent ? (vitals.breathingRate * 60).toFixed(1) : '—'}
              </span>
              <span className="text-[8px] text-neutral-500 font-medium">BPM</span>
            </div>
          </div>
        </div>

        {/* Breathing waveform */}
        <div className="mt-3 px-2 py-2 rounded-xl overflow-hidden" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-medium text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" /> Breathing Waveform
            </span>
            {vitals.driverPresent && (
              <span className="text-[8px] font-mono text-emerald-500">
                {(vitals.breathingRate * 60).toFixed(1)} brpm
              </span>
            )}
          </div>
          <BreathingWave
            active={vitals.driverPresent}
            rate={vitals.breathingRate}
            phase={breathPhase}
          />
        </div>

        {/* Heartbeat ECG waveform */}
        <div className="mt-2.5 px-2 py-2 rounded-xl overflow-hidden" style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.08)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-medium text-rose-600 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 animate-pulse" /> ECG Heartbeat Waveform
            </span>
            {vitals.driverPresent && (
              <span className="text-[8px] font-mono text-rose-500">
                {Math.round(vitals.heartRate)} bpm
              </span>
            )}
          </div>
          <EcgWave
            active={vitals.driverPresent}
            rate={vitals.heartRate}
            phase={heartPhase}
          />
        </div>
      </div>
    </div>
  );
}
