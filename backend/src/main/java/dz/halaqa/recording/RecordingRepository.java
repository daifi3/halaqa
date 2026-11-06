package dz.halaqa.recording;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RecordingRepository extends JpaRepository<Recording, String> {
    Optional<Recording> findByEgressId(String egressId);

    @Query("""
        select distinct rec from Recording rec
        join rec.room r
        left join r.invitedEmails e
        left join r.memberIds m
        where r.teacher.id = :userId or m = :userId or e = :email
        order by rec.recordedAt desc
        """)
    List<Recording> findVisibleTo(String userId, String email);
}
