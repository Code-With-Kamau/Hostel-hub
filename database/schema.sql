-- ============================================================
-- HostelHub Complete Database Schema (Fixed + Enhanced)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS admin_logs;
DROP TABLE IF EXISTS study_buddy_requests;
DROP TABLE IF EXISTS roommate_requests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS commissions;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS saved_hostels;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS nearby_amenities;
DROP TABLE IF EXISTS hostel_images;
DROP TABLE IF EXISTS hostels;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS university_profiles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  phone           VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('student','owner','admin','university') NOT NULL DEFAULT 'student',
  institution     VARCHAR(255),
  course          VARCHAR(255),
  year_of_study   TINYINT UNSIGNED,
  profile_photo   VARCHAR(500),
  is_banned       TINYINT(1) NOT NULL DEFAULT 0,
  email_verified  TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- EMAIL VERIFICATIONS
-- ============================================================
CREATE TABLE email_verifications (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PASSWORD RESETS
-- ============================================================
CREATE TABLE password_resets (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT         NOT NULL,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME    NOT NULL,
  used       TINYINT(1)  NOT NULL DEFAULT 0,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- UNIVERSITY PROFILES
-- ============================================================
CREATE TABLE university_profiles (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT          NOT NULL UNIQUE,
  university_name  VARCHAR(255) NOT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- HOSTELS
-- ============================================================
CREATE TABLE hostels (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  owner_id            INT            NOT NULL,
  name                VARCHAR(255)   NOT NULL,
  description         TEXT,
  address             VARCHAR(500),
  county              VARCHAR(100),
  latitude            DECIMAL(10,7),
  longitude           DECIMAL(10,7),
  nearest_institution VARCHAR(255),
  distance_to_campus  DECIMAL(6,2)   COMMENT 'km',
  room_type           ENUM('single','double','triple','ensuite','bedsitter','studio') NOT NULL,
  gender_policy       ENUM('male_only','female_only','mixed','any') NOT NULL DEFAULT 'any',
  monthly_price       DECIMAL(10,2)  NOT NULL,
  deposit_amount      DECIMAL(10,2)  NOT NULL,
  total_rooms         INT UNSIGNED   NOT NULL DEFAULT 1,
  available_rooms     INT UNSIGNED   NOT NULL DEFAULT 1,
  wifi                TINYINT(1)     NOT NULL DEFAULT 0,
  meals_provided      TINYINT(1)     NOT NULL DEFAULT 0,
  meals_description   VARCHAR(500),
  study_friendly      TINYINT(1)     NOT NULL DEFAULT 0,
  security            TINYINT(1)     NOT NULL DEFAULT 0,
  backup_power        TINYINT(1)     NOT NULL DEFAULT 0,
  allows_roommates    TINYINT(1)     NOT NULL DEFAULT 0,
  curfew_time         TIME,
  wifi_speed          VARCHAR(50),
  status              ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  average_rating      DECIMAL(3,1)   NOT NULL DEFAULT 0.0,
  total_reviews       INT UNSIGNED   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner    (owner_id),
  INDEX idx_status   (status),
  INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- HOSTEL IMAGES
-- ============================================================
CREATE TABLE hostel_images (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  hostel_id  INT          NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  is_primary TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  INDEX idx_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NEARBY AMENITIES
-- ============================================================
CREATE TABLE nearby_amenities (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  hostel_id   INT          NOT NULL,
  category    VARCHAR(50)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  distance_m  INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'metres',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  INDEX idx_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  hostel_id   INT            NOT NULL,
  student_id  INT            NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (hostel_id, student_id),
  FOREIGN KEY (hostel_id)  REFERENCES hostels(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SAVED HOSTELS
-- ============================================================
CREATE TABLE saved_hostels (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT       NOT NULL,
  hostel_id  INT       NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved (user_id, hostel_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  hostel_id       INT       NOT NULL,
  student_id      INT       NOT NULL,
  status          ENUM('pending','confirmed','cancelled','released','refunded') NOT NULL DEFAULT 'pending',
  deposit_amount  DECIMAL(10,2) NOT NULL,
  mpesa_phone     VARCHAR(20),
  check_in_date   DATE,
  notes           TEXT,
  cancel_deadline DATETIME  GENERATED ALWAYS AS (DATE_ADD(created_at, INTERVAL 3 DAY)) STORED,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id)  REFERENCES hostels(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE RESTRICT,
  INDEX idx_student (student_id),
  INDEX idx_hostel  (hostel_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  booking_id      INT          NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  mpesa_receipt   VARCHAR(100),
  mpesa_phone     VARCHAR(20),
  checkout_req_id VARCHAR(255),
  status          ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_type    ENUM('deposit','refund') NOT NULL DEFAULT 'deposit',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  INDEX idx_booking    (booking_id),
  INDEX idx_checkout   (checkout_req_id),
  INDEX idx_receipt    (mpesa_receipt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- COMMISSIONS (Admin 10% cut)
-- ============================================================
CREATE TABLE commissions (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  booking_id        INT           NOT NULL UNIQUE,
  payment_id        INT           NOT NULL,
  total_amount      DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL COMMENT '10% for admin',
  owner_amount      DECIMAL(10,2) NOT NULL COMMENT '90% for owner',
  settled           TINYINT(1)    NOT NULL DEFAULT 0,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CONVERSATIONS (Chat)
-- ============================================================
CREATE TABLE conversations (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  user1_id     INT       NOT NULL,
  user2_id     INT       NOT NULL,
  hostel_id    INT,
  last_message TEXT,
  last_msg_at  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv (user1_id, user2_id),
  FOREIGN KEY (user1_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (user2_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL,
  INDEX idx_user1 (user1_id),
  INDEX idx_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT       NOT NULL,
  sender_id       INT       NOT NULL,
  receiver_id     INT       NOT NULL,
  content         TEXT      NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id)     REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conv      (conversation_id),
  INDEX idx_sender    (sender_id),
  INDEX idx_receiver  (receiver_id),
  INDEX idx_read      (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  link       VARCHAR(500),
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user   (user_id),
  INDEX idx_unread (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ROOMMATE REQUESTS
-- ============================================================
CREATE TABLE roommate_requests (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  student_id      INT          NOT NULL,
  gender          ENUM('male','female','other') NOT NULL,
  preferred_gender ENUM('male','female','any')  NOT NULL DEFAULT 'any',
  institution     VARCHAR(255) NOT NULL,
  course          VARCHAR(255),
  min_budget      DECIMAL(10,2),
  max_budget      DECIMAL(10,2),
  move_in_date    DATE,
  bio             TEXT,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student (student_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- STUDY BUDDY REQUESTS
-- ============================================================
CREATE TABLE study_buddy_requests (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  student_id   INT          NOT NULL,
  subjects     TEXT         NOT NULL,
  study_style  ENUM('quiet','group','discussions','any') NOT NULL DEFAULT 'any',
  preferred_times VARCHAR(255),
  institution  VARCHAR(255) NOT NULL,
  bio          TEXT,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student (student_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ADMIN LOGS
-- ============================================================
CREATE TABLE admin_logs (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  admin_id   INT          NOT NULL,
  action     VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id  INT,
  details    TEXT,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin user (password: Admin@1234)
INSERT INTO users (name, email, phone, password_hash, role, email_verified) VALUES
('HostelHub Admin', 'admin@hostelhub.co.ke', '+254700000001',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1);

-- Owner (password: Owner@1234)
INSERT INTO users (name, email, phone, password_hash, role, institution, email_verified) VALUES
('Mary Wanjiku', 'mary.wanjiku@gmail.com', '+254712345678',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', NULL, 1),
('Grace Muthoni', 'grace.muthoni@gmail.com', '+254723456789',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', NULL, 1);

-- Student (password: Student@1234)
INSERT INTO users (name, email, phone, password_hash, role, institution, course, year_of_study, email_verified) VALUES
('Brian Kamau', 'brian.kamau@student.uon.ac.ke', '+254734567890',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student',
 'University of Nairobi', 'Computer Science', 2, 1);

-- University account (password: Univ@1234)
INSERT INTO users (name, email, phone, password_hash, role, email_verified) VALUES
('UoN Housing Office', 'housing@uon.ac.ke', '+254700000100',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'university', 1);

INSERT INTO university_profiles (user_id, university_name) VALUES (5, 'University of Nairobi');

-- Sample hostels
INSERT INTO hostels (owner_id, name, description, address, county, latitude, longitude,
  nearest_institution, distance_to_campus, room_type, gender_policy,
  monthly_price, deposit_amount, total_rooms, available_rooms,
  wifi, meals_provided, study_friendly, security, backup_power, status)
VALUES
(2, 'Wanjiku Student Apartments', 'Modern, secure student apartments near UoN main campus.',
 'Ngara Road, Nairobi', 'Nairobi', -1.2833, 36.8172,
 'University of Nairobi', 1.2, 'single', 'mixed',
 8500.00, 8500.00, 20, 15, 1, 0, 1, 1, 1, 'approved'),
(2, 'Campus View Hostels', 'Affordable double rooms, 5 min walk from main gate.',
 'University Way, Nairobi', 'Nairobi', -1.2800, 36.8200,
 'University of Nairobi', 0.5, 'double', 'female_only',
 6000.00, 6000.00, 30, 10, 1, 1, 1, 1, 0, 'approved'),
(3, 'Grace Court Residences', 'Ensuite rooms with all amenities included.',
 'Thika Road, Nairobi', 'Nairobi', -1.2200, 36.8800,
 'Kenyatta University', 0.8, 'ensuite', 'any',
 12000.00, 12000.00, 15, 8, 1, 1, 1, 1, 1, 'approved');
