package dz.halaqa.admin;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.User;
import dz.halaqa.notification.PushTokenRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Halaqa staff: accounts (public sign-up is off), roles, and the demo requests from the landing page. */
@Tag(name = "Admin", description = "Users, roles and demo requests. Admins only.")
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    public record AdminUserDto(String id, String name, String email, User.Role role, String avatarUrl, Instant createdAt,
                               User.Status status, Instant deletedAt) {
        static AdminUserDto of(User u) {
            return new AdminUserDto(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getAvatarUrl(), u.getCreatedAt(),
                    u.getStatus(), u.getDeletedAt());
        }
    }

    /**
     * One page of users (page is 0-based). counts: how many match the search and status in each role,
     * whatever role filter is on, so the filter chips can show them.
     */
    public record UserPageDto(List<AdminUserDto> items, long total, int page, int size, int totalPages, Map<String, Long> counts) {}

    /** password: leave empty to generate one. demoRequestId: the request this account answers, if any. */
    public record NewUserRequest(
            @NotBlank @Size(min = 2, max = 120) String name,
            @NotBlank @Email @Size(max = 255) String email,
            @NotNull User.Role role,
            @Size(max = 72) String password,
            String demoRequestId) {}

    /** temporaryPassword: shown to the admin once, to pass on to the user. */
    public record CreatedUserDto(AdminUserDto user, String temporaryPassword) {}

    public record RoleRequest(@NotNull User.Role role) {}

    public record PasswordResetDto(String temporaryPassword) {}

    public record DemoRequestDto(String id, String name, String email, String phone, String organization, String message,
                                 String status, String adminNote, AdminUserDto user, Instant createdAt, Instant updatedAt) {
        static DemoRequestDto of(DemoRequest r) {
            return new DemoRequestDto(r.getId(), r.getName(), r.getEmail(), r.getPhone(), r.getOrganization(), r.getMessage(),
                    r.getStatus().wire(), r.getAdminNote(), r.getUser() == null ? null : AdminUserDto.of(r.getUser()),
                    r.getCreatedAt(), r.getUpdatedAt());
        }
    }

    public record UpdateDemoRequest(String status, @Size(max = 1000) String adminNote) {}

    public record StatsDto(long teachers, long students, long admins, long newDemoRequests) {}

    private static final String PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthRepositories.Users users;
    private final AuthRepositories.Tokens tokens;
    private final AuthRepositories.RefreshTokens refreshTokens;
    private final DemoRequestRepository demoRequests;
    private final PushTokenRepository pushTokens;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    public AdminController(AuthRepositories.Users users, AuthRepositories.Tokens tokens,
                           AuthRepositories.RefreshTokens refreshTokens, DemoRequestRepository demoRequests,
                           PushTokenRepository pushTokens) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.demoRequests = demoRequests;
        this.pushTokens = pushTokens;
    }

    @GetMapping("/stats")
    public StatsDto stats(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        var active = User.Status.active;
        return new StatsDto(users.countByRoleAndStatus(User.Role.teacher, active), users.countByRoleAndStatus(User.Role.student, active),
                users.countByRoleAndStatus(User.Role.admin, active), demoRequests.countByStatus(DemoRequest.Status.NEW));
    }

    /* ---------------------------------------------------------------- users */

    /** Newest first. status defaults to active; deleted lists the closed accounts. size: 1-100. */
    @GetMapping("/users")
    public UserPageDto users(@RequestParam(required = false) String q, @RequestParam(required = false) User.Role role,
                             @RequestParam(defaultValue = "active") User.Status status,
                             @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                             @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        int pageSize = Math.max(1, Math.min(size, 100));
        Specification<User> base = hasStatus(status).and(matches(q));
        Page<User> result = users.findAll(role == null ? base : base.and(hasRole(role)),
                PageRequest.of(Math.max(page, 0), pageSize, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"))));

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("all", users.count(base));
        for (User.Role r : User.Role.values()) counts.put(r.name(), users.count(base.and(hasRole(r))));
        return new UserPageDto(result.getContent().stream().map(AdminUserDto::of).toList(), result.getTotalElements(),
                result.getNumber(), pageSize, result.getTotalPages(), counts);
    }

    private static Specification<User> hasStatus(User.Status status) {
        return (u, query, cb) -> cb.equal(u.get("status"), status);
    }

    private static Specification<User> hasRole(User.Role role) {
        return (u, query, cb) -> cb.equal(u.get("role"), role);
    }

    /** Name or email contains the text, ignoring case. % and _ in the search are taken literally. */
    private static Specification<User> matches(String q) {
        String text = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (text.isEmpty()) return (u, query, cb) -> cb.conjunction();
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return (u, query, cb) -> cb.or(
                cb.like(cb.lower(u.get("name")), pattern, '\\'),
                cb.like(cb.lower(u.get("email")), pattern, '\\'));
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CreatedUserDto createUser(@Valid @RequestBody NewUserRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, existing.get().isDeleted()
                    ? "This email belongs to a deleted account. Restore it from the Deleted list instead."
                    : "An account with this email already exists");
        }
        String password = req.password() == null || req.password().isBlank() ? generatePassword() : req.password();
        if (password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The password needs at least 6 characters");
        }
        User user = users.save(new User(req.name().trim(), email, req.role(), encoder.encode(password)));

        if (req.demoRequestId() != null && !req.demoRequestId().isBlank()) {
            demoRequests.findById(req.demoRequestId()).ifPresent(r -> {
                r.setUser(user);
                r.setStatus(DemoRequest.Status.ACCOUNT_CREATED);
            });
        }
        return new CreatedUserDto(AdminUserDto.of(user), password);
    }

    @PatchMapping("/users/{id}/role")
    @Transactional
    public AdminUserDto assignRole(@PathVariable String id, @Valid @RequestBody RoleRequest req,
                                   @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        User user = findActive(id);
        // An admin can't demote themselves, so there's always someone left to manage accounts.
        if (user.getId().equals(me.getId()) && req.role() != User.Role.admin) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't remove your own admin role. Ask another admin.");
        }
        user.setRole(req.role());
        return AdminUserDto.of(users.save(user));
    }

    /** A new temporary password; the user is signed out everywhere and changes it from their profile. */
    @PostMapping("/users/{id}/reset-password")
    @Transactional
    public PasswordResetDto resetPassword(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        User user = findActive(id);
        String password = generatePassword();
        user.setPasswordHash(encoder.encode(password));
        users.save(user);
        tokens.deleteAllFor(user);
        refreshTokens.deleteAllFor(user);
        return new PasswordResetDto(password);
    }

    /**
     * Closes the account: it's marked deleted (nothing is removed from the database), signed out everywhere
     * and stops getting push notifications. Its classes, messages and history stay. Restore brings it back.
     */
    @DeleteMapping("/users/{id}")
    @Transactional
    public AdminUserDto deleteUser(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        User user = find(id);
        if (user.getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't delete your own account. Ask another admin.");
        }
        if (!user.isDeleted()) {
            user.markDeleted();
            users.save(user);
            tokens.deleteAllFor(user);
            refreshTokens.deleteAllFor(user);
            pushTokens.deleteAll(pushTokens.findByUserId(user.getId()));
        }
        return AdminUserDto.of(user);
    }

    /** Reopens a deleted account with its old password and everything it had. */
    @PostMapping("/users/{id}/restore")
    @Transactional
    public AdminUserDto restoreUser(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        User user = find(id);
        user.restore();
        return AdminUserDto.of(users.save(user));
    }

    /* ---------------------------------------------------------------- demo requests */

    @GetMapping("/demo-requests")
    public List<DemoRequestDto> demoRequests(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        return demoRequests.findAllByOrderByCreatedAtDesc().stream().map(DemoRequestDto::of).toList();
    }

    @PatchMapping("/demo-requests/{id}")
    @Transactional
    public DemoRequestDto updateDemoRequest(@PathVariable String id, @Valid @RequestBody UpdateDemoRequest req,
                                            @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireAdmin(me);
        DemoRequest r = demoRequests.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        if (req.status() != null) {
            try {
                r.setStatus(DemoRequest.Status.fromWire(req.status()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status");
            }
        }
        if (req.adminNote() != null) r.setAdminNote(DemoRequestController.blankToNull(req.adminNote()));
        return DemoRequestDto.of(r);
    }

    /* ---------------------------------------------------------------- */

    static void requireAdmin(User me) {
        if (!me.isAdmin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Halaqa admins can do this");
    }

    private User find(String id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    /** Deleted accounts are read-only until restored. */
    private User findActive(String id) {
        User user = find(id);
        if (user.isDeleted()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This account is deleted. Restore it first.");
        return user;
    }

    /** 10 characters without look-alikes (0/O, 1/l/I), easy to read out or type from a message. */
    static String generatePassword() {
        var sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) sb.append(PASSWORD_ALPHABET.charAt(RANDOM.nextInt(PASSWORD_ALPHABET.length())));
        return sb.toString();
    }
}
