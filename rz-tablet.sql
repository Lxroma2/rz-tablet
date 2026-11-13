-- rz-tablet : schema de la base
-- Les tables sont aussi creees automatiquement au demarrage (MySQL.ready dans server/*.lua).
-- Ce fichier sert a une installation manuelle. Tables ESX utilisees sans creation : owned_vehicles, users.

-- server/bank.lua
CREATE TABLE IF NOT EXISTS rz_tablet_bank_log (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(60) NOT NULL,
    amount BIGINT NOT NULL,
    balance BIGINT NULL,
    reason VARCHAR(100) NOT NULL DEFAULT '',
    created_at INT NOT NULL,
    INDEX idx_rz_bank (identifier, id)
);

-- server/lock.lua
CREATE TABLE IF NOT EXISTS rz_tablet_locks (
    serial VARCHAR(40) NOT NULL PRIMARY KEY,
    owner VARCHAR(80) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    pin_hash VARCHAR(20) NOT NULL DEFAULT ''
);

-- server/notes.lua
CREATE TABLE IF NOT EXISTS rz_tablet_notes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    serial VARCHAR(40) NOT NULL,
    body TEXT NOT NULL,
    updated_at INT NOT NULL,
    INDEX idx_rz_notes_serial (serial)
);

-- server/services.lua
CREATE TABLE IF NOT EXISTS rz_tablet_services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(40) NOT NULL,
    job VARCHAR(50) NOT NULL,
    description VARCHAR(160) NOT NULL DEFAULT '',
    website VARCHAR(200) NOT NULL DEFAULT '',
    image VARCHAR(300) NOT NULL DEFAULT '',
    x DOUBLE NULL,
    y DOUBLE NULL,
    UNIQUE KEY uq_job (job)
);

CREATE TABLE IF NOT EXISTS rz_tablet_service_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED NOT NULL,
    sender_id VARCHAR(80) NOT NULL,
    sender_name VARCHAR(80) NOT NULL,
    player_id VARCHAR(80) NOT NULL DEFAULT '',
    player_name VARCHAR(80) NOT NULL DEFAULT '',
    from_service TINYINT(1) NOT NULL DEFAULT 0,
    message VARCHAR(300) NOT NULL,
    x DOUBLE NULL,
    y DOUBLE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_service (service_id),
    KEY idx_thread (service_id, player_id)
);

-- server/admin.lua (Reglages > Administration : sites autorises et apps web ajoutes en jeu par le staff)
CREATE TABLE IF NOT EXISTS rz_tablet_sites (
    host VARCHAR(120) NOT NULL PRIMARY KEY,
    created_at INT NOT NULL
);

CREATE TABLE IF NOT EXISTS rz_tablet_apps (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    label VARCHAR(24) NOT NULL,
    subtitle VARCHAR(60) NOT NULL DEFAULT '',
    category VARCHAR(24) NOT NULL DEFAULT '',
    url VARCHAR(300) NOT NULL,
    image VARCHAR(300) NOT NULL DEFAULT '',
    color VARCHAR(9) NOT NULL DEFAULT '',
    icon VARCHAR(48) NOT NULL DEFAULT '',
    description VARCHAR(600) NOT NULL DEFAULT '',
    created_at INT NOT NULL
);
