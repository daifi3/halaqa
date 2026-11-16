package dz.halaqa.livekit;

import dz.halaqa.auth.User;
import dz.halaqa.common.HalaqaProperties;
import dz.halaqa.common.Json;
import dz.halaqa.room.Room;
import io.livekit.server.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import livekit.LivekitEgress;
import livekit.LivekitModels;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Everything that talks to LiveKit:
 *  - access tokens for the app (video + data channel for the whiteboard)
 *  - server-side recording with Egress (records the whole room as one MP4)
 */
@Service
public class LiveKitService {

    private final HalaqaProperties.LiveKit cfg;
    private final EgressServiceClient egress;
    private final RoomServiceClient roomService;

    public LiveKitService(HalaqaProperties props) {
        this.cfg = props.livekit();
        this.egress = EgressServiceClient.createClient(cfg.apiUrl(), cfg.apiKey(), cfg.apiSecret());
        this.roomService = RoomServiceClient.createClient(cfg.apiUrl(), cfg.apiKey(), cfg.apiSecret());
    }

    public String wsUrl() {
        return cfg.wsUrl();
    }

    public String createToken(Room room, User user) {
        AccessToken token = new AccessToken(cfg.apiKey(), cfg.apiSecret());
        token.setIdentity(user.getId());
        token.setName(user.getName());
        // The app reads this for the teacher badge and the profile picture on tiles.
        Map<String, String> metadata = new HashMap<>();
        metadata.put("role", user.getRole().name());
        if (user.getAvatarUrl() != null) metadata.put("avatarUrl", user.getAvatarUrl());
        token.setMetadata(Json.write(metadata));
        token.addGrants(
                new RoomJoin(true),
                new RoomName(room.livekitName()),
                new CanPublish(true),
                new CanSubscribe(true),
                new CanPublishData(true), // whiteboard strokes, chat, reactions
                // Students get camera + mic; screen sharing only once the teacher allows it.
                new CanPublishSources(sourcesFor(room.canShareScreen(user))),
                new RoomAdmin(user.isTeacher()));
        return token.toJwt();
    }

    /** A token for a one-to-one audio call: microphone only, no camera or screen. */
    public String createCallToken(String roomName, User user) {
        AccessToken token = new AccessToken(cfg.apiKey(), cfg.apiSecret());
        token.setIdentity(user.getId());
        token.setName(user.getName());
        Map<String, String> metadata = new HashMap<>();
        metadata.put("role", user.getRole().name());
        if (user.getAvatarUrl() != null) metadata.put("avatarUrl", user.getAvatarUrl());
        token.setMetadata(Json.write(metadata));
        token.addGrants(
                new RoomJoin(true),
                new RoomName(roomName),
                new CanPublish(true),
                new CanSubscribe(true),
                new CanPublishData(false),
                new CanPublishSources(List.of("microphone")));
        return token.toJwt();
    }

    /** Each signed-in app listens in its own "inbox" room for chat events the server sends it. */
    public static String inboxRoom(String userId) {
        return "inbox-" + userId;
    }

    /**
     * A listen-only token for the user's inbox room: no microphone, no camera, and no data
     * publishing — only the server writes there, so nobody can fake a message.
     */
    public String createInboxToken(User user) {
        AccessToken token = new AccessToken(cfg.apiKey(), cfg.apiSecret());
        token.setIdentity(user.getId());
        token.setName(user.getName());
        token.setTtl(12 * 60 * 60 * 1000L);
        token.addGrants(
                new RoomJoin(true),
                new RoomName(inboxRoom(user.getId())),
                new CanPublish(false),
                new CanPublishData(false),
                new CanSubscribe(true),
                new Hidden(false));
        return token.toJwt();
    }

    /**
     * Sends an event to every app the user has open (their inbox room). Best effort: when
     * nobody is connected the room doesn't exist and LiveKit refuses — they catch up from
     * the API (and a push notification) instead.
     */
    public void sendToUser(String userId, byte[] payload, String topic) {
        try {
            roomService.sendData(inboxRoom(userId), payload, LivekitModels.DataPacket.Kind.RELIABLE, List.of(), List.of(), topic).execute();
        } catch (IOException | RuntimeException ignored) {
            // Offline, or LiveKit unreachable.
        }
    }

    private static List<String> sourcesFor(boolean screen) {
        var sources = new ArrayList<>(List.of("camera", "microphone"));
        if (screen) sources.addAll(List.of("screen_share", "screen_share_audio"));
        return sources;
    }

