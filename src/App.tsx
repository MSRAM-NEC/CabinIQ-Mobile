/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CabinIQ Mobile — Main Application
 *
 * Production-grade in-cabin radar intelligence system.
 *
 * Fixes applied:
 *  - BUG-02: Removed COM port references
 *  - BUG-03: Config payload no longer sends filename
 *  - BUG-06: Separated data processing from connection effect using refs
 *  - BUG-07: Stale closure fix via refs for rapidly-changing values
 *  - BUG-17: Bounded log buffer (no array spread on every frame)
 *  - BUG-20: Network disconnect callback wired up
 *  - BUG-21: Data watchdog timer for timeout detection
 *  - Added: Time-series data for analytics charts
 *  - Added: ConnectionDiagnostics state
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AndroidFrame from './components/AndroidFrame';
import DashboardTab from './components/DashboardTab';
import inCabinLogo from './assets/InCabin.png';
import mistralLogo from './assets/mistral-logo.png';
import Radar3DTab from './components/Radar3DTab';
import AnalyticsTab from './components/AnalyticsTab';
import SettingsTab from './components/SettingsTab';
import TerminalTab from './components/TerminalTab';
import HelpTab from './components/HelpTab';
import {
  DriveMode, ConnectionStatus, ZoneState, VitalSigns,
  RawPacketLog, AlgParams, Point3D, TransportType,
  ConnectionDiagnostics, DEFAULT_DIAGNOSTICS, ChartDataPoint,
  UsbDeviceInfo, ZoneDefinition
} from './types';
import {
  DEFAULT_ZONES, DEFAULT_ALG_PARAMS, initZoneState,
  generateMockSerializedFrame, parseSerializedFrame, updateOccupancyState,
  parseZonesFromConfig, parseSensorTiltFromConfig
} from './utils/radarPipeline';
import { usbSerialService } from './utils/usbSerialService';
import { networkService } from './utils/networkService';
import { RADAR_CONFIGS, DEFAULT_CONFIG_ID, getConfigById, cleanConfigText } from './utils/radarConfigs';
import {
  LayoutGrid, Box, BarChart3, Sliders, Terminal,
  AlertTriangle, CheckCircle, Info, Usb, Wifi, Cpu, HelpCircle
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { KeepAwake } from '@capacitor-community/keep-awake';

// ── Web Audio API sound alert synthesizer ───────────────────────────────────
const playSoundAlert = (type: 'info' | 'warning' | 'critical') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'critical') {
      const playBeep = (time: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + duration);
      };
      playBeep(ctx.currentTime, 880, 0.15);
      playBeep(ctx.currentTime + 0.2, 880, 0.15);
    } else if (type === 'warning') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(293.66, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {
    console.warn('Web Audio not supported or blocked:', e);
  }
};

type TabId    = 'dashboard' | 'radar' | 'analytics' | 'settings' | 'terminal' | 'help';
type ScenarioId = 'empty' | 'driver' | 'family' | 'baby';

// Max items for bounded collections
const MAX_PACKET_LOGS    = 30;
const MAX_HISTORY_LOGS   = 100;
const MAX_CHART_POINTS   = 60;

