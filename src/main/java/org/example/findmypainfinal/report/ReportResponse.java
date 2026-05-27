package org.example.findmypainfinal.report;

import org.example.findmypainfinal.session.AssessmentData;
import org.example.findmypainfinal.session.PainPoint;

import java.util.List;

public record ReportResponse(
        PatientSummary patient,
        List<PainPoint> painPoints,
        AssessmentData assessment
) {
}
