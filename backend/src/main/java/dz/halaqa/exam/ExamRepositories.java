package dz.halaqa.exam;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public final class ExamRepositories {
    private ExamRepositories() {}

    public interface Exams extends JpaRepository<Exam, String> {
        List<Exam> findByCourseIdOrderByOpensAtDesc(String courseId);

        List<Exam> findByCourseIdInOrderByOpensAtDesc(Collection<String> courseIds);
    }

    public interface Attempts extends JpaRepository<ExamAttempt, String> {
        Optional<ExamAttempt> findByExamIdAndStudentId(String examId, String studentId);

        List<ExamAttempt> findByExamIdOrderByStartedAtDesc(String examId);

        long countByExamIdAndFinishIsNotNull(String examId);

        long countByExamIdAndFinalizedAtIsNotNull(String examId);

        /** Attempts still running — the sweeper closes the overdue ones. */
        List<ExamAttempt> findByFinishIsNull();
    }
}
