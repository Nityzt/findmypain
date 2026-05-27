package org.example.findmypainfinal;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    SessionRepository sessionRepository() {
        return new SessionRepository();
    }

    @Bean
    PainConversationService painConversationService(SessionRepository sessionRepository) {
        return new PainConversationService(sessionRepository);
    }

    @Bean
    VapiPainVoiceAgent vapiPainVoiceAgent(SessionRepository sessionRepository) {
        return new VapiPainVoiceAgent(sessionRepository);
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
class SessionController {

    private final SessionRepository sessions;

    SessionController(SessionRepository sessions) {
        this.sessions = sessions;
    }

    @PostMapping("/api/session/start")
    ResponseEntity<StartSessionResponse> start(@RequestBody StartSessionRequest request) {
        SessionData session = sessions.create(request.intake());
        return ResponseEntity.ok(new StartSessionResponse(session.sessionId()));
    }

    @PostMapping("/api/session/pain-points")
    ResponseEntity<OkResponse> painPoints(@RequestBody PainPointsRequest request) {
        sessions.find(request.sessionId())
                .ifPresent(session -> session.replacePainPoints(request.painPoints()));
        return ResponseEntity.ok(new OkResponse(true));
    }
}

@RestController
class VapiVoiceAgentController {

    private final VapiPainVoiceAgent voiceAgent;
    private final PainConversationService conversationService;

    VapiVoiceAgentController(VapiPainVoiceAgent voiceAgent, PainConversationService conversationService) {
        this.voiceAgent = voiceAgent;
        this.conversationService = conversationService;
    }

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

    @PostMapping("/api/vapi/conversation")
    ResponseEntity<Map<String, Object>> handleVapiConversation(@RequestBody VapiConversationRequest request) {
        AnalyzeResponse response = conversationService.analyze(AnalyzeRequest.fromVapi(request));
        String content = conversationService.toVapiJson(response);

        return ResponseEntity.ok(Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of(
                                "role", "assistant",
                                "content", content
                        )
                ))
        ));
    }
}

@RestController
class AnalyzeController {

    private final PainConversationService conversationService;

    AnalyzeController(PainConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/api/analyze")
    ResponseEntity<AnalyzeResponse> analyze(@RequestBody AnalyzeRequest request) {
        return ResponseEntity.ok(conversationService.analyze(request));
    }
}

@RestController
class ReportController {

    private final SessionRepository sessions;
    private final PainConversationService conversationService;

    ReportController(SessionRepository sessions, PainConversationService conversationService) {
        this.sessions = sessions;
        this.conversationService = conversationService;
    }

    @PostMapping("/api/report/generate")
    ResponseEntity<ReportResponse> generate(@RequestBody ReportRequest request) {
        Optional<SessionData> session = sessions.find(request.sessionId());
        if (session.isEmpty()) {
            AssessmentData assessment = conversationService.assess(List.of(), List.of());
            return ResponseEntity.ok(new ReportResponse(null, List.of(), List.of(), assessment));
        }

        SessionData data = session.get();
        AssessmentData assessment = data.assessment() == null
                ? conversationService.assess(data.history(), data.painPoints())
                : data.assessment();
        data.assessment(assessment);

        return ResponseEntity.ok(new ReportResponse(
                data.intake(),
                data.painPoints(),
                data.history(),
                assessment
        ));
    }
}

class VapiPainVoiceAgent {

    private static final String SYSTEM_PROMPT = """
            You are a medical intake assistant for FindMyPain.
            Patient context may include age, biological sex, pain regions, conditions, medications, and onset.

            Rules:
            - Ask one follow-up question at a time.
            - Cover duration, radiation, triggers, associated symptoms, timing, and severity.
            - After 4-5 useful exchanges, call completeSession.
            - Never diagnose. Always recommend consulting a doctor.
            - If the user names a body region, call selectRegion.
            - If the user gives useful symptom detail, call recordSymptomDetail.
            - Keep every spoken response brief and conversational.
            """;

    private final SessionRepository sessions;
    private final ObjectMapper objectMapper = new ObjectMapper();

    VapiPainVoiceAgent(SessionRepository sessions) {
        this.sessions = sessions;
    }

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
        Map<String, Object> args = parseArguments(arguments);

        String result = switch (toolName) {
            case "selectRegion" -> selectRegion(args);
            case "recordSymptomDetail" -> recordSymptomDetail(args);
            case "completeSession" -> completeSession(args);
            default -> "Unsupported tool: " + toolName;
        };

        return Map.of(
                "toolCallId", toolCallId,
                "name", toolName,
                "result", result
        );
    }

    private String selectRegion(Map<String, Object> args) {
        String region = stringArg(args, "regionName")
                .or(() -> stringArg(args, "region"))
                .orElse("selected region");
        stringArg(args, "sessionId")
                .flatMap(sessions::find)
                .ifPresent(session -> session.addPainPoint(new PainPointPayload(region, null, List.of())));

        return "Region selected: " + region + ". Continue by asking about duration, severity, and what changes the pain.";
    }

