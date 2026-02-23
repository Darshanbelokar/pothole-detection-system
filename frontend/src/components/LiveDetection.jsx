import { useEffect, useRef, useState } from 'react';
import { detectFrame } from '../services/api';

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;

export default function LiveDetection({ onEvent }) {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const locationRef = useRef({ lat: null, lng: null });
  const locationTimerRef = useRef(null);
  const frameDataRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [latest, setLatest] = useState(null);
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
    if (inFlightRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    inFlightRef.current = true;

    try {
      canvas.width = FRAME_WIDTH;
      canvas.height = FRAME_HEIGHT;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Store frame data for display canvas
      const imageData = context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      frameDataRef.current = imageData;

      const { lat, lng } = locationRef.current;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) {
        return;
      }

      const message = await detectFrame(blob, lat, lng);
      setLatest(message);
      
      // Draw annotated frame on display canvas
      drawAnnotatedFrame(imageData, message);
      
      if (message.potholeDetected && typeof onEvent === 'function') {
        onEvent(message);
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const normalizeBbox = (bbox) => {
    if (!bbox) {
      return null;
    }

    let x1;
    let y1;
    let x2;
    let y2;

    if (Array.isArray(bbox) && bbox.length === 4) {
      [x1, y1, x2, y2] = bbox.map((value) => Number(value));
      if ([x1, y1, x2, y2].some((value) => Number.isNaN(value))) {
        return null;
      }

      const looksNormalized = [x1, y1, x2, y2].every((value) => value >= 0 && value <= 1);
      if (looksNormalized) {
        x1 *= FRAME_WIDTH;
        y1 *= FRAME_HEIGHT;
        x2 *= FRAME_WIDTH;
        y2 *= FRAME_HEIGHT;
      }

      if (x2 <= x1 || y2 <= y1) {
        x2 = x1 + x2;
        y2 = y1 + y2;
      }
    } else if (typeof bbox === 'object') {
      if (bbox.x1 !== undefined && bbox.y1 !== undefined && bbox.x2 !== undefined && bbox.y2 !== undefined) {
        x1 = Number(bbox.x1);
        y1 = Number(bbox.y1);
        x2 = Number(bbox.x2);
        y2 = Number(bbox.y2);
      } else if (bbox.x !== undefined && bbox.y !== undefined && bbox.w !== undefined && bbox.h !== undefined) {
        x1 = Number(bbox.x);
        y1 = Number(bbox.y);
        x2 = x1 + Number(bbox.w);
        y2 = y1 + Number(bbox.h);
      }
    }

    if ([x1, y1, x2, y2].some((value) => value === undefined || Number.isNaN(value))) {
      return null;
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

  const drawAnnotatedFrame = (imageData, detection) => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const ctx = displayCanvas.getContext('2d');
    displayCanvas.width = FRAME_WIDTH;
    displayCanvas.height = FRAME_HEIGHT;

    // Draw the base frame
    ctx.putImageData(imageData, 0, 0);

    // Draw bounding box if pothole detected
    if (detection && detection.bbox) {
      const normalized = normalizeBbox(detection.bbox);
      if (!normalized) {
        return;
      }

      const [x1, y1, x2, y2] = normalized;

      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const confidenceValue = Number(detection.confidence ?? 0);
      const label = `Pothole ${(confidenceValue * 100).toFixed(1)}%`;
      const fontSize = 16;
      ctx.font = `bold ${fontSize}px Arial`;
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width + 8;
      const textHeight = fontSize + 6;

      const labelX = x1;
      const labelY = y1 > textHeight + 4 ? y1 - textHeight - 4 : y2 + 4;

      ctx.fillStyle = '#FF0000';
      ctx.fillRect(labelX - 2, labelY - textHeight + 4, textWidth, textHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, labelX + 2, labelY - 2);
    }
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
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
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

      setRunning(true);
      setStatus('Running HTTP live detection...');

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

    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setRunning(false);
    setStatus('Stopped');
  };

  const cameraLabel = cameraMode === 'environment' ? 'Rear' : 'Front';
  const latestNormalizedBbox = normalizeBbox(latest?.bbox);
  const hasLatestBbox = Array.isArray(latestNormalizedBbox);

  const getLatestBboxStyle = () => {
    if (!hasLatestBbox) {
      return null;
    }

    const [x1, y1, x2, y2] = latestNormalizedBbox;
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

      <div className="split-view-container">
        {/* Left Panel: Raw Camera Feed */}
        <div className="feed-panel">
          <div className="feed-label">📹 Raw Camera Feed</div>
          <div className="camera-stage">
            <video ref={videoRef} autoPlay muted playsInline className="camera-view" />
          </div>
        </div>

        {/* Right Panel: Annotated Detection Output */}
        <div className="feed-panel">
          <div className="feed-label">🎯 Detection Output (with Bounding Boxes)</div>
          <div className="camera-stage">
            <canvas ref={displayCanvasRef} className="camera-view" />
            {hasLatestBbox && (
              <div className="bbox-overlay" style={getLatestBboxStyle()} />
            )}
            {!running && (
              <div className="no-feed-overlay">
                <p>Start live detection to see predicted objects</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <canvas ref={captureCanvasRef} className="hidden-canvas" />
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
