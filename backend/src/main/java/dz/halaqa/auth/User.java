package dz.halaqa.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    /** admin: Halaqa staff who create accounts and assign roles (public sign-up is off). */
    public enum Role { teacher, student, admin }

    /** deleted: closed by an admin. The row stays (classes, messages, history) but the account can't sign in. */
    public enum Status { active, deleted }

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private String passwordHash;

    /** Public URL of the uploaded profile picture; null until the user sets one. */
    private String avatarUrl;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.active;

    private Instant deletedAt;

    /** Last day covered by a recorded payment; null = never paid. Kept in step by the payments admin. */
    private java.time.LocalDate paidUntil;

    protected User() {}

    public User(String name, String email, Role role, String passwordHash) {
        this.name = name;
        this.email = email;
        this.role = role;
        this.passwordHash = passwordHash;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public Role getRole() { return role; }
    public String getPasswordHash() { return passwordHash; }
    public String getAvatarUrl() { return avatarUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Status getStatus() { return status; }
    public Instant getDeletedAt() { return deletedAt; }
    public java.time.LocalDate getPaidUntil() { return paidUntil; }
    public void setPaidUntil(java.time.LocalDate paidUntil) { this.paidUntil = paidUntil; }
    public boolean isDeleted() { return status == Status.deleted; }
    public void markDeleted() { status = Status.deleted; deletedAt = Instant.now(); }
    public void restore() { status = Status.active; deletedAt = null; }
    public boolean isTeacher() { return role == Role.teacher; }
    public boolean isAdmin() { return role == Role.admin; }
    public void setRole(Role role) { this.role = role; }
    public void setName(String name) { this.name = name; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
}
