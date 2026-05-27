package org.example.findmypainfinal;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class FindMyPainfinalApplication {

    public static void main(String[] args) {
        SpringApplication.run(FindMyPainfinalApplication.class, args);
    }

    @Bean
    WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("http://localhost:3000", "http://localhost:5173")
                        .allowedMethods("GET", "POST", "OPTIONS")
                        .allowedHeaders("*");
            }
        };
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

@RestController
class AnalyzeController {

    private final TextFallbackAnalyzer analyzer = new TextFallbackAnalyzer();

    @PostMapping("/api/analyze")
    ResponseEntity<AnalyzeResponse> analyze(@RequestBody AnalyzeRequest request) {
        return ResponseEntity.ok(analyzer.analyze(request));
    }
}

class VapiPainVoiceAgent {

    private static final String SYSTEM_PROMPT = """
            You are a medical intake assistant for FindMyPain.
            Ask one follow-up question at a time.
            Cover duration, radiation, triggers, associated symptoms, timing, and severity.
            After 4-5 useful exchanges, call completeSession.
            Never diagnose. Always recommend consulting a doctor.
            If the user names a body region, call selectRegion.
            If the user gives useful symptom detail, call recordSymptomDetail.
            Keep every spoken response brief and conversational.
            """;

    Map<String, Object> assistantConfig() {
        return Map.of(
                "name", "FindMyPain Voice Agent",
                "firstMessage", "Hi, I'm here to find your pain. Select your pain points by clicking body parts and I'll ask you a few questions.",
                "transcriber", Map.of(
                        "provider", "deepgram",
                        "model", "nova-3",
                        "language", "en"
                ),
                "model", Map.of(
                        "provider", "anthropic",
                        "model", "claude-haiku-4-5",
                        "messages", List.of(Map.of(
                                "role", "system",
                                "content", SYSTEM_PROMPT
                        )),
                        "tools", List.of(selectRegionTool(), recordSymptomDetailTool(), completeSessionTool())
                ),
                "voice", Map.of(
                        "provider", "11labs",
                        "voiceId", "21m00Tcm4TlvDq8ikWAM"
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

        String result = switch (toolName) {
            case "selectRegion" -> "Region selected. Continue by asking about duration, severity, and what changes the pain.";
            case "recordSymptomDetail" -> containsUrgentSymptom(arguments)
                    ? "Detail recorded. Red flags may be present; advise urgent care if symptoms are severe, sudden, or worsening."
                    : "Detail recorded. Continue with one focused follow-up question.";
            case "completeSession" -> "Session complete. Tell the user the report can now be generated.";
            default -> "Unsupported tool: " + toolName;
        };

        return Map.of(
                "toolCallId", toolCallId,
                "name", toolName,
                "result", result
        );
    }

    private Map<String, Object> selectRegionTool() {
        return Map.of(
                "type", "function",
                "function", Map.of(
                        "name", "selectRegion",
                        "description", "Adds a body region to the selected pain point list.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "regionName", Map.of(
                                                "type", "string",
                                                "description", "Body region where the user reports pain."
                                        )
                                ),
                                "required", List.of("regionName")
                        )
                )
        );
    }

    private Map<String, Object> recordSymptomDetailTool() {
        return Map.of(
                "type", "function",
                "function", Map.of(
                        "name", "recordSymptomDetail",
                        "description", "Stores a useful symptom detail for a selected pain region.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "region", Map.of(
                                                "type", "string",
                                                "description", "The selected pain region this detail belongs to."
                                        ),
                                        "detail", Map.of(
                                                "type", "string",
                                                "description", "The symptom detail in the user's own words."
                                        )
                                ),
                                "required", List.of("region", "detail")
                        )
                )
        );
    }

    private Map<String, Object> completeSessionTool() {
        return Map.of(
                "type", "function",
                "function", Map.of(
                        "name", "completeSession",
                        "description", "Marks the intake conversation complete after 4-5 useful exchanges.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of()
                        )
                )
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

class TextFallbackAnalyzer {

    private static final List<String> FOLLOW_UPS = List.of(
            "How long have you had this pain?",
            "Does the pain radiate anywhere else?",
            "What makes the pain better or worse?",
            "Are you noticing numbness, weakness, fever, nausea, or shortness of breath?",
            "On a scale from 1 to 10, how severe is the pain right now?"
    );

    AnalyzeResponse analyze(AnalyzeRequest request) {
        int userMessages = request.history() == null
                ? 1
                : (int) request.history().stream()
                        .filter(message -> "user".equalsIgnoreCase(message.role()))
                        .count();

        if (containsUrgentSymptom(request.message())) {
            return new AnalyzeResponse(
                    "That could be serious. If symptoms are severe, sudden, or worsening, please seek urgent medical care. When did this start?",
                    false
            );
        }

        boolean isComplete = userMessages >= 4;
        String reply = isComplete
                ? "Thanks, I have enough detail to prepare the report. You can generate it now."
                : FOLLOW_UPS.get(Math.min(userMessages - 1, FOLLOW_UPS.size() - 1));

        return new AnalyzeResponse(reply, isComplete);
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
}

record VapiServerRequest(VapiServerMessage message) {
}

record VapiServerMessage(String type, List<VapiToolCall> toolCallList) {
}

record VapiToolCall(String id, String type, VapiToolCallFunction function) {
}

record VapiToolCallFunction(String name, String arguments) {
}

record AnalyzeRequest(String message, List<ChatMessage> history, IntakePayload intake, List<String> painPoints) {
}

record ChatMessage(String role, String content) {
}

record IntakePayload(String age, String biologicalSex, String painOnset, String conditions, String medications) {
}

record AnalyzeResponse(String reply, boolean isComplete) {
}