    private String recordSymptomDetail(Map<String, Object> args) {
        String region = stringArg(args, "region").orElse("selected region");
        String detail = stringArg(args, "detail").orElse("Symptom detail recorded.");
        stringArg(args, "sessionId")
                .flatMap(sessions::find)
                .ifPresent(session -> session.addHistory(new ChatMessage("note", region + ": " + detail)));

        return containsUrgentSymptom(detail)
                ? "Detail recorded. Red flags may be present; advise urgent care if symptoms are severe, sudden, or worsening."
                : "Detail recorded for " + region + ". Continue with one focused follow-up question.";
    }

    private String completeSession(Map<String, Object> args) {
        stringArg(args, "sessionId")
                .flatMap(sessions::find)
                .ifPresent(session -> session.assessment(PainConversationService.defaultAssessment(
                        session.history(),
                        session.painPoints()
                )));

        return "Session complete. Tell the user the report can now be generated.";
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
                                        "sessionId", Map.of(
                                                "type", "string",
                                                "description", "Current FindMyPain session id, if available."
                                        ),
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
                                        "sessionId", Map.of(
                                                "type", "string",
                                                "description", "Current FindMyPain session id, if available."
                                        ),
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
                                "properties", Map.of(
                                        "sessionId", Map.of(
                                                "type", "string",
                                                "description", "Current FindMyPain session id, if available."
                                        )
                                )
                        )
                )
        );
    }

    private Map<String, Object> parseArguments(String arguments) {
        if (arguments == null || arguments.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(arguments, new TypeReference<>() {
            });
        } catch (JsonProcessingException ignored) {
            return Map.of();
        }
    }

    private Optional<String> stringArg(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value == null || value.toString().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(value.toString());
    }

    private boolean containsUrgentSymptom(String transcript) {
        return MedicalRedFlags.containsUrgentSymptom(transcript);
    }

    private String safeValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}

class PainConversationService {

    private static final List<String> FOLLOW_UPS = List.of(
            "How long have you had this pain?",
            "Does the pain radiate anywhere else?",
            "What makes the pain better or worse?",
            "Are you noticing numbness, weakness, fever, nausea, or shortness of breath?",
            "On a scale from 1 to 10, how severe is the pain right now?"
    );

    private final SessionRepository sessions;
    private final ObjectMapper objectMapper = new ObjectMapper();

    PainConversationService(SessionRepository sessions) {
        this.sessions = sessions;
    }

    AnalyzeResponse analyze(AnalyzeRequest request) {
        List<ChatMessage> history = normalizeHistory(request);
        List<PainPointPayload> painPoints = painPointsFrom(request);

        updateSession(request, history, painPoints);

        if (MedicalRedFlags.containsUrgentSymptom(request.message())) {
            return new AnalyzeResponse(
                    "That could be serious. If symptoms are severe, sudden, or worsening, please seek urgent medical care. When did this start?",
                    false,
                    null
            );
        }

        int userMessages = (int) history.stream()
                .filter(message -> "user".equalsIgnoreCase(message.role()))
                .count();
        boolean isComplete = userMessages >= 4;
        AssessmentData assessment = isComplete ? assess(history, painPoints) : null;
        String reply = isComplete
                ? "Thanks, I have enough detail to prepare the report. You can generate it now."
                : FOLLOW_UPS.get(Math.max(0, Math.min(userMessages - 1, FOLLOW_UPS.size() - 1)));

        request.sessionIdOptional()
                .flatMap(sessions::find)
                .ifPresent(session -> {
                    session.addHistory(new ChatMessage("assistant", reply));
                    if (assessment != null) {
                        session.assessment(assessment);
                    }
                });

        return new AnalyzeResponse(reply, isComplete, assessment);
    }

    AssessmentData assess(List<ChatMessage> history, List<PainPointPayload> painPoints) {
        return defaultAssessment(history, painPoints);
    }

    String toVapiJson(AnalyzeResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException ignored) {
            return "{\"reply\":\"Thanks. Can you tell me how long this has been happening?\",\"isComplete\":false,\"assessment\":null}";
        }
    }

    static AssessmentData defaultAssessment(List<ChatMessage> history, List<PainPointPayload> painPoints) {
        boolean hasRedFlags = history.stream()
                .map(ChatMessage::content)
                .anyMatch(MedicalRedFlags::containsUrgentSymptom);
        String urgency = hasRedFlags ? "high" : painPoints.isEmpty() ? "low" : "moderate";

        return new AssessmentData(
                urgency,
                List.of("Musculoskeletal pain", "Inflammation or strain", "Referred pain requiring clinician review"),
                hasRedFlags
                        ? List.of("Seek urgent medical care if symptoms are severe, sudden, or worsening.", "Bring this report to a clinician.")
                        : List.of("Schedule a clinician visit if pain persists or worsens.", "Track severity, triggers, and medication response."),
                "This is not a diagnosis. Please consult a medical professional."
        );
    }

    private List<ChatMessage> normalizeHistory(AnalyzeRequest request) {
        List<ChatMessage> history = request.history() == null
                ? new ArrayList<>()
                : new ArrayList<>(request.history());

        if (request.message() != null && !request.message().isBlank()) {
            boolean alreadyIncluded = history.stream()
                    .anyMatch(message -> "user".equalsIgnoreCase(message.role())
                            && request.message().equals(message.content()));
            if (!alreadyIncluded) {
                history.add(new ChatMessage("user", request.message()));
            }
        }

        return history;
    }

    private List<PainPointPayload> painPointsFrom(AnalyzeRequest request) {
        if (request.painPoints() == null) {
            return List.of();
        }

        return request.painPoints().stream()
                .filter(point -> point != null && !point.isBlank())
                .map(point -> new PainPointPayload(point, null, List.of()))
                .toList();
    }

    private void updateSession(AnalyzeRequest request, List<ChatMessage> history, List<PainPointPayload> painPoints) {
        request.sessionIdOptional()
                .flatMap(sessions::find)
                .ifPresent(session -> {
                    if (request.intake() != null) {
                        session.intake(request.intake());
                    }
                    if (!painPoints.isEmpty()) {
                        session.replacePainPoints(painPoints);
                    }
                    session.replaceHistory(history);
                });
    }
}