export default function App() {
  // ── UI State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [driveMode, setDriveMode] = useState<DriveMode>('rhd');
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(true);
  const [scenario, setScenario] = useState<ScenarioId>('driver');

  // Loading / Splash Screen States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing system...');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // ── Connection State ────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [transportType, setTransportType] = useState<TransportType>('serial');
  const [networkUrl, setNetworkUrl] = useState<string>('ws://192.168.1.100:8080');
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>(DEFAULT_DIAGNOSTICS);
  const [detectedDevices, setDetectedDevices] = useState<UsbDeviceInfo[]>([]);
  const [isScanningDevices, setIsScanningDevices] = useState<boolean>(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(DEFAULT_CONFIG_ID);
  const [radarConfig, setRadarConfig] = useState<string>(cleanConfigText(getConfigById(DEFAULT_CONFIG_ID).raw));

  // ── Algorithm State ─────────────────────────────────────────────────
  const [algParams, setAlgParams] = useState<AlgParams>(DEFAULT_ALG_PARAMS);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // ── App Preferences State ───────────────────────────────────────────
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => localStorage.getItem('hapticsOn') !== 'false');
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem('soundOn') === 'true');
  const [notificationsOn, setNotificationsOn] = useState<boolean>(() => localStorage.getItem('notificationsOn') !== 'false');
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('darkMode') !== 'false');
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(() => localStorage.getItem('keepScreenOn') !== 'false');
  const [alertOnEmpty, setAlertOnEmpty] = useState<boolean>(() => localStorage.getItem('alertOnEmpty') !== 'false');
  const [units, setUnits] = useState<'metric' | 'imperial'>(() => (localStorage.getItem('units') as 'metric' | 'imperial') || 'metric');

  // Persistence Effects
  useEffect(() => { localStorage.setItem('hapticsOn', String(hapticsOn)); }, [hapticsOn]);
  useEffect(() => { localStorage.setItem('soundOn', String(soundOn)); }, [soundOn]);
  useEffect(() => { localStorage.setItem('notificationsOn', String(notificationsOn)); }, [notificationsOn]);
  useEffect(() => { localStorage.setItem('darkMode', String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem('keepScreenOn', String(keepScreenOn)); }, [keepScreenOn]);
  useEffect(() => { localStorage.setItem('alertOnEmpty', String(alertOnEmpty)); }, [alertOnEmpty]);
  useEffect(() => { localStorage.setItem('units', units); }, [units]);

  // Keep Awake API Hook
  useEffect(() => {
    const applyKeepAwake = async () => {
      try {
        if (keepScreenOn) {
          await KeepAwake.keepAwake();
          console.log('[CabinIQ] Screen keep-awake enabled.');
        } else {
          await KeepAwake.allowSleep();
          console.log('[CabinIQ] Screen keep-awake disabled.');
        }
      } catch (e) {
        console.warn('KeepAwake API not available:', e);
      }
    };
    applyKeepAwake();
  }, [keepScreenOn]);

  // Local Notifications Permission Request
  useEffect(() => {
    if (notificationsOn) {
      const checkAndReq = async () => {
        try {
          const perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        } catch (e) {
          console.warn('LocalNotifications not supported or denied:', e);
        }
      };
      checkAndReq();
    }
  }, [notificationsOn]);

  // Stable Refs to avoid stale closure issues in callbacks
  const hapticsOnRef = useRef(hapticsOn);
  useEffect(() => { hapticsOnRef.current = hapticsOn; }, [hapticsOn]);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const notificationsOnRef = useRef(notificationsOn);
  useEffect(() => { notificationsOnRef.current = notificationsOn; }, [notificationsOn]);
  const alertOnEmptyRef = useRef(alertOnEmpty);
  useEffect(() => { alertOnEmptyRef.current = alertOnEmpty; }, [alertOnEmpty]);

  // Haptic Feedback trigger helper
  const triggerHapticFeedback = useCallback(async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!hapticsOnRef.current) return;
    try {
      const style = type === 'heavy' ? ImpactStyle.Heavy : type === 'light' ? ImpactStyle.Light : ImpactStyle.Medium;
      await Haptics.impact({ style });
    } catch (e) {
      console.warn('Haptics not supported:', e);
    }
  }, []);

  // System Notification dispatcher helper
  const sendSystemNotification = useCallback(async (title: string, body: string) => {
    if (!notificationsOnRef.current) return;
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) },
          }
        ]
      });
    } catch (e) {
      console.warn('Failed to schedule local notification:', e);
    }
  }, []);

  // Derive sensor tilt from active config (used for Z-axis correction in parseSerializedFrame)
  const sensorTiltDeg = React.useMemo(() => parseSensorTiltFromConfig(radarConfig), [radarConfig]);
  const sensorTiltRef = useRef(sensorTiltDeg);
  useEffect(() => { sensorTiltRef.current = sensorTiltDeg; }, [sensorTiltDeg]);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [baselines, setBaselines] = useState<{ [zoneId: number]: { density: number; snr: number } } | null>(null);

  // ── Live Data State ─────────────────────────────────────────────────
  const [zones, setZones] = useState<ZoneDefinition[]>(() => {
    const defaultRaw = getConfigById(DEFAULT_CONFIG_ID).raw;
    const parsed = parseZonesFromConfig(defaultRaw);
    return parsed.length > 0 ? parsed : DEFAULT_ZONES;
  });

  const [points, setPoints] = useState<Point3D[]>([]);
  const [zoneStates, setZoneStates] = useState<{ [zoneId: number]: ZoneState }>(() => {
    const initial: { [zoneId: number]: ZoneState } = {};
    const defaultRaw = getConfigById(DEFAULT_CONFIG_ID).raw;
    const parsed = parseZonesFromConfig(defaultRaw);
    const active = parsed.length > 0 ? parsed : DEFAULT_ZONES;
    active.forEach(z => {
      initial[z.id] = initZoneState(z.id);
    });
    return initial;
  });

  useEffect(() => {
    setZoneStates(prev => {
      const next: { [zoneId: number]: ZoneState } = {};
      zones.forEach(z => {
        next[z.id] = prev[z.id] || initZoneState(z.id);
      });
      return next;
    });
  }, [zones]);

  useEffect(() => {
    const raw = getConfigById(selectedConfigId).raw;
    const parsed = parseZonesFromConfig(raw, driveMode);
    setZones(parsed.length > 0 ? parsed : DEFAULT_ZONES);
  }, [driveMode, selectedConfigId]);

  const [vitals, setVitals] = useState<VitalSigns>({
    driverPresent: true, heartRate: 72, breathingRate: 0.25
  });

  // Run initial splash screen sequence on app launch
  useEffect(() => {
    const stages = [
      { progress: 15, status: 'Initializing radar subsystem...', delay: 400 },
      { progress: 30, status: 'Loading 3D visualization engine...', delay: 600 },
      { progress: 50, status: 'Configuring zone detection...', delay: 500 },
      { progress: 65, status: 'Establishing sensor connection...', delay: 500 },
      { progress: 80, status: 'Initializing sensor interface...', delay: 400 },
      { progress: 92, status: 'Preparing dashboard...', delay: 400 },
      { progress: 100, status: 'System ready — launching CabinIQ', delay: 600 },
    ];

    let currentStage = 0;
    let timerId: ReturnType<typeof setTimeout>;

    function nextStage() {
      if (currentStage >= stages.length) {
        setIsFadingOut(true);
        timerId = setTimeout(() => {
          setIsLoading(false);
        }, 600); // matches CSS fade-out duration
        return;
      }

      const stage = stages[currentStage];
      setLoadingProgress(stage.progress);
      setLoadingStatus(stage.status);
      currentStage++;
      timerId = setTimeout(nextStage, stage.delay);
    }

    timerId = setTimeout(nextStage, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

  // ── Logs & Notifications ────────────────────────────────────────────
  const [packetLogs, setPacketLogs] = useState<RawPacketLog[]>([]);
  const [historyLog, setHistoryLog] = useState<string[]>([]);
  const [nativeLogs, setNativeLogs] = useState<string[]>([]);
  const [notification, setNotification] = useState<{
    show: boolean; msg: string; type: 'success' | 'warning' | 'info';
  }>({ show: false, msg: '', type: 'info' });
  const [criticalAlert, setCriticalAlert] = useState<{ title: string; message: string } | null>(null);

  // ── Analytics Time-Series ───────────────────────────────────────────
  const [snrHistory, setSnrHistory]                 = useState<ChartDataPoint[]>([]);
  const [fpsHistory, setFpsHistory]                 = useState<ChartDataPoint[]>([]);
  const [pointDensityHistory, setPointDensityHistory] = useState<ChartDataPoint[]>([]);
  const [packetLossCount, setPacketLossCount]       = useState(0);
  const [totalFrames, setTotalFrames]               = useState(0);

  // ── Refs for values read inside intervals (avoids stale closures) ──
  const frameCountRef     = useRef<number>(0);
  const algParamsRef      = useRef(algParams);
  const baselinesRef      = useRef(baselines);
  const isCalibratingRef  = useRef(isCalibrating);
  const scenarioRef       = useRef(scenario);
  const driveModeRef      = useRef(driveMode);
  const zonesRef          = useRef(zones);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDataTimestamp = useRef<number>(Date.now());
  const watchdogRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogFiredRef  = useRef<boolean>(false);
  const lastFrameTimeRef  = useRef<number>(Date.now());

  // Keep refs in sync with state
  useEffect(() => { zonesRef.current         = zones; },         [zones]);
  useEffect(() => { algParamsRef.current     = algParams; },     [algParams]);
  useEffect(() => { baselinesRef.current     = baselines; },     [baselines]);
  useEffect(() => { isCalibratingRef.current = isCalibrating; }, [isCalibrating]);
  useEffect(() => { scenarioRef.current      = scenario; },      [scenario]);
  useEffect(() => { driveModeRef.current     = driveMode; },     [driveMode]);

  // ── Utility Helpers ─────────────────────────────────────────────────

  const addHistoryLog = useCallback((msg: string) => {
    setHistoryLog(prev => {
      const next = [msg, ...prev];
      return next.length > MAX_HISTORY_LOGS ? next.slice(0, MAX_HISTORY_LOGS) : next;
    });
  }, []);

  const pushChartPoint = useCallback((
    setter: React.Dispatch<React.SetStateAction<ChartDataPoint[]>>,
    value: number
  ) => {
    setter(prev => {
      const next = [...prev, { t: Date.now(), v: value }];
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
    });
  }, []);

  const triggerNotification = useCallback((msg: string, type: 'success' | 'warning' | 'info') => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setNotification({ show: true, msg, type });
    notificationTimer.current = setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);

    // Play synthesized sound alert if enabled
    if (soundOnRef.current) {
      playSoundAlert(type === 'warning' ? 'warning' : 'info');
    }

    // Schedule local notification if enabled
    if (notificationsOnRef.current) {
      sendSystemNotification('CabinIQ Alert', msg);
    }
  }, [sendSystemNotification]);

  const getScenarioOccupiers = useCallback(() => {
    const sc = scenarioRef.current;
    const base = { active: false, type: 'adult' as const };
    const map: Record<number, { active: boolean; type: 'child' | 'adult' }> = {};

    // Initialize all active zones to empty
    zonesRef.current.forEach(z => {
      map[z.id] = { ...base };
    });

    switch (sc) {
      case 'family':
        zonesRef.current.forEach(z => {
          const label = z.seatLabel.toLowerCase();
          if (label.includes('driver')) {
            map[z.id] = { active: true, type: 'adult' };
          } else if (label.includes('pass')) {
            map[z.id] = { active: true, type: 'adult' };
          } else if (label.includes('left')) {
            map[z.id] = { active: true, type: 'child' }; // Child in rear left
          } else if (label.includes('right')) {
            map[z.id] = { active: true, type: 'adult' }; // Adult in rear right
          }
        });
        break;
      case 'baby':
        zonesRef.current.forEach(z => {
          const label = z.seatLabel.toLowerCase();
          if (label.includes('center')) {
            map[z.id] = { active: true, type: 'child' }; // Child in center seat
          }
        });
        break;
      case 'driver':
        zonesRef.current.forEach(z => {
          const label = z.seatLabel.toLowerCase();
          if (label.includes('driver')) {
            map[z.id] = { active: true, type: 'adult' };
          }
        });
        break;
      case 'empty':
      default:
        break;
    }
    return map;
  }, []);

  // ── Core Frame Processor ────────────────────────────────────────────
  // Shared between simulation interval and hardware callback.

  const processFrame = useCallback((
    parsedPoints: Point3D[],
    parsedVitals: VitalSigns,
    packetLog: RawPacketLog,
    isError: boolean
  ) => {
    lastDataTimestamp.current = Date.now();
    watchdogFiredRef.current = false;  // Reset watchdog on fresh data

    // FPS tracking
    const now = Date.now();
    const dt  = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const instantFps = dt > 0 ? 1000 / dt : 0;

    setTotalFrames(f => f + 1);

    // Packet logs (bounded circular)
    setPacketLogs(prev => {
      const next = [...prev, packetLog];
      return next.length > MAX_PACKET_LOGS ? next.slice(-MAX_PACKET_LOGS) : next;
    });

    if (isError) {
      setPacketLossCount(c => c + 1);
      return;
    }

    setPoints(parsedPoints);
    setVitals(parsedVitals);

    // Analytics time-series
    const avgSnr = parsedPoints.length > 0
      ? parsedPoints.reduce((s, p) => s + p.snr, 0) / parsedPoints.length
      : 0;

    pushChartPoint(setSnrHistory, avgSnr);
    pushChartPoint(setFpsHistory, instantFps);
    pushChartPoint(setPointDensityHistory, parsedPoints.length);

    // Update diagnostics
    setDiagnostics(prev => ({
      ...prev,
      framesReceived: prev.framesReceived + 1,
      avgFps: instantFps > 0 ? (prev.avgFps * 0.9 + instantFps * 0.1) : prev.avgFps,
      avgSnr: avgSnr > 0 ? (prev.avgSnr * 0.9 + avgSnr * 0.1) : prev.avgSnr,
    }));

    // Calibration progress
    if (isCalibratingRef.current) {
      setCalibrationProgress(p => {
        const next = p + 10;
        if (next >= 100) {
          setIsCalibrating(false);
          const dynamicBaselines: { [zoneId: number]: { density: number; snr: number } } = {};
          zonesRef.current.forEach((z, i) => {
            dynamicBaselines[z.id] = {
              density: 0.08 + (i % 3) * 0.02,
              snr: 2.8 + (i % 2) * 0.2
            };
          });
          setBaselines(dynamicBaselines);
          addHistoryLog(`[${new Date().toLocaleTimeString()}] Baseline calibration completed.`);
          return 100;
        }
        return next;
      });
    }

    // Zone state machine
    setZoneStates(prev => {
      const next = updateOccupancyState(
        parsedPoints, prev, algParamsRef.current, baselinesRef.current, zonesRef.current
      );

      // Child-Left Alert logic:
      if (alertOnEmptyRef.current) {
        const driverZone = zonesRef.current.find(z => z.seatLabel === 'Driver');
        if (driverZone && prev[driverZone.id]?.occupied && !next[driverZone.id]?.occupied) {
          const childPresent = zonesRef.current.some(z => {
            if (z.id === driverZone.id) return false;
            const zState = next[z.id];
            return zState && zState.occupied && zState.classification === 'child';
          });
          
          if (childPresent) {
            setCriticalAlert({
              title: 'CHILD LEFT BEHIND',
              message: 'Driver has vacated the vehicle, but a child is still detected in the cabin!'
            });
            if (soundOnRef.current) {
              playSoundAlert('critical');
            }
            triggerHapticFeedback('heavy');
            sendSystemNotification('CRITICAL SAFETY ALERT', 'Unattended child left behind in vehicle!');
          }
        }
      }

      // Detect transitions → log + notify
      zonesRef.current.forEach(zone => {
        const prevZ = prev[zone.id];
        const nextZ = next[zone.id];
        if (prevZ && nextZ && prevZ.occupied !== nextZ.occupied) {
          // Trigger haptic feedback
          triggerHapticFeedback('medium');

          const action = nextZ.occupied
            ? `${nextZ.classification === 'child' ? 'Child' : 'Adult'} detected`
            : 'Vacated';
          addHistoryLog(
            `[${new Date().toLocaleTimeString()}] ${zone.seatLabel}: ${action} (${nextZ.features.numPoints} pts, SNR ${nextZ.features.avgSnr.toFixed(1)} dB)`
          );

          if (scenarioRef.current === 'baby' && nextZ.occupied && nextZ.classification === 'child') {
            setCriticalAlert({ title: 'SAFETY WARNING', message: 'Unattended Child Detected in Vehicle!' });
            if (soundOnRef.current) {
              playSoundAlert('critical');
            }
          } else {
            triggerNotification(
              `${zone.seatLabel}: ${nextZ.occupied ? 'Occupied' : 'Vacated'}`,
              nextZ.occupied && nextZ.classification === 'child' ? 'warning' : 'info'
            );
          }
        }
      });

      return next;
    });
  }, [addHistoryLog, pushChartPoint, triggerNotification]);

  // ── USB Device Scan Handler ─────────────────────────────────────────

  const handleScanDevices = useCallback(async () => {
    setIsScanningDevices(true);
    setDetectedDevices([]);
    addHistoryLog(`[${new Date().toLocaleTimeString()}] Scanning USB ports…`);

    try {
      const result = await usbSerialService.scanForDevices();
      setDetectedDevices(result.devices);

      if (result.devices.length === 0) {
        triggerNotification('No USB devices detected. Connect radar via OTG.', 'warning');
        addHistoryLog(`[${new Date().toLocaleTimeString()}] No USB devices found.`);
      } else {
        const names = result.devices.map(d => d.deviceName).join(', ');
        triggerNotification(`Found ${result.devices.length} device(s): ${names}`, 'success');
        addHistoryLog(`[${new Date().toLocaleTimeString()}] Detected: ${names}`);

        if (result.permissionGranted && result.grantedDevice) {
          addHistoryLog(`[${new Date().toLocaleTimeString()}] Permission granted for ${result.grantedDevice.deviceName}`);
        }
      }
    } catch (err: any) {
      console.error('[App] Scan error:', err);
      triggerNotification('USB scan failed: ' + (err?.message || 'Unknown error'), 'warning');
    } finally {
      setIsScanningDevices(false);
    }
  }, [addHistoryLog, triggerNotification]);

  // ── Connection Handler ──────────────────────────────────────────────

  const handleConnectToggle = useCallback(async () => {
    if (connectionStatus === 'connected') {
      // Disconnect
      if (!isSimulationMode) {
        try {
          if (transportType === 'serial') await usbSerialService.disconnect();
          else networkService.disconnect();
        } catch (e) { console.error(e); }
      }
      setConnectionStatus('disconnected');
      setDiagnostics(DEFAULT_DIAGNOSTICS);
      setDetectedDevices([]);
      addHistoryLog(`[${new Date().toLocaleTimeString()}] Sensor disconnected.`);
      triggerNotification('Sensor disconnected', 'warning');
    } else {
      // Connect
      setConnectionStatus('scanning');
      addHistoryLog(`[${new Date().toLocaleTimeString()}] Initializing link…`);

      if (isSimulationMode) {
        setTimeout(() => {
          setConnectionStatus('connected');
          setDiagnostics(prev => ({
            ...prev,
            deviceName: 'Simulation',
            vendorId: '—',
            productId: '—',
            baudRate: 0,
          }));
          addHistoryLog(`[${new Date().toLocaleTimeString()}] Simulation started.`);
          triggerNotification('Simulation active', 'success');
        }, 400);
      } else {
        try {
          if (transportType === 'serial') {
            // Scan → request permission → open connection → send config
            const scanResult = await usbSerialService.connect(radarConfig);
            setDetectedDevices(scanResult.devices);

            const dev = scanResult.grantedDevice;
            setDiagnostics(prev => ({
              ...prev,
              deviceName: dev ? dev.deviceName : 'TI AWR6843 (USB)',
              vendorId: dev ? `0x${dev.vendorId.toString(16).toUpperCase().padStart(4, '0')}` : '—',
              productId: dev ? `0x${dev.productId.toString(16).toUpperCase().padStart(4, '0')}` : '—',
              baudRate: 921600,
            }));
          } else {
            await networkService.connect(networkUrl);
            setDiagnostics(prev => ({
              ...prev,
              deviceName: `Network (${networkUrl})`,
              vendorId: '—',
              productId: '—',
              baudRate: 0,
            }));
          }
          setConnectionStatus('connected');
          addHistoryLog(`[${new Date().toLocaleTimeString()}] Connected.`);
          triggerNotification('Sensor connected', 'success');
        } catch (err: any) {
          console.error(err);
          const msg = err?.message || '';
          const isPermission = msg.includes('permission') || msg.includes('Permission');
          const isNoDevice = msg.includes('No USB') || msg.includes('not detected');
          setConnectionStatus(isPermission ? 'permission_denied' : 'disconnected');
          triggerNotification(
            isNoDevice
              ? 'No USB radar detected. Connect device and try again.'
              : isPermission
              ? 'USB permission denied. Please grant access.'
              : `Connection failed: ${msg}`,
            'warning'
          );
        }
      }
    }
  }, [connectionStatus, isSimulationMode, transportType, networkUrl, addHistoryLog, triggerNotification]);

  // ── Data Watchdog (BUG-21 fix) ──────────────────────────────────────
  // Detect if connected but no data for >5 seconds

  useEffect(() => {
    if (connectionStatus === 'connected') {
      lastDataTimestamp.current = Date.now();
      watchdogFiredRef.current = false;
      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastDataTimestamp.current > 5000 && !watchdogFiredRef.current) {
          watchdogFiredRef.current = true;  // Fire only once until data resumes
          triggerNotification('No data from sensor for 5s — check connection', 'warning');
          addHistoryLog(`[${new Date().toLocaleTimeString()}] ⚠ Data timeout — no frames received for 5 seconds`);
        }
      }, 5000);
      return () => { if (watchdogRef.current) clearInterval(watchdogRef.current); };
    }
  }, [connectionStatus, triggerNotification, addHistoryLog]);

  // ── Simulation Data Loop ────────────────────────────────────────────
  // Only runs when connected + simulation mode.

  useEffect(() => {
    if (connectionStatus !== 'connected' || !isSimulationMode) {
      if (connectionStatus !== 'connected') {
        setPoints([]);
        setVitals({ driverPresent: false, heartRate: 0, breathingRate: 0 });
      }
      return;
    }

    const interval = setInterval(() => {
      frameCountRef.current += 1;
      const scenarioMap    = getScenarioOccupiers();
      // Find driver zone dynamically by seatLabel (not hardcoded zone ID 0)
      const driverZone = zonesRef.current.find(z =>
        z.seatLabel.toLowerCase().includes('driver')
      );
      const driverPresent = driverZone ? (scenarioMap[driverZone.id]?.active ?? false) : false;

      const targetVitals: VitalSigns = {
        driverPresent,
        heartRate:     driverPresent ? 68 + Math.sin(frameCountRef.current * 0.05) * 5 : 0,
        breathingRate: driverPresent ? 0.22 + Math.sin(frameCountRef.current * 0.06) * 0.03 : 0,
      };

      const { buffer } = generateMockSerializedFrame(
        frameCountRef.current, scenarioMap, targetVitals, driveModeRef.current, zonesRef.current
      );

      try {
        const parsed = parseSerializedFrame(buffer, true, sensorTiltRef.current);
        processFrame(parsed.points, targetVitals, parsed.log, false);
      } catch {
        // Simulation frames should never fail, but handle gracefully
      }
    }, 200);

    return () => clearInterval(interval);
  }, [connectionStatus, isSimulationMode, getScenarioOccupiers, processFrame]);

  // ── Hardware Data Binding ───────────────────────────────────────────
  // Attaches the processFrame callback to the real serial/network service.

  useEffect(() => {
    if (connectionStatus !== 'connected' || isSimulationMode) return;

    const handleData = (
      _frameNum: number, pts: Point3D[], v: VitalSigns, log: RawPacketLog, isError: boolean
    ) => {
      processFrame(pts, v, log, isError);
    };

    // Tell the USB service about current tilt so it can pass it to parseSerializedFrame
    usbSerialService.setSensorTilt(sensorTiltRef.current);

    if (transportType === 'serial') {
      usbSerialService.onData = handleData;
      usbSerialService.onStatus = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        addHistoryLog(`[${ts}] 🔌 ${msg}`);
        setNativeLogs(prev => {
          const next = [`[${ts}] ${msg}`, ...prev];
          return next.length > 200 ? next.slice(0, 200) : next;
        });
      };
      usbSerialService.onDisconnect = () => {
        setConnectionStatus('disconnected');
        addHistoryLog(`[${new Date().toLocaleTimeString()}] USB disconnected unexpectedly.`);
        triggerNotification('USB device disconnected', 'warning');
      };
    } else {
      networkService.onData = handleData;
      networkService.onDisconnect = () => {
        setConnectionStatus('disconnected');
        addHistoryLog(`[${new Date().toLocaleTimeString()}] Network disconnected.`);
        triggerNotification('Network connection lost', 'warning');
      };
      networkService.onStatusChange = (status) => {
        if (status === 'disconnected') {
          setConnectionStatus('disconnected');
        }
      };
    }

    return () => {
      usbSerialService.onData = null;
      usbSerialService.onStatus = null;
      usbSerialService.onDisconnect = null;
      networkService.onData = null;
      networkService.onDisconnect = null;
      networkService.onStatusChange = null;
    };
  }, [connectionStatus, isSimulationMode, transportType, processFrame, addHistoryLog, triggerNotification]);

  useEffect(() => {
    return () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      usbSerialService.onData = null;
      usbSerialService.onStatus = null;
      usbSerialService.onDisconnect = null;
      networkService.onData = null;
      networkService.onDisconnect = null;
      networkService.onStatusChange = null;
    };
  }, []);

  // ── Scenario Selector ───────────────────────────────────────────────

  const selectScenario = useCallback((id: ScenarioId) => {
    setScenario(id);
    const names: Record<ScenarioId, string> = {
      empty: 'Empty Cabin', driver: 'Driver Solo',
      family: 'Family (Mixed)', baby: 'Child Left Behind'
    };
    addHistoryLog(`[${new Date().toLocaleTimeString()}] Scenario: ${names[id]}`);
    triggerNotification(`Scenario: ${names[id]}`, id === 'baby' ? 'warning' : 'info');
  }, [addHistoryLog, triggerNotification]);

  // ── Calibration Trigger ─────────────────────────────────────────────

  const handleTriggerCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    setBaselines(null);
    addHistoryLog(`[${new Date().toLocaleTimeString()}] Baseline calibration started.`);
    triggerNotification('Calibrating baseline…', 'info');
  }, [addHistoryLog, triggerNotification]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <AndroidFrame>
      <div className={`flex-1 w-full overflow-hidden flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#070c16]' : 'light-theme bg-[#f8fafc] text-[#1e293b]'}`}>

      {/* ── Loading / Splash Screen ────────────────────────────────── */}
      {isLoading && (
        <div className={`loading-screen ${isFadingOut ? 'fade-out' : ''}`}>
          <div className="loading-bg-grid" aria-hidden="true" />
          <div className="loading-content">
            <div className="loading-radar-ring">
              <svg className="radar-svg" viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="90" className="radar-ring-outer" />
                <circle cx="100" cy="100" r="65" className="radar-ring-mid" />
                <circle cx="100" cy="100" r="40" className="radar-ring-inner" />
                <line x1="100" y1="10" x2="100" y2="190" className="radar-crosshair" />
                <line x1="10" y1="100" x2="190" y2="100" className="radar-crosshair" />
                <line x1="100" y1="100" x2="100" y2="15" className="radar-sweep" />
              </svg>
              <div className="loading-logo-center">
                <img src={inCabinLogo} alt="" className="loading-logo-img animate-pulse" />
              </div>
            </div>
            <h2 className="loading-title text-white">
              Cabin<span className="text-sky-400 font-extrabold">IQ</span>
            </h2>
            <p className="loading-subtitle text-[#9aa8bf]">In-Cabin Radar Intelligence Platform</p>
            <div className="loading-progress-track">
              <div className="loading-progress-bar" style={{ width: `${loadingProgress}%` }} />
            </div>
            <p className="loading-status text-[#6a7c99]">{loadingStatus}</p>

            {/* Mistral Solutions partner strip */}
            <div className="loading-partner-strip">
              <div className="loading-partner-divider">
                <div className="loading-partner-divider-line" />
                <span className="loading-partner-label">Hardware by</span>
                <div className="loading-partner-divider-line" />
              </div>
              <img
                src={mistralLogo}
                alt="Mistral Solutions"
                className="h-[18px] w-auto object-contain"
                style={{ filter: 'brightness(1.05) saturate(0.85) opacity(0.75)' }}
              />
            </div>

          </div>
        </div>
      )}

      {/* ── Safety-Critical Alert Modal ──────────────────────────────── */}
      {criticalAlert && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="w-11/12 max-w-sm bg-[#111318] border-2 border-red-500/40 rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500 animate-pulse" />
            </div>
            <h2 className="text-[16px] font-bold text-red-400 uppercase tracking-wider mb-1">{criticalAlert.title}</h2>
            <p className="text-[13px] text-neutral-300 mb-6">{criticalAlert.message}</p>
            <button
              onClick={() => setCriticalAlert(null)}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all rounded-xl text-white text-[12px] font-bold uppercase tracking-wider"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Toast Notification ───────────────────────────────────────── */}
      {notification.show && !criticalAlert && (
        <div className="absolute bottom-[100px] inset-x-4 z-50 pointer-events-none" style={{ animation: 'slide-in-bottom 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}>
          <div className={`p-3.5 rounded-2xl flex items-center gap-3 border backdrop-blur-sm shadow-xl relative overflow-hidden ${
            notification.type === 'warning'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
          }`}>
            {notification.type === 'warning'
              ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              : notification.type === 'success'
              ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
            }
            <span className="text-[12px] font-medium leading-snug">{notification.msg}</span>
            {/* Toast auto-dismiss progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full"
                style={{
                  background: 'currentColor',
                  animation: 'shrinkWidth 4s linear forwards'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header
        className={`px-3 pt-2.5 pb-2.5 border-b relative z-40 ${darkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]'}`}
        style={{ background: darkMode ? 'linear-gradient(180deg,#070c15 0%,#060810 100%)' : 'linear-gradient(180deg,#ffffff 0%,#f1f5f9 100%)' }}
      >
        <div className="flex items-center justify-between gap-2">

          {/* ── Left: CabinIQ logo + title ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Round-cornered logo */}
            <div
              className="flex-shrink-0 rounded-xl overflow-hidden"
              style={{
                width: 40, height: 40,
                border: '1.5px solid rgba(14,165,233,0.25)',
                boxShadow: '0 0 10px rgba(14,165,233,0.15)',
                background: '#070c16',
              }}
            >
              <img src={inCabinLogo} alt="CabinIQ" className="w-full h-full object-cover" />
            </div>

            {/* Title + tagline */}
            <div>
              <h1 className={`text-[15px] font-extrabold leading-none tracking-tight ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                Cabin<span className="text-sky-400">IQ</span>
              </h1>
              <p className={`text-[8px] font-medium leading-none mt-[3px] tracking-wide ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
                An InCabin Monitoring System
              </p>
            </div>
          </div>

          {/* ── Centre: Powered by Mistral ── */}
          <div className="flex flex-col items-center gap-[3px] flex-1 min-w-0">
            <span className={`text-[6.5px] uppercase tracking-[1.6px] font-semibold leading-none ${darkMode ? 'text-neutral-600' : 'text-neutral-500'}`}>
              Powered by
            </span>
            <div
              className="flex items-center justify-center px-2 py-[3px] rounded-lg"
              style={{
                background: 'rgba(226,168,75,0.07)',
                border: '1px solid rgba(226,168,75,0.20)',
              }}
            >
              <img
                src={mistralLogo}
                alt="Mistral Solutions"
                className="h-[14px] w-auto object-contain"
                style={{ filter: 'brightness(1.05) saturate(0.9)' }}
              />
            </div>
          </div>

          {/* ── Right: connection indicator ── */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Data-active bars */}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-0.5">
                <span className="w-[3px] h-3 rounded-full bg-sky-500/50" style={{ animation: 'breathe 0.9s ease-in-out infinite', animationDelay: '0ms' }} />
                <span className="w-[3px] h-2 rounded-full bg-sky-500/70" style={{ animation: 'breathe 0.9s ease-in-out infinite', animationDelay: '0.15s' }} />
                <span className="w-[3px] h-3 rounded-full bg-sky-500/50" style={{ animation: 'breathe 0.9s ease-in-out infinite', animationDelay: '0.30s' }} />
              </div>
            )}
            {/* Status pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold uppercase tracking-wider ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : connectionStatus === 'scanning'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : darkMode
                ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.05)] text-neutral-600'
                : 'bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.05)] text-neutral-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                connectionStatus === 'connected' ? 'bg-emerald-500'
                : connectionStatus === 'scanning' ? 'bg-amber-500 animate-pulse'
                : 'bg-neutral-700'
              }`} />
              {connectionStatus === 'connected' && (
                isSimulationMode ? <Cpu className="w-3 h-3 text-emerald-400" /> :
                transportType === 'network' ? <Wifi className="w-3 h-3 text-emerald-400" /> :
                <Usb className="w-3 h-3 text-emerald-400" />
              )}
              {connectionStatus === 'connected'
                ? (isSimulationMode ? 'SIM' : transportType === 'network' ? 'NET' : 'USB')
                : connectionStatus === 'scanning' ? 'SCAN'
                : 'OFF'
              }
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <div className="flex-grow overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && (
          <DashboardTab
            zones={zones}
            zoneStates={zoneStates}
            vitals={vitals}
            driveMode={driveMode}
            onTriggerCalibration={handleTriggerCalibration}
            isCalibrating={isCalibrating}
            connectionStatus={connectionStatus}
            transportType={transportType}
            isSimulationMode={isSimulationMode}
            sensorTiltDeg={sensorTiltDeg}
            diagnostics={diagnostics}
            configName={getConfigById(selectedConfigId).label}
            darkMode={darkMode}
          />
        )}

        {activeTab === 'radar' && (
          <Radar3DTab points={points} zoneStates={zoneStates} zones={zones} darkMode={darkMode} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            zones={zones}
            zoneStates={zoneStates}
            historyLog={historyLog}
            snrHistory={snrHistory}
            fpsHistory={fpsHistory}
            pointDensityHistory={pointDensityHistory}
            packetLossCount={packetLossCount}
            totalFrames={totalFrames}
            darkMode={darkMode}
          />
        )}
        {activeTab === 'settings' && (
        <SettingsTab
            connectionStatus={connectionStatus}
            onConnectToggle={handleConnectToggle}
            algParams={algParams}
            onParamChange={(param, value) => setAlgParams(prev => ({ ...prev, [param]: value }))}
            driveMode={driveMode}
            setDriveMode={setDriveMode}
            isSimulationMode={isSimulationMode}
            setIsSimulationMode={setIsSimulationMode}
            transportType={transportType}
            setTransportType={setTransportType}
            networkUrl={networkUrl}
            setNetworkUrl={setNetworkUrl}
            diagnostics={diagnostics}
            detectedDevices={detectedDevices}
            isScanning={isScanningDevices}
            onScanDevices={handleScanDevices}
            selectedConfigId={selectedConfigId}
            onConfigChange={(id) => {
              setSelectedConfigId(id);
              setRadarConfig(cleanConfigText(getConfigById(id).raw));
            }}
            scenario={scenario}
            onScenarioChange={selectScenario}
            hapticsOn={hapticsOn}
            setHapticsOn={setHapticsOn}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            notificationsOn={notificationsOn}
            setNotificationsOn={setNotificationsOn}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            keepScreenOn={keepScreenOn}
            setKeepScreenOn={setKeepScreenOn}
            alertOnEmpty={alertOnEmpty}
            setAlertOnEmpty={setAlertOnEmpty}
            units={units}
            setUnits={setUnits}
          />
        )}
        {activeTab === 'terminal' && (
          <TerminalTab packetLogs={packetLogs} nativeLogs={nativeLogs} darkMode={darkMode} />
        )}
        {activeTab === 'help' && (
          <HelpTab
            diagnostics={diagnostics}
            connectionStatus={connectionStatus}
            selectedConfigId={selectedConfigId}
            sensorTiltDeg={sensorTiltDeg}
            framesReceived={diagnostics.framesReceived}
            parseErrors={diagnostics.parseErrors}
            crcErrors={diagnostics.crcErrors}
            appVersion="1.0.0"
            darkMode={darkMode}
          />
        )}
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        {/* Gradient separator above nav */}
        <div className="absolute bottom-full left-0 right-0 h-6 pointer-events-none z-40" style={{ background: darkMode ? 'linear-gradient(to top, #060810 0%, transparent 100%)' : 'linear-gradient(to top, #f1f5f9 0%, transparent 100%)' }} />
        <nav className="w-full backdrop-blur-md border-t flex justify-around items-center px-1 select-none z-50 pb-safe" style={{ height: 'calc(72px + env(safe-area-inset-bottom, 0px))', background: darkMode ? 'rgba(6,8,16,0.96)' : 'rgba(255,255,255,0.96)', borderTop: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)' }}>
          {([
            { id: 'dashboard' as TabId, icon: LayoutGrid,  label: 'Cabin'     },
            { id: 'radar'     as TabId, icon: Box,          label: '3D View'   },
            { id: 'analytics' as TabId, icon: BarChart3,    label: 'Analytics' },
            { id: 'settings'  as TabId, icon: Sliders,      label: 'Settings'  },
            { id: 'terminal'  as TabId, icon: Terminal,     label: 'Terminal'  },
            { id: 'help'      as TabId, icon: HelpCircle,   label: 'Help'      },
          ]).map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const isHelp = tab.id === 'help';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center justify-center gap-1 h-full flex-1 transition-all active:scale-90 min-w-[44px]"
                aria-label={tab.label}
              >
                {/* Active pill gradient indicator */}
                {isActive && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-7 rounded-b-full"
                    style={{ background: isHelp
                      ? 'linear-gradient(90deg, #e2a84b, #f0c060, #e2a84b)'
                      : 'linear-gradient(90deg, #0284c7, #38bdf8, #0284c7)'
                    }}
                  />
                )}
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive ? '' : darkMode ? 'text-neutral-700' : 'text-neutral-400'
                  }`}
                  style={isActive ? {
                    background: isHelp
                      ? 'rgba(226,168,75,0.10)'
                      : 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.06))',
                    color: isHelp ? '#e2a84b' : '#38bdf8',
                  } : {}}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span className={`text-[8px] font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  isActive
                    ? isHelp ? 'text-[#e2a84b]' : 'text-sky-400'
                    : darkMode ? 'text-neutral-700' : 'text-neutral-400'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
      </div>
    </AndroidFrame>
  );
}
