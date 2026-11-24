package dz.halaqa.admin;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Subscriptions are paid outside the app (cash, CCP, BaridiMob, transfer...). An admin records each payment here;
 * it covers whole months and moves the account's paid-until date forward. Mistakes are voided, never deleted.
 */
@Tag(name = "Admin payments", description = "Record and review what teachers (or any role) have paid. Admins only.")
@RestController
@RequestMapping("/api/admin/payments")
public class PaymentController {

    /** Halaqa runs in Algeria: "today" and "this month" follow Algiers time. */
    static final ZoneId ZONE = ZoneId.of("Africa/Algiers");
    /** Within this many days of the end, an account is "due soon". */
    static final int DUE_SOON_DAYS = 7;

    /** never: no payment yet. overdue: paid-until is in the past. due_soon: ends within 7 days. paid: covered. */
    public enum Standing { paid, due_soon, overdue, never }

    public record PersonRef(String id, String name) {}

    public record PaymentDto(String id, AdminController.AdminUserDto user, BigDecimal amount, String currency, int months,
                             LocalDate periodStart, LocalDate periodEnd, Payment.Method method, String reference, String note,
                             LocalDate paidOn, PersonRef recordedBy, String status, String voidReason, Instant voidedAt,
                             Instant createdAt) {
        static PaymentDto of(Payment p) {
            return new PaymentDto(p.getId(), AdminController.AdminUserDto.of(p.getUser()), p.getAmount(), p.getCurrency(),
                    p.getMonths(), p.getPeriodStart(), p.getPeriodEnd(), p.getMethod(), p.getReference(), p.getNote(),
                    p.getPaidOn(), new PersonRef(p.getRecordedBy().getId(), p.getRecordedBy().getName()),
                    Payment.wire(p.getStatus()), p.getVoidReason(), p.getVoidedAt(), p.getCreatedAt());
        }
    }

    /** daysLeft: until paidUntil (negative when overdue, null when never paid). */
    public record AccountDto(AdminController.AdminUserDto user, LocalDate paidUntil, Standing standing, Long daysLeft,
                             PaymentDto lastPayment) {}

    public record PageDto<T>(List<T> items, long total, int page, int size, int totalPages, Map<String, Long> counts) {}

    public record SummaryDto(String currency, BigDecimal collectedThisMonth, BigDecimal collectedThisYear,
                             long paid, long dueSoon, long overdue, long never) {}

    public record AccountDetailDto(AccountDto account, BigDecimal totalPaid, String currency) {}

    public record NewPayment(
            @NotBlank String userId,
            @NotNull @DecimalMin(value = "1") @DecimalMax(value = "10000000") BigDecimal amount,
            @Min(1) @Max(36) int months,
            @NotNull Payment.Method method,
            @Size(max = 120) String reference,
            @Size(max = 500) String note,
            /** Defaults to today. */
            LocalDate paidOn) {}

    public record VoidRequest(@Size(max = 300) String reason) {}

    private final PaymentRepository payments;
    private final AuthRepositories.Users users;

    public PaymentController(PaymentRepository payments, AuthRepositories.Users users) {
        this.payments = payments;
        this.users = users;
    }

    static LocalDate today() { return LocalDate.now(ZONE); }

    /* ---------------------------------------------------------------- overview */

    @GetMapping("/summary")
    public SummaryDto summary(@RequestParam(defaultValue = "teacher") User.Role role,
                              @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        LocalDate today = today();
        var recorded = Payment.Status.recorded;
        Specification<User> base = activeWithRole(role);
        return new SummaryDto("DZD",
                payments.collected(role, recorded, today.withDayOfMonth(1), today),
                payments.collected(role, recorded, today.withDayOfYear(1), today),
                users.count(base.and(standing(Standing.paid))), users.count(base.and(standing(Standing.due_soon))),
                users.count(base.and(standing(Standing.overdue))), users.count(base.and(standing(Standing.never))));
    }

    /**
     * Active accounts of a role with where they stand, the ones that need attention first
     * (overdue, then due soon...), never-paid last. counts: per standing for the same role and search.
     */
    @GetMapping("/accounts")
    @Transactional(readOnly = true)
    public PageDto<AccountDto> accounts(@RequestParam(defaultValue = "teacher") User.Role role,
                                        @RequestParam(required = false) Standing standing, @RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                        @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        int pageSize = Math.max(1, Math.min(size, 100));
        Specification<User> base = activeWithRole(role).and(matches(q));
        Page<User> result = users.findAll(standing == null ? base : base.and(standing(standing)),
                PageRequest.of(Math.max(page, 0), pageSize, Sort.by(Sort.Order.asc("paidUntil"), Sort.Order.asc("name"), Sort.Order.asc("id"))));

        Map<String, Payment> latest = new HashMap<>();
        List<String> ids = result.getContent().stream().map(User::getId).toList();
        if (!ids.isEmpty()) payments.recordedFor(ids, Payment.Status.recorded).forEach(p -> latest.putIfAbsent(p.getUser().getId(), p));

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("all", users.count(base));
        for (Standing s : Standing.values()) counts.put(s.name(), users.count(base.and(standing(s))));

        LocalDate today = today();
        List<AccountDto> items = result.getContent().stream().map(u -> account(u, latest.get(u.getId()), today)).toList();
        return new PageDto<>(items, result.getTotalElements(), result.getNumber(), pageSize, result.getTotalPages(), counts);
    }

