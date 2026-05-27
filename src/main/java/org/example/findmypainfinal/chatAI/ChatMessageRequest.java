package org.example.findmypainfinal.chatAI;

public record ChatMessageRequest(
        String sessionId,
        String message
) {
}