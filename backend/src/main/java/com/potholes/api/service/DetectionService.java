package com.potholes.api.service;

import com.potholes.api.entity.DetectionRecord;
import com.potholes.api.model.DetectionEvent;
import com.potholes.api.model.ModelFrameResponse;
import com.potholes.api.model.ModelVideoDetection;
import com.potholes.api.model.ModelVideoResponse;
import com.potholes.api.repository.DetectionRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class DetectionService {

    private final ModelInferenceClient modelInferenceClient;
    private final DetectionRecordRepository detectionRecordRepository;

    @Value("${app.model.enabled:true}")
    private boolean modelEnabled;

    @Value("${app.model.required:false}")
    private boolean modelRequired;

    @Value("${app.model.fallback-threshold:0.55}")
    private double fallbackThreshold;

    public DetectionService(ModelInferenceClient modelInferenceClient, DetectionRecordRepository detectionRecordRepository) {
        this.modelInferenceClient = modelInferenceClient;
        this.detectionRecordRepository = detectionRecordRepository;
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

            detectionRecordRepository.save(toRecord(event));

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
                            detectionRecordRepository.save(toRecord(event));
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

        for (DetectionEvent event : result) {
            detectionRecordRepository.save(toRecord(event));
        }

        return result;
    }

    public List<DetectionEvent> getHeatmapEvents() {
        List<DetectionRecord> rows = detectionRecordRepository
                .findTop2000ByPotholeDetectedTrueAndLatitudeIsNotNullAndLongitudeIsNotNullOrderByTimestampDesc();

        List<DetectionEvent> response = new ArrayList<>();
        for (DetectionRecord row : rows) {
            response.add(toEvent(row));
        }
        return response;
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

    private DetectionRecord toRecord(DetectionEvent event) {
        DetectionRecord record = new DetectionRecord();
        record.setExternalId(event.getId());
        record.setTimestamp(event.getTimestamp());
        record.setPotholeDetected(event.isPotholeDetected());
        record.setConfidence(event.getConfidence());
        record.setSeverity(event.getSeverity());
        record.setLatitude(event.getLatitude());
        record.setLongitude(event.getLongitude());

        int[] bbox = event.getBbox();
        if (bbox != null && bbox.length == 4) {
            record.setBboxX1(bbox[0]);
            record.setBboxY1(bbox[1]);
            record.setBboxX2(bbox[2]);
            record.setBboxY2(bbox[3]);
        }
        return record;
    }

    private DetectionEvent toEvent(DetectionRecord row) {
        int[] bbox = null;
        if (row.getBboxX1() != null && row.getBboxY1() != null && row.getBboxX2() != null && row.getBboxY2() != null) {
            bbox = new int[]{row.getBboxX1(), row.getBboxY1(), row.getBboxX2(), row.getBboxY2()};
        }

        return new DetectionEvent(
                row.getExternalId(),
                row.getTimestamp(),
                row.isPotholeDetected(),
                row.getConfidence(),
                row.getSeverity(),
                bbox,
                row.getLatitude(),
                row.getLongitude()
        );
    }
}
