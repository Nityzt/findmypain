package org.example.findmypainfinal.session;

public record IntakeData(
        String age,
        String biologicalSex,
        String painOnset,
        String chronicConditions,
        String medications
) {
}
