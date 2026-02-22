package com.potholes.api.model;

import java.util.ArrayList;
import java.util.List;

public class ModelVideoResponse {
    private List<ModelVideoDetection> detections = new ArrayList<>();

    public List<ModelVideoDetection> getDetections() {
        return detections;
    }

    public void setDetections(List<ModelVideoDetection> detections) {
        this.detections = detections;
    }
}
