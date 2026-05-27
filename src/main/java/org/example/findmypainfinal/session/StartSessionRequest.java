package org.example.findmypainfinal.session;

public record StartSessionRequest(
        String age,
        String biologicalSex,
        String painOnset,
        String chronicConditions,
        String medications
) {
}
