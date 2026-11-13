package dz.halaqa.exam;

import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Closes attempts whose time ran out while nobody was looking (the student closed the app,
 * their phone died), so the teacher hears about it within a minute instead of whenever
 * someone next opens the exam.
 */
@Component
public class ExamSweeper {

    private final ExamRepositories.Attempts attempts;
    private final ExamNotifier notifier;

    public ExamSweeper(ExamRepositories.Attempts attempts, ExamNotifier notifier) {
        this.attempts = attempts;
        this.notifier = notifier;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void closeOverdueAttempts() {
        Instant now = Instant.now();
        attempts.findByFinishIsNull().forEach(a -> notifier.expireIfDue(a, now));
    }
}
