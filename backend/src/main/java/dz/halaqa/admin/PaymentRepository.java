package dz.halaqa.admin;

import dz.halaqa.auth.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Callers pass Payment.Status.recorded as :recorded (the status goes through a converter). */
public interface PaymentRepository extends JpaRepository<Payment, String> {

    /** Latest end date among the account's recorded (not voided) payments. */
    @Query("select max(p.periodEnd) from Payment p where p.user = :user and p.status = :recorded")
    Optional<LocalDate> paidUntil(@Param("user") User user, @Param("recorded") Payment.Status recorded);

    /** Newest first; voided ones too, so the history is complete. */
    @Query(value = "select p from Payment p join fetch p.user join fetch p.recordedBy order by p.paidOn desc, p.createdAt desc",
            countQuery = "select count(p) from Payment p")
    Page<Payment> history(Pageable pageable);

    @Query(value = "select p from Payment p join fetch p.user join fetch p.recordedBy where p.user.id = :userId order by p.paidOn desc, p.createdAt desc",
            countQuery = "select count(p) from Payment p where p.user.id = :userId")
    Page<Payment> historyFor(@Param("userId") String userId, Pageable pageable);

    /** Recorded payments of these accounts, newest first: the caller keeps the first per account. */
    @Query("select p from Payment p where p.user.id in :userIds and p.status = :recorded order by p.paidOn desc, p.createdAt desc")
    List<Payment> recordedFor(@Param("userIds") Collection<String> userIds, @Param("recorded") Payment.Status recorded);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.user.id = :userId and p.status = :recorded")
    BigDecimal totalFor(@Param("userId") String userId, @Param("recorded") Payment.Status recorded);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.user.role = :role and p.status = :recorded "
            + "and p.paidOn between :from and :to")
    BigDecimal collected(@Param("role") User.Role role, @Param("recorded") Payment.Status recorded,
                         @Param("from") LocalDate from, @Param("to") LocalDate to);
}