class SessionRepository {

    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();

    SessionData create(IntakePayload intake) {
        String sessionId = UUID.randomUUID().toString();
        SessionData session = new SessionData(sessionId, intake == null ? IntakePayload.empty() : intake);
        sessions.put(sessionId, session);
        return session;
    }

    Optional<SessionData> find(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(sessions.get(sessionId));
    }
}

class SessionData {

    private final String sessionId;
    private IntakePayload intake;
    private final CopyOnWriteArrayList<PainPointPayload> painPoints = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<ChatMessage> history = new CopyOnWriteArrayList<>();
    private AssessmentData assessment;

    SessionData(String sessionId, IntakePayload intake) {
        this.sessionId = sessionId;
        this.intake = intake;
    }

    String sessionId() {
        return sessionId;
    }

    IntakePayload intake() {
        return intake;
    }

    void intake(IntakePayload intake) {
        this.intake = intake;
    }

    List<PainPointPayload> painPoints() {
        return List.copyOf(painPoints);
    }

    void replacePainPoints(List<PainPointPayload> nextPainPoints) {
        painPoints.clear();
        if (nextPainPoints != null) {
            painPoints.addAll(nextPainPoints);
        }
    }

    void addPainPoint(PainPointPayload painPoint) {
        boolean alreadySelected = painPoints.stream()
                .anyMatch(existing -> existing.region().equalsIgnoreCase(painPoint.region()));
        if (!alreadySelected) {
            painPoints.add(painPoint);
        }
    }

    List<ChatMessage> history() {
        return List.copyOf(history);
    }

    void replaceHistory(List<ChatMessage> nextHistory) {
        history.clear();
        if (nextHistory != null) {
            history.addAll(nextHistory);
        }
    }

    void addHistory(ChatMessage message) {
        history.add(message);
    }

    AssessmentData assessment() {
        return assessment;
    }

    void assessment(AssessmentData assessment) {
        this.assessment = assessment;
    }
}

class MedicalRedFlags {

    private MedicalRedFlags() {
    }

    static boolean containsUrgentSymptom(String transcript) {
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

record StartSessionRequest(IntakePayload intake) {
}

record StartSessionResponse(String sessionId) {
}

record PainPointsRequest(String sessionId, List<PainPointPayload> painPoints) {
}

record OkResponse(boolean ok) {
}

record VapiServerRequest(VapiServerMessage message) {
}

record VapiServerMessage(String type, List<VapiToolCall> toolCallList) {
}

record VapiToolCall(String id, String type, VapiToolCallFunction function) {
}

record VapiToolCallFunction(String name, String arguments) {
}

record VapiConversationRequest(String sessionId, List<ChatMessage> messages) {
}

record AnalyzeRequest(String sessionId, String message, List<ChatMessage> history, IntakePayload intake, List<String> painPoints) {

    static AnalyzeRequest fromVapi(VapiConversationRequest request) {
        List<ChatMessage> messages = request.messages() == null ? List.of() : request.messages();
        String latestUserMessage = messages.stream()
                .filter(message -> "user".equalsIgnoreCase(message.role()))
                .reduce((first, second) -> second)
                .map(ChatMessage::content)
                .orElse("");

        return new AnalyzeRequest(request.sessionId(), latestUserMessage, messages, null, List.of());
    }

    Optional<String> sessionIdOptional() {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(sessionId);
    }
}

record ChatMessage(String role, String content) {
}

record IntakePayload(String age, String biologicalSex, String painOnset, String conditions, String medications) {

    static IntakePayload empty() {
        return new IntakePayload("", "", "", "", "");
    }
}

record PainPointPayload(String region, String severity, List<String> conversationAnswers) {
}

record AnalyzeResponse(String reply, boolean isComplete, AssessmentData assessment) {
}

record ReportRequest(String sessionId) {
}

record ReportResponse(
        IntakePayload patient,
        List<PainPointPayload> painPoints,
        List<ChatMessage> history,
        AssessmentData assessment
) {
}

record AssessmentData(String urgency, List<String> differentials, List<String> nextSteps, String disclaimer) {
}
