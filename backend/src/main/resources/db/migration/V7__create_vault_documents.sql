CREATE TABLE vault_documents (
    id                VARCHAR(255) PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename   VARCHAR(255) NOT NULL UNIQUE,
    mime_type         VARCHAR(255),
    size_bytes        BIGINT       NOT NULL,
    folder            VARCHAR(255),
    owner_id          VARCHAR(255) NOT NULL REFERENCES users (id),
    created_at        TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_vault_documents_owner_created ON vault_documents (owner_id, created_at);

CREATE TABLE vault_document_shares (
    vault_document_id VARCHAR(255) NOT NULL REFERENCES vault_documents (id),
    shared_emails     VARCHAR(255) NOT NULL,
    PRIMARY KEY (vault_document_id, shared_emails)
);

CREATE INDEX idx_vault_document_shares_email ON vault_document_shares (shared_emails);
