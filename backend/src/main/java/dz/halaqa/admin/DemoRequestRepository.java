package dz.halaqa.admin;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DemoRequestRepository extends JpaRepository<DemoRequest, String> {
    List<DemoRequest> findAllByOrderByCreatedAtDesc();

    /** Same email asked again recently: treat it as the same request instead of filling the list. */
    boolean existsByEmailIgnoreCaseAndCreatedAtAfter(String email, Instant after);

    long countByStatus(DemoRequest.Status status);
}
