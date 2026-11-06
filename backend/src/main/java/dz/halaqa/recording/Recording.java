package dz.halaqa.recording;

import dz.halaqa.room.Room;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recordings")
public class Recording {
    public enum Status { processing, ready, failed }

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false)
    private Room room;

    @Column(nullable = false, unique = true)
    private String egressId;

    private Instant recordedAt = Instant.now();
    private long durationSec;
    /** File name inside ./recordings, set when egress finishes. */
    private String fileName;

    @Enumerated(EnumType.STRING)
    private Status status = Status.processing;

    protected Recording() {}

    public Recording(Room room, String egressId) {
        this.room = room;
        this.egressId = egressId;
    }

    public String getId() { return id; }
    public Room getRoom() { return room; }
    public String getEgressId() { return egressId; }
    public Instant getRecordedAt() { return recordedAt; }
    public long getDurationSec() { return durationSec; }
    public String getFileName() { return fileName; }
    public Status getStatus() { return status; }

    public void markReady(String fileName, long durationSec) {
        this.fileName = fileName;
        this.durationSec = durationSec;
        this.status = Status.ready;
    }

    public void markFailed() { this.status = Status.failed; }
}
