/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SettingsTab — System Config + Connection Diagnostics
 *
 * Phase 5 Improvements:
 *  - Left-border accent colors on section cards
 *  - Smoother simulation toggle with label state
 *  - Colored fill tracks on range sliders
 *  - Config dropdown with cleaner styling
 *  - Better section grouping with icon accents
 */

import React, { useState } from 'react';
import {
  ConnectionStatus, AlgParams, DriveMode, TransportType,
  ConnectionDiagnostics, DEFAULT_DIAGNOSTICS, UsbDeviceInfo
} from '../types';
import {
  Sliders, HardDrive, RefreshCw, Cpu, Settings,
  Usb, Wifi, Activity, AlertTriangle, CheckCircle, XCircle,
  Search, Radio, FileText, ChevronDown
} from 'lucide-react';
import { RADAR_CONFIGS, RadarConfigEntry } from '../utils/radarConfigs';

interface SettingsTabProps {
  connectionStatus: ConnectionStatus;
  onConnectToggle: () => void;
  algParams: AlgParams;
  onParamChange: (param: keyof AlgParams, value: number) => void;
  driveMode: DriveMode;
  setDriveMode: (m: DriveMode) => void;
  isSimulationMode: boolean;
  setIsSimulationMode: (b: boolean) => void;
  transportType: TransportType;
  setTransportType: (t: TransportType) => void;
  networkUrl: string;
  setNetworkUrl: (url: string) => void;
  diagnostics: ConnectionDiagnostics;
  detectedDevices: UsbDeviceInfo[];
  isScanning: boolean;
  onScanDevices: () => void;
  selectedConfigId: string;
  onConfigChange: (id: string) => void;
  scenario?: 'empty' | 'driver' | 'family' | 'baby';
  onScenarioChange?: (id: 'empty' | 'driver' | 'family' | 'baby') => void;
}

// ── Reusable section card with left accent border ────────────────────────────

