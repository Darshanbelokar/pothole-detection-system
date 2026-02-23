import os
import tempfile
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO

app = FastAPI()
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
        return False, 0.0, None

    result = model.predict(
        source=frame,
        conf=MODEL_CONF,
        iou=MODEL_IOU,
        imgsz=MODEL_IMGSZ,
        verbose=False
    )[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return False, 0.0, None

    conf_tensor = boxes.conf
    best_index = int(conf_tensor.argmax().item())
    best_conf = float(conf_tensor[best_index].item())
    best_box = boxes.xyxy[best_index].tolist()
    bbox = [int(best_box[0]), int(best_box[1]), int(best_box[2]), int(best_box[3])]

    return True, best_conf, bbox


@app.post("/predict/frame")
async def predict_frame(frame: UploadFile = File(...)):
    image_bytes = await frame.read()
    detected, confidence, bbox = infer_image_bytes(image_bytes)

    return {
        "potholeDetected": detected,
        "confidence": round(confidence, 4),
        "bbox": bbox
    }


@app.post("/predict/video")
async def predict_video(video: UploadFile = File(...)):
    suffix = os.path.splitext(video.filename or "upload.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        temp_file.write(await video.read())

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

    return {"detections": detections}