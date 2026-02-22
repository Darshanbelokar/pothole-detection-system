package com.potholes.api.model;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ModelFrameResponse {
    @JsonAlias("pothole_detected")
    private boolean potholeDetected;
    private double confidence;
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

    public int[] getBbox() {
        return bbox;
    }

    public void setBbox(int[] bbox) {
        this.bbox = bbox;
    }
}
