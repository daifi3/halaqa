package dz.halaqa.chat;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public final class ChatRepositories {
    private ChatRepositories() {}

    public interface Conversations extends JpaRepository<Conversation, String> {
        Optional<Conversation> findByUserAIdAndUserBId(String userAId, String userBId);

        @Query("select c from Conversation c where c.userA.id = :userId or c.userB.id = :userId order by coalesce(c.lastMessageAt, c.createdAt) desc")
        List<Conversation> forUser(@Param("userId") String userId);
    }

    public interface Messages extends JpaRepository<DirectMessage, String> {
        @Query("select m from DirectMessage m where m.conversation.id = :conversationId and m.createdAt < :before order by m.createdAt desc")
        List<DirectMessage> page(@Param("conversationId") String conversationId, @Param("before") Instant before, PageRequest page);

        Optional<DirectMessage> findFirstByConversationIdOrderByCreatedAtDesc(String conversationId);

        Optional<DirectMessage> findByConversationIdAndClientId(String conversationId, String clientId);

        Optional<DirectMessage> findByStoredFilename(String storedFilename);

        @Query("select count(m) from DirectMessage m where m.conversation.id = :conversationId and m.sender.id <> :userId and m.createdAt > :since")
        long unread(@Param("conversationId") String conversationId, @Param("userId") String userId, @Param("since") Instant since);
    }

    public interface Reactions extends JpaRepository<MessageReaction, MessageReaction.Key> {
        List<MessageReaction> findByMessageIdIn(Collection<String> messageIds);
    }
}
