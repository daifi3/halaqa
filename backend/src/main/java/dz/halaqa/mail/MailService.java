package dz.halaqa.mail;

import dz.halaqa.course.Course;
import dz.halaqa.room.Room;
import dz.halaqa.vault.VaultDocument;

/**
 * Invitation emails. {@link LoggingMailService} is the only implementation
 * for now — it logs instead of sending (no SMTP provider is configured yet).
 * Swap in a JavaMailSender-backed bean later; callers don't need to change.
 */
public interface MailService {
    void sendRoomInvite(String toEmail, Room room);

    void sendCourseInvite(String toEmail, Course course);

    void sendDocumentShared(String toEmail, VaultDocument document);
}
