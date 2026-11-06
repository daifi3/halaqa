package dz.halaqa.vault;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import dz.halaqa.common.FileStorage;
import dz.halaqa.common.HalaqaProperties;
import dz.halaqa.mail.MailService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Vault", description = "A teacher's documents and who they are shared with.")
@RestController
@RequestMapping("/api/vault")
public class VaultController {

    public record ShareRequest(@NotEmpty List<@Email String> emails) {}

    public record UpdateRequest(@Size(max = 120) String title, @Size(max = 60) String folder) {}

    public record DocumentDto(String id, String title, String folder, String mimeType, long sizeBytes,
                               String url, Instant createdAt, Map<String, String> owner,
                               List<String> sharedEmails, boolean canManage) {
        static DocumentDto of(VaultDocument d, User viewer, HalaqaProperties props) {
            boolean owner = d.getOwner().getId().equals(viewer.getId());
            return new DocumentDto(d.getId(), d.getTitle(), d.getFolder(), d.getMimeType(), d.getSizeBytes(),
                    props.publicBaseUrl() + "/vault-files/" + d.getStoredFilename(), d.getCreatedAt(),
                    Map.of("id", d.getOwner().getId(), "name", d.getOwner().getName()),
                    owner ? List.copyOf(d.getSharedEmails()) : List.of(), owner);
        }
    }

    private final VaultDocumentRepository documents;
    private final FileStorage storage;
    private final HalaqaProperties props;
    private final MailService mail;

    public VaultController(VaultDocumentRepository documents, FileStorage storage, HalaqaProperties props, MailService mail) {
        this.documents = documents;
        this.storage = storage;
        this.props = props;
        this.mail = mail;
    }

    /** The signed-in teacher's own vault. */
    @GetMapping("/mine")
    public List<DocumentDto> mine(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireTeacher(me);
        return documents.findByOwnerIdOrderByCreatedAtDesc(me.getId()).stream()
                .map(d -> DocumentDto.of(d, me, props))
                .toList();
    }

    /** Documents someone else has shared with me. */
    @GetMapping("/shared")
    public List<DocumentDto> shared(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return documents.findSharedWith(me.getEmail().toLowerCase()).stream()
                .map(d -> DocumentDto.of(d, me, props))
                .toList();
    }

    @GetMapping("/{id}")
    public DocumentDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return DocumentDto.of(accessible(id, me), me, props);
    }

    @PostMapping
    @Transactional
    public DocumentDto upload(@RequestParam("file") MultipartFile file,
                               @RequestParam(value = "title", required = false) String title,
                               @RequestParam(value = "folder", required = false) String folder,
                               @RequestAttribute(AuthInterceptor.USER_ATTR) User me) throws IOException {
        requireTeacher(me);
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file provided");
        FileStorage.Stored stored = storage.save(file, Path.of(props.storage().vaultDir()));
        String docTitle = (title == null || title.isBlank()) ? stored.originalFilename() : title.trim();
        VaultDocument doc = new VaultDocument(docTitle, stored.originalFilename(), stored.storedFilename(),
                stored.contentType(), stored.size(), blankToNull(folder), me);
        return DocumentDto.of(documents.save(doc), me, props);
    }

    @PatchMapping("/{id}")
    @Transactional
    public DocumentDto update(@PathVariable String id, @Valid @RequestBody UpdateRequest req,
                               @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        VaultDocument doc = owned(id, me);
        if (req.title() != null && !req.title().isBlank()) doc.setTitle(req.title().trim());
        if (req.folder() != null) doc.setFolder(blankToNull(req.folder()));
        return DocumentDto.of(doc, me, props);
    }

    @PostMapping("/{id}/share")
    @Transactional
    public DocumentDto share(@PathVariable String id, @Valid @RequestBody ShareRequest req,
                              @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        VaultDocument doc = owned(id, me);
        var emails = normalizeEmails(req.emails());
        doc.getSharedEmails().addAll(emails);
        emails.forEach(e -> mail.sendDocumentShared(e, doc));
        return DocumentDto.of(doc, me, props);
    }

    @DeleteMapping("/{id}/share/{email}")
    @Transactional
    public DocumentDto unshare(@PathVariable String id, @PathVariable String email,
                                @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        VaultDocument doc = owned(id, me);
        doc.getSharedEmails().remove(email.trim().toLowerCase());
        return DocumentDto.of(doc, me, props);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        VaultDocument doc = owned(id, me);
        storage.delete(Path.of(props.storage().vaultDir()), doc.getStoredFilename());
        documents.delete(doc);
    }

    /* ---------------------------------------------------------------- */

    private VaultDocument accessible(String id, User me) {
        VaultDocument doc = documents.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
        if (!doc.canAccess(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You don't have access to this document");
        return doc;
    }

    private VaultDocument owned(String id, User me) {
        VaultDocument doc = accessible(id, me);
        if (!doc.getOwner().getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can do this");
        }
        return doc;
    }

    private static void requireTeacher(User me) {
        if (!me.isTeacher()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teachers have a vault");
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static LinkedHashSet<String> normalizeEmails(List<String> emails) {
        return emails.stream().map(e -> e.trim().toLowerCase()).collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
