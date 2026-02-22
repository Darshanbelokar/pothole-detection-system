package com.potholes.api.controller;

import com.potholes.api.model.DetectionEvent;
import com.potholes.api.service.DetectionService;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/detections")
@Validated
public class DetectionController {

    private final DetectionService detectionService;

    public DetectionController(DetectionService detectionService) {
        this.detectionService = detectionService;
    }

    @PostMapping(value = "/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> detectFromVideo(@RequestParam("video") @NotNull MultipartFile video) throws IOException {
        List<DetectionEvent> detections = detectionService.analyzeVideo(video);
        return ResponseEntity.ok(Map.of(
                "fileName", video.getOriginalFilename(),
                "detections", detections,
                "totalFramesChecked", detections.size(),
                "potholesFound", detections.stream().filter(DetectionEvent::isPotholeDetected).count()
        ));
    }

    @PostMapping(value = "/frame", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DetectionEvent> detectFromFrame(
            @RequestParam("frame") @NotNull MultipartFile frame,
            @RequestParam(value = "lat", required = false) Double latitude,
            @RequestParam(value = "lng", required = false) Double longitude
    ) throws IOException {
        return ResponseEntity.ok(detectionService.analyzeFrame(frame, latitude, longitude));
    }

    @PostMapping(value = "/realtime", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DetectionEvent> detectRealtime(
            @RequestParam("frame") @NotNull MultipartFile frame,
            @RequestParam(value = "lat", required = false) Double latitude,
            @RequestParam(value = "lng", required = false) Double longitude
    ) throws IOException {
        return ResponseEntity.ok(detectionService.analyzeFrame(frame, latitude, longitude));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<List<DetectionEvent>> heatmap() {
        return ResponseEntity.ok(detectionService.getHeatmapEvents());
    }
}
