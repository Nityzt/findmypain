package org.example.findmypainfinal.chatAI;

import java.util.List;

public record ChatMessageResponse(
        String sessionId,
        String botMessage,
        boolean completed,
        String urgencyLevel,
        String frontendAction,
        List<String> redFlags,
        List<String> nextSteps,
        List<ChatTurn> history
) {
}