package org.example.findmypainfinal.chatAI;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class AssessmentSession {

    private final String sessionId;
    private final String bodyPart;
    private int questionIndex;
    private final List<String> answers;
    private final List<ChatTurn> history;
    private boolean completed;
    private String urgencyLevel;

    public AssessmentSession() {
        this.sessionId = UUID.randomUUID().toString();
        this.bodyPart = "Right Knee";
        this.questionIndex = 0;
        this.answers = new ArrayList<>();
        this.history = new ArrayList<>();
        this.completed = false;
        this.urgencyLevel = null;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getBodyPart() {
        return bodyPart;
    }

    public int getQuestionIndex() {
        return questionIndex;
    }

    public void moveToNextQuestion() {
        this.questionIndex++;
    }

    public List<String> getAnswers() {
        return answers;
    }

    public void addAnswer(String answer) {
        this.answers.add(answer);
    }

    public List<ChatTurn> getHistory() {
        return history;
    }

    public void addUserTurn(String content) {
        this.history.add(new ChatTurn("user", content));
    }

    public void addAssistantTurn(String content) {
        this.history.add(new ChatTurn("assistant", content));
    }

    public boolean isCompleted() {
        return completed;
    }

    public void markCompleted() {
        this.completed = true;
    }

    public String getUrgencyLevel() {
        return urgencyLevel;
    }

    public void setUrgencyLevel(String urgencyLevel) {
        this.urgencyLevel = urgencyLevel;
    }
}