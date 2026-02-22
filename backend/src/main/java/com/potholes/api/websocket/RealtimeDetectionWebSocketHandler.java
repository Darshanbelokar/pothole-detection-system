package com.potholes.api.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.potholes.api.model.DetectionEvent;
import com.potholes.api.model.RealtimeFrameRequest;
import com.potholes.api.service.DetectionService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Base64;

@Component
public class RealtimeDetectionWebSocketHandler extends TextWebSocketHandler {

    private final DetectionService detectionService;
    private final ObjectMapper objectMapper;

    public RealtimeDetectionWebSocketHandler(DetectionService detectionService, ObjectMapper objectMapper) {
        this.detectionService = detectionService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            RealtimeFrameRequest request = objectMapper.readValue(message.getPayload(), RealtimeFrameRequest.class);
            if (request.getFrameBase64() == null || request.getFrameBase64().isBlank()) {
                session.sendMessage(new TextMessage("{\"error\":\"frameBase64 is required\"}"));
                return;
            }

            byte[] frameBytes = decodeBase64Frame(request.getFrameBase64());
            DetectionEvent event = detectionService.analyzeFrame(frameBytes, request.getLat(), request.getLng());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(event)));
        } catch (Exception ex) {
            session.sendMessage(new TextMessage("{\"error\":\"" + escapeJson(ex.getMessage()) + "\"}"));
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.sendMessage(new TextMessage("{\"status\":\"connected\"}"));
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    private byte[] decodeBase64Frame(String input) {
        String payload = input;
        int commaIndex = input.indexOf(',');
        if (input.startsWith("data:") && commaIndex > -1) {
            payload = input.substring(commaIndex + 1);
        }
        return Base64.getDecoder().decode(payload);
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "unknown_error";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
