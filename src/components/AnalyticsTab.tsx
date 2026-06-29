/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AnalyticsTab — Engineering Metrics Dashboard
 *
 * Phase 4 Improvements:
 *  - Sparklines with gradient fill, animated live dot, min/max labels
 *  - Zone-specific theme colors on bar charts with value labels
 *  - Event stream with icons for event types and slide-in entry animation
 *  - Improved layout with section dividers and icons
 */

import React, { useMemo } from 'react';
import { ZoneState, ChartDataPoint, ZoneDefinition } from '../types';
import { BarChart3, Activity, Clock, Wifi, AlertTriangle, User, Baby, Radio } from 'lucide-react';

interface AnalyticsTabProps {
  zones: ZoneDefinition[];
  zoneStates: { [zoneId: number]: ZoneState };
  historyLog: string[];
  snrHistory: ChartDataPoint[];
  fpsHistory: ChartDataPoint[];
  pointDensityHistory: ChartDataPoint[];
  packetLossCount: number;
  totalFrames: number;
  darkMode?: boolean;
}

// ── Zone color themes (must match Radar3DTab palette) ────────────────────────

const ZONE_COLORS = ['#10b981','#8b5cf6','#ec4899','#f59e0b','#06b6d4'];
function getZoneColor(id: number) { return ZONE_COLORS[id % ZONE_COLORS.length]; }

// ── Enhanced Sparkline ───────────────────────────────────────────────────────