    /**
     * Grants or revokes screen sharing for someone already in the call. LiveKit
     * unpublishes their screen track itself when it's revoked. Someone not
     * connected right now just gets the new rights in their next token.
     */
    public void setScreenShare(Room room, String identity, boolean allow) {
        var permission = LivekitModels.ParticipantPermission.newBuilder()
                .setCanSubscribe(true)
                .setCanPublish(true)
                .setCanPublishData(true)
                .addCanPublishSources(LivekitModels.TrackSource.CAMERA)
                .addCanPublishSources(LivekitModels.TrackSource.MICROPHONE);
        if (allow) {
            permission.addCanPublishSources(LivekitModels.TrackSource.SCREEN_SHARE)
                    .addCanPublishSources(LivekitModels.TrackSource.SCREEN_SHARE_AUDIO);
        }
        try {
            roomService.updateParticipant(room.livekitName(), identity, null, null, permission.build()).execute();
        } catch (IOException ignored) {
            // Not in the call (or LiveKit unreachable) — the stored grant applies on their next join.
        }
    }

    /**
     * Mutes one person's microphone in the live call. They can turn it back on
     * themselves. Returns false when they aren't in the call (or have no mic on).
     */
    public boolean muteMicrophone(Room room, String identity) {
        try {
            var res = roomService.getParticipant(room.livekitName(), identity).execute();
            return res.isSuccessful() && res.body() != null && muteMicrophone(room, res.body());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Live class service unreachable");
        }
    }

    /** Mutes every student in the call; teachers keep their mic. Returns how many were muted. */
    public int muteStudents(Room room) {
        try {
            var res = roomService.listParticipants(room.livekitName()).execute();
            if (!res.isSuccessful() || res.body() == null) return 0;
            int muted = 0;
            for (var p : res.body()) {
                // The token's metadata carries the role, e.g. {"role":"teacher"}.
                if (p.getMetadata().contains("\"role\":\"teacher\"")) continue;
                if (muteMicrophone(room, p)) muted++;
            }
            return muted;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Live class service unreachable");
        }
    }

    private boolean muteMicrophone(Room room, LivekitModels.ParticipantInfo p) throws IOException {
        boolean muted = false;
        for (var track : p.getTracksList()) {
            if (track.getSource() == LivekitModels.TrackSource.MICROPHONE && !track.getMuted()) {
                muted |= roomService.mutePublishedTrack(room.livekitName(), p.getIdentity(), track.getSid(), true)
                        .execute().isSuccessful();
            }
        }
        return muted;
    }

    /** Identities of everyone currently connected to the room. */
    public List<String> participants(Room room) {
        return participants(room.livekitName());
    }

    /** Identities of everyone connected to a LiveKit room, by its name (empty when it doesn't exist). */
    public List<String> participants(String livekitRoomName) {
        try {
            var res = roomService.listParticipants(livekitRoomName).execute();
            if (!res.isSuccessful() || res.body() == null) return List.of();
            return res.body().stream().map(LivekitModels.ParticipantInfo::getIdentity).toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    /** Starts a room-composite recording (grid layout, audio + video) and returns the egress id. */
    public String startRecording(Room room) {
        if (!cfg.recordingEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Recording isn't available on this server yet");
        }
        var output = LivekitEgress.EncodedFileOutput.newBuilder()
                .setFileType(LivekitEgress.EncodedFileType.MP4)
                .setFilepath(cfg.egressOutputDir() + "/" + room.getId() + "-{time}.mp4")
                .build();
        try {
            var res = egress.startRoomCompositeEgress(room.livekitName(), output, "grid").execute();
            if (!res.isSuccessful() || res.body() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Recording service refused to start (" + res.code() + ")");
            }
            return res.body().getEgressId();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Recording service unreachable");
        }
    }

    public void stopRecording(String egressId) {
        try {
            egress.stopEgress(egressId).execute();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Recording service unreachable");
        }
    }

    public void closeRoom(String livekitRoomName) {
        try {
            roomService.deleteRoom(livekitRoomName).execute();
        } catch (IOException ignored) {
            // Room may already be gone — nothing to do.
        }
    }

    public WebhookReceiver webhookReceiver() {
        return new WebhookReceiver(cfg.apiKey(), cfg.apiSecret());
    }
}
