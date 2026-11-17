package dz.halaqa.recording;

import dz.halaqa.common.HalaqaProperties;
import dz.halaqa.livekit.LiveKitService;
import dz.halaqa.room.RoomRepository;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import livekit.LivekitEgress;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns a finished LiveKit recording (egress) into a ready — or failed — Recording, and says
 * where its file can be played. Fed by the egress_ended webhook, and also by asking LiveKit
 * directly for recordings still "processing", so they finish even when the webhook can't
 * reach this server (a local backend, or no webhook set up in LiveKit Cloud yet).
 */
@Service
public class RecordingSync {

    /** Give Egress a moment before asking about a recording it only just started. */
    private static final Duration ASK_AFTER = Duration.ofSeconds(20);

    private final RecordingRepository recordings;
    private final RoomRepository rooms;
    private final LiveKitService livekit;
    private final HalaqaProperties props;

    public RecordingSync(RecordingRepository recordings, RoomRepository rooms, LiveKitService livekit, HalaqaProperties props) {
        this.recordings = recordings;
        this.rooms = rooms;
        this.livekit = livekit;
        this.props = props;
    }

    /** Applies what LiveKit says about an egress. Still running: nothing changes. */
    @Transactional
    public void apply(LivekitEgress.EgressInfo info) {
        var status = info.getStatus();
        boolean done = status == LivekitEgress.EgressStatus.EGRESS_COMPLETE || status == LivekitEgress.EgressStatus.EGRESS_LIMIT_REACHED;
        boolean failed = status == LivekitEgress.EgressStatus.EGRESS_FAILED || status == LivekitEgress.EgressStatus.EGRESS_ABORTED;
        if (!done && !failed) return;

        recordings.findByEgressId(info.getEgressId()).ifPresent(rec -> {
            if (rec.getStatus() != Recording.Status.processing) return;
            if (done && info.getFileResultsCount() > 0) {
                var file = info.getFileResults(0);
                rec.markReady(keyOf(file.getFilename()), file.getDuration() / 1_000_000_000L); // ns → s
            } else {
                rec.markFailed();
            }
        });
        // If recording stopped on its own (room emptied, time limit), clear the flag on the room.
        rooms.findByActiveEgressId(info.getEgressId()).ifPresent(r -> r.setActiveEgressId(null));
    }

    /** Asks LiveKit about recordings still processing. Cheap: there are rarely more than one or two. */
    @Transactional
    public void syncPending() {
        Instant before = Instant.now().minus(ASK_AFTER);
        for (Recording rec : recordings.findByStatus(Recording.Status.processing)) {
            if (rec.getRecordedAt().isAfter(before)) continue;
            var info = livekit.egressInfo(rec.getEgressId());
            if (info != null) apply(info);
        }
    }

    /** Uploaded files keep their path in the bucket (recordings/…); local ones just their name in ./recordings. */
    private String keyOf(String filename) {
        if (props.recordings() != null && props.recordings().s3()) return filename.replaceFirst("^/+", "");
        return Path.of(filename).getFileName().toString();
    }

    /** Where the apps play a recording from, or null while there's no file (or no public address for the bucket). */
    public String urlOf(Recording rec) {
        String key = rec.getFileName();
        if (key == null) return null;
        if (key.contains("/")) {
            String base = props.recordings() == null ? null : props.recordings().publicUrl();
            return base == null || base.isBlank() ? null : base.replaceAll("/+$", "") + "/" + key;
        }
        return props.publicBaseUrl() + "/recordings/" + key;
    }
}
