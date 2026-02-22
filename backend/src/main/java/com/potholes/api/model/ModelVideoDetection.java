package com.potholes.api.model;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ModelVideoDetection {
    @JsonAlias("pothole_detected")
    private boolean potholeDetected;
    private double confidence;
    private Long timestamp;
    private int[] bbox;

    public boolean isPotholeDetected() {
        return potholeDetected;
    }

    public void setPotholeDetected(boolean potholeDetected) {
        this.potholeDetected = potholeDetected;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }

    public int[] getBbox() {
        return bbox;
    }

    public void setBbox(int[] bbox) {
        this.bbox = bbox;
    }
}
