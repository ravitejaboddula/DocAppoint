package com.docappoint.chatbot.controller;

import com.docappoint.chatbot.dto.ChatbotRequest;
import com.docappoint.chatbot.dto.ChatbotResponse;
import com.docappoint.chatbot.service.ChatbotService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/chatbot")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class ChatbotController {

    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping("/analyze")
    public ResponseEntity<ChatbotResponse> analyzeSymptoms(@Valid @RequestBody ChatbotRequest request) {
        log.info("Received symptom analysis request");
        ChatbotResponse response = chatbotService.analyzeSymptoms(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Chatbot service is running");
    }
}
