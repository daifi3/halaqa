CREATE TABLE recordings (
    id           VARCHAR(255) PRIMARY KEY,
    room_id      VARCHAR(255) NOT NULL REFERENCES rooms (id),
    egress_id    VARCHAR(255) NOT NULL UNIQUE,
    recorded_at  TIMESTAMP(6) WITH TIME ZONE,
    duration_sec BIGINT       NOT NULL,
    file_name    VARCHAR(255),
    status       VARCHAR(255) CHECK (status IN ('processing', 'ready', 'failed'))
);

CREATE INDEX idx_recordings_room ON recordings (room_id);
