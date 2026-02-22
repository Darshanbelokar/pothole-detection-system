from fastapi import FastAPI
from ultralytics import YOLO

app = FastAPI()

model = YOLO("model/best.pt")

@app.get("/health")
def health():
    return {"status": "UP"}

@app.post("/predict")
def predict():
    # inference logic
    return {"message": "prediction done"}