    @GetMapping("/accounts/{userId}")
    @Transactional(readOnly = true)
    public AccountDetailDto account(@PathVariable String userId, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Payment last = payments.recordedFor(List.of(userId), Payment.Status.recorded).stream().findFirst().orElse(null);
        return new AccountDetailDto(account(user, last, today()), payments.totalFor(userId, Payment.Status.recorded), "DZD");
    }

    /** Every payment, newest first, voided ones included. userId: one account's history. */
    @GetMapping
    @Transactional(readOnly = true)
    public PageDto<PaymentDto> history(@RequestParam(required = false) String userId,
                                       @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                       @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        int pageSize = Math.max(1, Math.min(size, 100));
        var pageable = PageRequest.of(Math.max(page, 0), pageSize);
        Page<Payment> result = userId == null || userId.isBlank() ? payments.history(pageable) : payments.historyFor(userId, pageable);
        return new PageDto<>(result.getContent().stream().map(PaymentDto::of).toList(), result.getTotalElements(),
                result.getNumber(), pageSize, result.getTotalPages(), Map.of());
    }

    /* ---------------------------------------------------------------- record / void */

    /**
     * Records a payment. It starts the day after the current paid-until when the account is still covered
     * on the payment date (renewing early adds on), otherwise on the payment date (a lapsed account isn't
     * charged for the gap).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PaymentDto record(@Valid @RequestBody NewPayment req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        User user = users.findById(req.userId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.isDeleted()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This account is deleted. Restore it first.");
        LocalDate today = today();
        LocalDate paidOn = req.paidOn() == null ? today : req.paidOn();
        if (paidOn.isAfter(today)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment date can't be in the future");
        if (paidOn.isBefore(today.minusYears(2))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The payment date is too far back");

        LocalDate current = user.getPaidUntil();
        LocalDate start = current != null && !current.isBefore(paidOn) ? current.plusDays(1) : paidOn;
        Payment payment = payments.save(new Payment(user, req.amount().setScale(2, RoundingMode.HALF_UP), "DZD", req.months(), start,
                req.method(), blankToNull(req.reference()), blankToNull(req.note()), paidOn, me));
        if (current == null || payment.getPeriodEnd().isAfter(current)) user.setPaidUntil(payment.getPeriodEnd());
        users.save(user);
        return PaymentDto.of(payment);
    }

    /** Cancels a payment recorded by mistake. It stays in the history; paid-until is worked out again without it. */
    @PostMapping("/{id}/void")
    @Transactional
    public PaymentDto voidPayment(@PathVariable String id, @Valid @RequestBody(required = false) VoidRequest req,
                                  @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        AdminController.requireAdmin(me);
        Payment payment = payments.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (payment.isVoid()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This payment is already void");
        payment.voidIt(req == null ? null : blankToNull(req.reason()));
        payments.saveAndFlush(payment);
        User user = payment.getUser();
        user.setPaidUntil(payments.paidUntil(user, Payment.Status.recorded).orElse(null));
        users.save(user);
        return PaymentDto.of(payment);
    }

    /* ---------------------------------------------------------------- */

    private static AccountDto account(User u, Payment last, LocalDate today) {
        LocalDate until = u.getPaidUntil();
        Long daysLeft = until == null ? null : ChronoUnit.DAYS.between(today, until);
        return new AccountDto(AdminController.AdminUserDto.of(u), until, standingOf(until, today), daysLeft,
                last == null ? null : PaymentDto.of(last));
    }

    static Standing standingOf(LocalDate until, LocalDate today) {
        if (until == null) return Standing.never;
        if (until.isBefore(today)) return Standing.overdue;
        if (!until.isAfter(today.plusDays(DUE_SOON_DAYS))) return Standing.due_soon;
        return Standing.paid;
    }

    private static Specification<User> activeWithRole(User.Role role) {
        return (u, query, cb) -> cb.and(cb.equal(u.get("status"), User.Status.active), cb.equal(u.get("role"), role));
    }

    /** Same buckets as standingOf, as a query. */
    private static Specification<User> standing(Standing s) {
        LocalDate today = today();
        return (u, query, cb) -> switch (s) {
            case never -> cb.isNull(u.get("paidUntil"));
            case overdue -> cb.lessThan(u.get("paidUntil"), today);
            case due_soon -> cb.between(u.get("paidUntil"), today, today.plusDays(DUE_SOON_DAYS));
            case paid -> cb.greaterThan(u.get("paidUntil"), today.plusDays(DUE_SOON_DAYS));
        };
    }

    private static Specification<User> matches(String q) {
        String text = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (text.isEmpty()) return (u, query, cb) -> cb.conjunction();
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return (u, query, cb) -> cb.or(cb.like(cb.lower(u.get("name")), pattern, '\\'), cb.like(cb.lower(u.get("email")), pattern, '\\'));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
