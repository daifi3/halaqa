package dz.halaqa.contact;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One entry in a user's address book. Only its owner ever sees it. */
@Entity
@Table(name = "contacts")
public class Contact {
    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User owner;

    @Column(nullable = false, length = 120)
    private String name;

    /** Lower-cased. When it matches a Halaqa account, the contact can be called. */
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(length = 500)
    private String note;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected Contact() {}

    public Contact(User owner) {
        this.owner = owner;
    }

    public void update(String name, String email, String phone, String note) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.note = note;
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public User getOwner() { return owner; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
}
