package org.example.findmypainfinal.session;

import java.util.List;

public record AssessmentData(
        String urgency,
        List<String> differentials,
        List<String> nextSteps
) {
}
