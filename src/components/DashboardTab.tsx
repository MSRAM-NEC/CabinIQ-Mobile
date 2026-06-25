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
import { ZoneState, VitalSigns, DriveMode, ZoneDefinition } from '../types';
import { Heart, HeartPulse, Activity, Target, User, Baby } from 'lucide-react';

interface DashboardTabProps {
  zones: ZoneDefinition[];
  zoneStates: { [zoneId: number]: ZoneState };
  vitals: VitalSigns;
  driveMode: DriveMode;
  onTriggerCalibration: () => void;
  isCalibrating: boolean;
}

// ── Seat Card ────────────────────────────────────────────────────────────────

function SeatCard({ state, label, isDriver = false, animDelay = 0 }: {
  state: ZoneState;
  label: string;
  isDriver?: boolean;
  animDelay?: number;
  key?: React.Key;
}) {
  const isOcc   = state.occupied;
  const isChild = state.classification === 'child';
  const conf    = Math.round(state.confidence * 100);
  const [appeared, setAppeared] = useState(false);
  const [prevOcc, setPrevOcc] = useState(isOcc);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  useEffect(() => {
    if (prevOcc !== isOcc) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      setPrevOcc(isOcc);
      return () => clearTimeout(t);
    }
  }, [isOcc, prevOcc]);

  // Color scheme
  const scheme = isOcc
    ? isChild
      ? { bg: 'linear-gradient(145deg,#451a03,#78350f)', border: '#d97706', icon: '#fbbf24', text: '#fef3c7', glow: 'rgba(217,119,6,0.35)' }
      : { bg: 'linear-gradient(145deg,#0d1b3e,#1e3a8a)', border: '#3b82f6', icon: '#60a5fa', text: '#dbeafe', glow: 'rgba(59,130,246,0.30)' }
    : { bg: 'linear-gradient(145deg,#13151c,#1a1d24)', border: 'rgba(255,255,255,0.08)', icon: '#374151', text: '#4b5563', glow: 'transparent' };

  return (
    <div
      className="flex flex-col items-center gap-1.5 transition-all duration-500"
      style={{ opacity: appeared ? 1 : 0, transform: appeared ? 'translateY(0)' : 'translateY(12px)' }}
    >
      {/* Seat card body */}
      <div
        className="relative w-[68px] h-[76px] rounded-2xl flex flex-col items-center justify-center transition-all duration-400"
        style={{
          background: scheme.bg,
          border: `1.5px solid ${scheme.border}`,
          boxShadow: flash
            ? `0 0 20px ${scheme.glow}, 0 0 8px ${scheme.glow}`
            : isOcc
            ? `0 0 10px ${scheme.glow}`
            : 'none',
          transform: flash ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        {/* Classification badge */}
        {isOcc && (
          <span
            className="absolute -top-1 -right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[7px] font-bold uppercase tracking-wide text-white"
            style={{ background: isChild ? '#d97706' : '#2563eb' }}
          >
            {isChild ? <Baby className="w-2 h-2" /> : <User className="w-2 h-2" />}
            {isChild ? 'Child' : 'Adult'}
          </span>
        )}

        {/* Icon */}
        <div className="mb-1" style={{ color: scheme.icon }}>
          {isOcc
            ? isChild
              ? <Baby className="w-6 h-6" />
              : <User className="w-6 h-6" />
            : <div className="w-6 h-6 rounded-lg border-2 border-dashed border-[#374151]" />
          }
        </div>

        {/* Confidence bar */}
        <div className="w-10 h-[3px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${conf}%`,
              background: isOcc
                ? isChild ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#3b82f6,#60a5fa)'
                : '#374151',
            }}
          />
        </div>

        {/* Confidence % */}
        <span className="text-[8px] font-mono font-semibold mt-0.5" style={{ color: scheme.text }}>
          {conf}%
        </span>
      </div>

      {/* Label */}
      <span className="text-[10px] font-semibold tracking-wide text-center leading-tight" style={{ color: scheme.text }}>
        {label}
      </span>

      {/* Driver indicator */}
      {isDriver && (
        <span className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest -mt-1">
          ● DRIVER
        </span>
      )}
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

// ── Main Component ───────────────────────────────────────────────────────────

export default function DashboardTab({
  zones, zoneStates, vitals, driveMode,
  onTriggerCalibration, isCalibrating
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
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 select-none">

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-2xl flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#0d111a,#111520)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <h2 className="text-[13px] font-semibold text-neutral-200">
            {isCalibrating ? 'Calibrating…' : 'Continuous Monitoring'}
          </h2>
          <p className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isCalibrating ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {isCalibrating ? 'Scanning ambient baseline' : `${totalOccupied} of ${zones.length} seats occupied`}
          </p>
        </div>
        <button
          onClick={onTriggerCalibration}
          disabled={isCalibrating}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all border ${
            isCalibrating
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-[#1a1d28] text-neutral-300 border-[rgba(255,255,255,0.10)] active:scale-95 hover:border-sky-500/30'
          }`}
        >
          <Target className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
          {isCalibrating ? 'Calibrating' : 'Reset Baseline'}
        </button>
      </div>

      {/* ── Vehicle Cabin Layout ────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg,#0d111a,#0a0e17)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Cabin Occupancy</h3>
          <div className="flex items-center gap-3 text-[8px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-600 inline-block" /> Adult</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber-600 inline-block" /> Child</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-[#1a1d24] border border-neutral-700 inline-block" /> Empty</span>
          </div>
        </div>

        {/* Cabin area: car silhouette + seats overlaid */}
        <div className="relative px-3 pb-5">
          {/* Car silhouette */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[140px] h-full max-h-[320px]">
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
                <SeatCard key={z.id} state={getZoneState(z.id)} label={z.seatLabel} animDelay={150 + i * 80} />
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
                  <SeatCard key={z.id} state={getZoneState(z.id)} label={z.seatLabel} animDelay={280 + i * 80} />
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
