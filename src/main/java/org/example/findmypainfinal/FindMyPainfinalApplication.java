package org.example.findmypainfinal;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class FindMyPainfinalApplication {

    public static void main(String[] args) {
        SpringApplication.run(FindMyPainfinalApplication.class, args);
    }

}

@RestController
class VapiVoiceAgentController {

    private final VapiPainVoiceAgent voiceAgent = new VapiPainVoiceAgent();

    @PostMapping("/api/vapi/server")
    ResponseEntity<Map<String, Object>> handleVapiServerMessage(@RequestBody VapiServerRequest request) {
        String messageType = request.message() == null ? null : request.message().type();

        if ("assistant-request".equals(messageType)) {
            return ResponseEntity.ok(Map.of(
                    "messageResponse", Map.of("assistant", voiceAgent.assistantConfig())
            ));
        }

        if ("tool-calls".equals(messageType)) {
            return ResponseEntity.ok(Map.of(
                    "messageResponse", Map.of("results", voiceAgent.handleToolCalls(request.message().toolCallList()))
            ));
        }

        return ResponseEntity.ok(Map.of());
    }
}

class VapiPainVoiceAgent {

    private static final String SYSTEM_PROMPT = """
            You are FindMyPain, a careful voice assistant that helps users describe pain clearly.
            Keep responses brief enough to be spoken aloud.
            Ask one or two focused follow-up questions.
            Do not diagnose. Encourage urgent medical care for red-flag symptoms.
            """;

    Map<String, Object> assistantConfig() {
        return Map.of(
                "name", "FindMyPain Voice Agent",
                "firstMessage", "Hi, I am FindMyPain. Tell me where you feel pain and what it feels like.",
                "transcriber", Map.of(
                        "provider", "deepgram",
                        "model", "nova-3",
                        "language", "en"
                ),
                "model", Map.of(
                        "provider", "openai",
                        "model", "gpt-4.1-mini",
                        "messages", List.of(Map.of(
                                "role", "system",
                                "content", SYSTEM_PROMPT
                        )),
                        "tools", List.of(painTriageTool())
                ),
                "voice", Map.of(
                        "provider", "vapi",
                        "voiceId", "Elliot"
                )
        );
    }

    List<Map<String, Object>> handleToolCalls(List<VapiToolCall> toolCalls) {
        if (toolCalls == null || toolCalls.isEmpty()) {
            return List.of();
        }

        return toolCalls.stream()
                .map(this::handleToolCall)
                .toList();
    }

    private Map<String, Object> handleToolCall(VapiToolCall toolCall) {
        String toolCallId = safeValue(toolCall.id(), "missing-tool-call-id");
        String toolName = toolCall.function() == null ? "unknown" : safeValue(toolCall.function().name(), "unknown");
        String arguments = toolCall.function() == null ? "" : safeValue(toolCall.function().arguments(), "");

        if (!"triagePain".equals(toolName)) {
            return Map.of(
                    "toolCallId", toolCallId,
                    "name", toolName,
                    "error", "Unsupported tool: " + toolName
            );
        }

        boolean urgentCareRecommended = containsUrgentSymptom(arguments);
        String result = urgentCareRecommended
                ? "Red flags may be present. Tell the user to seek emergency medical care if symptoms are severe, sudden, or worsening, then collect location, severity, onset, and quality of pain."
                : "No obvious red-flag terms were detected. Continue collecting pain location, severity from 1 to 10, onset, pain quality, and associated symptoms.";

        return Map.of(
                "toolCallId", toolCallId,
                "name", toolName,
                "result", result
        );
    }

    private Map<String, Object> painTriageTool() {
        return Map.of(
                "type", "function",
                "function", Map.of(
                        "name", "triagePain",
                        "description", "Checks a user's pain description for urgent red-flag symptoms and returns guidance for the next spoken response.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "painDescription", Map.of(
                                                "type", "string",
                                                "description", "The user's latest spoken pain description."
                                        )
                                ),
                                "required", List.of("painDescription")
                        )
                ),
                "messages", List.of(Map.of(
                        "type", "request-start",
                        "content", "Let me quickly check for urgent warning signs."
                ))
        );
    }

    private boolean containsUrgentSymptom(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return false;
        }

        String normalizedTranscript = transcript.toLowerCase(Locale.ROOT);

        return normalizedTranscript.contains("chest pain")
                || normalizedTranscript.contains("shortness of breath")
                || normalizedTranscript.contains("can't breathe")
                || normalizedTranscript.contains("cannot breathe")
                || normalizedTranscript.contains("fainting")
                || normalizedTranscript.contains("stroke")
                || normalizedTranscript.contains("severe headache")
                || normalizedTranscript.contains("numbness")
                || normalizedTranscript.contains("weakness")
                || normalizedTranscript.contains("bleeding");
    }

    private String safeValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}

record VapiServerRequest(VapiServerMessage message) {
}

record VapiServerMessage(String type, List<VapiToolCall> toolCallList) {
}

record VapiToolCall(String id, String type, VapiToolCallFunction function) {
}

record VapiToolCallFunction(String name, String arguments) {
}
