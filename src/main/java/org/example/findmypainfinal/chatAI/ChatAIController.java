package org.example.findmypainfinal.chatAI;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat-ai")
@CrossOrigin(origins = "*")
public class ChatAIController {

    private final ChatAIService chatAIService;

    public ChatAIController(ChatAIService chatAIService) {
        this.chatAIService = chatAIService;
    }

    @PostMapping("/start")
    public ResponseEntity<ChatMessageResponse> startAssessment() {
        return ResponseEntity.ok(chatAIService.startAssessment());
    }

    @PostMapping("/message")
    public ResponseEntity<ChatMessageResponse> sendMessage(@RequestBody ChatMessageRequest request) {
        return ResponseEntity.ok(chatAIService.processMessage(request));
    }

    @GetMapping("/report/{sessionId}")
    public ResponseEntity<AssessmentReport> getReport(@PathVariable String sessionId) {
        return ResponseEntity.ok(chatAIService.generateReport(sessionId));
    }
}