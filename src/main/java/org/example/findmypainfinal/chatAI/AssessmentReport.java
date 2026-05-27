package org.example.findmypainfinal.chatAI;

import java.util.List;

public record AssessmentReport(
        String sessionId,
        String bodyPart,
        String urgencyLevel,
        List<String> answers,
        List<String> redFlags,
        List<String> nextSteps,
        String disclaimer
) {
}
