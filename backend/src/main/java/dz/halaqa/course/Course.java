package dz.halaqa.course;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A standing class a teacher runs over time — a subject, a description, and a
 * roster of students (invited by email or self-enrolled with the join code).
 * Individual {@link dz.halaqa.room.Room} sessions can be scheduled under a
 * course; everyone on the course roster automatically has access to them.
 */
@Entity
@Table(name = "courses")
public class Course {

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String subject;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, unique = true, length = 6)
    private String joinCode;

    @ManyToOne(optional = false)
    private User teacher;

    /** Students invited by email — the standing roster, inherited by every session under this course. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "course_invites")
    private Set<String> invitedEmails = new LinkedHashSet<>();

    /** Students who joined with the course code. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "course_members")
    private Set<String> memberIds = new LinkedHashSet<>();

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Course() {}

    public Course(String title, String subject, String description, String joinCode, User teacher, Set<String> invitedEmails) {
        this.title = title;
        this.subject = subject;
        this.description = description;
        this.joinCode = joinCode;
        this.teacher = teacher;
        this.invitedEmails.addAll(invitedEmails);
    }

    public boolean canAccess(User u) {
        return teacher.getId().equals(u.getId())
                || memberIds.contains(u.getId())
                || invitedEmails.contains(u.getEmail().toLowerCase());
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getSubject() { return subject; }
    public String getDescription() { return description; }
    public String getJoinCode() { return joinCode; }
    public User getTeacher() { return teacher; }
    public Set<String> getInvitedEmails() { return invitedEmails; }
    public Set<String> getMemberIds() { return memberIds; }
    public Instant getCreatedAt() { return createdAt; }
}
