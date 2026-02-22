package com.potholes.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "detection_records")
public class DetectionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String externalId;

    @Column(nullable = false)
    private long timestamp;

    @Column(nullable = false)
    private boolean potholeDetected;

    @Column(nullable = false)
    private double confidence;

    @Column(length = 20)
    private String severity;

    private Integer bboxX1;
    private Integer bboxY1;
    private Integer bboxX2;
    private Integer bboxY2;

    private Double latitude;
    private Double longitude;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
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

    public Integer getBboxX1() {
        return bboxX1;
    }

    public void setBboxX1(Integer bboxX1) {
        this.bboxX1 = bboxX1;
    }

    public Integer getBboxY1() {
        return bboxY1;
    }

    public void setBboxY1(Integer bboxY1) {
        this.bboxY1 = bboxY1;
    }

    public Integer getBboxX2() {
        return bboxX2;
    }

    public void setBboxX2(Integer bboxX2) {
        this.bboxX2 = bboxX2;
    }

    public Integer getBboxY2() {
        return bboxY2;
    }

    public void setBboxY2(Integer bboxY2) {
        this.bboxY2 = bboxY2;
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
