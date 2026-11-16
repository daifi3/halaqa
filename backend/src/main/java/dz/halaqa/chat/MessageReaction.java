package dz.halaqa.chat;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/** One person's emoji on one message. */
@Entity
@Table(name = "message_reactions")
@IdClass(MessageReaction.Key.class)
public class MessageReaction {

    public static class Key implements Serializable {
        private String messageId;
        private String userId;

        public Key() {}

        public Key(String messageId, String userId) {
            this.messageId = messageId;
            this.userId = userId;
        }

        @Override public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(messageId, k.messageId) && Objects.equals(userId, k.userId);
        }

        @Override public int hashCode() { return Objects.hash(messageId, userId); }
    }

    @Id
    @Column(name = "message_id")
    private String messageId;

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(nullable = false, length = 16)
    private String emoji;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected MessageReaction() {}

    public MessageReaction(String messageId, String userId, String emoji) {
        this.messageId = messageId;
        this.userId = userId;
        this.emoji = emoji;
    }

    public String getMessageId() { return messageId; }
    public String getUserId() { return userId; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; this.createdAt = Instant.now(); }
}
