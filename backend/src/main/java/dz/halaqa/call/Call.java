package dz.halaqa.call;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** An audio call between two users, in its own LiveKit room. */
@Entity
@Table(name = "calls")
public class Call {
    public enum Status { ringing, accepted, declined, missed, cancelled, ended }

    /** How long a call rings before it counts as missed. */
    public static final Duration RING = Duration.ofSeconds(45);

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User caller;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User callee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ringing;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant answeredAt;
    private Instant endedAt;

    protected Call() {}

    public Call(User caller, User callee) {
        this.caller = caller;
        this.callee = callee;
    }

    public String livekitName() { return "call-" + id; }

    public boolean involves(User u) {
        return caller.getId().equals(u.getId()) || callee.getId().equals(u.getId());
    }

    /** A call nobody answered in time becomes missed. Returns true when that changed it. */
    public boolean expireIfUnanswered(Instant now) {
        if (status != Status.ringing || createdAt.plus(RING).isAfter(now)) return false;
        finish(Status.missed);
        return true;
    }

    public boolean isOver() {
        return status != Status.ringing && status != Status.accepted;
    }

    public void accept() {
        status = Status.accepted;
        answeredAt = Instant.now();
    }

    public void finish(Status how) {
        status = how;
        endedAt = Instant.now();
    }

    public String getId() { return id; }
    public User getCaller() { return caller; }
    public User getCallee() { return callee; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getAnsweredAt() { return answeredAt; }
    public Instant getEndedAt() { return endedAt; }
}
