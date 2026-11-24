package dz.halaqa.admin;

import dz.halaqa.auth.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A payment an admin recorded for an account. Covers [periodStart, periodEnd]. Voided, never deleted. */
@Entity
@Table(name = "payments")
public class Payment {
    public enum Method { cash, ccp, baridimob, bank_transfer, card, other }

    public enum Status { recorded, void_ }

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency = "DZD";

    @Column(nullable = false)
    private int months;

    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false)
    private LocalDate periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Method method;

    private String reference;

    private String note;

    @Column(nullable = false)
    private LocalDate paidOn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by")
    private User recordedBy;

    /** "recorded" / "void" in the database; void is a Java keyword, hence the converter. */
    @Convert(converter = StatusConverter.class)
    @Column(nullable = false)
    private Status status = Status.recorded;

    private String voidReason;

    private Instant voidedAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Payment() {}

    public Payment(User user, BigDecimal amount, String currency, int months, LocalDate periodStart, Method method,
                   String reference, String note, LocalDate paidOn, User recordedBy) {
        this.user = user;
        this.amount = amount;
        this.currency = currency;
        this.months = months;
        this.periodStart = periodStart;
        this.periodEnd = periodStart.plusMonths(months).minusDays(1);
        this.method = method;
        this.reference = reference;
        this.note = note;
        this.paidOn = paidOn;
        this.recordedBy = recordedBy;
    }

    public String getId() { return id; }
    public User getUser() { return user; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public int getMonths() { return months; }
    public LocalDate getPeriodStart() { return periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public Method getMethod() { return method; }
    public String getReference() { return reference; }
    public String getNote() { return note; }
    public LocalDate getPaidOn() { return paidOn; }
    public User getRecordedBy() { return recordedBy; }
    public Status getStatus() { return status; }
    public boolean isVoid() { return status == Status.void_; }
    public String getVoidReason() { return voidReason; }
    public Instant getVoidedAt() { return voidedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void voidIt(String reason) {
        status = Status.void_;
        voidReason = reason;
        voidedAt = Instant.now();
    }

    public static String wire(Status s) { return s == Status.void_ ? "void" : "recorded"; }

    @Converter
    public static class StatusConverter implements AttributeConverter<Status, String> {
        @Override public String convertToDatabaseColumn(Status s) { return s == null ? null : wire(s); }
        @Override public Status convertToEntityAttribute(String v) {
            return v == null ? null : "void".equals(v) ? Status.void_ : Status.recorded;
        }
    }
}
