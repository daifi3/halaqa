package dz.halaqa.room;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Class chat", description = "The saved history of a session's chat. Live delivery goes over LiveKit.")
@RestController
@RequestMapping("/api/rooms/{roomId}/messages")
public class ChatController {

    /** How much history a late joiner gets. */
    private static final int HISTORY = 200;

    public interface Messages extends JpaRepository<ChatMessage, String> {
        List<ChatMessage> findByRoomIdOrderBySentAtDesc(String roomId, PageRequest page);

        Optional<ChatMessage> findByRoomIdAndClientId(String roomId, String clientId);
    }

    public record NewMessageRequest(
            @NotBlank @Size(max = 40) String id,
            @NotBlank @Size(max = 500) String text) {}

    /** `at` is epoch milliseconds, matching what the app sends over LiveKit. */
    public record MessageDto(String id, String authorId, String author, boolean teacher, String text, long at) {
        static MessageDto of(ChatMessage m) {
            Room room = m.getRoom();
            return new MessageDto(m.getClientId(), m.getAuthor().getId(), m.getAuthor().getName(),
                    room.getTeacher().getId().equals(m.getAuthor().getId()), m.getText(), m.getSentAt().toEpochMilli());
        }
    }

    private final Messages messages;
    private final RoomRepository rooms;

    public ChatController(Messages messages, RoomRepository rooms) {
        this.messages = messages;
        this.rooms = rooms;
    }

    @Operation(summary = "The latest messages, oldest first")
    @GetMapping
    public List<MessageDto> history(@PathVariable String roomId, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        accessible(roomId, me);
        var latest = messages.findByRoomIdOrderBySentAtDesc(roomId, PageRequest.of(0, HISTORY));
        return latest.reversed().stream().map(MessageDto::of).toList();
    }

    @Operation(summary = "Save a message",
            description = "The author is always the signed-in user. Sending the same `id` twice returns the stored message.")
    @PostMapping
    @Transactional
    public MessageDto post(@PathVariable String roomId, @Valid @RequestBody NewMessageRequest req,
                           @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = accessible(roomId, me);
        if (room.getStatus() == Room.Status.ended) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This class has ended");
        }
        return messages.findByRoomIdAndClientId(roomId, req.id())
                .map(MessageDto::of)
                .orElseGet(() -> MessageDto.of(messages.save(new ChatMessage(room, me, req.id(), req.text().trim()))));
    }

    private Room accessible(String roomId, User me) {
        Room room = rooms.findById(roomId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));
        if (!room.canAccess(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not invited to this class");
        return room;
    }
}
