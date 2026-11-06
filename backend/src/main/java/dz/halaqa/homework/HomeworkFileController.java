package dz.halaqa.homework;

import dz.halaqa.common.HalaqaProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Serves homework attachments at an unguessable URL — the same "public by URL"
 * tradeoff as vault files, so the app can open them in a viewer without a token.
 */
@Tag(name = "Files", description = "Downloads for vault documents and homework attachments, by their unguessable stored name.")
@RestController
public class HomeworkFileController {

    private final HomeworkRepositories.Submissions submissions;
    private final HalaqaProperties props;

    public HomeworkFileController(HomeworkRepositories.Submissions submissions, HalaqaProperties props) {
        this.submissions = submissions;
        this.props = props;
    }

    @GetMapping("/homework-files/{storedFilename}")
    public ResponseEntity<FileSystemResource> get(@PathVariable String storedFilename) {
        HomeworkSubmission sub = submissions.findByStoredFilename(storedFilename)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Path file = Path.of(props.storage().homeworkDir()).resolve(storedFilename).normalize();
        if (!Files.exists(file)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);

        MediaType type = sub.getMimeType() != null
                ? MediaType.parseMediaType(sub.getMimeType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(sub.getOriginalFilename()).build().toString())
                .body(new FileSystemResource(file));
    }
}
