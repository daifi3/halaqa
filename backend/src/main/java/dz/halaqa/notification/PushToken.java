package dz.halaqa.notification;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

/** A phone that receives push notifications: its Expo push token, and whose phone it is now. */
@Entity
@Table(name = "push_tokens")
public class PushToken {

    @Id
    private String token;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @Column(length = 20)
    private String platform;

    /** Notification kinds turned off on this phone, comma separated. */
    @Column(nullable = false, length = 500)
    private String mutedKinds = "";

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected PushToken() {}

    public PushToken(String token) {
        this.token = token;
    }

    /** The phone now belongs to {@code user} (someone else may have signed in on it). */
    public void assign(User user, String platform, Collection<Notification.Kind> muted) {
        this.user = user;
        this.platform = platform;
        this.mutedKinds = muted == null ? "" : muted.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
        this.updatedAt = Instant.now();
    }

    public boolean wants(Notification.Kind kind) {
        Set<String> muted = Arrays.stream(mutedKinds.split(",")).map(String::trim).collect(Collectors.toSet());
        return !muted.contains(kind.name());
    }

    public String getToken() { return token; }
    public User getUser() { return user; }
}
