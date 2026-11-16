-- One-to-one chats between users. user_a_id < user_b_id, so a pair has exactly one conversation.
CREATE TABLE conversations (
    id              VARCHAR(255) PRIMARY KEY,
    user_a_id       VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b_id       VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The chat's colour theme, picked by either person and shown to both.
    theme           VARCHAR(30)  NOT NULL DEFAULT 'default',
    -- When each side last read the chat (drives unread counts and "Seen").
    a_read_at       TIMESTAMP(6) WITH TIME ZONE,
    b_read_at       TIMESTAMP(6) WITH TIME ZONE,
    created_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    last_message_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT uq_conversation_pair UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_conversations_a ON conversations (user_a_id, last_message_at DESC);
CREATE INDEX idx_conversations_b ON conversations (user_b_id, last_message_at DESC);

CREATE TABLE direct_messages (
    id                VARCHAR(255) PRIMARY KEY,
    conversation_id   VARCHAR(255) NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id         VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The id the sending app gave the message, so a retried send isn't stored twice.
    client_id         VARCHAR(40)  NOT NULL,
    text              VARCHAR(4000),
    stored_filename   VARCHAR(255),
    original_filename VARCHAR(255),
    mime_type         VARCHAR(255),
    size_bytes        BIGINT,
    created_at        TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_direct_message_client UNIQUE (conversation_id, client_id)
);

CREATE INDEX idx_direct_messages_timeline ON direct_messages (conversation_id, created_at DESC);
CREATE INDEX idx_direct_messages_file ON direct_messages (stored_filename);

-- One emoji per person per message; picking another replaces it.
CREATE TABLE message_reactions (
    message_id VARCHAR(255) NOT NULL REFERENCES direct_messages (id) ON DELETE CASCADE,
    user_id    VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji      VARCHAR(16)  NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    PRIMARY KEY (message_id, user_id)
);