function SectionCard({ children, accent = '#0ea5e9' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3 relative"
      style={{
        background: 'linear-gradient(135deg,#0d111a,#111520)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${accent}33`,
      }}
    >
      {/* Left accent bar — clipped to card height via absolute positioning */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${accent}88, ${accent}22)` }}
      />
      {children}
    </div>
  );
}

// ── Algorithm slider with colored fill track ─────────────────────────────────

function AlgoSlider({
  label, value, min, max, step, onChange, color = '#0ea5e9'
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">{label}</label>
        <span
          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg"
          style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
        >
          {value.toFixed(2)}
        </span>
      </div>
      {/* Custom track with fill */}
      <div className="relative h-4 flex items-center">
        <div className="w-full h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
          />
        </div>
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-4"
          style={{ zIndex: 1 }}
        />
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 pointer-events-none transition-all duration-200"
          style={{
            left: `calc(${pct}% - 8px)`,
            background: color,
            borderColor: '#0a0c0f',
            boxShadow: `0 0 0 3px ${color}33`,
          }}
        />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SettingsTab({
  connectionStatus, onConnectToggle,
  algParams, onParamChange,
  driveMode, setDriveMode,
  isSimulationMode, setIsSimulationMode,
  transportType, setTransportType,
  networkUrl, setNetworkUrl,
  diagnostics,
  detectedDevices,
  isScanning: isScanningDevices,
  onScanDevices,
  selectedConfigId,
  onConfigChange,
  scenario = 'driver',
  onScenarioChange,
}: SettingsTabProps) {

  const [configDropdownOpen, setConfigDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedConfig = RADAR_CONFIGS.find(c => c.id === selectedConfigId) ?? RADAR_CONFIGS[0];

  const filteredConfigs = RADAR_CONFIGS.filter(cfg =>
    cfg.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cfg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isConnected = connectionStatus === 'connected';
  const isScanning  = connectionStatus === 'scanning';

  const StatusIcon = isConnected ? CheckCircle
    : connectionStatus === 'permission_denied' ? XCircle
    : isScanning ? RefreshCw
    : AlertTriangle;

  const statusColor = isConnected ? 'text-emerald-400'
    : connectionStatus === 'permission_denied' ? 'text-red-400'
    : isScanning ? 'text-amber-400'
    : 'text-neutral-500';

  const statusText = isConnected ? 'Connected'
    : connectionStatus === 'permission_denied' ? 'Permission Denied'
    : isScanning ? 'Scanning…'
    : 'Disconnected';

  return (
    <div className="h-full overflow-y-auto pb-[90px] p-3 space-y-3 select-none">

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-0.5">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.15)' }}>
          <Settings className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-neutral-200">System Config</h2>
          <span className="text-[10px] text-neutral-500 font-medium">Hardware & Algorithms</span>
        </div>
      </div>

      {/* ── Hardware Link ─────────────────────────────────────────── */}
      <SectionCard accent="#0ea5e9">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" /> Hardware Link
          </h3>
          <div className={`flex items-center gap-1.5 ${statusColor}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-semibold">{statusText}</span>
          </div>
        </div>

        {/* Simulation toggle */}
        <div className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <span className="text-[11px] font-medium text-neutral-300">Simulation Mode</span>
            <p className="text-[9px] mt-0.5" style={{ color: isSimulationMode ? '#0ea5e9' : '#f59e0b' }}>
              {isSimulationMode ? '● Using mock radar data' : '⚡ Hardware input active'}
            </p>
          </div>
          <button
            onClick={() => setIsSimulationMode(!isSimulationMode)}
            disabled={isConnected}
            aria-label={isSimulationMode ? 'Switch to hardware mode' : 'Switch to simulation mode'}
            className={`relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300 ${isConnected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{
              background: isSimulationMode
                ? 'linear-gradient(90deg,#0284c7,#0ea5e9)'
                : 'linear-gradient(90deg,#92400e,#b45309)',
            }}
          >
            {/* Text labels inside track */}
            <span className="absolute inset-0 flex items-center justify-between px-1.5 select-none pointer-events-none">
              <span className="text-[8px] font-bold text-white/80" style={{ opacity: isSimulationMode ? 0 : 1, transition: 'opacity 0.2s' }}>HW</span>
              <span className="text-[8px] font-bold text-white/80" style={{ opacity: isSimulationMode ? 1 : 0, transition: 'opacity 0.2s' }}>SIM</span>
            </span>
            {/* Thumb */}
            <div
              className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300"
              style={{ left: isSimulationMode ? '30px' : '4px' }}
            />
          </button>
        </div>

        {/* Simulation scenario selector */}
        {isSimulationMode && (
          <div className="space-y-1.5 py-2 px-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.12)' }}>
            <label className="text-[9px] font-semibold text-sky-500 uppercase tracking-wider block">
              Simulation Scenario
            </label>
            <div className="relative">
              <select
                value={scenario}
                onChange={e => onScenarioChange?.(e.target.value as any)}
                className="w-full rounded-xl py-2.5 px-3 text-[11px] font-medium text-white focus:outline-none appearance-none"
                style={{ background: '#161a23', border: '1px solid rgba(14,165,233,0.2)' }}
              >
                <option value="driver">Driver Solo</option>
                <option value="family">Family Occupancy</option>
                <option value="baby">⚠ Abandoned Child</option>
                <option value="empty">Empty Cabin</option>
              </select>
              <ChevronDown className="absolute right-3 inset-y-0 my-auto w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Transport type (hidden in simulation mode) */}
        {!isSimulationMode && (
          <>
            <div className="flex gap-2">
              {(['serial', 'network'] as TransportType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTransportType(t)}
                  disabled={isConnected}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                    transportType === t
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-[rgba(255,255,255,0.03)] text-neutral-500 border-[rgba(255,255,255,0.06)]'
                  } ${isConnected ? 'opacity-40' : ''}`}
                >
                  {t === 'serial' ? <Usb className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  {t === 'serial' ? 'USB OTG' : 'Network (WS)'}
                </button>
              ))}
            </div>

            {transportType === 'serial' ? (
              <div className="space-y-2">
                <button
                  onClick={onScanDevices}
                  disabled={isConnected || isScanningDevices}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                    isScanningDevices
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-[rgba(14,165,233,0.06)] text-sky-400 border-sky-500/20 active:scale-[0.98]'
                  } ${isConnected ? 'opacity-40' : ''}`}
                >
                  {isScanningDevices ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {isScanningDevices ? 'Scanning USB Ports…' : 'Scan for Devices'}
                </button>

                {detectedDevices.length > 0 ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Radio className="w-3 h-3" /> {detectedDevices.length} Device{detectedDevices.length !== 1 ? 's' : ''} Detected
                      </span>
                    </div>
                    {detectedDevices.map((dev, i) => (
                      <div key={`${dev.vendorId}-${dev.productId}-${i}`} className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${dev.isKnownRadarDevice ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-[11px] font-medium text-neutral-200">{dev.deviceName}</span>
                          </div>
                          {dev.isKnownRadarDevice && (
                            <span className="text-[8px] font-bold text-emerald-400 px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.10)' }}>RADAR</span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1 ml-4">
                          <span className="text-[9px] font-mono text-neutral-500">VID: 0x{dev.vendorId.toString(16).toUpperCase().padStart(4, '0')}</span>
                          <span className="text-[9px] font-mono text-neutral-500">PID: 0x{dev.productId.toString(16).toUpperCase().padStart(4, '0')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2.5 rounded-xl text-[10px] text-neutral-400" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p>USB OTG auto-detection will scan for TI XDS110, CP210x, and FTDI devices.</p>
                    <p className="mt-1 text-neutral-600">Tap "Scan for Devices" to detect connected hardware.</p>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={networkUrl}
                onChange={e => setNetworkUrl(e.target.value)}
                disabled={isConnected}
                placeholder="ws://192.168.1.100:8080"
                className="w-full rounded-xl px-3 py-2.5 text-[12px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            )}
          </>
        )}

        {/* Config File Selector */}
        {!isSimulationMode && transportType === 'serial' && (
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', position: 'relative', zIndex: 10 }}>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wider">Chirp Config File</span>
            </div>
            <div className="relative">
              <button
                onClick={() => !isConnected && setConfigDropdownOpen(v => !v)}
                disabled={isConnected}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                  isConnected ? 'opacity-40' : configDropdownOpen ? 'bg-violet-500/10 border-violet-500/30' : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] active:scale-[0.98]'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[11px] font-semibold text-neutral-200 truncate">{selectedConfig.label}</span>
                  <span className="text-[9px] text-neutral-500 truncate mt-0.5">{selectedConfig.description}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform duration-200 ${configDropdownOpen ? 'rotate-180 text-violet-400' : ''}`} />
              </button>

              {configDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl max-h-[280px] overflow-y-auto" style={{ background: '#111520', border: '1px solid rgba(139,92,246,0.25)' }}>
                  {/* Sticky Search Input */}
                  <div className="sticky top-0 bg-[#111520] p-2 border-b border-[rgba(255,255,255,0.06)] z-10 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-violet-400" />
                    <input
                      type="text"
                      placeholder="Search configurations..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent text-[11px] text-neutral-200 focus:outline-none w-full border-none py-1 px-1"
                    />
                  </div>
                  {filteredConfigs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[10px] text-neutral-500">
                      No matching configs found
                    </div>
                  ) : (
                    filteredConfigs.map(cfg => (
                      <button
                        key={cfg.id}
                        onClick={() => { onConfigChange(cfg.id); setConfigDropdownOpen(false); setSearchQuery(''); }}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          cfg.id === selectedConfigId
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'hover:bg-[rgba(255,255,255,0.04)] text-neutral-300'
                        }`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <p className="text-[11px] font-semibold leading-tight">{cfg.label}</p>
                        <p className="text-[9px] text-neutral-500 mt-0.5 leading-tight">{cfg.description}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
              <span className="text-[9px] text-neutral-500">Will be sent to radar on connect</span>
            </div>
          </div>
        )}

        {/* Connect/Disconnect button */}
        <button
          onClick={onConnectToggle}
          className={`w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
            isConnected
              ? 'bg-red-500/10 text-red-400 border-red-500/20 active:scale-[0.98]'
              : isScanning
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'text-white border-sky-500 active:scale-[0.98]'
          }`}
          style={!isConnected && !isScanning ? { background: 'linear-gradient(135deg,#0284c7,#0ea5e9)' } : {}}
        >
          {isScanning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {isConnected ? 'Disconnect Sensor' : isScanning ? 'Scanning…' : 'Connect Sensor'}
        </button>
      </SectionCard>

      {/* ── Connection Diagnostics ───────────────────────────────── */}
      {isConnected && (
        <SectionCard accent="#10b981">
          <h3 className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Connection Diagnostics
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[
              ['Device',       diagnostics.deviceName],
              ['Vendor ID',    diagnostics.vendorId],
              ['Product ID',   diagnostics.productId],
              ['Baud Rate',    `${diagnostics.baudRate}`],
              ['Frames Rx',   `${diagnostics.framesReceived}`],
              ['Packets Rx',  `${diagnostics.packetsReceived}`],
              ['Parse Errors', `${diagnostics.parseErrors}`],
              ['CRC Errors',   `${diagnostics.crcErrors}`],
              ['Avg FPS',      `${diagnostics.avgFps.toFixed(1)}`],
              ['Avg SNR',      `${diagnostics.avgSnr.toFixed(1)} dB`],
              ['Reconnects',   `${diagnostics.reconnectAttempts}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-[10px] text-neutral-500">{label}</span>
                <span className={`text-[10px] font-mono font-medium ${
                  (label === 'Parse Errors' || label === 'CRC Errors') && value !== '0' ? 'text-amber-400' : 'text-neutral-300'
                }`}>{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Drive Mode ──────────────────────────────────────────── */}
      <SectionCard accent="#f59e0b">
        <h3 className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">Drive Mode</h3>
        <div className="flex gap-2">
          {(['rhd', 'lhd'] as DriveMode[]).map(m => (
            <button
              key={m}
              onClick={() => setDriveMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                driveMode === m
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-[rgba(255,255,255,0.03)] text-neutral-500 border-[rgba(255,255,255,0.06)]'
              }`}
            >
              {m === 'rhd' ? '🚗 Right-Hand Drive' : '🚙 Left-Hand Drive'}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Algorithm Tuning ────────────────────────────────────── */}
      <SectionCard accent="#8b5cf6">
        <h3 className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-violet-400" /> Algorithm Tuning
        </h3>
        <div className="space-y-5 pt-1">
          <AlgoSlider
            label="EMA Smoothing (α)"
            value={algParams.alphaSmoothing}
            min={0.1} max={1.0} step={0.05}
            onChange={v => onParamChange('alphaSmoothing', v)}
            color="#8b5cf6"
          />
          <AlgoSlider
            label="Occupied Gate"
            value={algParams.occupiedThreshold}
            min={0.4} max={0.85} step={0.05}
            onChange={v => onParamChange('occupiedThreshold', v)}
            color="#10b981"
          />
          <AlgoSlider
            label="Empty Gate"
            value={algParams.emptyThreshold}
            min={0.1} max={0.35} step={0.05}
            onChange={v => onParamChange('emptyThreshold', v)}
            color="#f59e0b"
          />
        </div>
      </SectionCard>
    </div>
  );
}
