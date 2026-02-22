import { useEffect, useState } from 'react';
import HeatmapPanel from './components/HeatmapPanel';
import LiveDetection from './components/LiveDetection';
import VideoUpload from './components/VideoUpload';
import { checkHealth, fetchHeatmapEvents } from './services/api';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('Checking backend...');
  const [events, setEvents] = useState([]);

  const connected = backendStatus === 'Backend connected';
  const detectedCount = events.filter((event) => event.potholeDetected).length;

  const loadEvents = async () => {
    try {
      const list = await fetchHeatmapEvents();
      setEvents(list);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    checkHealth()
      .then(() => setBackendStatus('Backend connected'))
      .catch(() => setBackendStatus('Backend offline'));

    loadEvents();
    const timer = setInterval(loadEvents, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleLiveEvent = (event) => {
    setEvents((prev) => [event, ...prev].slice(0, 1500));
  };

  return (
    <div className="app-layout">
      <header className="top-header card">
        <div className="top-header-left">
          <p className="top-tag">Road Safety AI</p>
          <h2>RoadGuard Monitoring Console</h2>
        </div>
        <div className="top-header-right">
          <span>Live Detection</span>
          <span>Heatmap Analytics</span>
          <span>Dashcam Upload</span>
        </div>
      </header>

      <header className="app-header card">
        <div>
          <p className="eyebrow">Smart Road Monitoring</p>
          <h1>Pothole Detection Dashboard</h1>
        </div>

        <div className="header-metrics">
          <span className={`backend-pill ${connected ? 'ok' : 'warn'}`}>
            {backendStatus}
          </span>
          <span className="metric-chip">Events: {events.length}</span>
          <span className="metric-chip">Detected: {detectedCount}</span>
        </div>
      </header>

      <main className="grid">
        <VideoUpload />
        <LiveDetection onEvent={handleLiveEvent} />
        <HeatmapPanel events={events} />
      </main>

      <footer className="app-footer card">
        <p>Pothole Detection Dashboard • Real-time road monitoring and mapping</p>
        <p>© {new Date().getFullYear()} RoadGuard AI</p>
      </footer>
    </div>
  );
}
