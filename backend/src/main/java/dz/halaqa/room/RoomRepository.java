package dz.halaqa.room;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RoomRepository extends JpaRepository<Room, String> {
    Optional<Room> findByJoinCode(String joinCode);

    Optional<Room> findByActiveEgressId(String egressId);

    boolean existsByJoinCode(String joinCode);

    List<Room> findByCourseId(String courseId);

    long countByCourseId(String courseId);

    @Query("""
        select distinct r from Room r
        left join r.invitedEmails e
        left join r.memberIds m
        left join r.course c
        left join c.invitedEmails ce
        left join c.memberIds cm
        where r.teacher.id = :userId or m = :userId or e = :email
           or (c is not null and (c.teacher.id = :userId or cm = :userId or ce = :email))
        order by r.startsAt
        """)
    List<Room> findVisibleTo(String userId, String email);
}
