/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Radar3DTab — Enhanced 3D Point Cloud Visualization
 *
 * Improvements:
 *  - Depth fog: farther points are dimmer (distance-based opacity falloff)
 *  - Gradient point coloring based on SNR (cool blue → warm orange → red)
 *  - Improved grid with radial fade
 *  - Zone box gradient fills & pulsing animation on occupied zones
 *  - Smooth camera lerp animation for preset buttons
 *  - Pinch-to-zoom support (touch events)
 *  - Radial gradient background on canvas
 *  - X/Y/Z axis labels
 *  - Better stats overlay with animated live dot
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point3D, ZoneState, ZoneDefinition } from '../types';
import { RotateCcw, ZoomIn, ZoomOut, Layers } from 'lucide-react';

// ── Color Theme Helpers ──────────────────────────────────────────────────────

interface ZoneTheme {
  primary: string;
  light: string;
  fill: string;
  fillOcc: string;
  rgb: string;
}

const ZONE_THEMES: ZoneTheme[] = [
  { primary: '#10b981', light: '#34d399', fill: 'rgba(16,185,129,0.05)', fillOcc: 'rgba(16,185,129,0.18)', rgb: '16,185,129'   },
  { primary: '#8b5cf6', light: '#a78bfa', fill: 'rgba(139,92,246,0.05)',  fillOcc: 'rgba(139,92,246,0.18)',  rgb: '139,92,246'  },
  { primary: '#ec4899', light: '#f472b6', fill: 'rgba(236,72,153,0.05)',  fillOcc: 'rgba(236,72,153,0.18)',  rgb: '236,72,153'  },
  { primary: '#f59e0b', light: '#fbbf24', fill: 'rgba(245,158,11,0.05)',  fillOcc: 'rgba(245,158,11,0.18)',  rgb: '245,158,11'  },
  { primary: '#06b6d4', light: '#22d3ee', fill: 'rgba(6,182,212,0.05)',   fillOcc: 'rgba(6,182,212,0.18)',   rgb: '6,182,212'   },
];

function getZoneTheme(id: number): ZoneTheme {
  return ZONE_THEMES[id % ZONE_THEMES.length];
}

// SNR-based point color: 0–8 dB = cool grey, 8–18 dB = blue, 18+ dB = orange→red
function getSnrColor(snr: number): { fill: string; glow: string } {
  if (snr > 20) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.35)' };
  if (snr > 14) return { fill: '#f97316', glow: 'rgba(249,115,22,0.30)' };
  if (snr > 8)  return { fill: '#3b82f6', glow: 'rgba(59,130,246,0.25)' };
  return         { fill: '#6b7280', glow: 'rgba(107,114,128,0.15)' };
}

interface Radar3DTabProps {
  points: Point3D[];
  zoneStates: { [zoneId: number]: ZoneState };
  zones: ZoneDefinition[];
  darkMode?: boolean;
}

// ── Camera lerp state ────────────────────────────────────────────────────────

interface CameraTarget { yaw: number; pitch: number; zoom: number; }

