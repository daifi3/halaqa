package dz.halaqa.notification;

import dz.halaqa.auth.User;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Adds notifications and pushes them to the recipient's phones. Called inside the caller's
 * transaction: the notification is saved (or rolled back) with it, and the push goes out
 * only once that transaction has committed.
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final PushTokenRepository tokens;
    private final ExpoPushService push;

    public NotificationService(NotificationRepository notifications, PushTokenRepository tokens, ExpoPushService push) {
        this.notifications = notifications;
        this.tokens = tokens;
        this.push = push;
    }

    public void notify(User recipient, Notification.Kind kind, String title, String body, String link) {
        Notification n = notifications.save(new Notification(recipient, kind, title, body, link));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("notificationId", n.getId());
        data.put("kind", kind.name());
        if (link != null) data.put("link", link);
        List<ExpoPushService.Message> messages = new ArrayList<>();
        for (PushToken t : tokens.findByUserId(recipient.getId())) {
            if (t.wants(kind)) messages.add(new ExpoPushService.Message(t.getToken(), n.getTitle(), n.getBody(), data));
        }
        if (messages.isEmpty()) return;

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { push.sendLater(messages); }
            });
        } else {
            push.sendLater(messages);
        }
    }
}
