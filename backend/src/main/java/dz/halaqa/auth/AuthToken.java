package dz.halaqa.auth;

import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Short-lived opaque bearer (access) token. When it expires the app trades its
 * {@link RefreshToken} for a new pair at POST /api/auth/refresh.
 */
@Entity
@Table(name = "auth_tokens")
public class AuthToken {
    @Id
    private String token = UUID.randomUUID().toString() + UUID.randomUUID();

    @ManyToOne(optional = false)
    private User user;

    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant expiresAt;

    protected AuthToken() {}

    public AuthToken(User user, Duration ttl) {
        this.user = user;
        this.expiresAt = createdAt.plus(ttl);
    }

    public String getToken() { return token; }
    public User getUser() { return user; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isExpired() { return !Instant.now().isBefore(expiresAt); }
}
