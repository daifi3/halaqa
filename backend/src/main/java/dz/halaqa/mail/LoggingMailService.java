package dz.halaqa.mail;

import dz.halaqa.course.Course;
import dz.halaqa.room.Room;
import dz.halaqa.vault.VaultDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * No real SMTP provider is configured, so invitations are logged rather than
 * sent — the roster/join-code UI still works end-to-end, nothing just lands
 * in anyone's inbox yet. Replace with a JavaMailSender-backed implementation
 * once real credentials (SMTP host/user/password or a provider API key) are
 * available; {@link MailService} is the contract callers already use.
 */
@Service
public class LoggingMailService implements MailService {
    private static final Logger log = LoggerFactory.getLogger(LoggingMailService.class);

    @Override
    public void sendRoomInvite(String toEmail, Room room) {
        log.info("[mail:mock] class invite -> {} — \"{}\" starts {} · join code {}",
                toEmail, room.getTitle(), room.getStartsAt(), room.getJoinCode());
    }

    @Override
    public void sendCourseInvite(String toEmail, Course course) {
        log.info("[mail:mock] course invite -> {} — \"{}\" · join code {}",
                toEmail, course.getTitle(), course.getJoinCode());
    }

    @Override
    public void sendDocumentShared(String toEmail, VaultDocument document) {
        log.info("[mail:mock] document shared -> {} — \"{}\" from {}",
                toEmail, document.getTitle(), document.getOwner().getName());
    }
}
