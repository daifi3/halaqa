package dz.halaqa.chat;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A message in a one-to-one chat: text, a file, or both. */
@Entity
@Table(name = "direct_messages")
public class DirectMessage {
    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Conversation conversation;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User sender;

    @Column(name = "client_id", nullable = false, length = 40)
    private String clientId;

    @Column(length = 4000)
    private String text;

    private String storedFilename;
    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected DirectMessage() {}

    public DirectMessage(Conversation conversation, User sender, String clientId, String text) {
        this.conversation = conversation;
        this.sender = sender;
        this.clientId = clientId;
        this.text = text;
    }

    public void attach(String storedFilename, String originalFilename, String mimeType, long sizeBytes) {
        this.storedFilename = storedFilename;
        this.originalFilename = originalFilename;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
    }

    public String getId() { return id; }
    public Conversation getConversation() { return conversation; }
    public User getSender() { return sender; }
    public String getClientId() { return clientId; }
    public String getText() { return text; }
    public String getStoredFilename() { return storedFilename; }
    public String getOriginalFilename() { return originalFilename; }
    public String getMimeType() { return mimeType; }
    public Long getSizeBytes() { return sizeBytes; }
    public Instant getCreatedAt() { return createdAt; }
}
