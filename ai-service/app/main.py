from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class FrameData(BaseModel):
    message: str

@app.get("/")
def root():
    return {"status": "AI Service running ✅"}

@app.post("/analyze-frame")
def analyze_frame(data: FrameData):
    # Later: webcam frame processing (OpenCV + mediapipe)
    return {"result": "Normal", "info": data.message}
