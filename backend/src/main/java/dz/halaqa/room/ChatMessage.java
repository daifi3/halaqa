package dz.halaqa.room;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * A class chat message, kept so people who join late (or reconnect) see what was
 * said. Live delivery still goes over LiveKit; this is the record of it.
 */
@Entity
@Table(name = "room_messages",
        uniqueConstraints = @UniqueConstraint(columnNames = {"room_id", "client_id"}),
        indexes = @Index(columnList = "room_id, sentAt"))
public class ChatMessage {
    @Id
    private String id = UUID.randomUUID().toString();

    /** The id the sending app gave the message — also used for it over LiveKit, so copies can be matched up. */
    @Column(name = "client_id", nullable = false, length = 40)
    private String clientId;

    @ManyToOne(optional = false)
    private Room room;

    @ManyToOne(optional = false)
    private User author;

    @Column(nullable = false, length = 500)
    private String text;

    @Column(nullable = false)
    private Instant sentAt = Instant.now();

    protected ChatMessage() {}

    public ChatMessage(Room room, User author, String clientId, String text) {
        this.room = room;
        this.author = author;
        this.clientId = clientId;
        this.text = text;
    }

    public String getClientId() { return clientId; }
    public Room getRoom() { return room; }
    public User getAuthor() { return author; }
    public String getText() { return text; }
    public Instant getSentAt() { return sentAt; }
}
