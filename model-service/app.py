from fastapi import FastAPI, File, UploadFile, HTTPException
from typing import List, Dict, Any
import numpy as np
import cv2
import time

app = FastAPI(title="Pothole Model Service", version="1.0.0")

# Replace these with your actual model loading/inference code.
# Example:
# model = torch.load("best.pt", map_location="cpu")
# model.eval()


def infer_frame_confidence(image_bgr: np.ndarray) -> float:
    if image_bgr is None or image_bgr.size == 0:
        return 0.0

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 70, 150)
    score = float(np.clip(edges.mean() / 255.0 * 1.8, 0.0, 1.0))
    return score


def infer_bbox(image_bgr: np.ndarray, confidence: float) -> list[int] | None:
    if confidence < 0.55:
        return None

    height, width = image_bgr.shape[:2]
    x1 = int(width * 0.35)
    y1 = int(height * 0.45)
    x2 = int(width * 0.65)
    y2 = int(height * 0.78)
    return [x1, y1, x2, y2]


def detect_pothole(confidence: float, threshold: float = 0.55) -> bool:
    return confidence >= threshold


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "UP"}


@app.post("/predict/frame")
async def predict_frame(frame: UploadFile = File(...)) -> Dict[str, Any]:
    raw = await frame.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty frame file")

    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    confidence = infer_frame_confidence(img)
    bbox = infer_bbox(img, confidence)
    detected = detect_pothole(confidence)
    return {
        "potholeDetected": detected,
        "pothole_detected": detected,
        "confidence": round(confidence, 4),
        "bbox": bbox
    }


@app.post("/predict/video")
async def predict_video(video: UploadFile = File(...)) -> Dict[str, List[Dict[str, Any]]]:
    raw = await video.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty video file")

    # Minimal sampling-based placeholder. Replace with your real video model pipeline.
    # For production, decode video frames and run model per frame/window.
    bucket_count = max(4, min(20, len(raw) // 250000))
    detections: List[Dict[str, Any]] = []
    base_ts = int(time.time() * 1000)

    for i in range(bucket_count):
        start = (len(raw) * i) // bucket_count
        end = (len(raw) * (i + 1)) // bucket_count
        chunk = raw[start:end]

        if len(chunk) == 0:
            confidence = 0.0
        else:
            sample = np.frombuffer(chunk[: min(5000, len(chunk))], dtype=np.uint8)
            confidence = float(np.clip(sample.mean() / 255.0, 0.0, 1.0))

        detected = detect_pothole(confidence, threshold=0.60)
        bbox = [160, 120, 280, 220] if detected else None

        detections.append({
            "potholeDetected": detected,
            "pothole_detected": detected,
            "confidence": round(confidence, 4),
            "timestamp": base_ts + i * 400,
            "bbox": bbox
        })

    return {"detections": detections}
