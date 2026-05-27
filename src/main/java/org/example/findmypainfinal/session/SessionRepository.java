package org.example.findmypainfinal.session;

import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class SessionRepository {

    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();

    public SessionData save(SessionData session) {
        sessions.put(session.getSessionId(), session);
        return session;
    }

    public Optional<SessionData> findById(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(sessions.get(sessionId));
    }
}
