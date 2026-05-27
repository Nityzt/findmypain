package org.example.findmypainfinal.report;

import org.example.findmypainfinal.analyze.PainAssessmentEngine;
import org.example.findmypainfinal.session.AssessmentData;
import org.example.findmypainfinal.session.IntakeData;
import org.example.findmypainfinal.session.SessionData;
import org.example.findmypainfinal.session.SessionService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReportService {

    private final SessionService sessionService;
    private final PainAssessmentEngine assessmentEngine;

    public ReportService(SessionService sessionService, PainAssessmentEngine assessmentEngine) {
        this.sessionService = sessionService;
        this.assessmentEngine = assessmentEngine;
    }

    public ReportResponse generateReport(ReportRequest request) {
        SessionData session = sessionService.requireSession(request.sessionId());
        AssessmentData assessment = session.getAssessment();

        if (assessment == null) {
            List<String> answers = session.userAnswers();
            List<String> redFlags = assessmentEngine.detectRedFlags(answers);
            String urgency = assessmentEngine.determineUrgencyLevel(answers, redFlags);
            assessment = new AssessmentData(
                    urgency,
                    assessmentEngine.buildDifferentials(urgency),
                    assessmentEngine.buildNextSteps(urgency)
            );
            session.setAssessment(assessment);
        }

        IntakeData intake = session.getIntake();
        PatientSummary patient = new PatientSummary(
                intake.age(),
                intake.biologicalSex(),
                intake.painOnset(),
                intake.chronicConditions(),
                intake.medications()
        );

        return new ReportResponse(
                patient,
                session.getPainPoints(),
                assessment
        );
    }
}
