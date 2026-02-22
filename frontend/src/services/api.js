const API_BASE = import.meta.env.VITE_API_URL + '/api';

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Backend unavailable');
  }
  return response.json();
}

export async function uploadVideo(videoFile) {
  const formData = new FormData();
  formData.append('video', videoFile);

  const response = await fetch(`${API_BASE}/detections/video`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Video upload failed');
  }

  return response.json();
}

export async function detectFrame(blob, lat, lng) {
  const formData = new FormData();
  formData.append('frame', blob, 'frame.jpg');

  if (typeof lat === 'number') {
    formData.append('lat', lat);
  }
  if (typeof lng === 'number') {
    formData.append('lng', lng);
  }

  const response = await fetch(`${API_BASE}/detections/frame`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Live detection failed');
  }

  return response.json();
}

export async function fetchHeatmapEvents() {
  const response = await fetch(`${API_BASE}/detections/heatmap`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to load heatmap data');
  }
  return response.json();
}