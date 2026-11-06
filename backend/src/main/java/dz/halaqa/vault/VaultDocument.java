package dz.halaqa.vault;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A file in a teacher's personal vault — uploaded, optionally filed under a
 * folder for organization, and shared with chosen people by email (same
 * pattern as {@link dz.halaqa.course.Course#getInvitedEmails()}).
 */
@Entity
@Table(name = "vault_documents")
public class VaultDocument {

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false, unique = true)
    private String storedFilename;

    private String mimeType;

    @Column(nullable = false)
    private long sizeBytes;

    /** Free-text folder name for organizing the vault; null/blank means "unfiled". */
    private String folder;

    @ManyToOne(optional = false)
    private User owner;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "vault_document_shares")
    private Set<String> sharedEmails = new LinkedHashSet<>();

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected VaultDocument() {}

    public VaultDocument(String title, String originalFilename, String storedFilename, String mimeType,
                          long sizeBytes, String folder, User owner) {
        this.title = title;
        this.originalFilename = originalFilename;
        this.storedFilename = storedFilename;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.folder = folder;
        this.owner = owner;
    }

    public boolean canAccess(User u) {
        return owner.getId().equals(u.getId()) || sharedEmails.contains(u.getEmail().toLowerCase());
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStoredFilename() { return storedFilename; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getFolder() { return folder; }
    public User getOwner() { return owner; }
    public Set<String> getSharedEmails() { return sharedEmails; }
    public Instant getCreatedAt() { return createdAt; }
    public void setTitle(String title) { this.title = title; }
    public void setFolder(String folder) { this.folder = folder; }
}
