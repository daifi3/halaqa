package dz.halaqa.exam;

import com.fasterxml.jackson.core.type.TypeReference;
import dz.halaqa.auth.User;
import dz.halaqa.common.Json;
import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * A student's single attempt at an exam. Once finished the answers never change; the teacher
 * grades the written ones, then finalizes the attempt, which releases the grade to the student.
 */
@Entity
@Table(name = "exam_attempts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"exam_id", "student_id"}))
public class ExamAttempt {
    private static final TypeReference<LinkedHashMap<String, Object>> ANSWERS = new TypeReference<>() {};
    private static final TypeReference<LinkedHashMap<String, Integer>> GRADES = new TypeReference<>() {};

    /** Network slack: an answer or submit sent just before the deadline still counts. */
    static final Duration GRACE = Duration.ofSeconds(15);

    public enum Finish { submitted, time_up, left }

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false)
    private Exam exam;

    @ManyToOne(optional = false)
    private User student;

    @Column(nullable = false)
    private Instant startedAt = Instant.now();

    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    private Finish finish;

    /** Question id → chosen option index (number) or written answer (string). */
    @Column(nullable = false, length = 200_000)
    private String answersJson = "{}";

    /** Question id → points the teacher awarded a written answer. */
    @Column(nullable = false, length = 20_000)
    private String writtenGradesJson = "{}";

    /** When the teacher finalized the grade. Grades are locked while it's set. */
    private Instant finalizedAt;

    protected ExamAttempt() {}

    public ExamAttempt(Exam exam, User student) {
        this.exam = exam;
        this.student = student;
    }

    public Instant deadline() { return exam.deadlineFor(startedAt); }

    public boolean isFinished() { return finish != null; }

    /**
     * Closes an attempt whose time ran out while nobody was looking (the app was closed,
     * the phone died). Called before every read or write, so an overdue attempt can't
     * be answered and always reports how it really ended.
     */
    public boolean expireIfDue(Instant now) {
        if (isFinished() || !now.isAfter(deadline().plus(GRACE))) return false;
        finish = Finish.time_up;
        finishedAt = deadline();
        return true;
    }

    /** Ends the attempt. True if this call ended it, false if it had already ended. */
    public boolean finish(Finish how, Instant now) {
        if (isFinished()) return false;
        boolean late = now.isAfter(deadline());
        finish = late ? Finish.time_up : how;
        finishedAt = late ? deadline() : now;
        return true;
    }

    public boolean isFinalized() { return finalizedAt != null; }

    public void finalizeGrade(Instant now) { finalizedAt = now; }

    public void reopenGrade() { finalizedAt = null; }

    public Map<String, Object> getAnswers() { return Json.read(answersJson, ANSWERS); }

    public void setAnswer(String questionId, Object value) {
        Map<String, Object> answers = getAnswers();
        if (value == null) answers.remove(questionId);
        else answers.put(questionId, value);
        answersJson = Json.write(answers);
    }

    public Map<String, Integer> getWrittenGrades() { return Json.read(writtenGradesJson, GRADES); }

    public void setWrittenGrade(String questionId, int points) {
        Map<String, Integer> grades = getWrittenGrades();
        grades.put(questionId, points);
        writtenGradesJson = Json.write(grades);
    }

    public String getId() { return id; }
    public Exam getExam() { return exam; }
    public User getStudent() { return student; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public Finish getFinish() { return finish; }
    public Instant getFinalizedAt() { return finalizedAt; }
}
