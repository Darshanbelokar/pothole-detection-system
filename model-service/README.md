# Model Service (FastAPI)

This service provides model inference endpoints used by Spring Boot backend:

- `POST /predict/frame` (multipart field: `frame`)
- `POST /predict/video` (multipart field: `video`)
- `GET /health`

## Run

```bash
cd model-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Plug in your trained model

Edit `app.py`:

1. Load your model once at startup.
2. Replace `infer_frame_confidence(...)` with actual inference.
3. Replace `/predict/video` logic with frame/window inference from your trained pipeline.
4. Keep response JSON keys exactly same:
   - `potholeDetected` (boolean)
   - `confidence` (0 to 1 float)
   - `timestamp` (milliseconds, for video detections)

## Backend connection

Spring Boot is already configured to call:
- `http://localhost:8000/predict/frame`
- `http://localhost:8000/predict/video`

If your model runs elsewhere, update:
`backend/src/main/resources/application.properties`

- `app.model.base-url`
- `app.model.frame-endpoint`
- `app.model.video-endpoint`
