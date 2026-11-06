package dz.halaqa.livekit;

import dz.halaqa.recording.RecordingRepository;
import dz.halaqa.room.RoomRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.file.Path;
import livekit.LivekitEgress;
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
    private final RecordingRepository recordings;
    private final RoomRepository rooms;

    public LiveKitWebhookController(LiveKitService livekit, RecordingRepository recordings, RoomRepository rooms) {
        this.livekit = livekit;
        this.recordings = recordings;
        this.rooms = rooms;
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
            case "egress_ended" -> onEgressEnded(event.getEgressInfo());
            default -> log.debug("LiveKit event {}", event.getEvent());
        }
        return ResponseEntity.ok().build();
    }

    private void onEgressEnded(LivekitEgress.EgressInfo info) {
        recordings.findByEgressId(info.getEgressId()).ifPresent(rec -> {
            if (info.getStatus() == LivekitEgress.EgressStatus.EGRESS_COMPLETE && info.getFileResultsCount() > 0) {
                var file = info.getFileResults(0);
                String name = Path.of(file.getFilename()).getFileName().toString();
                rec.markReady(name, file.getDuration() / 1_000_000_000L); // ns → s
            } else {
                rec.markFailed();
            }
        });
        // If recording stopped on its own (room emptied), clear the flag on the room.
        rooms.findByActiveEgressId(info.getEgressId()).ifPresent(r -> r.setActiveEgressId(null));
    }
}
