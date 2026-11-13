package dz.halaqa.auth;

import jakarta.persistence.*;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * Long-lived, single-use token that buys a new access + refresh token pair.
 * Each use deletes it (rotation), so a stolen or replayed one stops working.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    private static final SecureRandom RANDOM = new SecureRandom();

    @Id
    private String token = newValue();

    @ManyToOne(optional = false)
    private User user;

    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant expiresAt;

    protected RefreshToken() {}

    public RefreshToken(User user, Duration ttl) {
        this.user = user;
        this.expiresAt = createdAt.plus(ttl);
    }

    private static String newValue() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String getToken() { return token; }
    public User getUser() { return user; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isExpired() { return !Instant.now().isBefore(expiresAt); }
}
