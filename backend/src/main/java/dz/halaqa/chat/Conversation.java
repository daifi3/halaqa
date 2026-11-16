package dz.halaqa.chat;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A one-to-one chat. userA's id sorts before userB's, so each pair has a single conversation. */
@Entity
@Table(name = "conversations")
public class Conversation {
    @Id
    private String id = UUID.randomUUID().toString();

    // Named explicitly: the default naming would make "userA" into "usera_id".
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_a_id")
    private User userA;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_b_id")
    private User userB;

    @Column(nullable = false, length = 30)
    private String theme = "default";

    @Column(name = "a_read_at")
    private Instant aReadAt;

    @Column(name = "b_read_at")
    private Instant bReadAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant lastMessageAt;

    protected Conversation() {}

    public Conversation(User one, User two) {
        boolean oneFirst = one.getId().compareTo(two.getId()) < 0;
        this.userA = oneFirst ? one : two;
        this.userB = oneFirst ? two : one;
    }

    public boolean involves(User u) {
        return userA.getId().equals(u.getId()) || userB.getId().equals(u.getId());
    }

    public User other(User me) {
        return userA.getId().equals(me.getId()) ? userB : userA;
    }

    public Instant readAt(User u) {
        return userA.getId().equals(u.getId()) ? aReadAt : bReadAt;
    }

    public void markRead(User u, Instant at) {
        if (userA.getId().equals(u.getId())) aReadAt = at;
        else bReadAt = at;
    }

    public String getId() { return id; }
    public User getUserA() { return userA; }
    public User getUserB() { return userB; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(Instant at) { this.lastMessageAt = at; }
}
