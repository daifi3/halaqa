package dz.halaqa.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Opaque bearer token. Simple on purpose — replace with your usual
 * Spring Security + JWT / OAuth setup before production.
 */
@Entity
@Table(name = "auth_tokens")
public class AuthToken {
    @Id
    private String token = UUID.randomUUID().toString() + UUID.randomUUID();

    @ManyToOne(optional = false)
    private User user;

    private Instant createdAt = Instant.now();

    protected AuthToken() {}

    public AuthToken(User user) { this.user = user; }

    public String getToken() { return token; }
    public User getUser() { return user; }
}
