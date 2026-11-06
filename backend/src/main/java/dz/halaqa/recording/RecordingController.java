package dz.halaqa.recording;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import dz.halaqa.common.HalaqaProperties;
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
    private final HalaqaProperties props;

    public RecordingController(RecordingRepository recordings, HalaqaProperties props) {
        this.recordings = recordings;
        this.props = props;
    }

    @GetMapping
    public List<RecordingDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return recordings.findVisibleTo(me.getId(), me.getEmail()).stream().map(r -> new RecordingDto(
                r.getId(), r.getRoom().getId(), r.getRoom().getTitle(), r.getRoom().getSubject(), r.getRecordedAt(),
                r.getDurationSec(),
                r.getFileName() == null ? null : props.publicBaseUrl() + "/recordings/" + r.getFileName(),
                r.getStatus()
        )).toList();
        // NOTE: files under /recordings are public by URL. For production, move them to
        // S3/R2 and return short-lived signed URLs here instead.
    }
}
