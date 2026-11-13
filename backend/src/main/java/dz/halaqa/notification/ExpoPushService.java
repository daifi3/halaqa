package dz.halaqa.notification;

import com.fasterxml.jackson.core.type.TypeReference;
import dz.halaqa.common.Json;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends push notifications to phones through Expo's push service, which forwards them to
 * Apple and Google. Runs on a background thread so a slow or unreachable push service never
 * holds up an API request. Tokens Expo reports as no longer registered (app uninstalled)
 * are deleted.
 */
@Service
public class ExpoPushService {
    private static final Logger log = LoggerFactory.getLogger(ExpoPushService.class);
    private static final URI SEND = URI.create("https://exp.host/--/api/v2/push/send");
    /** Expo accepts at most 100 messages per request. */
    private static final int BATCH = 100;

    public record Message(String token, String title, String body, Map<String, Object> data) {}

    private final boolean enabled;
    private final String accessToken;
    private final PushTokenRepository tokens;
    private final TransactionTemplate tx;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "expo-push");
        t.setDaemon(true);
        return t;
    });

    public ExpoPushService(@Value("${halaqa.push.enabled:true}") boolean enabled,
                           @Value("${halaqa.push.access-token:}") String accessToken,
                           PushTokenRepository tokens, TransactionTemplate tx) {
        this.enabled = enabled;
        this.accessToken = accessToken;
        this.tokens = tokens;
        this.tx = tx;
    }

    public void sendLater(List<Message> messages) {
        if (!enabled || messages.isEmpty()) return;
        worker.execute(() -> {
            for (int i = 0; i < messages.size(); i += BATCH) {
                send(messages.subList(i, Math.min(i + BATCH, messages.size())));
            }
        });
    }

    private void send(List<Message> batch) {
        List<Map<String, Object>> body = batch.stream().map(m -> {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("to", m.token());
            msg.put("title", m.title());
            if (m.body() != null) msg.put("body", m.body());
            msg.put("data", m.data());
            msg.put("sound", "default");
            msg.put("priority", "high");
            msg.put("channelId", "default");
            return msg;
        }).toList();
        try {
            HttpRequest.Builder req = HttpRequest.newBuilder(SEND)
                    .timeout(Duration.ofSeconds(20))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)));
            if (!accessToken.isBlank()) req.header("Authorization", "Bearer " + accessToken);
            HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 300) {
                log.warn("Expo push failed ({}): {}", res.statusCode(), res.body());
                return;
            }
            forgetDeadTokens(batch, res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Expo push failed: {}", e.toString());
        }
    }

    /** Tickets come back in the order sent; DeviceNotRegistered means the app is gone from that phone. */
    private void forgetDeadTokens(List<Message> batch, String response) {
        Map<String, Object> parsed = Json.read(response, new TypeReference<>() {});
        if (!(parsed.get("data") instanceof List<?> tickets)) return;
        List<String> dead = new ArrayList<>();
        for (int i = 0; i < tickets.size() && i < batch.size(); i++) {
            if (tickets.get(i) instanceof Map<?, ?> ticket && "error".equals(ticket.get("status"))) {
                Object details = ticket.get("details");
                String error = details instanceof Map<?, ?> d ? String.valueOf(d.get("error")) : null;
                if ("DeviceNotRegistered".equals(error)) dead.add(batch.get(i).token());
                else log.warn("Expo push ticket error: {}", ticket.get("message"));
            }
        }
        if (!dead.isEmpty()) tx.executeWithoutResult(s -> tokens.deleteByTokens(dead));
    }
}
