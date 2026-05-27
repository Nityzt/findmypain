package org.example.findmypainfinal.session;

import org.springframework.stereotype.Service;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;

    public SessionService(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    public StartSessionResponse startSession(StartSessionRequest request) {
        IntakeData intake = new IntakeData(
                request.age(),
                request.biologicalSex(),
                request.painOnset(),
                request.chronicConditions(),
                request.medications()
        );
        SessionData session = sessionRepository.save(new SessionData(intake));
        return new StartSessionResponse(session.getSessionId());
    }

    public PainPointsResponse savePainPoints(PainPointsRequest request) {
        SessionData session = sessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new SessionNotFoundException(request.sessionId()));
        session.setPainPoints(request.painPoints());
        return new PainPointsResponse(true);
    }

    public SessionData requireSession(String sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
    }
}