function Sparkline({ data, color, label, unit, height = 60 }: {
  data: ChartDataPoint[];
  color: string;
  label: string;
  unit: string;
  height?: number;
}) {
  const last = data.length > 0 ? data[data.length - 1].v : 0;
  const max  = data.length > 0 ? Math.max(...data.map(d => d.v), 0.01) : 1;
  const min  = data.length > 0 ? Math.min(...data.map(d => d.v)) : 0;

  const svgH = height - 4;

  const linePts = useMemo(() => {
    if (data.length < 2) return '';
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * 200;
      const y = svgH - 4 - ((d.v - min) / (max - min || 1)) * (svgH - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [data, max, min, svgH]);

  const lastPt = data.length > 0 ? (() => {
    const i = data.length - 1;
    const x = 200;
    const y = svgH - 4 - ((data[i].v - min) / (max - min || 1)) * (svgH - 8);
    return { x, y };
  })() : null;

  const displayVal = typeof last === 'number'
    ? (last % 1 === 0 ? last.toString() : last.toFixed(1))
    : '—';

  return (
    <div className="rounded-xl p-3 flex flex-col" style={{ background: 'linear-gradient(135deg,#0d111a,#111520)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</span>
        <span className="text-[13px] font-mono font-bold" style={{ color }}>
          {displayVal}
          <span className="text-[8px] text-neutral-500 ml-0.5 font-normal">{unit}</span>
        </span>
      </div>

      <svg viewBox={`0 0 200 ${svgH}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {linePts && (
          <>
            {/* Gradient fill */}
            <polyline
              points={`0,${svgH} ${linePts} 200,${svgH}`}
              fill={`url(#fill-${label})`}
              stroke="none"
            />
            {/* Line */}
            <polyline
              points={linePts}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Animated live dot */}
            {lastPt && (
              <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={color} opacity="0.9">
                <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        )}
      </svg>

      {/* Min/Max labels */}
      {data.length > 1 && (
        <div className="flex justify-between mt-1">
          <span className="text-[7px] font-mono text-neutral-600">min {min.toFixed(1)}</span>
          <span className="text-[7px] font-mono text-neutral-600">max {max.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

// ── Zone Bar Chart (zone-colored) ────────────────────────────────────────────

function ZoneBarChart({ zones, zoneStates, metric, label, maxVal }: {
  zones: ZoneDefinition[];
  zoneStates: { [zoneId: number]: ZoneState };
  metric: 'numPoints' | 'avgSnr' | 'pointDensity';
  label: string;
  maxVal: number;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg,#0d111a,#111520)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block mb-3">{label}</span>
      <div className="flex items-end gap-1.5 h-16">
        {zones.map(zone => {
          const val  = zoneStates[zone.id]?.features[metric] ?? 0;
          const pct  = Math.min(100, (val / maxVal) * 100);
          const color = getZoneColor(zone.id);
          return (
            <div key={zone.id} className="flex-1 flex flex-col items-center gap-1">
              {/* Value label */}
              <span className="text-[7px] font-mono text-neutral-500" style={{ color: pct > 20 ? color : undefined }}>
                {metric === 'avgSnr' ? val.toFixed(0) : Math.round(val)}
              </span>
              <div className="w-full rounded-sm h-9 flex items-end overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div
                  className="w-full rounded-sm transition-all duration-500"
                  style={{
                    height: `${pct}%`,
                    background: `linear-gradient(180deg, ${color}, ${color}88)`,
                    boxShadow: pct > 50 ? `0 0 8px ${color}44` : 'none',
                  }}
                />
              </div>
              <span className="text-[7px] font-mono text-neutral-600 text-center truncate w-full" title={zone.seatLabel}>
                {zone.seatLabel.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Event Log entry (with icon) ──────────────────────────────────────────────

function EventEntry({ log, index }: { log: string; index: number; key?: string }) {
  const parts = log.split('] ');
  const time  = parts[0] + ']';
  const msg   = parts[1] || '';

  const isChild   = msg.includes('Child');
  const isAdult   = msg.includes('Adult');
  const isVacated = msg.includes('Vacated');
  const isWarning = msg.includes('WARNING') || msg.includes('⚠');
  const isSystem  = msg.includes('calibrat') || msg.includes('Simulation') || msg.includes('connect') || msg.includes('Scanning');

  const color = isWarning ? 'text-amber-400'
    : isChild   ? 'text-amber-300'
    : isAdult   ? 'text-blue-300'
    : isVacated ? 'text-neutral-400'
    : isSystem  ? 'text-sky-400'
    : 'text-neutral-300';

  const Icon = isWarning ? AlertTriangle
    : isChild   ? Baby
    : isAdult   ? User
    : isVacated ? Radio
    : Activity;

  return (
    <div
      className="flex items-start gap-2 text-[10px] font-mono py-1.5 px-2.5 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.04)',
        animation: index === 0 ? 'slideInEvent 0.3s ease-out' : 'none',
      }}
    >
      <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${color}`} />
      <div>
        <span className="text-neutral-600 mr-1.5">{time}</span>
        <span className={color}>{msg}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsTab({
  zones, zoneStates, historyLog,
  snrHistory, fpsHistory, pointDensityHistory,
  packetLossCount, totalFrames, darkMode = true
}: AnalyticsTabProps) {

  const packetLossRate = totalFrames > 0
    ? ((packetLossCount / totalFrames) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="h-full overflow-y-auto pb-[90px] p-3 space-y-3 select-none" style={{ background: darkMode ? undefined : '#f8fafc' }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-0.5">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <BarChart3 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className={`text-[14px] font-semibold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>System Analytics</h2>
          <span className={`text-[10px] font-medium ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>Real-time engineering metrics</span>
        </div>
      </div>

      {/* ── Sparkline Charts Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <Sparkline data={snrHistory}          color="#3b82f6" label="Avg SNR"       unit="dB"  />
        <Sparkline data={fpsHistory}          color="#10b981" label="Frame Rate"    unit="fps" />
        <Sparkline data={pointDensityHistory} color="#8b5cf6" label="Point Density" unit="pts" />

        {/* Packet Loss static card */}
        <div className="rounded-xl p-3 flex flex-col justify-between" style={{ background: darkMode ? 'linear-gradient(135deg,#0d111a,#111520)' : 'linear-gradient(135deg,#ffffff,#f1f5f9)', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)' }}>
          <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">Packet Loss</span>
          <div className="my-2">
            <span className={`text-[24px] font-mono font-bold leading-none ${packetLossCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {packetLossRate}
              <span className="text-[10px] text-neutral-500 ml-0.5 font-normal">%</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-neutral-600" />
            <span className="text-[8px] text-neutral-600">{totalFrames} frames total</span>
          </div>
        </div>
      </div>

      {/* ── Zone Bar Charts ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <ZoneBarChart zones={zones} zoneStates={zoneStates} metric="numPoints" label="Points / Zone" maxVal={80} />
        <ZoneBarChart zones={zones} zoneStates={zoneStates} metric="avgSnr"    label="SNR / Zone (dB)" maxVal={25} />
      </div>

      {/* ── Occupancy Summary ─────────────────────────────────────── */}
      <div className="rounded-xl p-3" style={{ background: darkMode ? 'linear-gradient(135deg,#0d111a,#111520)' : 'linear-gradient(135deg,#ffffff,#f1f5f9)', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)' }}>
        <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2.5">Occupancy Status</span>
        <div className="space-y-2">
          {zones.map(zone => {
            const st    = zoneStates[zone.id];
            const isOcc = st?.occupied;
            const conf  = Math.round((st?.confidence ?? 0) * 100);
            const color = getZoneColor(zone.id);
            return (
              <div key={zone.id} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300"
                  style={{ background: isOcc ? color : '#374151', boxShadow: isOcc ? `0 0 6px ${color}66` : 'none' }}
                />
                <span className="text-[11px] text-neutral-300 font-medium flex-1">{zone.seatLabel}</span>
                <span className={`text-[9px] font-mono font-semibold ${isOcc ? 'text-neutral-200' : 'text-neutral-600'}`}>
                  {isOcc ? (st.classification === 'child' ? '👶 CHILD' : 'ADULT') : 'EMPTY'}
                </span>
                {/* Confidence mini-bar */}
                <div className="w-10 h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${conf}%`, background: isOcc ? color : '#374151' }}
                  />
                </div>
                <span className="text-[9px] font-mono text-neutral-600 w-8 text-right">{conf}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Event Stream ──────────────────────────────────────────── */}
      <div className="rounded-xl p-3 min-h-[160px]" style={{ background: darkMode ? 'linear-gradient(135deg,#0d111a,#111520)' : 'linear-gradient(135deg,#ffffff,#f1f5f9)', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Event Stream
          </span>
          <span className="text-[8px] text-emerald-400 font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.15)' }}>
            LIVE
          </span>
        </div>
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {historyLog.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[11px] text-neutral-600">
              Waiting for events…
            </div>
          ) : (
            historyLog.map((log, i) => (
              <EventEntry key={`${log.slice(0, 30)}-${i}`} log={log} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
