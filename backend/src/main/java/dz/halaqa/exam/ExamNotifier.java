package dz.halaqa.exam;

import dz.halaqa.notification.Notification;
import dz.halaqa.notification.NotificationService;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.stereotype.Component;

/** Exam events that notify someone: a student finishing (to the teacher) and a final grade (to the student). */
@Component
public class ExamNotifier {

    private final NotificationService notifications;

    public ExamNotifier(NotificationService notifications) {
        this.notifications = notifications;
    }

    /**
     * Closes the attempt if its time ran out, telling the teacher when it does.
     * Use instead of {@link ExamAttempt#expireIfDue} everywhere.
     */
    public boolean expireIfDue(ExamAttempt a, Instant now) {
        boolean expired = a.expireIfDue(now);
        if (expired) finished(a);
        return expired;
    }

    /** The attempt just ended: tell the course teacher, with what's left to do. */
    public void finished(ExamAttempt a) {
        Exam exam = a.getExam();
        String student = a.getStudent().getName();
        String title = switch (a.getFinish()) {
            case submitted -> student + " submitted “" + exam.getTitle() + "”";
            case time_up -> "Time ran out for " + student + " on “" + exam.getTitle() + "”";
            case left -> student + " left “" + exam.getTitle() + "”";
        };
        ExamController.ScoreDto score = ExamController.score(exam, a);
        String next = score.ungraded() > 0
                ? score.ungraded() + (score.ungraded() == 1 ? " written answer" : " written answers") + " to grade"
                : "Auto-graded " + grade(score) + " · ready to finalize";
        notifications.notify(exam.getTeacher(), Notification.Kind.exam_submitted, title,
                exam.getCourse().getTitle() + " · " + next, "/exam/attempt/" + a.getId());
    }

    /** The teacher finalized the grade: tell the student. */
    public void finalized(ExamAttempt a) {
        Exam exam = a.getExam();
        ExamController.ScoreDto score = ExamController.score(exam, a);
        notifications.notify(a.getStudent(), Notification.Kind.exam_graded,
                "Your grade for “" + exam.getTitle() + "”: " + grade(score),
                exam.getCourse().getTitle() + " · Graded by " + exam.getTeacher().getName(),
                "/exam/" + exam.getId());
    }

    /** 15.0 → "15/20", 14.5 → "14.5/20". */
    static String grade(ExamController.ScoreDto s) {
        return BigDecimal.valueOf(s.grade()).stripTrailingZeros().toPlainString() + "/" + s.scale();
    }
}
