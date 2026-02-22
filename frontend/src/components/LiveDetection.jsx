import { useEffect, useRef, useState } from 'react';
import { WS_BASE } from '../services/api';
import { detectFrame } from '../services/api';

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;

export default function LiveDetection({ onEvent }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const wsFailuresRef = useRef(0);
  const locationRef = useRef({ lat: null, lng: null });
  const locationTimerRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [latest, setLatest] = useState(null);
  const [connectionMode, setConnectionMode] = useState('ws');
  const [cameraMode, setCameraMode] = useState('environment');
  const [videoDevices, setVideoDevices] = useState([]);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(0);
  const [switching, setSwitching] = useState(false);

  const statusClass = running ? 'live' : 'stopped';

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const getLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 2000 }
    );
  });

  const refreshLocation = async () => {
    const location = await getLocation();
    locationRef.current = location;
    return location;
  };

  const captureAndSend = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const { lat, lng } = locationRef.current;

    if (connectionMode === 'ws' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.7);
      wsRef.current.send(JSON.stringify({ frameBase64, lat, lng }));
      return;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    if (!blob) {
      return;
    }

    const message = await detectFrame(blob, lat, lng);
    setLatest(message);
    if (message.potholeDetected && typeof onEvent === 'function') {
      onEvent(message);
    }
  };

  const connectSocket = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const socket = new WebSocket(`${WS_BASE}/ws/realtime`);

    socket.onopen = () => {
      wsFailuresRef.current = 0;
      setConnectionMode('ws');
      setStatus('Live detection running');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.status === 'connected') {
          return;
        }
        if (message.error) {
          setStatus(`Detection error: ${message.error}`);
          return;
        }

        setLatest(message);
        if (message.potholeDetected && typeof onEvent === 'function') {
          onEvent(message);
        }
      } catch {
        setStatus('Detection error: invalid server response');
      }
    };

    socket.onerror = () => {
      setStatus('WebSocket connection error');
    };

    socket.onclose = () => {
      if (streamRef.current) {
        wsFailuresRef.current += 1;
        if (wsFailuresRef.current >= 3) {
          setConnectionMode('http');
          setStatus('WebSocket unstable. Switched to HTTP live mode.');
          return;
        }

        setStatus('WebSocket disconnected. Reconnecting...');
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectSocket();
        }, 2000);
      }
    };

    wsRef.current = socket;
  };

  const loadVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === 'videoinput');
      setVideoDevices(inputs);

      if (streamRef.current && inputs.length > 0) {
        const currentTrack = streamRef.current.getVideoTracks()[0];
        const currentId = currentTrack?.getSettings()?.deviceId;
        const index = inputs.findIndex((device) => device.deviceId === currentId);
        if (index >= 0) {
          setActiveDeviceIndex(index);
        }
      }
    } catch {
      setVideoDevices([]);
    }
  };

  const start = async (options = {}) => {
    const { mode = cameraMode, deviceId } = options;

    try {
      setStatus('Starting camera...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream;
      if (deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: mode } },
            audio: false
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      await refreshLocation();
      if (!locationTimerRef.current) {
        locationTimerRef.current = setInterval(() => {
          refreshLocation();
        }, 5000);
      }

      await loadVideoDevices();

      const socketState = wsRef.current?.readyState;
      if (connectionMode === 'ws' && socketState !== WebSocket.OPEN && socketState !== WebSocket.CONNECTING) {
        connectSocket();
      }
      setRunning(true);
      setStatus(connectionMode === 'ws' ? 'Connecting realtime socket...' : 'Running HTTP live detection...');

      if (!timerRef.current) {
        timerRef.current = setInterval(async () => {
          try {
            await captureAndSend();
          } catch (error) {
            setStatus(`Detection error: ${error.message}`);
          }
        }, 450);
      }
    } catch (error) {
      setStatus(`Cannot open camera: ${error.message}`);
      setRunning(false);
    }
  };

  const switchCamera = async () => {
    if (switching) {
      return;
    }

    setSwitching(true);
    try {
      if (videoDevices.length > 1) {
        const nextIndex = (activeDeviceIndex + 1) % videoDevices.length;
        setActiveDeviceIndex(nextIndex);
        await start({ deviceId: videoDevices[nextIndex].deviceId });
      } else {
        const nextMode = cameraMode === 'environment' ? 'user' : 'environment';
        setCameraMode(nextMode);
        if (running) {
          await start({ mode: nextMode });
        }
      }
    } finally {
      setSwitching(false);
    }
  };

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRunning(false);
    setStatus('Stopped');
  };

  const cameraLabel = cameraMode === 'environment' ? 'Rear' : 'Front';
  const normalizeBbox = () => {
    if (!latest?.bbox) {
      return null;
    }

    let rawBbox = latest.bbox;
    if (!Array.isArray(rawBbox) && typeof rawBbox === 'object') {
      if (['x1', 'y1', 'x2', 'y2'].every((key) => key in rawBbox)) {
        rawBbox = [rawBbox.x1, rawBbox.y1, rawBbox.x2, rawBbox.y2];
      } else if (['x', 'y', 'w', 'h'].every((key) => key in rawBbox)) {
        rawBbox = [rawBbox.x, rawBbox.y, rawBbox.w, rawBbox.h];
      }
    }

    if (!Array.isArray(rawBbox) || rawBbox.length !== 4) {
      return null;
    }

    let [a, b, c, d] = rawBbox.map((value) => Number(value));
    if ([a, b, c, d].some((value) => Number.isNaN(value))) {
      return null;
    }

    const maybeNormalized = [a, b, c, d].every((value) => value >= 0 && value <= 1);
    if (maybeNormalized) {
      a *= FRAME_WIDTH;
      b *= FRAME_HEIGHT;
      c *= FRAME_WIDTH;
      d *= FRAME_HEIGHT;
    }

    let x1 = a;
    let y1 = b;
    let x2 = c;
    let y2 = d;

    if (x2 <= x1 || y2 <= y1) {
      x2 = x1 + c;
      y2 = y1 + d;
    }

    x1 = Math.max(0, Math.min(FRAME_WIDTH, x1));
    y1 = Math.max(0, Math.min(FRAME_HEIGHT, y1));
    x2 = Math.max(0, Math.min(FRAME_WIDTH, x2));
    y2 = Math.max(0, Math.min(FRAME_HEIGHT, y2));

    if (x2 <= x1 || y2 <= y1) {
      return null;
    }

    return [x1, y1, x2, y2];
  };

  const normalizedBbox = normalizeBbox();
  const hasBbox = Array.isArray(normalizedBbox);

  const getBboxStyle = () => {
    if (!hasBbox) {
      return null;
    }

    const [x1, y1, x2, y2] = normalizedBbox;
    const left = Math.max(0, (x1 / FRAME_WIDTH) * 100);
    const top = Math.max(0, (y1 / FRAME_HEIGHT) * 100);
    const width = Math.max(0, ((x2 - x1) / FRAME_WIDTH) * 100);
    const height = Math.max(0, ((y2 - y1) / FRAME_HEIGHT) * 100);

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`
    };
  };

  return (
    <section className="card">
      <h2>Live Dashcam Detection</h2>
      <div className="button-row">
        <button type="button" onClick={start} disabled={running}>Start Live</button>
        <button type="button" onClick={stop} disabled={!running}>Stop</button>
        <button type="button" onClick={switchCamera} disabled={switching || (!running && videoDevices.length > 1)}>
          {switching ? 'Switching...' : `Switch Camera (${cameraLabel})`}
        </button>
      </div>
      <p className="camera-hint">For phones: use Switch Camera to toggle front/rear lens.</p>

      <div className="camera-stage">
        <video ref={videoRef} autoPlay muted playsInline className="camera-view" />
        {hasBbox && (
          <div className="bbox-overlay" style={getBboxStyle()} />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden-canvas" />
      <p className={`status-pill ${statusClass}`}>{status}</p>

      {latest && (
        <div className="result-box">
          <p>
            <strong>Detected:</strong>{' '}
            <span className={`detect-pill ${latest.potholeDetected ? 'yes' : 'no'}`}>
              {latest.potholeDetected ? 'Yes' : 'No'}
            </span>
          </p>
          <p><strong>Confidence:</strong> {(latest.confidence * 100).toFixed(1)}%</p>
          <p><strong>Lat/Lng:</strong> {latest.latitude ?? '-'}, {latest.longitude ?? '-'}</p>
        </div>
      )}
    </section>
  );
}
