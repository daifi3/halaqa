package dz.halaqa.chat;

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

/** Serves files sent in chats by their unguessable stored name — the same tradeoff as vault files. */
@Tag(name = "Files")
@RestController
public class ChatFileController {

    private final ChatRepositories.Messages messages;
    private final HalaqaProperties props;

    public ChatFileController(ChatRepositories.Messages messages, HalaqaProperties props) {
        this.messages = messages;
        this.props = props;
    }

    @GetMapping("/chat-files/{storedFilename}")
    public ResponseEntity<FileSystemResource> get(@PathVariable String storedFilename) {
        DirectMessage m = messages.findByStoredFilename(storedFilename)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Path file = Path.of(props.storage().chatDir()).resolve(storedFilename).normalize();
        if (!Files.exists(file)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        MediaType type = m.getMimeType() != null ? MediaType.parseMediaType(m.getMimeType()) : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(m.getOriginalFilename()).build().toString())
                .body(new FileSystemResource(file));
    }
}
