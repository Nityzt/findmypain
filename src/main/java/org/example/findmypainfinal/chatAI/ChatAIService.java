package org.example.findmypainfinal.chatAI;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatAIService {

    private final Map<String, AssessmentSession> sessions = new ConcurrentHashMap<>();

    private final List<String> kneeQuestions = List.of(
            "Hey, I’m FindMyPain AI. Tell me what happened with your knee pain.",
            "Okay, I’m focusing on the knee now. Did the pain start after a twist, fall, direct impact, or did it come out of nowhere?",
            "Can you put weight on that leg and walk normally, or is walking difficult?",
            "Do you notice swelling around the knee?",
            "Did you feel or hear a pop when the pain started?",
            "Does your knee feel unstable, like it might give out?",
            "On a scale from 1 to 10, how severe is the pain right now?",
            "Any numbness, tingling, fever, major bruising, or does the knee look deformed?"
    );

    public ChatMessageResponse startAssessment() {
        AssessmentSession session = new AssessmentSession();
        sessions.put(session.getSessionId(), session);
        String openingMessage = kneeQuestions.get(0);
        session.addAssistantTurn(openingMessage);

        return new ChatMessageResponse(
                session.getSessionId(),
                openingMessage,
                false,
                null,
                "START_ASSESSMENT",
                List.of(),
                List.of(),
                session.getHistory()
        );
    }

    public ChatMessageResponse processMessage(ChatMessageRequest request) {
        if (request.sessionId() == null || request.sessionId().isBlank()) {
            return startAssessment();
        }

        AssessmentSession session = sessions.get(request.sessionId());

        if (session == null) {
            return new ChatMessageResponse(
                    null,
                    "I couldn’t find that session. Please start a new assessment.",
                    true,
                    "UNKNOWN",
                    "SESSION_NOT_FOUND",
                    List.of(),
                    List.of("Start a new assessment."),
                    List.of()
            );
        }

        if (session.isCompleted()) {
            return buildFinalResponse(session);
        }

        String userMessage = sanitize(request.message());
        session.addAnswer(userMessage);
        session.addUserTurn(userMessage);

        if (shouldZoomToKnee(session)) {
            session.moveToNextQuestion();
            String nextQuestion = kneeQuestions.get(session.getQuestionIndex());
            String botMessage = "Got it. I’m going to focus on your knee and ask a targeted question now. " + nextQuestion;
            session.addAssistantTurn(botMessage);

            return new ChatMessageResponse(
                    session.getSessionId(),
                    botMessage,
                    false,
                    null,
                    "ZOOM_KNEE",
                    List.of(),
                    List.of(),
                    session.getHistory()
            );
        }

        if (hasImmediateRedFlag(userMessage)) {
            session.markCompleted();
            session.setUrgencyLevel("RED");
            return buildFinalResponse(session);
        }

        session.moveToNextQuestion();

        if (session.getQuestionIndex() >= kneeQuestions.size()) {
            session.markCompleted();
            session.setUrgencyLevel(determineUrgency(session.getAnswers(), detectRedFlags(session.getAnswers())));
            return buildFinalResponse(session);
        }

        String botMessage = addNaturalFiller(kneeQuestions.get(session.getQuestionIndex()));
        session.addAssistantTurn(botMessage);
        return new ChatMessageResponse(
                session.getSessionId(),
                botMessage,
                false,
                null,
                "ASK_NEXT_QUESTION",
                List.of(),
                List.of(),
                session.getHistory()
        );
    }

    public AssessmentReport generateReport(String sessionId) {
        AssessmentSession session = sessions.get(sessionId);

        if (session == null) {
            return new AssessmentReport(
                    null,
                    "Unknown",
                    "UNKNOWN",
                    List.of(),
                    List.of(),
                    List.of("Session not found."),
                    "This tool is not a diagnosis. Please consult a medical professional."
            );
        }

        List<String> redFlags = detectRedFlags(session.getAnswers());
        String urgency = session.getUrgencyLevel();

        if (urgency == null) {
            urgency = determineUrgency(session.getAnswers(), redFlags);
        }

        return new AssessmentReport(
                session.getSessionId(),
                session.getBodyPart(),
                urgency,
                session.getAnswers(),
                redFlags,
                buildNextSteps(urgency),
                "FindMyPain AI does not provide a medical diagnosis. It is a guidance tool. For serious, worsening, or concerning symptoms, seek professional medical care."
        );
    }

    private ChatMessageResponse buildFinalResponse(AssessmentSession session) {
        List<String> redFlags = detectRedFlags(session.getAnswers());

        String urgency = session.getUrgencyLevel();
        if (urgency == null) {
            urgency = determineUrgency(session.getAnswers(), redFlags);
            session.setUrgencyLevel(urgency);
        }

        String botMessage = switch (urgency) {
            case "RED" -> "Based on what you described, there may be red flags. This is not a diagnosis, but you should consider urgent medical care, especially if walking is difficult, swelling is severe, or the knee feels unstable.";
            case "YELLOW" -> "Your answers suggest moderate concern. It may not be an emergency, but you should rest, monitor symptoms, and consider seeing a clinician if it worsens or does not improve.";
            default -> "Your answers suggest a lower-risk pattern right now. Keep monitoring it and avoid activities that make the pain worse.";
        };
        appendAssistantTurnIfNew(session, botMessage);

        return new ChatMessageResponse(
                session.getSessionId(),
                botMessage,
                true,
                urgency,
                "SHOW_RESULT",
                redFlags,
                buildNextSteps(urgency),
                session.getHistory()
        );
    }

    private boolean shouldZoomToKnee(AssessmentSession session) {
        return session.getAnswers().size() == 1;
    }

    private String sanitize(String message) {
        if (message == null || message.isBlank()) {
            return "No answer provided.";
        }

        return message.trim();
    }

    private boolean hasImmediateRedFlag(String message) {
        String lower = message.toLowerCase();

        return lower.contains("can't walk")
                || lower.contains("cannot walk")
                || lower.contains("cant walk")
                || lower.contains("unable to walk")
                || lower.contains("can't stand")
                || lower.contains("cannot stand")
                || lower.contains("severe swelling")
                || lower.contains("deformed")
                || lower.contains("numb")
                || lower.contains("tingling")
                || lower.contains("unbearable")
                || lower.contains("extreme pain")
                || lower.contains("10 out of 10")
                || lower.equals("10");
    }

    private List<String> detectRedFlags(List<String> answers) {
        List<String> redFlags = new ArrayList<>();
        String allAnswers = String.join(" ", answers).toLowerCase();

        if (allAnswers.contains("can't walk")
                || allAnswers.contains("cannot walk")
                || allAnswers.contains("cant walk")
                || allAnswers.contains("unable to walk")) {
            redFlags.add("Difficulty bearing weight");
        }

        if (allAnswers.contains("severe swelling") || allAnswers.contains("swollen a lot")) {
            redFlags.add("Severe swelling");
        }

        if (allAnswers.contains("pop")) {
            redFlags.add("Pop sensation during injury");
        }

        if (allAnswers.contains("unstable")
                || allAnswers.contains("give out")
                || allAnswers.contains("giving out")) {
            redFlags.add("Knee instability");
        }

        if (allAnswers.contains("numb") || allAnswers.contains("tingling")) {
            redFlags.add("Numbness or tingling");
        }

        if (allAnswers.contains("deformed") || allAnswers.contains("looks wrong")) {
            redFlags.add("Possible deformity");
        }

        if (allAnswers.contains("unbearable")
                || allAnswers.contains("extreme pain")
                || allAnswers.contains("10 out of 10")) {
            redFlags.add("Extreme pain level");
        }

        return redFlags;
    }

    private String determineUrgency(List<String> answers, List<String> redFlags) {
        String allAnswers = String.join(" ", answers).toLowerCase();

        if (redFlags.size() >= 2) {
            return "RED";
        }

        if (allAnswers.contains("can't walk")
                || allAnswers.contains("cannot walk")
                || allAnswers.contains("cant walk")
                || allAnswers.contains("unable to walk")
                || allAnswers.contains("deformed")
                || allAnswers.contains("numb")) {
            return "RED";
        }

        if (!redFlags.isEmpty()) {
            return "YELLOW";
        }

        if (allAnswers.contains("7")
                || allAnswers.contains("8")
                || allAnswers.contains("9")
                || allAnswers.contains("swelling")
                || allAnswers.contains("twist")
                || allAnswers.contains("fall")
                || allAnswers.contains("impact")) {
            return "YELLOW";
        }

        return "GREEN";
    }

    private List<String> buildNextSteps(String urgency) {
        if ("RED".equals(urgency)) {
            return List.of(
                    "Stop activity immediately.",
                    "Avoid putting weight on the injured knee.",
                    "Consider urgent care or the ER if symptoms are severe.",
                    "Seek medical help quickly if the knee is unstable, severely swollen, numb, or deformed."
            );
        }

        if ("YELLOW".equals(urgency)) {
            return List.of(
                    "Rest the knee and avoid painful movement.",
                    "Use ice for 15–20 minutes at a time.",
                    "Monitor swelling, instability, and worsening pain.",
                    "Consider seeing a clinician if symptoms persist or worsen."
            );
        }

        return List.of(
                "Rest and monitor symptoms.",
                "Avoid intense activity for now.",
                "Use ice if there is soreness.",
                "Seek medical advice if pain worsens or new symptoms appear."
        );
    }

    private String addNaturalFiller(String question) {
        return "Okay, that helps. " + question;
    }

    private void appendAssistantTurnIfNew(AssessmentSession session, String message) {
        List<ChatTurn> history = session.getHistory();
        if (history.isEmpty()) {
            session.addAssistantTurn(message);
            return;
        }

        ChatTurn lastTurn = history.get(history.size() - 1);
        if (!"assistant".equals(lastTurn.role()) || !message.equals(lastTurn.content())) {
            session.addAssistantTurn(message);
        }
    }
}