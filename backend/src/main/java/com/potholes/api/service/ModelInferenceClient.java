package com.potholes.api.service;

import com.potholes.api.model.ModelFrameResponse;
import com.potholes.api.model.ModelVideoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class ModelInferenceClient {

    private final RestTemplate restTemplate;

    public ModelInferenceClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    @Value("${app.model.base-url:http://localhost:8000}")
    private String baseUrl;

    @Value("${app.model.backup-base-url:https://soothing-luck-production.up.railway.app}")
    private String backupBaseUrl;

    @Value("${app.model.frame-endpoint:/predict/frame}")
    private String frameEndpoint;

    @Value("${app.model.video-endpoint:/predict/video}")
    private String videoEndpoint;

    public ModelFrameResponse predictFrame(byte[] frameBytes) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("frame", asNamedResource(frameBytes, "frame.jpg"));

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            return executeFrameInference(baseUrl, request);
        } catch (RuntimeException ex) {
            if (backupBaseUrl != null && !backupBaseUrl.isBlank() && !backupBaseUrl.equals(baseUrl)) {
                return executeFrameInference(backupBaseUrl, request);
            }
            throw ex;
        }
    }

    public ModelVideoResponse predictVideo(byte[] videoBytes) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("video", asNamedResource(videoBytes, "upload.mp4"));

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            return executeVideoInference(baseUrl, request);
        } catch (RuntimeException ex) {
            if (backupBaseUrl != null && !backupBaseUrl.isBlank() && !backupBaseUrl.equals(baseUrl)) {
                return executeVideoInference(backupBaseUrl, request);
            }
            throw ex;
        }
    }

    private ModelFrameResponse executeFrameInference(String currentBaseUrl, HttpEntity<MultiValueMap<String, Object>> request) {
        String url = UriComponentsBuilder.fromHttpUrl(currentBaseUrl).path(frameEndpoint).toUriString();

        try {
            ResponseEntity<ModelFrameResponse> response = restTemplate.postForEntity(url, request, ModelFrameResponse.class);
            ModelFrameResponse payload = response.getBody();
            if (payload == null) {
                throw new IllegalStateException("Model frame response is empty");
            }
            return payload;
        } catch (RestClientException ex) {
            throw new IllegalStateException("Model frame inference failed at " + currentBaseUrl + ": " + ex.getMessage(), ex);
        }
    }

    private ModelVideoResponse executeVideoInference(String currentBaseUrl, HttpEntity<MultiValueMap<String, Object>> request) {
        String url = UriComponentsBuilder.fromHttpUrl(currentBaseUrl).path(videoEndpoint).toUriString();

        try {
            ResponseEntity<ModelVideoResponse> response = restTemplate.postForEntity(url, request, ModelVideoResponse.class);
            ModelVideoResponse payload = response.getBody();
            if (payload == null) {
                throw new IllegalStateException("Model video response is empty");
            }
            return payload;
        } catch (RestClientException ex) {
            throw new IllegalStateException("Model video inference failed at " + currentBaseUrl + ": " + ex.getMessage(), ex);
        }
    }

    private ByteArrayResource asNamedResource(byte[] bytes, String filename) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }
}
