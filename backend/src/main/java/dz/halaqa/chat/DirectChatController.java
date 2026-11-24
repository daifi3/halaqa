package dz.halaqa.chat;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.PersonDto;
import dz.halaqa.auth.User;
import dz.halaqa.common.FileStorage;
import dz.halaqa.common.HalaqaProperties;
import dz.halaqa.livekit.LiveKitService;
import dz.halaqa.notification.ExpoPushService;
import dz.halaqa.notification.PushToken;
import dz.halaqa.notification.PushTokenRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * One-to-one chats. Everything is saved here first, then pushed live over LiveKit: each
 * open app listens in its user's own inbox room (token from /realtime-token), and only this
 * server writes into those rooms. Typing is relayed the same way but never stored.
 */
@Tag(name = "Chats", description = "One-to-one chats: messages, files, reactions, typing, read receipts and chat themes.")
@RestController
@RequestMapping("/api/chats")
public class DirectChatController {

    /** Live events go out on this LiveKit data topic. */
    static final String TOPIC = "chat";
    private static final int PAGE = 40;
    public static final Set<String> THEMES = Set.of("default", "ocean", "forest", "sunset", "rose", "grape", "midnight", "gold");
    public static final Set<String> EMOJIS = Set.of("❤️", "😂", "👍", "😮", "😢", "🙏", "🔥", "👏");

    public record AttachmentDto(String url, String name, String mimeType, long size) {}
    public record ReactionDto(String userId, String emoji) {}
    public record MessageDto(String id, String conversationId, String clientId, String senderId, String text,
                             AttachmentDto attachment, Instant createdAt, List<ReactionDto> reactions) {}
    /** `otherReadAt` is when the other person last read the chat (for "Seen"). */
    public record ConversationDto(String id, PersonDto other, String theme, MessageDto lastMessage, long unread,
                                  Instant otherReadAt, Instant lastMessageAt, Instant createdAt) {}

    public record OpenRequest(@NotBlank String userId) {}
    public record SendRequest(@NotBlank @Size(max = 40) String id, @NotBlank @Size(max = 4000) String text) {}
    public record ReactionRequest(String emoji) {}
    public record ThemeRequest(@NotBlank String theme) {}

    private final ChatRepositories.Conversations conversations;
    private final ChatRepositories.Messages messages;
    private final ChatRepositories.Reactions reactions;
    private final AuthRepositories.Users users;
    private final LiveKitService livekit;
    private final FileStorage storage;
    private final HalaqaProperties props;
    private final PushTokenRepository pushTokens;
    private final ExpoPushService push;
    /** Spring's mapper, so live events carry the same ISO timestamps as API responses. */
    private final ObjectMapper json;

    public DirectChatController(ChatRepositories.Conversations conversations, ChatRepositories.Messages messages,
                                ChatRepositories.Reactions reactions, AuthRepositories.Users users, LiveKitService livekit,
                                FileStorage storage, HalaqaProperties props, PushTokenRepository pushTokens, ExpoPushService push,
                                ObjectMapper json) {
        this.conversations = conversations;
        this.messages = messages;
        this.reactions = reactions;
        this.users = users;
        this.livekit = livekit;
        this.storage = storage;
        this.props = props;
        this.pushTokens = pushTokens;
        this.push = push;
        this.json = json;
    }

    @Operation(summary = "Token for live chat events", description = "A listen-only LiveKit token for the user's own inbox room.")
    @PostMapping("/realtime-token")
    public Map<String, String> realtimeToken(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return Map.of("serverUrl", livekit.wsUrl(), "token", livekit.createInboxToken(me));
    }

