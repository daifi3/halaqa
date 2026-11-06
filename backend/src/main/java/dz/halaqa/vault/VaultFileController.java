package dz.halaqa.vault;

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
 * Serves vault files at a plain, unguessable URL — same "public by URL"
 * tradeoff already used for /recordings/**. Kept as its own controller
 * (rather than Spring's static resource handling) so the original filename
 * survives in Content-Disposition instead of the random stored name.
 */
@Tag(name = "Files", description = "Downloads for vault documents and homework attachments, by their unguessable stored name.")
@RestController
public class VaultFileController {

    private final VaultDocumentRepository documents;
    private final HalaqaProperties props;

    public VaultFileController(VaultDocumentRepository documents, HalaqaProperties props) {
        this.documents = documents;
        this.props = props;
    }

    @GetMapping("/vault-files/{storedFilename}")
    public ResponseEntity<FileSystemResource> get(@PathVariable String storedFilename) {
        VaultDocument doc = documents.findByStoredFilename(storedFilename)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Path file = Path.of(props.storage().vaultDir()).resolve(storedFilename).normalize();
        if (!Files.exists(file)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);

        MediaType type = doc.getMimeType() != null
                ? MediaType.parseMediaType(doc.getMimeType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(doc.getOriginalFilename()).build().toString())
                .body(new FileSystemResource(file));
    }
}
