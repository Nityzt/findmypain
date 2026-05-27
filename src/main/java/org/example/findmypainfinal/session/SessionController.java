package org.example.findmypainfinal.session;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/session")
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/start")
    public ResponseEntity<StartSessionResponse> startSession(@RequestBody StartSessionRequest request) {
        return ResponseEntity.ok(sessionService.startSession(request));
    }

    @PostMapping("/pain-points")
    public ResponseEntity<PainPointsResponse> savePainPoints(@RequestBody PainPointsRequest request) {
        return ResponseEntity.ok(sessionService.savePainPoints(request));
    }
}
