import os
import tempfile
import time
import logging

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("pothole-model")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("model/best.pt")
MODEL_CONF = float(os.getenv("YOLO_CONF", "0.15"))
MODEL_IOU = float(os.getenv("YOLO_IOU", "0.45"))
MODEL_IMGSZ = int(os.getenv("YOLO_IMGSZ", "960"))


@app.get("/health")
def health():
    return {"status": "UP"}


def infer_image_bytes(image_bytes: bytes):
    image_np = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
    if frame is None:
        return False, 0.0, None, []

    result = model.predict(
        source=frame,
        conf=MODEL_CONF,
        iou=MODEL_IOU,
        imgsz=MODEL_IMGSZ,
        verbose=False
    )[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return False, 0.0, None, []

    all_bboxes = []
    for box in boxes.xyxy.tolist():
        all_bboxes.append([
            int(box[0]),
            int(box[1]),
            int(box[2]),
            int(box[3]),
        ])

    conf_tensor = boxes.conf
    best_index = int(conf_tensor.argmax().item())
    best_conf = float(conf_tensor[best_index].item())
    best_box = boxes.xyxy[best_index].tolist()
    bbox = [int(best_box[0]), int(best_box[1]), int(best_box[2]), int(best_box[3])]

    return True, best_conf, bbox, all_bboxes


@app.post("/predict/frame")
async def predict_frame(frame: UploadFile = File(...)):
    started = time.time()
    image_bytes = await frame.read()
    detected, confidence, bbox, bboxes = infer_image_bytes(image_bytes)
    elapsed_ms = int((time.time() - started) * 1000)

    logger.info(
        "frame filename=%s bytes=%d detected=%s confidence=%.4f bbox=%s elapsedMs=%d",
        frame.filename,
        len(image_bytes),
        detected,
        confidence,
        bboxes,
        elapsed_ms,
    )

    return {
        "potholeDetected": detected,
        "confidence": round(confidence, 4),
        "bbox": bbox,
        "bboxes": bboxes
    }


@app.post("/predict/video")
async def predict_video(video: UploadFile = File(...)):
    started = time.time()
    suffix = os.path.splitext(video.filename or "upload.mp4")[1] or ".mp4"
    video_bytes = await video.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        temp_file.write(video_bytes)

    detections = []
    cap = cv2.VideoCapture(temp_path)

    try:
        frame_index = 0
        sample_every = 10
        base_ts = int(time.time() * 1000)

        while cap.isOpened():
            ok, frame = cap.read()
            if not ok:
                break

            if frame_index % sample_every == 0:
                result = model.predict(
                    source=frame,
                    conf=MODEL_CONF,
                    iou=MODEL_IOU,
                    imgsz=MODEL_IMGSZ,
                    verbose=False
                )[0]
                boxes = result.boxes

                if boxes is not None and len(boxes) > 0:
                    conf_tensor = boxes.conf
                    best_index = int(conf_tensor.argmax().item())
                    best_conf = float(conf_tensor[best_index].item())
                    best_box = boxes.xyxy[best_index].tolist()
                    bbox = [int(best_box[0]), int(best_box[1]), int(best_box[2]), int(best_box[3])]

                    detections.append({
                        "potholeDetected": True,
                        "confidence": round(best_conf, 4),
                        "timestamp": base_ts + (frame_index * 33),
                        "bbox": bbox
                    })
                else:
                    detections.append({
                        "potholeDetected": False,
                        "confidence": 0.0,
                        "timestamp": base_ts + (frame_index * 33),
                        "bbox": None
                    })

            frame_index += 1
    finally:
        cap.release()
        if os.path.exists(temp_path):
            os.remove(temp_path)

    positives = sum(1 for item in detections if item.get("potholeDetected"))
    elapsed_ms = int((time.time() - started) * 1000)
    logger.info(
        "video filename=%s bytes=%d detections=%d positives=%d elapsedMs=%d",
        video.filename,
        len(video_bytes),
        len(detections),
        positives,
        elapsed_ms,
    )

    return {"detections": detections}