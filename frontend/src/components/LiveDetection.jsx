import { useEffect, useRef, useState } from 'react';

export default function LiveDetection({ onEvent }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [latest, setLatest] = useState(null);

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

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const { lat, lng } = await getLocation();
    const frameBase64 = canvas.toDataURL('image/jpeg', 0.7);
    wsRef.current.send(JSON.stringify({ frameBase64, lat, lng }));
  };

  const connectSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/realtime`);

    socket.onopen = () => {
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
        setStatus('WebSocket disconnected');
      }
    };

    wsRef.current = socket;
  };

  const start = async () => {
    try {
      setStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      connectSocket();
      setRunning(true);
      setStatus('Connecting realtime socket...');

      timerRef.current = setInterval(async () => {
        try {
          await captureAndSend();
        } catch (error) {
          setStatus(`Detection error: ${error.message}`);
        }
      }, 1200);
    } catch (error) {
      setStatus(`Cannot open camera: ${error.message}`);
    }
  };

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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

  return (
    <section className="card">
      <h2>Live Dashcam Detection</h2>
      <div className="button-row">
        <button type="button" onClick={start} disabled={running}>Start Live</button>
        <button type="button" onClick={stop} disabled={!running}>Stop</button>
      </div>

      <video ref={videoRef} autoPlay muted playsInline className="camera-view" />
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
