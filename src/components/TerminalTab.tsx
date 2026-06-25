/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TerminalTab — Raw Serial Packet Inspector + Native Debug Log
 *
 * Phase 5 Improvements:
 *  - Hex dump syntax highlighting (sync bytes, header, TLV type fields)
 *  - Auto-scroll toggle button
 *  - Better packet card layout with improved badges
 *  - Native log improved line coloring
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RawPacketLog } from '../types';
import {
  Terminal, ShieldCheck, ShieldX, Cpu, Database, Radio,
  ChevronDown, ChevronUp, ArrowDown, ArrowUp
} from 'lucide-react';

interface TerminalTabProps {
  packetLogs: RawPacketLog[];
  nativeLogs?: string[];
}

// ── Hex highlight: color first 8 bytes (sync), next 8 (header), rest neutral ──

function HexDump({ hex }: { hex: string }) {
  const bytes = hex.replace('…', '').trim().split(' ');
  return (
    <div className="font-mono text-[10px] leading-relaxed break-all flex flex-wrap gap-x-0.5">
      {bytes.map((byte, i) => {
        let color = 'text-neutral-600';
        if (i < 8)  color = 'text-sky-500';        // Sync pattern
        else if (i < 16) color = 'text-violet-400'; // Version/length
        else if (i < 24) color = 'text-emerald-500';// Frame info
        return (
          <span key={i} className={color}>{byte}</span>
        );
      })}
      {hex.endsWith('…') && <span className="text-neutral-700">…</span>}
    </div>
  );
}

// ── Validation badge ──────────────────────────────────────────────────────────

function ValidBadge({ valid, label }: { valid: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${
      valid ? 'text-emerald-400' : 'text-red-400'
    }`} style={{ background: valid ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)', border: `1px solid ${valid ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)'}` }}>
      {valid ? <ShieldCheck className="w-2.5 h-2.5" /> : <ShieldX className="w-2.5 h-2.5" />}
      {label} {valid ? 'OK' : 'FAIL'}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TerminalTab({ packetLogs, nativeLogs = [] }: TerminalTabProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showNative, setShowNative] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto scroll to bottom on new logs if enabled
  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packetLogs, autoScroll]);

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3 select-none overflow-hidden h-full" style={{ background: '#060810' }}>

      {/* ── Native Plugin Log ──────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#0a0d18', border: '1px solid rgba(14,165,233,0.12)' }}>
        <button
          onClick={() => setShowNative(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2"
          style={{ borderBottom: showNative ? '1px solid rgba(14,165,233,0.08)' : 'none' }}
        >
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Native Plugin Log</span>
            <span className="text-[9px] font-mono text-sky-600 ml-1">({nativeLogs.length} msgs)</span>
          </div>
          <div className="flex items-center gap-2">
            {nativeLogs.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            )}
            {showNative ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
          </div>
        </button>

        {showNative && (
          <div className="max-h-[160px] overflow-y-auto p-2 space-y-0.5 font-mono text-[10px]">
            {nativeLogs.length === 0 ? (
              <p className="text-neutral-600 py-2 text-center">No native logs yet — connect sensor to see output.</p>
            ) : (
              nativeLogs.map((line, i) => {
                const isError   = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
                const isSuccess = line.toLowerCase().includes('online') || line.toLowerCase().includes('ok') || line.toLowerCase().includes('success');
                const isWarn    = line.toLowerCase().includes('warn') || line.toLowerCase().includes('timeout');
                return (
                  <div
                    key={i}
                    className={`px-1.5 py-0.5 rounded leading-relaxed ${
                      isError   ? 'text-red-400' :
                      isSuccess ? 'text-emerald-400' :
                      isWarn    ? 'text-amber-400' :
                                  'text-sky-300/70'
                    }`}
                  >
                    <span className="text-neutral-700 mr-1.5">[{i + 1}]</span>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Frame Feed Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">AWR6843 Frame Feed</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-semibold uppercase tracking-wider transition-all border ${
              autoScroll
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-neutral-900 text-neutral-600 border-[rgba(255,255,255,0.06)]'
            }`}
            title="Toggle auto-scroll"
          >
            {autoScroll ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />}
            Auto
          </button>

          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${packetLogs.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${packetLogs.length > 0 ? 'text-emerald-500' : 'text-neutral-600'}`}>
              {packetLogs.length > 0 ? 'Streaming' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Packet List ──────────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] leading-relaxed min-h-0">
        {packetLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 py-8 gap-2">
            <Cpu className="w-7 h-7 text-neutral-800" />
            <span className="text-[11px]">Waiting for frames…</span>
            <span className="text-[9px] text-neutral-700">Check Native Plugin Log above for connection status</span>
          </div>
        ) : (
          packetLogs.map((log, idx) => {
            const hasError = !log.syncValid || !log.checksumValid || log.frameNum === -1;
            return (
              <div
                key={`pkt-${log.frameNum}-${log.timestamp}-${idx}`}
                className="p-2.5 rounded-xl border space-y-2"
                style={{
                  background: hasError ? 'rgba(127,29,29,0.12)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${hasError ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                {/* Frame header */}
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Database className="w-3 h-3" />
                    {log.frameNum >= 0 ? `FRAME #${log.frameNum}` : 'ERROR'}
                  </span>
                  <span className="text-neutral-600 text-[9px]">{log.timestamp}</span>
                </div>

                {/* Hex dump with highlighting */}
                <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <HexDump hex={log.rawHexPrefix} />
                </div>

                {/* Hex key legend */}
                <div className="flex gap-3 text-[8px]">
                  <span className="text-sky-500">■ Sync</span>
                  <span className="text-violet-400">■ Version</span>
                  <span className="text-emerald-500">■ Frame Info</span>
                  <span className="text-neutral-600">■ TLV Data</span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-neutral-500 text-[9px]">
                  <span>{log.size}B</span>
                  <span className="text-neutral-700">·</span>
                  <span>{log.numTLVs} TLVs</span>
                  <span className="text-neutral-700">·</span>
                  <span>{log.pointsParsed} pts</span>
                </div>

                {/* Validation badges */}
                <div className="flex items-center gap-2">
                  <ValidBadge valid={log.syncValid} label="SYNC" />
                  <ValidBadge valid={log.checksumValid} label="CRC" />
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