export default function Radar3DTab({ points, zoneStates, zones, darkMode = true }: Radar3DTabProps) {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Camera live state (interpolated toward target each frame)
  const [yaw,   setYaw]   = useState(-0.55);
  const [pitch, setPitch] = useState(0.40);
  const [zoom,  setZoom]  = useState(130);

  // Camera target for smooth lerp
  const targetRef = useRef<CameraTarget>({ yaw: -0.55, pitch: 0.40, zoom: 130 });
  const liveRef   = useRef<CameraTarget>({ yaw: -0.55, pitch: 0.40, zoom: 130 });
  const animFrameRef = useRef<number>(0);

  // Drag tracking
  const isDragging = useRef(false);
  const prevPos    = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom
  const prevPinchDist = useRef<number | null>(null);

  // FPS tracking
  const lastFrameTime  = useRef(Date.now());
  const fpsAcc         = useRef<number[]>([]);
  const [liveFps, setLiveFps] = useState(0);

  // Pulse tick for occupied zone animation
  const [pulseTick, setPulseTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulseTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // ── Auto-Fit Camera to Zone Bounding Box ─────────────────────────────────
  useEffect(() => {
    if (zones.length === 0) return;

    // Compute scene extent across all zone boxes
    const xMin = Math.min(...zones.map(z => z.xMin));
    const xMax = Math.max(...zones.map(z => z.xMax));
    const yMin = Math.min(...zones.map(z => z.yMin));
    const yMax = Math.max(...zones.map(z => z.yMax));
    const zMin = Math.min(...zones.map(z => z.zMin));
    const zMax = Math.max(...zones.map(z => z.zMax));

    const sceneW = xMax - xMin;
    const sceneD = yMax - yMin;
    const sceneH = zMax - zMin;
    const maxExtent = Math.max(sceneW, sceneD, sceneH, 0.1); // avoid /0

    // Scale zoom so that maxExtent fills ~60% of the viewport (empirical constant ~160)
    const autoZoom = Math.max(80, Math.min(260, 160 / maxExtent));

    // Good isometric-ish angle for a rear-mounted radar pointing forward (+Y)
    targetRef.current = { yaw: -0.45, pitch: 0.48, zoom: autoZoom };
  }, [zones]);

  // ── Camera Lerp Animation Loop ───────────────────────────────────────────

  useEffect(() => {
    let rafId: number;
    function animate() {
      const t = targetRef.current;
      const l = liveRef.current;
      const alpha = 0.12; // lerp factor — lower = smoother
      l.yaw   += (t.yaw   - l.yaw)   * alpha;
      l.pitch += (t.pitch - l.pitch) * alpha;
      l.zoom  += (t.zoom  - l.zoom)  * alpha;
      setYaw(l.yaw); setPitch(l.pitch); setZoom(l.zoom);
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Input Handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    prevPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - prevPos.current.x;
    const dy = e.clientY - prevPos.current.y;
    targetRef.current.yaw   += dx * 0.008;
    targetRef.current.pitch  = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, targetRef.current.pitch + dy * 0.008));
    prevPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(() => { isDragging.current = false; }, []);

  // ── Touch Pinch-to-Zoom ─────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging.current) e.preventDefault();
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (prevPinchDist.current !== null) {
          const delta = dist - prevPinchDist.current;
          targetRef.current.zoom = Math.max(60, Math.min(320, targetRef.current.zoom + delta * 0.5));
        }
        prevPinchDist.current = dist;
      }
    };
    const onTouchEnd = () => { prevPinchDist.current = null; };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // ── Canvas Sizing ────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
  }, []);

  // ── FPS Tracker ──────────────────────────────────────────────────────────

  useEffect(() => {
    const now = Date.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;
    if (delta > 0) {
      fpsAcc.current.push(1000 / delta);
      if (fpsAcc.current.length > 12) fpsAcc.current.shift();
      const avg = fpsAcc.current.reduce((a, b) => a + b, 0) / fpsAcc.current.length;
      setLiveFps(Math.round(avg));
    }
  }, [points]);

  // ── Main Canvas Render ───────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const cx = W / 2;
    const cy = H / 2 + 20;

    // ── Background radial gradient ─────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    if (darkMode) {
      bg.addColorStop(0,   'rgba(14,22,38,0.95)');
      bg.addColorStop(0.6, 'rgba(8,11,18,0.98)');
      bg.addColorStop(1,   'rgba(3,5,10,1)');
    } else {
      bg.addColorStop(0,   '#ffffff');
      bg.addColorStop(0.6, '#f1f5f9');
      bg.addColorStop(1,   '#e2e8f0');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Projection ────────────────────────────────────────────────────
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    const project = (x: number, y: number, z: number) => {
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;
      const x2 = x1;
      const y2 = y1 * cosP - z * sinP;
      const z2 = y1 * sinP + z * cosP;
      const zOff = 4.0;
      const scale = zoom / (y2 + zOff);
      return { x: cx + x2 * scale, y: cy - z2 * scale, depth: y2 };
    };

    // ── Grid — faded radial mask ──────────────────────────────────────
    const gridRange = 2.6;
    const gridStep  = 0.6;

    for (let g = -gridRange; g <= gridRange; g += gridStep) {
      const distFromCenter = Math.abs(g) / gridRange;
      const alpha = 0.05 + (1 - distFromCenter) * 0.06;
      ctx.strokeStyle = darkMode
        ? `rgba(14,165,233,${alpha.toFixed(3)})`
        : `rgba(2,132,199,${(alpha * 1.8).toFixed(3)})`;
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      for (let yy = -0.5; yy <= 3.2; yy += 0.12) {
        const p = project(g, yy, 0);
        yy === -0.5 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let xx = -gridRange; xx <= gridRange; xx += 0.12) {
        const p = project(xx, g + 1.0, 0);
        xx === -gridRange ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // ── Origin Axes ───────────────────────────────────────────────────
    const o = project(0, 0, 0);
    const axLen = 0.7;
    ctx.lineWidth = 2;

    const drawAxis = (color: string, tx: number, ty: number, tz: number, label: string) => {
      const a = project(tx, ty, tz);
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(a.x, a.y); ctx.stroke();
      ctx.font = 'bold 9px Inter, monospace'; ctx.textAlign = 'center';
      ctx.shadowColor = darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(label, a.x, a.y - 6);
      ctx.shadowBlur = 0;
    };
    drawAxis('#ef4444', axLen, 0, 0,      'X');
    drawAxis('#22c55e', 0, axLen * 2, 0,  'Y');
    drawAxis('#3b82f6', 0, 0, axLen,      'Z');

    // ── Zone Solid Volumes ────────────────────────────────────────────
    // Phase: pulsing multiplier for occupied zones
    const pulseAlpha = 0.8 + Math.sin(pulseTick * Math.PI) * 0.2;

    zones.forEach(zone => {
      const st = zoneStates[zone.id];
      const isOcc = st?.occupied ?? false;
      const theme = getZoneTheme(zone.id);

      const verts = [
        project(zone.xMin, zone.yMin, zone.zMin),
        project(zone.xMax, zone.yMin, zone.zMin),
        project(zone.xMax, zone.yMax, zone.zMin),
        project(zone.xMin, zone.yMax, zone.zMin),
        project(zone.xMin, zone.yMin, zone.zMax),
        project(zone.xMax, zone.yMin, zone.zMax),
        project(zone.xMax, zone.yMax, zone.zMax),
        project(zone.xMin, zone.yMax, zone.zMax),
      ];

      const drawFace = (idx: number[], alpha: number) => {
        ctx.beginPath();
        ctx.moveTo(verts[idx[0]].x, verts[idx[0]].y);
        for (let i = 1; i < idx.length; i++) ctx.lineTo(verts[idx[i]].x, verts[idx[i]].y);
        ctx.closePath();
        ctx.fillStyle = isOcc
          ? `rgba(${theme.rgb},${((darkMode ? 0.12 : 0.16) * pulseAlpha).toFixed(3)})`
          : `rgba(${theme.rgb},${darkMode ? 0.04 : 0.06})`;
        ctx.fill();
      };

      [
        [0,1,2,3], [4,5,6,7],
        [0,1,5,4], [2,3,7,6],
        [0,3,7,4], [1,2,6,5],
      ].forEach((f, fi) => drawFace(f, fi < 2 ? 1.0 : 0.7));
    });

    // ── Point Cloud (sorted by depth) ─────────────────────────────────
    const projected = points.map(pt => {
      let matchedZoneId: number | null = null;
      for (const zone of zones) {
        if (
          pt.x >= zone.xMin && pt.x < zone.xMax &&
          pt.y >= zone.yMin && pt.y < zone.yMax &&
          pt.z >= zone.zMin && pt.z < zone.zMax
        ) { matchedZoneId = zone.id; break; }
      }
      return { ...pt, proj: project(pt.x, pt.y, pt.z), matchedZoneId };
    }).sort((a, b) => b.proj.depth - a.proj.depth);

    projected.forEach(({ snr, proj, matchedZoneId }) => {
      if (proj.x < -10 || proj.x > W + 10 || proj.y < -10 || proj.y > H + 10) return;

      // Depth fog: points deeper get more transparent
      const depthOpacity = Math.max(0.25, 1.0 - proj.depth / 8.0);
      const r = Math.max(2.5, Math.min(9, 20 / (proj.depth + 4.0)));

      const theme   = matchedZoneId !== null ? getZoneTheme(matchedZoneId) : null;
      const snrClr  = getSnrColor(snr);
      const dotColor = theme ? (darkMode ? theme.light : theme.primary) : snrClr.fill;
      const glowRgb  = theme ? theme.rgb   : '';

      // Outer soft halo
      const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, r + 4);
      if (theme) {
        grad.addColorStop(0, `rgba(${theme.rgb},${((darkMode ? 0.5 : 0.3) * depthOpacity).toFixed(2)})`);
        grad.addColorStop(1, `rgba(${theme.rgb},0)`);
      } else {
        grad.addColorStop(0, snrClr.glow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = depthOpacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // ── Zone Wireframes & Labels ──────────────────────────────────────
    zones.forEach(zone => {
      const st = zoneStates[zone.id];
      const isOcc = st?.occupied ?? false;
      const theme = getZoneTheme(zone.id);

      const verts = [
        project(zone.xMin, zone.yMin, zone.zMin),
        project(zone.xMax, zone.yMin, zone.zMin),
        project(zone.xMax, zone.yMax, zone.zMin),
        project(zone.xMin, zone.yMax, zone.zMin),
        project(zone.xMin, zone.yMin, zone.zMax),
        project(zone.xMax, zone.yMin, zone.zMax),
        project(zone.xMax, zone.yMax, zone.zMax),
        project(zone.xMin, zone.yMax, zone.zMax),
      ];

      ctx.strokeStyle = isOcc
        ? `rgba(${theme.rgb},${((darkMode ? 0.85 : 0.95) * pulseAlpha).toFixed(2)})`
        : `rgba(${theme.rgb},${darkMode ? 0.25 : 0.4})`;
      ctx.lineWidth = isOcc ? 1.8 : 0.7;

      // Bottom face
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y); ctx.lineTo(verts[1].x, verts[1].y);
      ctx.lineTo(verts[2].x, verts[2].y); ctx.lineTo(verts[3].x, verts[3].y);
      ctx.closePath(); ctx.stroke();
      // Top face
      ctx.beginPath();
      ctx.moveTo(verts[4].x, verts[4].y); ctx.lineTo(verts[5].x, verts[5].y);
      ctx.lineTo(verts[6].x, verts[6].y); ctx.lineTo(verts[7].x, verts[7].y);
      ctx.closePath(); ctx.stroke();
      // Verticals
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(verts[i].x, verts[i].y);
        ctx.lineTo(verts[i + 4].x, verts[i + 4].y);
      }
      ctx.stroke();

      // Label projected above top face center
      const mid = project(
        (zone.xMin + zone.xMax) / 2,
        (zone.yMin + zone.yMax) / 2,
        zone.zMax + 0.08
      );

      const labelText = zone.seatLabel.toUpperCase();
      const labelAlpha = isOcc ? 1 : 0.5;
      ctx.font = isOcc ? 'bold 9px Inter, monospace' : '600 8px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = darkMode ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = darkMode ? 6 : 3;

      // Label pill background
      const tw = ctx.measureText(labelText).width + 8;
      ctx.fillStyle = darkMode 
        ? `rgba(${theme.rgb},${(0.2 * labelAlpha).toFixed(2)})`
        : `rgba(${theme.rgb},${(0.12 * labelAlpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.roundRect(mid.x - tw / 2, mid.y - 11, tw, 13, 4);
      ctx.fill();

      ctx.fillStyle = isOcc 
        ? (darkMode ? theme.light : theme.primary) 
        : (darkMode ? `rgba(${theme.rgb},0.6)` : `rgba(${theme.rgb},0.8)`);
      ctx.fillText(labelText, mid.x, mid.y);
      ctx.shadowBlur = 0;

      // Occupied badge
      if (isOcc) {
        const cls = st?.classification?.toUpperCase() ?? '';
        const confPct = Math.round((st?.confidence ?? 0) * 100);
        ctx.font = '600 7.5px Inter, monospace';
        ctx.fillStyle = darkMode ? `rgba(${theme.rgb},0.7)` : theme.primary;
        ctx.fillText(`${cls} ${confPct}%`, mid.x, mid.y + 12);
      }
    });

  }, [points, zoneStates, zones, yaw, pitch, zoom, pulseTick, darkMode]);

  // ── Computed Stats ───────────────────────────────────────────────────────

  const avgSnr = points.length > 0
    ? (points.reduce((s, p) => s + p.snr, 0) / points.length).toFixed(1)
    : '—';
  const occupiedCount = Object.values(zoneStates).filter(z => z.occupied).length;
  const totalZones = zones.length;

  // ── Camera preset helper ─────────────────────────────────────────────────
  const setPreset = useCallback((yaw: number, pitch: number, zoom: number) => {
    targetRef.current = { yaw, pitch, zoom };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={`flex-1 relative w-full h-full overflow-hidden ${darkMode ? 'bg-[#03050a]' : 'bg-[#f8fafc]'}`}>

      {/* Full-bleed canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />

      {/* ── Stats Overlay (top-left) ─────────────────────────────────── */}
      <div className="absolute top-3 left-3 pointer-events-none select-none">
        <div className={`backdrop-blur-md border rounded-xl px-3 py-2.5 space-y-1 shadow-xl ${darkMode ? 'bg-[#080c14]/85 border-[rgba(14,165,233,0.15)]' : 'bg-white/90 border-[rgba(14,165,233,0.25)]'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">Point Cloud</span>
          </div>
          <div className={`text-[18px] font-mono font-bold leading-none ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
            {points.length}
            <span className="text-[10px] text-neutral-500 font-normal ml-1">pts</span>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 mt-1.5">
            <span className="text-[9px] text-neutral-500">FPS</span>
            <span className={`text-[9px] font-mono font-semibold text-right ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{liveFps}</span>
            <span className="text-[9px] text-neutral-500">Avg SNR</span>
            <span className={`text-[9px] font-mono font-semibold text-right ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{avgSnr} dB</span>
            <span className="text-[9px] text-neutral-500">Occupied</span>
            <span className={`text-[9px] font-mono font-semibold text-right ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{occupiedCount}/{totalZones}</span>
          </div>
        </div>
      </div>

      {/* ── Camera Presets (top-right) ──────────────────────────────── */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <CamButton label="Reset" darkMode={darkMode} onClick={() => setPreset(-0.55, 0.40, 130)}>
          <RotateCcw className="w-4 h-4" />
        </CamButton>
        <CamButton label="ISO" darkMode={darkMode} onClick={() => setPreset(-0.60, 0.50, 130)}>
          <span className="text-[9px] font-bold">ISO</span>
        </CamButton>
        <CamButton label="Top" darkMode={darkMode} onClick={() => setPreset(0, Math.PI / 2 - 0.06, 150)}>
          <span className="text-[9px] font-bold">TOP</span>
        </CamButton>
        <CamButton label="Side" darkMode={darkMode} onClick={() => setPreset(Math.PI / 2, 0.15, 140)}>
          <span className="text-[9px] font-bold">SIDE</span>
        </CamButton>
      </div>

      {/* ── Zoom Controls (bottom-right) ─────────────────────────────── */}
      <div className="absolute bottom-4 right-3 flex flex-col gap-2 z-10">
        <CamButton label="Zoom In" darkMode={darkMode} onClick={() => { targetRef.current.zoom = Math.min(320, targetRef.current.zoom + 22); }}>
          <ZoomIn className="w-4 h-4" />
        </CamButton>
        <CamButton label="Zoom Out" darkMode={darkMode} onClick={() => { targetRef.current.zoom = Math.max(60, targetRef.current.zoom - 22); }}>
          <ZoomOut className="w-4 h-4" />
        </CamButton>
      </div>

      {/* ── Zone legend (bottom-left) ─────────────────────────────────── */}
      <div className="absolute bottom-4 left-3 z-10 pointer-events-none select-none">
        <div className="flex flex-col gap-1">
          {zones.slice(0, 5).map(z => {
            const theme = getZoneTheme(z.id);
            const isOcc = zoneStates[z.id]?.occupied ?? false;
            return (
              <div key={z.id} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: isOcc ? theme.primary : `rgba(${theme.rgb},0.35)` }}
                />
                <span className={`text-[8px] font-mono ${isOcc ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  {z.seatLabel}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[8px] text-neutral-700 font-medium mt-2">Drag · Pinch to zoom</p>
      </div>

      {/* ── SNR Color Key (center-bottom) ────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
        <div className={`flex items-center gap-1.5 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border ${darkMode ? 'bg-[#080c14]/70 border-[rgba(255,255,255,0.06)]' : 'bg-white/80 border-[rgba(0,0,0,0.10)]'}`}>
          <div className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-[#6b7280]" />
            <span className="text-[8px] text-neutral-600">Low</span>
          </div>
          <span className="text-[8px] text-neutral-700">·</span>
          <div className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span className="text-[8px] text-neutral-600">Med</span>
          </div>
          <span className="text-[8px] text-neutral-700">·</span>
          <div className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-[#f97316]" />
            <span className="text-[8px] text-neutral-600">High</span>
          </div>
          <span className="text-[8px] text-neutral-700">·</span>
          <div className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-[8px] text-neutral-600">Peak SNR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Minimal Camera Button ────────────────────────────────────────────────────

function CamButton({ children, onClick, label, darkMode = true }: {
  children: React.ReactNode; onClick: () => void; label: string; darkMode?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-10 h-10 flex items-center justify-center backdrop-blur-md border rounded-xl hover:text-sky-300 hover:border-sky-500/30 active:scale-90 transition-all shadow-lg ${darkMode ? 'bg-[#0d111a]/90 border-[rgba(14,165,233,0.15)] text-neutral-400' : 'bg-white/90 border-[rgba(14,165,233,0.25)] text-neutral-600'}`}
    >
      {children}
    </button>
  );
}