    @Operation(summary = "My chats, most recent first")
    @GetMapping
    @Transactional(readOnly = true)
    public List<ConversationDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return conversations.forUser(me.getId()).stream().map(c -> conversationDto(c, me)).toList();
    }

    @Operation(summary = "Open the chat with someone", description = "Returns the existing chat, or starts one.")
    @PostMapping
    @Transactional
    public ConversationDto open(@Valid @RequestBody OpenRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        if (req.userId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't chat with yourself");
        User other = users.findById(req.userId()).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This person doesn't have a Halaqa account"));
        Conversation probe = new Conversation(me, other);
        Conversation c = conversations.findByUserAIdAndUserBId(probe.getUserA().getId(), probe.getUserB().getId())
                .orElseGet(() -> conversations.save(probe));
        return conversationDto(c, me);
    }

    @Operation(summary = "One chat")
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ConversationDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return conversationDto(mine(id, me), me);
    }

    @Operation(summary = "Message history", description = "Newest first, 40 at a time. Pass the oldest `createdAt` you have as `before` for the page before it.")
    @GetMapping("/{id}/messages")
    @Transactional(readOnly = true)
    public List<MessageDto> history(@PathVariable String id, @RequestParam(required = false) Instant before,
                                    @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        mine(id, me);
        List<DirectMessage> page = messages.page(id, before == null ? Instant.now().plusSeconds(60) : before, PageRequest.of(0, PAGE));
        return dtos(page);
    }

    @Operation(summary = "Send a text message", description = "Sending the same `id` twice returns the stored message.")
    @PostMapping("/{id}/messages")
    @Transactional
    public MessageDto send(@PathVariable String id, @Valid @RequestBody SendRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Conversation c = mine(id, me);
        var existing = messages.findByConversationIdAndClientId(id, req.id());
        if (existing.isPresent()) return dto(existing.get(), List.of());
        DirectMessage m = messages.save(new DirectMessage(c, me, req.id(), req.text().strip()));
        return delivered(c, m, me);
    }

    @Operation(summary = "Send a file", description = "Multipart: `file`, the message `id`, and an optional `text` caption.")
    @PostMapping(value = "/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public MessageDto sendFile(@PathVariable String id, @RequestParam("file") MultipartFile file, @RequestParam("id") String clientId,
                               @RequestParam(value = "text", required = false) String text,
                               @RequestAttribute(AuthInterceptor.USER_ATTR) User me) throws IOException {
        Conversation c = mine(id, me);
        if (clientId.isBlank() || clientId.length() > 40) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad message id");
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The file is empty");
        var existing = messages.findByConversationIdAndClientId(id, clientId);
        if (existing.isPresent()) return dto(existing.get(), List.of());
        String caption = text == null || text.isBlank() ? null : text.strip();
        if (caption != null && caption.length() > 4000) caption = caption.substring(0, 4000);
        FileStorage.Stored stored = storage.save(file, dir());
        DirectMessage m = new DirectMessage(c, me, clientId, caption);
        m.attach(stored.storedFilename(), stored.originalFilename(), stored.contentType(), stored.size());
        return delivered(c, messages.save(m), me);
    }

    @Operation(summary = "React to a message", description = "One emoji per person; send another to change it, or null to remove it.")
    @PutMapping("/{id}/messages/{messageId}/reaction")
    @Transactional
    public MessageDto react(@PathVariable String id, @PathVariable String messageId, @RequestBody ReactionRequest req,
                            @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Conversation c = mine(id, me);
        DirectMessage m = messages.findById(messageId)
                .filter(x -> x.getConversation().getId().equals(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
        var key = new MessageReaction.Key(messageId, me.getId());
        if (req.emoji() == null || req.emoji().isBlank()) {
            reactions.findById(key).ifPresent(reactions::delete);
        } else {
            if (!EMOJIS.contains(req.emoji())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported reaction");
            reactions.findById(key).ifPresentOrElse(r -> r.setEmoji(req.emoji()),
                    () -> reactions.save(new MessageReaction(messageId, me.getId(), req.emoji())));
        }
        reactions.flush();
        MessageDto out = dtos(List.of(m)).getFirst();
        relay(c, null, Map.of("type", "reaction", "conversationId", id, "message", out));
        return out;
    }

    @Operation(summary = "I'm typing", description = "Relayed live to the other person, never stored. Apps send it every few seconds while typing.")
    @PostMapping("/{id}/typing")
    @Transactional(readOnly = true)
    public void typing(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Conversation c = mine(id, me);
        relayTo(c.other(me).getId(), Map.of("type", "typing", "conversationId", id, "userId", me.getId()));
    }

    @Operation(summary = "Mark the chat read", description = "Clears my unread count and shows the other person \"Seen\".")
    @PostMapping("/{id}/read")
    @Transactional
    public ConversationDto read(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Conversation c = mine(id, me);
        Instant now = Instant.now();
        c.markRead(me, now);
        relay(c, null, Map.of("type", "read", "conversationId", id, "userId", me.getId(), "at", now));
        return conversationDto(c, me);
    }

    @Operation(summary = "Change the chat's theme", description = "Both people see the new theme.")
    @PutMapping("/{id}/theme")
    @Transactional
    public ConversationDto theme(@PathVariable String id, @Valid @RequestBody ThemeRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Conversation c = mine(id, me);
        if (!THEMES.contains(req.theme())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown theme");
        c.setTheme(req.theme());
        relay(c, null, Map.of("type", "theme", "conversationId", id, "theme", req.theme(), "userId", me.getId()));
        return conversationDto(c, me);
    }

    /* ---------- helpers ---------- */

    private Path dir() {
        return Path.of(props.storage().chatDir());
    }

    private Conversation mine(String id, User me) {
        Conversation c = conversations.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found"));
        if (!c.involves(me)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
        return c;
    }

    /** A new message: bump the chat, mark it read for the sender, tell both sides live, push the other's phones. */
    private MessageDto delivered(Conversation c, DirectMessage m, User me) {
        c.setLastMessageAt(m.getCreatedAt());
        c.markRead(me, m.getCreatedAt());
        MessageDto out = dto(m, List.of());
        relay(c, null, Map.of("type", "message", "conversationId", c.getId(), "message", out));

        User other = c.other(me);
        String body = m.getText() != null ? m.getText() : "📎 " + m.getOriginalFilename();
        if (body.length() > 140) body = body.substring(0, 137) + "…";
        Map<String, Object> data = Map.of("kind", "chat", "conversationId", c.getId(), "link", "/chat/" + c.getId());
        String title = me.getName();
        String text = body;
        List<ExpoPushService.Message> pushes = pushTokens.findByUserId(other.getId()).stream()
                .map(PushToken::getToken).map(t -> new ExpoPushService.Message(t, title, text, data)).toList();
        afterCommit(() -> push.sendLater(pushes));
        return out;
    }

    /** Sends a live event to both people in the chat (all their open apps), or everyone but `except`. */
    private void relay(Conversation c, String except, Map<String, Object> event) {
        for (User u : List.of(c.getUserA(), c.getUserB())) {
            if (!u.getId().equals(except)) relayTo(u.getId(), event);
        }
    }

    private void relayTo(String userId, Map<String, Object> event) {
        byte[] payload;
        try {
            payload = json.writeValueAsBytes(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not encode chat event", e);
        }
        afterCommit(() -> livekit.sendToUser(userId, payload, TOPIC));
    }

    private ConversationDto conversationDto(Conversation c, User me) {
        User other = c.other(me);
        MessageDto last = messages.findFirstByConversationIdOrderByCreatedAtDesc(c.getId()).map(m -> dto(m, List.of())).orElse(null);
        Instant myRead = c.readAt(me);
        long unread = messages.unread(c.getId(), me.getId(), myRead == null ? Instant.EPOCH : myRead);
        return new ConversationDto(c.getId(), PersonDto.of(other), c.getTheme(), last, unread, c.readAt(other),
                c.getLastMessageAt(), c.getCreatedAt());
    }

    private List<MessageDto> dtos(List<DirectMessage> list) {
        if (list.isEmpty()) return List.of();
        Map<String, List<ReactionDto>> byMessage = reactions.findByMessageIdIn(list.stream().map(DirectMessage::getId).toList()).stream()
                .collect(Collectors.groupingBy(MessageReaction::getMessageId,
                        Collectors.mapping(r -> new ReactionDto(r.getUserId(), r.getEmoji()), Collectors.toList())));
        return list.stream().map(m -> dto(m, byMessage.getOrDefault(m.getId(), List.of()))).toList();
    }

    private MessageDto dto(DirectMessage m, List<ReactionDto> reactionList) {
        AttachmentDto attachment = m.getStoredFilename() == null ? null : new AttachmentDto(
                props.publicBaseUrl() + "/chat-files/" + m.getStoredFilename(), m.getOriginalFilename(),
                m.getMimeType(), m.getSizeBytes() == null ? 0 : m.getSizeBytes());
        return new MessageDto(m.getId(), m.getConversation().getId(), m.getClientId(), m.getSender().getId(), m.getText(),
                attachment, m.getCreatedAt(), reactionList);
    }

    private static void afterCommit(Runnable run) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { run.run(); }
            });
        } else {
            run.run();
        }
    }
}
