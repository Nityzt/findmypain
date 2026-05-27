package org.example.findmypainfinal.analyze;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class PainAssessmentEngine {

    public boolean hasImmediateRedFlag(String message) {
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
                || lower.equals("10")
                || lower.contains("chest pain")
                || lower.contains("shortness of breath")
                || lower.contains("can't breathe")
                || lower.contains("cannot breathe");
    }

    public List<String> detectRedFlags(List<String> answers) {
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
            redFlags.add("Joint instability");
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

        if (allAnswers.contains("chest pain") || allAnswers.contains("shortness of breath")) {
            redFlags.add("Cardiopulmonary symptoms reported");
        }

        return redFlags;
    }

    public String determineUrgencyLevel(List<String> answers, List<String> redFlags) {
        String allAnswers = String.join(" ", answers).toLowerCase();

        if (redFlags.size() >= 2) {
            return "high";
        }

        if (allAnswers.contains("can't walk")
                || allAnswers.contains("cannot walk")
                || allAnswers.contains("cant walk")
                || allAnswers.contains("unable to walk")
                || allAnswers.contains("deformed")
                || allAnswers.contains("numb")
                || allAnswers.contains("chest pain")) {
            return "high";
        }

        if (!redFlags.isEmpty()) {
            return "moderate";
        }

        if (allAnswers.contains("7")
                || allAnswers.contains("8")
                || allAnswers.contains("9")
                || allAnswers.contains("swelling")
                || allAnswers.contains("twist")
                || allAnswers.contains("fall")
                || allAnswers.contains("impact")) {
            return "moderate";
        }

        return "low";
    }

    public List<String> buildDifferentials(String urgency) {
        return switch (urgency) {
            case "high" -> List.of(
                    "Acute injury requiring medical evaluation",
                    "Possible nerve involvement",
                    "Serious musculoskeletal or referred pain pattern"
            );
            case "moderate" -> List.of(
                    "Musculoskeletal strain",
                    "Nerve compression",
                    "Referred pain pattern"
            );
            default -> List.of(
                    "Muscle strain or overuse",
                    "Minor soft tissue irritation",
                    "Postural or activity-related discomfort"
            );
        };
    }

    public List<String> buildNextSteps(String urgency) {
        if ("high".equals(urgency)) {
            return List.of(
                    "Stop activity immediately.",
                    "Avoid putting weight on the affected area if movement is painful.",
                    "Consider urgent care or the ER if symptoms are severe or worsening.",
                    "Seek medical help quickly for numbness, deformity, or inability to bear weight."
            );
        }

        if ("moderate".equals(urgency)) {
            return List.of(
                    "Rest the affected area and avoid painful movement.",
                    "Use ice for 15-20 minutes at a time.",
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
}
