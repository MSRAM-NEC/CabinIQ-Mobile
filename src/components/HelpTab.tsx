/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HelpTab — Help & Support screen
 *
 * Features:
 *  - Hero banner with Mistral Solutions partnership branding
 *  - About the App section
 *  - Getting Started step-by-step guide
 *  - Mounting & Tilt Guide
 *  - Collapsible FAQ accordion
 *  - Export Diagnostics (JSON download)
 *  - Mistral Solutions contact & support info
 */

import React, { useState } from 'react';
import {
  HelpCircle, Info, ChevronDown, ChevronUp,
  Download, Mail, Globe, Book,
  Zap, Ruler, AlertTriangle, CheckCircle2,
  Radio, ShieldCheck
} from 'lucide-react';
import { ConnectionDiagnostics, DEFAULT_DIAGNOSTICS } from '../types';
import mistralLogoWhite from '../assets/Mistral_logo_White .png';
import mistralLogoBlack from '../assets/Mistral_logo_Black.png';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HelpTabProps {
  diagnostics?: ConnectionDiagnostics;
  connectionStatus?: string;
  selectedConfigId?: string;
  sensorTiltDeg?: number;
  framesReceived?: number;
  parseErrors?: number;
  crcErrors?: number;
  appVersion?: string;
  darkMode?: boolean;
}

// ─── Mistral Solutions brand colors ──────────────────────────────────────────

