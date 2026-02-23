// Use your latest Render URL (IMPORTANT: use -5 not -4)
const DEFAULT_BACKEND_BASE = 'https://pothole-detection-system-5.onrender.com';

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_BACKEND_BASE;

// ❌ REMOVE /api (your backend does not use /api prefix)
export const API_BASE = BACKEND_BASE;

export const WS_BASE = BACKEND_BASE.replace(/^http/, 'ws');

// ================= HEALTH =================
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Backend unavailable');
  }

  return response.json();
}

// ================= VIDEO =================
export async function uploadVideo(videoFile) {
  const formData = new FormData();
  formData.append('video', videoFile);

  const response = await fetch(`${API_BASE}/predict/video`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Video upload failed');
  }

  return response.json();
}

// ================= FRAME =================
export async function detectFrame(blob, lat, lng) {
  const formData = new FormData();
  formData.append('frame', blob, 'frame.jpg');

  if (typeof lat === 'number') {
    formData.append('lat', lat);
  }

  if (typeof lng === 'number') {
    formData.append('lng', lng);
  }

  const response = await fetch(`${API_BASE}/predict/frame`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Live detection failed');
  }

  return response.json();
}