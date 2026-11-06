package dz.halaqa.homework;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public final class HomeworkRepositories {
    private HomeworkRepositories() {}

    public interface Assignments extends JpaRepository<Homework, String> {
        List<Homework> findByCourseIdOrderByDueAtAsc(String courseId);
    }

    public interface Submissions extends JpaRepository<HomeworkSubmission, String> {
        List<HomeworkSubmission> findByHomeworkIdOrderBySubmittedAtDesc(String homeworkId);

        Optional<HomeworkSubmission> findByHomeworkIdAndStudentId(String homeworkId, String studentId);

        Optional<HomeworkSubmission> findByStoredFilename(String storedFilename);

        long countByHomeworkId(String homeworkId);
    }
}