const MISTRAL_GOLD = '#e2a84b';
const MISTRAL_GOLD_DIM = 'rgba(226,168,75,0.10)';
const MISTRAL_GOLD_BORDER = 'rgba(226,168,75,0.22)';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, color = '#0ea5e9' }: {
  icon: React.ElementType; label: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div
        className="p-2 rounded-xl flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}28` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <h2 className="text-[13px] font-bold text-neutral-200 tracking-tight">{label}</h2>
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-2xl p-4 relative"
      style={{
        background: 'linear-gradient(135deg,#0d111a,#111520)',
        border: `1px solid ${accent ? accent + '28' : 'rgba(255,255,255,0.07)'}`,
        borderLeft: accent ? `3px solid ${accent}55` : undefined,
      }}
    >
      {accent && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${accent}88, ${accent}22)` }}
        />
      )}
      {children}
    </div>
  );
}

function Step({ num, title, description }: {
  num: number; title: string; description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="help-step-number">{num}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-neutral-200 leading-snug">{title}</p>
        <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
      >
        <span className="text-[11px] font-medium text-neutral-300 leading-snug pr-1">{question}</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
        }
      </button>
      <div className={`faq-item-body ${open ? 'open' : ''}`}>
        <div
          className="px-3 pb-3 text-[10px] text-neutral-400 leading-relaxed"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="pt-2">{answer}</div>
        </div>
      </div>
    </div>
  );
}

function TiltDiagram({ tilt, label }: { tilt: 'overhead' | 'dashboard'; label: string }) {
  const isOverhead = tilt === 'overhead';
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <svg viewBox="0 0 80 64" className="w-20 h-16" fill="none">
        {/* Car body top-down */}
        <rect x="22" y="30" width="36" height="26" rx="4" stroke="#374151" strokeWidth="1.5" fill="rgba(55,65,81,0.3)" />
        <path d="M26 30 Q40 22 54 30" stroke="#4b5563" strokeWidth="1.5" />
        {/* Sensor dot */}
        <circle
          cx={isOverhead ? 40 : 52}
          cy={isOverhead ? 16 : 24}
          r="5" fill="rgba(14,165,233,0.25)" stroke="#0ea5e9" strokeWidth="1.2"
        />
        {/* Radar waves */}
        {[8, 14, 20].map((r, i) => (
          <path
            key={i}
            d={isOverhead
              ? `M${40 - r} ${16 + r * 0.6} Q40 ${16 + r * 0.2} ${40 + r} ${16 + r * 0.6}`
              : `M${52 - r} ${24 + r * 0.5} Q${52 + r * 0.2} ${24 + r} ${52 + r * 0.5} ${24 + r * 1.4}`
            }
            stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="2 2"
            opacity={0.55 - i * 0.14}
          />
        ))}
        {/* Angle label */}
        <text x="4" y="62" fontSize="7" fill="#6b7280" fontWeight="600">
          {isOverhead ? '≥45°' : '<45°'}
        </text>
      </svg>
      <p className="text-[9px] text-neutral-500 text-center font-medium leading-snug">{label}</p>
    </div>
  );
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    question: 'App says "No serial devices found" — what do I do?',
    answer: 'Ensure the AWR6843 USB cable is plugged in before tapping Connect. On Android you must grant USB permission when the dialog appears. If the dialog never shows, try unplugging and re-plugging the device, then tap "Scan for Devices" again.',
  },
  {
    question: 'I granted USB permission but connection still fails.',
    answer: 'Check that the correct USB config (CP210x or XDS110) matches your hardware variant. Also verify the radar firmware is loaded — connect via TI mmWave Studio first to confirm the sensor enumerates correctly. Some Android ROMs require revoking and re-granting USB permissions after a reboot.',
  },
  {
    question: 'Frames are received but all seats show "Empty".',
    answer: 'First tap "Reset Baseline" on the Dashboard to recalibrate. Then check the sensorPosition tilt value in Settings → Config. If your sensor is mounted overhead (≥45°), the Z-axis is inverted automatically. Confirm the correct config profile is selected for your mounting position.',
  },
  {
    question: 'What does "CRC Error" mean in the Terminal?',
    answer: 'A CRC error means the header checksum of a received radar frame did not match the computed value — the data was corrupted in transit. Occasional errors (<1%) are normal. A high rate suggests a USB cable issue, EMI interference, or a baud rate mismatch.',
  },
  {
    question: 'How do I calibrate for my specific vehicle?',
    answer: 'With the cabin completely empty, select the appropriate radar config in Settings. Then go to the Dashboard and tap "Reset Baseline". Tune the Occupied Gate / Empty Gate sliders in Settings → Algorithm Tuning if confidence values are too high or low.',
  },
  {
    question: 'Network (WebSocket) mode — when should I use it?',
    answer: 'Network mode is for setups where a Raspberry Pi or similar board reads the radar UART and streams processed data over Wi-Fi WebSocket. It is primarily a development and field-testing tool. For production deployments, USB mode is recommended.',
  },
  {
    question: 'Which radar config should I use for my vehicle?',
    answer: 'Use "2-Row Cabin (Overhead)" for SUVs/MPVs with roof mounting, "2-Row Cabin (Dashboard)" for dashboard or rearview mounts, and "3-Row Cabin" for 7-seater vehicles. The tilt angle in the config drives the Z-axis correction automatically.',
  },
  {
    question: 'Vital signs (heart rate, breathing) seem inaccurate.',
    answer: 'Vital signs TLV data (type 12) requires AWR6843 firmware compiled with vitals processing enabled. Not all firmware variants include this. The occupant must also be relatively still — motion will disrupt vital sign estimation.',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HelpTab({
  diagnostics = DEFAULT_DIAGNOSTICS,
  connectionStatus = 'disconnected',
  selectedConfigId = '—',
  sensorTiltDeg = 0,
  framesReceived = 0,
  parseErrors = 0,
  crcErrors = 0,
  appVersion = '1.0.0',
  darkMode = true,
}: HelpTabProps) {

  const mistralLogo = darkMode ? mistralLogoWhite : mistralLogoBlack;

  const handleExportDiagnostics = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion,
      connectionStatus,
      selectedConfigId,
      sensorTiltDeg,
      framesReceived,
      parseErrors,
      crcErrors,
      diagnostics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cabiniq-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto pb-[96px] p-3 space-y-3 select-none">

      {/* ── Mistral Solutions Hero Banner ─────────────────────────────── */}
      <div className="help-hero-banner p-5">
        <div className="relative z-10 flex flex-col gap-3">
          {/* Partner badge */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: MISTRAL_GOLD_DIM, border: `1px solid ${MISTRAL_GOLD_BORDER}` }}
            >
              <span className="mistral-badge-dot" />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: MISTRAL_GOLD }}>
                Hardware Partner
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-[22px] font-extrabold text-white leading-tight tracking-tight">
              Cabin<span className="text-sky-400">IQ</span>
            </h1>
            <p className="text-[11px] text-neutral-400 mt-0.5">In-Cabin Radar Intelligence Platform</p>
          </div>

          {/* Mistral callout — with real logo */}
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(226,168,75,0.06)', border: '1px solid rgba(226,168,75,0.18)' }}
          >
            <div
              className="flex-shrink-0 rounded-xl p-1 flex items-center justify-center w-16 h-16"
              style={{ background: 'rgba(226,168,75,0.12)', border: '1px solid rgba(226,168,75,0.25)' }}
            >
              <img
                src={mistralLogo}
                alt="Mistral Solutions"
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold leading-none" style={{ color: MISTRAL_GOLD }}>
                Powered by Mistral Solutions
              </p>
              <p className="text-[9px] text-neutral-500 mt-1 leading-relaxed">
                Hardware engineering, sensor integration &amp; embedded support.
                India's leading embedded systems company.
              </p>
            </div>
          </div>


          {/* Version */}
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-lg text-[8px] font-mono font-semibold text-neutral-500"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              v{appVersion}
            </span>
            <span className="text-[9px] text-neutral-600">AWR6843 · Capacitor · React</span>
          </div>
        </div>
      </div>

      {/* ── About the App ─────────────────────────────────────────────── */}
      <Card accent="#0ea5e9">
        <SectionHeader icon={Info} label="About CabinIQ" color="#0ea5e9" />
        <div className="space-y-2 text-[10px] text-neutral-400 leading-relaxed">
          <p>
            CabinIQ is a real-time in-cabin occupancy and vital signs monitoring system powered by the
            Texas Instruments <span className="text-neutral-300 font-semibold">AWR6843</span> 60 GHz
            millimetre-wave radar sensor.
          </p>
          <p>
            It detects presence and classification (adult / child) of vehicle occupants across multiple
            seating zones, and passively monitors driver heart rate and breathing rate — all without
            cameras or wearables.
          </p>
          <p>
            Designed for automotive OEM integration, fleet safety, and child-left-behind alert systems.
            Hardware engineered in partnership with{' '}
            <span className="font-semibold" style={{ color: MISTRAL_GOLD }}>Mistral Solutions Pvt. Ltd.</span>
          </p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { icon: Radio,       label: '60 GHz mmWave', color: '#0ea5e9' },
            { icon: ShieldCheck, label: 'Privacy-First',  color: '#10b981' },
            { icon: Zap,         label: 'Real-Time',      color: '#f59e0b' },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
              style={{ background: `${color}0d`, border: `1px solid ${color}22` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-[8px] font-semibold text-center leading-tight text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Getting Started ───────────────────────────────────────────── */}
      <Card accent="#10b981">
        <SectionHeader icon={CheckCircle2} label="Getting Started" color="#10b981" />
        <div className="space-y-3">
          <Step num={1} title="Connect the Radar Sensor"
            description="Plug the AWR6843 USB cable into your Android device using a USB-OTG adapter. The CP210x or XDS110 UART bridge is auto-detected." />
          <Step num={2} title="Grant USB Permission"
            description="When prompted by Android, tap 'OK' to grant USB access. If the dialog doesn't appear, tap 'Scan for Devices' in Settings, then grant permission." />
          <Step num={3} title="Select a Radar Config"
            description='In Settings, choose the config matching your sensor mounting — e.g. "2-Row Cabin — Overhead" for a roof-mounted unit. It is sent to the sensor automatically on connect.' />
          <Step num={4} title="Connect & Calibrate"
            description="Tap 'Connect Sensor'. Once connected and cabin is empty, tap 'Reset Baseline' on the Dashboard to calibrate occupancy thresholds for your vehicle." />
          <Step num={5} title="Monitor in Real Time"
            description="Seat occupancy, passenger classification, and driver vitals update live. Use 3D View to see radar point cloud data, and Analytics for historical trends." />
        </div>
      </Card>

      {/* ── Mounting & Tilt Guide ─────────────────────────────────────── */}
      <Card accent="#8b5cf6">
        <SectionHeader icon={Ruler} label="Mounting & Tilt Guide" color="#8b5cf6" />
        <p className="text-[10px] text-neutral-500 mb-3 leading-relaxed">
          The sensor mounting angle determines how the radar's Z-axis maps to the vehicle frame.
          CabinIQ automatically corrects for tilt using the{' '}
          <span className="text-neutral-300 font-medium font-mono">sensorPosition</span> config parameter.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TiltDiagram tilt="overhead" label="Overhead / Rear-View (≥45°) — Z-axis auto-inverted" />
          <TiltDiagram tilt="dashboard" label="Dashboard / Windshield (<45°) — Z-axis normal" />
        </div>
        <div
          className="mt-3 p-3 rounded-xl text-[9px] text-neutral-400 leading-relaxed"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
        >
          <span className="font-semibold text-violet-400">Active tilt: </span>
          <span className="font-mono text-neutral-300">{sensorTiltDeg}°</span>
          {' — '}
          {sensorTiltDeg >= 45
            ? 'Overhead mount. Z-axis is negated so points align with seat bounding boxes.'
            : 'Dashboard mount. Z-axis is used as-is.'}
        </div>
      </Card>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <Card accent="#f59e0b">
        <SectionHeader icon={HelpCircle} label="Troubleshooting FAQ" color="#f59e0b" />
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <React.Fragment key={i}>
              <FaqItem question={faq.question} answer={faq.answer} />
            </React.Fragment>
          ))}

        </div>
      </Card>

      {/* ── Export Diagnostics ───────────────────────────────────────── */}
      <Card accent="#10b981">
        <SectionHeader icon={Download} label="Export Diagnostics" color="#10b981" />
        <p className="text-[10px] text-neutral-500 leading-relaxed mb-3">
          Download a JSON snapshot of system state, connection diagnostics, and error counters.
          Share with Mistral Solutions support when reporting issues.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Frames Rx',  value: framesReceived, good: true },
            { label: 'Parse Err',  value: parseErrors,    good: parseErrors === 0 },
            { label: 'CRC Err',    value: crcErrors,      good: crcErrors === 0 },
          ].map(({ label, value, good }) => (
            <div
              key={label}
              className="p-2 rounded-xl flex flex-col items-center gap-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-[14px] font-mono font-bold" style={{ color: good ? '#10b981' : '#f59e0b' }}>
                {value}
              </span>
              <span className="text-[8px] text-neutral-600 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleExportDiagnostics}
          className="w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
        >
          <Download className="w-3.5 h-3.5" />
          Download Diagnostics JSON
        </button>
      </Card>

      {/* ── Mistral Solutions Contact ─────────────────────────────────── */}
      <Card>
        <SectionHeader icon={Book} label="Support & Contact" color={MISTRAL_GOLD} />

        <div
          className="rounded-xl p-4 mb-3 flex items-center gap-3"
          style={{ background: MISTRAL_GOLD_DIM, border: `1px solid ${MISTRAL_GOLD_BORDER}` }}
        >
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 p-1"
            style={{ background: 'rgba(226,168,75,0.12)', border: '1px solid rgba(226,168,75,0.30)' }}
          >
            <img src={mistralLogo} alt="Mistral Solutions" className="h-12 w-auto object-contain" />
          </div>
          <div>
            <p className="text-[12px] font-bold" style={{ color: MISTRAL_GOLD }}>Mistral Solutions Pvt. Ltd.</p>
            <p className="text-[9px] text-neutral-500 mt-0.5">Hardware Enablement Partner</p>
          </div>
        </div>


        <div className="space-y-2">
          {[
            { icon: Mail,  label: 'Technical Support',       value: 'support@mistralsolutions.com', color: '#0ea5e9' },
            { icon: Globe, label: 'Website',                 value: 'www.mistralsolutions.com',     color: '#10b981' },
            { icon: Book,  label: 'Hardware Documentation',  value: 'AWR6843 Integration Guide',    color: '#8b5cf6' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
                <Icon className="w-3 h-3" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wide">{label}</p>
                <p className="text-[11px] font-medium text-neutral-300 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-3 p-3 rounded-xl flex items-start gap-2"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[8px] text-neutral-600 leading-relaxed">
            CabinIQ is an engineering and development tool. Vital signs data is for informational purposes
            only and not a certified medical device. Always validate zone detection for your specific
            vehicle before deployment.
          </p>
        </div>
      </Card>

    </div>
  );
}
