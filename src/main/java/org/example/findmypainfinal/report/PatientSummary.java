package org.example.findmypainfinal.report;

public record PatientSummary(
        String age,
        String biologicalSex,
        String painOnset,
        String chronicConditions,
        String medications
) {
}
