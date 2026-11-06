package dz.halaqa.common;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

/** Saves uploaded files to a local folder under a random name. Shared by avatar and vault uploads. */
@Component
public class FileStorage {

    public record Stored(String storedFilename, String originalFilename, String contentType, long size) {}

    public Stored save(MultipartFile file, Path dir) throws IOException {
        Files.createDirectories(dir);
        String original = StringUtils.cleanPath(
                file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                        ? "file" : decodeName(file.getOriginalFilename()));
        int dot = original.lastIndexOf('.');
        String ext = dot >= 0 ? original.substring(dot) : "";
        String stored = UUID.randomUUID() + ext;
        file.transferTo(dir.resolve(stored).normalize());
        return new Stored(stored, original, file.getContentType(), file.getSize());
    }

    /** The mobile app's fetch percent-encodes filenames ("Cours%201.pdf"); browsers send them as-is. */
    private static String decodeName(String name) {
        try {
            return UriUtils.decode(name, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return name; // a literal "%" that isn't an escape
        }
    }

    public void delete(Path dir, String storedFilename) {
        if (storedFilename == null || storedFilename.isBlank()) return;
        try {
            Files.deleteIfExists(dir.resolve(storedFilename).normalize());
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }
}
