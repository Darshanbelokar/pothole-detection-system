package com.potholes.api.model;

public class RealtimeFrameRequest {
    private String frameBase64;
    private Double lat;
    private Double lng;

    public String getFrameBase64() {
        return frameBase64;
    }

    public void setFrameBase64(String frameBase64) {
        this.frameBase64 = frameBase64;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }
}
