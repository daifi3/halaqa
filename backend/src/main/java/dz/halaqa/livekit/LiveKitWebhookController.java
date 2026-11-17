package dz.halaqa.livekit;

import dz.halaqa.recording.RecordingSync;
import io.swagger.v3.oas.annotations.tags.Tag;
import livekit.LivekitWebhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * LiveKit calls this when things happen in a room. We use egress_ended
 * to mark a recording as ready (or failed) once the MP4 is written.
 * Configure the URL in livekit.yaml → webhook.urls.
 */
@Tag(name = "LiveKit webhook", description = "Called by the LiveKit server (signed with the API secret), not by the app.")
@RestController
@RequestMapping("/api/livekit")
public class LiveKitWebhookController {
    private static final Logger log = LoggerFactory.getLogger(LiveKitWebhookController.class);

    private final LiveKitService livekit;
    private final RecordingSync recordings;

    public LiveKitWebhookController(LiveKitService livekit, RecordingSync recordings) {
        this.livekit = livekit;
        this.recordings = recordings;
    }

    @PostMapping(value = "/webhook", consumes = {"application/webhook+json", "application/json"})
    @Transactional
    public ResponseEntity<Void> webhook(@RequestBody String body, @RequestHeader("Authorization") String auth) {
        LivekitWebhook.WebhookEvent event;
        try {
            event = livekit.webhookReceiver().receive(body, auth); // verifies the signature
        } catch (Exception e) {
            return ResponseEntity.status(401).build();
        }

        switch (event.getEvent()) {
            case "egress_ended" -> recordings.apply(event.getEgressInfo());
            default -> log.debug("LiveKit event {}", event.getEvent());
        }
        return ResponseEntity.ok().build();
    }
}
