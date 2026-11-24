-- Teachers pay Halaqa outside the app (cash, CCP, BaridiMob, transfer...). An admin records each payment;
-- it covers a number of months and moves the account's paid_until forward. A mistaken entry is voided,
-- never deleted, so the history stays complete.
CREATE TABLE payments (
    id           VARCHAR(36)   PRIMARY KEY,
    user_id      VARCHAR(36)   NOT NULL REFERENCES users (id),
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency     VARCHAR(3)    NOT NULL DEFAULT 'DZD',
    months       INT           NOT NULL CHECK (months BETWEEN 1 AND 36),
    period_start DATE          NOT NULL,
    period_end   DATE          NOT NULL,
    method       VARCHAR(20)   NOT NULL CHECK (method IN ('cash', 'ccp', 'baridimob', 'bank_transfer', 'card', 'other')),
    reference    VARCHAR(120),
    note         VARCHAR(500),
    paid_on      DATE          NOT NULL,
    recorded_by  VARCHAR(36)   NOT NULL REFERENCES users (id),
    status       VARCHAR(20)   NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
    void_reason  VARCHAR(300),
    voided_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments (user_id, period_end DESC);
CREATE INDEX idx_payments_paid_on ON payments (paid_on DESC);

-- Last day the account is paid for (from its recorded payments); null = never paid.
ALTER TABLE users ADD COLUMN paid_until DATE;
CREATE INDEX idx_users_paid_until ON users (paid_until);
