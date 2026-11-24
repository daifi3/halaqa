package dz.halaqa.admin;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * A "Request a demo" sent from the landing page. Public sign-up is off, so this is how a
 * teacher (or a school) asks to join: an admin follows it up, takes payment outside the app,
 * then creates the account from it.
 */
@Entity
@Table(name = "demo_requests")
public class DemoRequest {

    /**
     * new, contacted, awaiting_payment, paid, account_created, or declined at any point.
     * "new" is a Java keyword, so that constant is NEW; the API and the database use the lowercase names.
     */
    public enum Status {
        NEW, CONTACTED, AWAITING_PAYMENT, PAID, ACCOUNT_CREATED, DECLINED;

        public String wire() { return name().toLowerCase(); }

        public static Status fromWire(String s) { return valueOf(s.toUpperCase()); }
    }

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(length = 160)
    private String organization;

    @Column(length = 1000)
    private String message;

    @Convert(converter = StatusConverter.class)
    @Column(nullable = false, length = 32)
    private Status status = Status.NEW;

    @Column(length = 1000)
    private String adminNote;

    /** The account an admin created from this request. */
    @ManyToOne
    private User user;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected DemoRequest() {}

    public DemoRequest(String name, String email, String phone, String organization, String message) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.organization = organization;
        this.message = message;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getOrganization() { return organization; }
    public String getMessage() { return message; }
    public Status getStatus() { return status; }
    public String getAdminNote() { return adminNote; }
    public User getUser() { return user; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setStatus(Status status) { this.status = status; touch(); }
    public void setAdminNote(String adminNote) { this.adminNote = adminNote; touch(); }
    public void setUser(User user) { this.user = user; touch(); }

    private void touch() { updatedAt = Instant.now(); }

    @Converter
    public static class StatusConverter implements AttributeConverter<Status, String> {
        @Override
        public String convertToDatabaseColumn(Status s) { return s == null ? null : s.wire(); }

        @Override
        public Status convertToEntityAttribute(String s) { return s == null ? null : Status.fromWire(s); }
    }
}
