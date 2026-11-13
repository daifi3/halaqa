package dz.halaqa.notification;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One entry in a user's notification list (the bell in the apps). */
@Entity
@Table(name = "notifications")
public class Notification {

    public enum Kind {
        /** To the teacher: a student finished an exam (submitted, left, or ran out of time). */
        exam_submitted,
        /** To the student: the teacher finalized their exam grade. */
        exam_graded
    }

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Kind kind;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String body;

    /** The app screen it opens, e.g. /exam/attempt/{id}. Both apps use the same paths. */
    @Column(length = 300)
    private String link;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant readAt;

    protected Notification() {}

    public Notification(User recipient, Kind kind, String title, String body, String link) {
        this.recipient = recipient;
        this.kind = kind;
        this.title = cut(title, 200);
        this.body = cut(body, 500);
        this.link = link;
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    public void markRead(Instant now) {
        if (readAt == null) readAt = now;
    }

    public String getId() { return id; }
    public User getRecipient() { return recipient; }
    public Kind getKind() { return kind; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getLink() { return link; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
}
