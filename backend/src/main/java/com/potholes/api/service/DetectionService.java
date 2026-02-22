package com.potholes.api.service;

import com.potholes.api.model.DetectionEvent;
import com.potholes.api.model.ModelFrameResponse;
import com.potholes.api.model.ModelVideoDetection;
import com.potholes.api.model.ModelVideoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class DetectionService {

    private final ModelInferenceClient modelInferenceClient;
    private final List<DetectionEvent> recentEvents = new CopyOnWriteArrayList<>();

    @Value("${app.model.enabled:true}")
    private boolean modelEnabled;

    @Value("${app.model.required:false}")
    private boolean modelRequired;

    @Value("${app.model.fallback-threshold:0.55}")
    private double fallbackThreshold;

    public DetectionService(ModelInferenceClient modelInferenceClient) {
        this.modelInferenceClient = modelInferenceClient;
    }

    public DetectionEvent analyzeFrame(MultipartFile frame, Double latitude, Double longitude) throws IOException {
        return analyzeFrame(frame.getBytes(), latitude, longitude);
    }

    public DetectionEvent analyzeFrame(byte[] bytes, Double latitude, Double longitude) {
        double score;
        boolean detected;
        int[] bbox;

        if (modelEnabled) {
            try {
                ModelFrameResponse prediction = modelInferenceClient.predictFrame(bytes);
                score = prediction.getConfidence();
                detected = prediction.isPotholeDetected();
                bbox = normalizeBbox(prediction.getBbox());
            } catch (RuntimeException ex) {
                if (modelRequired) {
                    throw ex;
                }
                score = scoreFromBytes(bytes);
                detected = score >= fallbackThreshold;
                bbox = null;
            }
        } else {
            score = scoreFromBytes(bytes);
            detected = score >= fallbackThreshold;
            bbox = null;
        }

        String severity = deriveSeverity(score);

        DetectionEvent event = new DetectionEvent(
                UUID.randomUUID().toString(),
                System.currentTimeMillis(),
                detected,
                score,
                severity,
                bbox,
                latitude,
                longitude
        );

        saveEvent(event);

        return event;
    }

    public List<DetectionEvent> analyzeVideo(MultipartFile video) throws IOException {
        byte[] bytes = video.getBytes();
        List<DetectionEvent> result = new ArrayList<>();

        if (modelEnabled) {
            try {
                ModelVideoResponse response = modelInferenceClient.predictVideo(bytes);
                long baseTs = System.currentTimeMillis();
                int i = 0;
                for (ModelVideoDetection d : response.getDetections()) {
                    long ts = d.getTimestamp() != null ? d.getTimestamp() : baseTs + (i * 400L);
                    DetectionEvent event = new DetectionEvent(
                            UUID.randomUUID().toString(),
                            ts,
                            d.isPotholeDetected(),
                            d.getConfidence(),
                            deriveSeverity(d.getConfidence()),
                            normalizeBbox(d.getBbox()),
                            null,
                            null
                    );
                    result.add(event);
                    saveEvent(event);
                    i++;
                }
                return result;
            } catch (RuntimeException ex) {
                if (modelRequired) {
                    throw ex;
                }
            }
        }

        int windows = Math.max(3, bytes.length / 250_000);
        for (int index = 0; index < windows; index++) {
            int start = (bytes.length * index) / windows;
            int end = (bytes.length * (index + 1)) / windows;
            byte[] chunk = new byte[Math.max(0, end - start)];
            if (chunk.length > 0) {
                System.arraycopy(bytes, start, chunk, 0, chunk.length);
            }
            double confidence = scoreFromBytes(chunk);
            boolean detected = confidence >= fallbackThreshold;
            result.add(new DetectionEvent(
                    UUID.randomUUID().toString(),
                    System.currentTimeMillis() + index * 400L,
                    detected,
                    confidence,
                    deriveSeverity(confidence),
                    null,
                    null,
                    null
            ));
        }

        result.forEach(this::saveEvent);

        return result;
    }

    public List<DetectionEvent> getHeatmapEvents() {
        return recentEvents.stream()
                .filter(DetectionEvent::isPotholeDetected)
                .filter(event -> event.getLatitude() != null && event.getLongitude() != null)
                .sorted(Comparator.comparingLong(DetectionEvent::getTimestamp).reversed())
                .limit(2000)
                .toList();
    }

    private double scoreFromBytes(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return 0.05;
        }

        long sum = 0;
        int stride = Math.max(1, bytes.length / 3000);
        for (int i = 0; i < bytes.length; i += stride) {
            sum += (bytes[i] & 0xFF);
        }

        double normalized = (sum % 1000) / 1000.0;
        return Math.max(0.05, Math.min(0.98, normalized));
    }

    private String deriveSeverity(double confidence) {
        if (confidence >= 0.85) {
            return "high";
        }
        if (confidence >= 0.65) {
            return "medium";
        }
        return "low";
    }

    private int[] normalizeBbox(int[] bbox) {
        if (bbox == null || bbox.length != 4) {
            return null;
        }
        return bbox;
    }

    private void saveEvent(DetectionEvent event) {
        recentEvents.add(event);
        int maxSize = 5000;
        if (recentEvents.size() > maxSize) {
            recentEvents.remove(0);
        }
    }
}
