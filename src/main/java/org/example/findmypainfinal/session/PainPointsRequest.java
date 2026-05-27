package org.example.findmypainfinal.session;

import java.util.List;

public record PainPointsRequest(
        String sessionId,
        List<PainPoint> painPoints
) {
}
