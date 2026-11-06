package dz.halaqa.homework;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A student's hand-in for one homework — one per student, replaced when they resubmit. */
@Entity
@Table(name = "homework_submissions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"homework_id", "student_id"}))
public class HomeworkSubmission {
    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false)
    private Homework homework;

    @ManyToOne(optional = false)
    private User student;

    @Column(length = 4000)
    private String note;

    /** Optional attachment, stored on disk under a random name. All four are null when there's none. */
    private String storedFilename;
    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;

    @Column(nullable = false)
    private Instant submittedAt = Instant.now();

    protected HomeworkSubmission() {}

    public HomeworkSubmission(Homework homework, User student) {
        this.homework = homework;
        this.student = student;
    }

    public void setNote(String note) { this.note = note; }

    public void setAttachment(String storedFilename, String originalFilename, String mimeType, Long sizeBytes) {
        this.storedFilename = storedFilename;
        this.originalFilename = originalFilename;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
    }

    public void touch() { this.submittedAt = Instant.now(); }

    public String getId() { return id; }
    public Homework getHomework() { return homework; }
    public User getStudent() { return student; }
    public String getNote() { return note; }
    public String getStoredFilename() { return storedFilename; }
    public String getOriginalFilename() { return originalFilename; }
    public String getMimeType() { return mimeType; }
    public Long getSizeBytes() { return sizeBytes; }
    public Instant getSubmittedAt() { return submittedAt; }
}
