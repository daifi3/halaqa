package dz.halaqa.notification;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PushTokenRepository extends JpaRepository<PushToken, String> {

    List<PushToken> findByUserId(String userId);

    @Modifying
    @Query("delete from PushToken p where p.token in :tokens")
    int deleteByTokens(@Param("tokens") Collection<String> tokens);
}
