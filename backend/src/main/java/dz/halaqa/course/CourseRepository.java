package dz.halaqa.course;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CourseRepository extends JpaRepository<Course, String> {
    Optional<Course> findByJoinCode(String joinCode);

    boolean existsByJoinCode(String joinCode);

    @Query("""
        select distinct c from Course c
        left join c.invitedEmails e
        left join c.memberIds m
        where c.teacher.id = :userId or m = :userId or e = :email
        order by c.createdAt desc
        """)
    List<Course> findVisibleTo(String userId, String email);
}
