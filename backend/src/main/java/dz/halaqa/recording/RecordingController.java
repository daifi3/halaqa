package dz.halaqa.recording;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Recordings", description = "Recorded sessions available to replay.")
@RestController
@RequestMapping("/api/recordings")
public class RecordingController {

    public record RecordingDto(String id, String roomId, String roomTitle, String subject, Instant recordedAt,
                               long durationSec, String url, Recording.Status status) {}

    private final RecordingRepository recordings;
    private final RecordingSync sync;

    public RecordingController(RecordingRepository recordings, RecordingSync sync) {
        this.recordings = recordings;
        this.sync = sync;
    }

    @GetMapping
    public List<RecordingDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        // Finish any recording the webhook hasn't told us about yet.
        sync.syncPending();
        return recordings.findVisibleTo(me.getId(), me.getEmail()).stream().map(r -> new RecordingDto(
                r.getId(), r.getRoom().getId(), r.getRoom().getTitle(), r.getRoom().getSubject(), r.getRecordedAt(),
                r.getDurationSec(), sync.urlOf(r), r.getStatus()
        )).toList();
        // NOTE: recordings are public by URL (the bucket's public address, or /recordings here).
        // For stricter privacy, return short-lived signed URLs instead.
    }
}
