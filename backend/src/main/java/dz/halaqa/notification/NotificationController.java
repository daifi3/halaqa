package dz.halaqa.notification;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * The signed-in user's notifications. The apps poll {@code GET /api/notifications}
 * (it's cheap) to keep the bell's unread count fresh.
 */
@Tag(name = "Notifications", description = "What happened while you were away: exams submitted, grades released.")
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    public record NotificationDto(String id, Notification.Kind kind, String title, String body, String link,
                                  Instant createdAt, Instant readAt) {
        static NotificationDto of(Notification n) {
            return new NotificationDto(n.getId(), n.getKind(), n.getTitle(), n.getBody(), n.getLink(),
                    n.getCreatedAt(), n.getReadAt());
        }
    }

    public record InboxDto(List<NotificationDto> items, long unread) {}

    /** @param muted kinds the user turned off on this phone */
    public record PushTokenRequest(@NotBlank @Size(max = 255) String token, @Size(max = 20) String platform,
                                   List<Notification.Kind> muted) {}

    private final NotificationRepository notifications;
    private final PushTokenRepository pushTokens;

    public NotificationController(NotificationRepository notifications, PushTokenRepository pushTokens) {
        this.notifications = notifications;
        this.pushTokens = pushTokens;
    }

    @Operation(summary = "The newest notifications (up to `limit`, default 50) and how many are unread")
    @GetMapping
    @Transactional(readOnly = true)
    public InboxDto list(@RequestParam(defaultValue = "50") int limit, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        int size = Math.max(1, Math.min(limit, 100));
        List<NotificationDto> items = notifications.findByRecipientIdOrderByCreatedAtDesc(me.getId(), PageRequest.of(0, size))
                .stream().map(NotificationDto::of).toList();
        return new InboxDto(items, notifications.countByRecipientIdAndReadAtIsNull(me.getId()));
    }

    @Operation(summary = "Mark one notification as read")
    @PostMapping("/{id}/read")
    @Transactional
    public NotificationDto markRead(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Notification n = notifications.findById(id)
                .filter(x -> x.getRecipient().getId().equals(me.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        n.markRead(Instant.now());
        return NotificationDto.of(n);
    }

    @Operation(summary = "Mark every notification as read")
    @PostMapping("/read-all")
    @Transactional
    public void markAllRead(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        notifications.markAllRead(me.getId(), Instant.now());
    }

    @Operation(summary = "Register this phone for push notifications (or update its settings)",
            description = "`token` is the app's Expo push token. A phone belongs to whoever signed in on it last.")
    @PutMapping("/push-token")
    @Transactional
    public void registerPushToken(@Valid @RequestBody PushTokenRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        PushToken t = pushTokens.findById(req.token()).orElseGet(() -> new PushToken(req.token()));
        t.assign(me, req.platform(), req.muted());
        pushTokens.save(t);
    }

    @Operation(summary = "Stop push notifications to this phone (on sign-out, or when turned off)")
    @DeleteMapping("/push-token")
    @Transactional
    public void removePushToken(@RequestParam String token, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        pushTokens.findById(token).filter(t -> t.getUser().getId().equals(me.getId())).ifPresent(pushTokens::delete);
    }
}
