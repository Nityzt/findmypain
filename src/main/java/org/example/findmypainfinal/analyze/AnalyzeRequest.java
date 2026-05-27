package org.example.findmypainfinal.analyze;

import org.example.findmypainfinal.session.ChatMessage;

import java.util.List;

public record AnalyzeRequest(
        String sessionId,
        String message,
        List<ChatMessage> history
) {
}
