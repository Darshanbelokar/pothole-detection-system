# Pothole Detection App (React + Spring Boot)

This project has:
- `frontend` (React + Vite): upload dashcam video, start live camera, and view potholes on a map
- `backend` (Spring Boot): API endpoints for video detection, live frame detection, and heatmap points

## Backend API

Base URL: `http://localhost:8080/api`

- `GET /health`
- `POST /detections/video` (multipart `video`)
- `POST /detections/frame` (multipart `frame`, optional `lat`, `lng`)
- `POST /detections/realtime` (same as `/detections/frame`, for dashcam stream)
- `GET /detections/heatmap`

## Backend Architecture (Implemented)

1. **Framework**: Spring Boot (Java)
2. **Realtime Processing**:
	- receives frame from dashcam over WebSocket (`/ws/realtime`) or HTTP (`/api/detections/realtime`)
	- forwards frame to model service
	- returns `potholeDetected`, `confidence`, `bbox`, `severity`, `timestamp`
3. **ML Integration**:
	- backend calls model API endpoints:
	  - `/predict/frame`
	  - `/predict/video`
4. **GPS Capture**:
	- accepts `lat` and `lng` from frontend
	- stores latitude/longitude + timestamp + severity
5. **Storage (PostgreSQL)**:
	- detection events are persisted in PostgreSQL
	- heatmap data is loaded from persisted records

## Run Backend

```bash
cd backend
mvn spring-boot:run
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Integrate Your Trained Model (Realtime)

Backend is now wired to call an external model service for frame/video inference.

### Model Service Contract

Backend sends multipart requests to your model server:

- `POST http://localhost:8000/predict/frame`
	- form-data: `frame` (image file)
	- response JSON:
	```json
	{
		"potholeDetected": true,
		"confidence": 0.91
	}
	```

- `POST http://localhost:8000/predict/video`
	- form-data: `video` (video file)
	- response JSON:
	```json
	{
		"detections": [
			{ "potholeDetected": true, "confidence": 0.87, "timestamp": 1739871111222 },
			{ "potholeDetected": false, "confidence": 0.21, "timestamp": 1739871111622 }
		]
	}
	```

### Backend Configuration

In `backend/src/main/resources/application.properties`:

- `spring.datasource.url=${DATABASE_URL:jdbc:postgresql://localhost:5432/potholes_db}`
- `spring.datasource.username=${DB_USER:postgres}`
- `spring.datasource.password=${DB_PASSWORD:postgres}`
- `spring.jpa.hibernate.ddl-auto=update`

- `app.model.enabled=true`
- `app.model.required=false`
- `app.model.base-url=http://localhost:8000`
- `app.model.frame-endpoint=/predict/frame`
- `app.model.video-endpoint=/predict/video`
- `app.model.fallback-threshold=0.55`

If `app.model.required=true`, backend returns error when model service is unavailable.
If `false`, backend falls back to placeholder scoring.

### Realtime Flow

1. Frontend captures live camera frame every ~1.2 seconds.
2. Frontend sends frame (+ GPS lat/lng) to backend WebSocket `/ws/realtime`.
3. Backend forwards frame to model service.
4. If pothole detected, event is stored for `/api/detections/heatmap`.
5. Frontend refreshes heatmap periodically and displays detected points.

## Start All Services Together

Open 3 terminals:

1. Model service
```bash
cd model-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

2. Backend
```bash
cd backend
..\tools\apache-maven-3.9.9\bin\mvn.cmd spring-boot:run
```

3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Open Website on Phone

1. Ensure phone and laptop are on the same Wi-Fi network.
2. Run frontend (`npm run dev`) from `frontend`.
3. Open the Vite network URL shown in terminal on your phone browser.

Example:
- `http://192.168.1.11:5173/`

If phone cannot open the site, allow Node.js/terminal through Windows Firewall for private networks.
