package org.example.findmypainfinal.session;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class SessionData {

    private final String sessionId;
    private final IntakeData intake;
    private final List<PainPoint> painPoints;
    private final List<ChatMessage> history;
    private AssessmentData assessment;
    private boolean conversationComplete;
    private int questionIndex;

    public SessionData(IntakeData intake) {
        this.sessionId = UUID.randomUUID().toString();
        this.intake = intake;
        this.painPoints = new ArrayList<>();
        this.history = new ArrayList<>();
        this.conversationComplete = false;
        this.questionIndex = 0;
    }

    public String getSessionId() {
        return sessionId;
    }

    public IntakeData getIntake() {
        return intake;
    }

    public List<PainPoint> getPainPoints() {
        return painPoints;
    }

    public void setPainPoints(List<PainPoint> painPoints) {
        this.painPoints.clear();
        if (painPoints != null) {
            this.painPoints.addAll(painPoints);
        }
    }

    public List<ChatMessage> getHistory() {
        return history;
    }

    public void syncHistory(List<ChatMessage> incoming) {
        if (incoming == null || incoming.isEmpty()) {
            return;
        }
        history.clear();
        history.addAll(incoming);
    }

    public void addMessage(ChatMessage message) {
        history.add(message);
    }

    public AssessmentData getAssessment() {
        return assessment;
    }

    public void setAssessment(AssessmentData assessment) {
        this.assessment = assessment;
    }

    public boolean isConversationComplete() {
        return conversationComplete;
    }

    public void markConversationComplete() {
        this.conversationComplete = true;
    }

    public int getQuestionIndex() {
        return questionIndex;
    }

    public void advanceQuestion() {
        this.questionIndex++;
    }

    public long userMessageCount() {
        return history.stream().filter(message -> "user".equals(message.role())).count();
    }

    public List<String> userAnswers() {
        return history.stream()
                .filter(message -> "user".equals(message.role()))
                .map(ChatMessage::content)
                .toList();
    }
}
