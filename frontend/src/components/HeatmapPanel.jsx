import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';

function confidenceColor(confidence) {
  if (confidence >= 0.85) return '#ff1f1f';
  if (confidence >= 0.7) return '#ff7a1a';
  return '#f1c40f';
}

export default function HeatmapPanel({ events }) {
  const points = (events || []).filter(
    (item) => item.potholeDetected && typeof item.latitude === 'number' && typeof item.longitude === 'number'
  );

  const center = points.length > 0
    ? [points[0].latitude, points[0].longitude]
    : [28.6139, 77.209];

  return (
    <section className="card map-card">
      <h2>Pothole Heatmap</h2>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((event) => (
          <CircleMarker
            key={event.id}
            center={[event.latitude, event.longitude]}
            radius={6 + Math.round(event.confidence * 10)}
            pathOptions={{ color: confidenceColor(event.confidence), fillOpacity: 0.6 }}
          >
            <Popup>
              <div>
                <div><strong>Confidence:</strong> {(event.confidence * 100).toFixed(1)}%</div>
                <div><strong>Time:</strong> {new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <p className="map-meta">
        Detected map points: <strong>{points.length}</strong>
        {points.length === 0 ? ' • Start live detection and allow location access to plot points.' : ''}
      </p>
    </section>
  );
}
