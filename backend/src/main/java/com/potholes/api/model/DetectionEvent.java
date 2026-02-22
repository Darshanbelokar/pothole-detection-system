package com.potholes.api.model;

public class DetectionEvent {
    private String id;
    private long timestamp;
    private boolean potholeDetected;
    private double confidence;
    private String severity;
    private int[] bbox;
    private Double latitude;
    private Double longitude;

    public DetectionEvent() {
    }

    public DetectionEvent(String id, long timestamp, boolean potholeDetected, double confidence, String severity, int[] bbox, Double latitude, Double longitude) {
        this.id = id;
        this.timestamp = timestamp;
        this.potholeDetected = potholeDetected;
        this.confidence = confidence;
        this.severity = severity;
        this.bbox = bbox;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

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

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public int[] getBbox() {
        return bbox;
    }

    public void setBbox(int[] bbox) {
        this.bbox = bbox;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }
}
