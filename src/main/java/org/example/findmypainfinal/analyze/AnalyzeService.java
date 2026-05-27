package org.example.findmypainfinal.analyze;

import org.example.findmypainfinal.session.AssessmentData;
import org.example.findmypainfinal.session.ChatMessage;
import org.example.findmypainfinal.session.PainPoint;
import org.example.findmypainfinal.session.SessionData;
import org.example.findmypainfinal.session.SessionService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AnalyzeService {

    private static final int COMPLETION_EXCHANGE_COUNT = 5;

    private final SessionService sessionService;
    private final PainAssessmentEngine assessmentEngine;

    private final List<String> followUpQuestions = List.of(
            "How long have you been experiencing this pain?",
            "On a scale from 1 to 10, how severe is the pain right now?",
            "Does the pain spread or radiate to any other areas?",
            "What seems to trigger or worsen the pain?",
            "Do you have any associated symptoms like numbness, tingling, nausea, or swelling?",
            "When does the pain tend to be worst — morning, during activity, or at rest?"
    );

    public AnalyzeService(SessionService sessionService, PainAssessmentEngine assessmentEngine) {
        this.sessionService = sessionService;
        this.assessmentEngine = assessmentEngine;
    }

    public AnalyzeResponse analyze(AnalyzeRequest request) {
        if (request.sessionId() == null || request.sessionId().isBlank()) {
            return new AnalyzeResponse(
                    "Please complete intake first so I can start your assessment.",
                    false
            );
        }

        SessionData session = sessionService.requireSession(request.sessionId());

        if (session.isConversationComplete()) {
            return new AnalyzeResponse(buildCompletionReply(session), true);
        }

        syncHistory(session, request);
        String userMessage = sanitize(request.message());
        appendUserMessageIfMissing(session, userMessage);

        if (assessmentEngine.hasImmediateRedFlag(userMessage)) {
            return completeSession(session, buildRedFlagReply());
        }

        long userCount = session.userMessageCount();
        if (userCount >= COMPLETION_EXCHANGE_COUNT) {
            return completeSession(session, buildCompletionReply(session));
        }

        String reply = buildNextQuestion(session, (int) userCount);
        session.addMessage(new ChatMessage("assistant", reply));
        session.advanceQuestion();
        return new AnalyzeResponse(reply, false);
    }

    private AnalyzeResponse completeSession(SessionData session, String reply) {
        List<String> answers = session.userAnswers();
        List<String> redFlags = assessmentEngine.detectRedFlags(answers);
        String urgency = assessmentEngine.determineUrgencyLevel(answers, redFlags);

        session.setAssessment(new AssessmentData(
                urgency,
                assessmentEngine.buildDifferentials(urgency),
                assessmentEngine.buildNextSteps(urgency)
        ));
        session.markConversationComplete();
        appendAssistantMessageIfMissing(session, reply);
        return new AnalyzeResponse(reply, true);
    }

    private void syncHistory(SessionData session, AnalyzeRequest request) {
        if (request.history() == null || request.history().isEmpty()) {
            return;
        }

        List<ChatMessage> normalized = request.history().stream()
                .filter(message -> message.role() != null && message.content() != null)
                .map(message -> new ChatMessage(message.role(), message.content().trim()))
                .toList();
        session.syncHistory(normalized);
    }

    private void appendUserMessageIfMissing(SessionData session, String userMessage) {
        List<ChatMessage> history = session.getHistory();
        if (!history.isEmpty()) {
            ChatMessage last = history.get(history.size() - 1);
            if ("user".equals(last.role()) && userMessage.equals(last.content())) {
                return;
            }
        }
        session.addMessage(new ChatMessage("user", userMessage));
    }

    private void appendAssistantMessageIfMissing(SessionData session, String reply) {
        List<ChatMessage> history = session.getHistory();
        if (!history.isEmpty()) {
            ChatMessage last = history.get(history.size() - 1);
            if ("assistant".equals(last.role()) && reply.equals(last.content())) {
                return;
            }
        }
        session.addMessage(new ChatMessage("assistant", reply));
    }

    private String buildNextQuestion(SessionData session, int userCount) {
        int questionIndex = Math.min(session.getQuestionIndex(), followUpQuestions.size() - 1);
        String question = followUpQuestions.get(questionIndex);

        if (userCount == 1) {
            return "Thanks for sharing that. " + regionAcknowledgement(session) + " " + question;
        }

        return "Okay, that helps. " + question;
    }

    private String regionAcknowledgement(SessionData session) {
        List<PainPoint> painPoints = session.getPainPoints();
        if (painPoints.isEmpty()) {
            return "Let's go through a few focused questions about your pain.";
        }

        String regions = painPoints.stream()
                .map(PainPoint::region)
                .collect(Collectors.joining(", "));
        return "I see you're experiencing pain in " + regions + ".";
    }

    private String buildRedFlagReply() {
        return "Based on what you described, there may be red flags. This is not a diagnosis, "
                + "but you should consider urgent medical care if symptoms are severe or worsening. "
                + "I think I have enough to generate your report.";
    }

    private String buildCompletionReply(SessionData session) {
        String urgency = session.getAssessment() == null
                ? assessmentEngine.determineUrgencyLevel(
                        session.userAnswers(),
                        assessmentEngine.detectRedFlags(session.userAnswers()))
                : session.getAssessment().urgency();

        return switch (urgency) {
            case "high" -> "Thank you for answering those questions. Some of your symptoms may need prompt medical attention. "
                    + "I'd recommend speaking with a doctor about this. I think I have enough to generate your report.";
            case "moderate" -> "Thank you — that gives me a clearer picture. It may not be an emergency, "
                    + "but I'd recommend speaking with a doctor if symptoms persist or worsen. "
                    + "I think I have enough to generate your report.";
            default -> "Thank you for sharing those details. Your answers suggest a lower-risk pattern right now, "
                    + "but I'd still recommend speaking with a doctor if anything changes. "
                    + "I think I have enough to generate your report.";
        };
    }

    private String sanitize(String message) {
        if (message == null || message.isBlank()) {
            return "No answer provided.";
        }
        return message.trim();
    }
}
