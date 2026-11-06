package dz.halaqa.vault;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VaultDocumentRepository extends JpaRepository<VaultDocument, String> {
    List<VaultDocument> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

    Optional<VaultDocument> findByStoredFilename(String storedFilename);

    @Query("""
        select distinct d from VaultDocument d
        left join d.sharedEmails e
        where e = :email
        order by d.createdAt desc
        """)
    List<VaultDocument> findSharedWith(@Param("email") String email);
}
