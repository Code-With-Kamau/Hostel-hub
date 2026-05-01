-- HostelHub Database Schema

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS admin_logs, amenity_votes, roommate_requests, study_buddy_requests,
  nearby_amenities, notifications, messages, payments, bookings,
  hostel_images, hostels, users;
SET FOREIGN_KEY_CHECKS = 1;

-- USERS
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  uuid            VARCHAR(36) UNIQUE NOT NULL,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  phone           VARCHAR(20),
  password        VARCHAR(255) NOT NULL,
  role            ENUM('student','owner','admin') DEFAULT 'student',
  profile_photo   VARCHAR(255),
  -- Student-specific
  institution     VARCHAR(200),          -- University/College name
  course          VARCHAR(150),          -- Course of study
  year_of_study   TINYINT DEFAULT 1,     -- Year 1–6
  student_id      VARCHAR(50),           -- Registration number
  -- Account
  is_active       TINYINT(1) DEFAULT 1,
  is_verified     TINYINT(1) DEFAULT 0,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- HOSTELS 
CREATE TABLE hostels (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  owner_id             INT NOT NULL,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  -- Location
  location             VARCHAR(255) NOT NULL,
  county               VARCHAR(100),
  sub_county           VARCHAR(100),
  latitude             DECIMAL(10,7),
  longitude            DECIMAL(10,7),
  -- Nearest institution (key for students)
  nearest_institution  VARCHAR(200),
  distance_to_campus   DECIMAL(5,2),     -- km to nearest campus
  -- Room info
  room_type            ENUM('single','double','triple','quad','ensuite','bedsitter','studio') DEFAULT 'single',
  price_per_month      DECIMAL(10,2) NOT NULL,
  deposit_amount       DECIMAL(10,2),
  total_rooms          INT DEFAULT 1,
  available_rooms      INT DEFAULT 1,
  -- Student features
  allows_roommates     TINYINT(1) DEFAULT 0,  -- Can students share a room
  max_roommates        TINYINT DEFAULT 2,
  gender_policy        ENUM('male_only','female_only','mixed','any') DEFAULT 'any',
  study_friendly       TINYINT(1) DEFAULT 1,   -- Quiet study environment
  -- Amenities
  wifi                 TINYINT(1) DEFAULT 0,
  wifi_speed           VARCHAR(50),             -- e.g. "20 Mbps"
  meals_provided       TINYINT(1) DEFAULT 0,
  meals_description    VARCHAR(255),            -- e.g. "Breakfast & Dinner KES 150/day"
  water_supply         ENUM('piped','borehole','bought','24hrs') DEFAULT 'piped',
  electricity          TINYINT(1) DEFAULT 1,
  backup_power         TINYINT(1) DEFAULT 0,   -- Generator/solar
  security             TINYINT(1) DEFAULT 0,
  cctv                 TINYINT(1) DEFAULT 0,
  caretaker            TINYINT(1) DEFAULT 0,
  parking              TINYINT(1) DEFAULT 0,
  laundry              TINYINT(1) DEFAULT 0,   -- Laundry area/washing machine
  gym                  TINYINT(1) DEFAULT 0,
  common_room          TINYINT(1) DEFAULT 0,   -- TV/common area
  kitchen_access       TINYINT(1) DEFAULT 0,
  fridge_access        TINYINT(1) DEFAULT 0,
  cleaning_service     TINYINT(1) DEFAULT 0,
  -- Rules
  rules                TEXT,
  no_alcohol           TINYINT(1) DEFAULT 0,
  no_smoking           TINYINT(1) DEFAULT 0,
  visitors_allowed     TINYINT(1) DEFAULT 1,
  curfew_time          VARCHAR(20),             -- e.g. "10:00 PM"
  -- Status
  status               ENUM('available','full','maintenance','unlisted') DEFAULT 'available',
  is_approved          TINYINT(1) DEFAULT 0,
  is_featured          TINYINT(1) DEFAULT 0,
  views_count          INT DEFAULT 0,
  avg_rating           DECIMAL(3,2) DEFAULT 0.00,
  review_count         INT DEFAULT 0,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- HOSTEL IMAGES 
CREATE TABLE hostel_images (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id  INT NOT NULL,
  image_url  VARCHAR(500) NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  caption    VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
);

-- BOOKINGS 
CREATE TABLE bookings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id       INT NOT NULL,
  student_id      INT NOT NULL,
  move_in_date    DATE,
  move_out_date   DATE,
  duration_months INT DEFAULT 1,
  deposit_amount  DECIMAL(10,2),
  monthly_rent    DECIMAL(10,2),
  status          ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  deposit_paid    TINYINT(1) DEFAULT 0,
  notes           TEXT,
  -- Roommate info
  wants_roommate  TINYINT(1) DEFAULT 0,
  roommate_gender ENUM('male','female','any') DEFAULT 'any',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- PAYMENTS 
CREATE TABLE payments (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  booking_id            INT NOT NULL,
  user_id               INT NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  phone                 VARCHAR(20),
  payment_method        VARCHAR(50) DEFAULT 'mpesa',
  mpesa_checkout_id     VARCHAR(100),
  mpesa_receipt_number  VARCHAR(100),
  status                ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- MESSAGES 
CREATE TABLE messages (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  sender_id        INT NOT NULL,
  receiver_id      INT NOT NULL,
  hostel_id        INT,
  conversation_id  VARCHAR(100) NOT NULL,
  message          TEXT NOT NULL,
  is_read          TINYINT(1) DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

--  NOTIFICATIONS 
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT NOT NULL,
  type       VARCHAR(50) DEFAULT 'info',
  is_read    TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SAVED HOSTELS
CREATE TABLE saved_hostels (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  hostel_id  INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_save (user_id, hostel_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
);

-- REVIEWS
CREATE TABLE reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id    INT NOT NULL,
  student_id   INT NOT NULL,
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text  TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_review (hostel_id, student_id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

--  ROOMMATE REQUESTS
CREATE TABLE roommate_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  student_id      INT NOT NULL,
  hostel_id       INT,                   -- Optional: specific hostel
  institution     VARCHAR(200),
  course          VARCHAR(150),
  year_of_study   TINYINT,
  gender          ENUM('male','female'),
  preferred_gender ENUM('male','female','any') DEFAULT 'any',
  budget_min      DECIMAL(10,2),
  budget_max      DECIMAL(10,2),
  move_in_date    DATE,
  bio             TEXT,                  -- About me & what I'm looking for
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL
);

-- STUDY BUDDY REQUESTS 
CREATE TABLE study_buddy_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  student_id      INT NOT NULL,
  institution     VARCHAR(200) NOT NULL,
  course          VARCHAR(150) NOT NULL,
  year_of_study   TINYINT,
  subjects        TEXT,                  -- Subjects they want to study together
  study_style     ENUM('quiet','group','discussions','any') DEFAULT 'any',
  preferred_time  VARCHAR(100),          -- e.g. "Evenings & weekends"
  bio             TEXT,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NEARBY AMENITIES 
CREATE TABLE nearby_amenities (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id    INT NOT NULL,
  name         VARCHAR(200) NOT NULL,
  category     ENUM('shop','supermarket','pharmacy','hospital','bank','atm','restaurant','cafe','gym','library','church','mosque','salon','market','bus_stop','other') DEFAULT 'other',
  distance_m   INT,                      -- distance in metres
  latitude     DECIMAL(10,7),
  longitude    DECIMAL(10,7),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
);

-- HOSTEL VIEWS 
CREATE TABLE hostel_views (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id  INT NOT NULL,
  user_id    INT,
  ip_address VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
);

--  ADMIN LOGS 
CREATE TABLE admin_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NOT NULL,
  action      VARCHAR(255) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
-- SAMPLE DATA
-- ═══════════════════════════════════════════════

-- Admin
INSERT INTO users (uuid,name,email,phone,password,role,is_active,is_verified) VALUES
('uuid-admin-001','Admin HostelHub','admin@hostelhub.co.ke','0700000001',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','admin',1,1);

-- Hostel Owners
INSERT INTO users (uuid,name,email,phone,password,role,institution,is_active,is_verified) VALUES
('uuid-owner-001','Mary Wanjiku','mary.wanjiku@gmail.com','0712345678',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','owner',NULL,1,1),
('uuid-owner-002','Peter Otieno','peter.otieno@gmail.com','0723456789',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','owner',NULL,1,1),
('uuid-owner-003','Grace Muthoni','grace.muthoni@gmail.com','0734567890',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','owner',NULL,1,1);

-- Students
INSERT INTO users (uuid,name,email,phone,password,role,institution,course,year_of_study,student_id,is_active,is_verified) VALUES
('uuid-student-001','Brian Kamau','brian.kamau@student.uon.ac.ke','0745678901',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','University of Nairobi','Computer Science',2,'CS/001/2023',1,1),
('uuid-student-003','Kevin Mwangi','kevin.mwangi@student.mku.ac.ke','0767890123',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','Mount Kenya University','Business Administration',3,'BA/078/2022',1,1);

-- Hostels
INSERT INTO hostels (owner_id,title,description,location,county,sub_county,latitude,longitude,
  nearest_institution,distance_to_campus,room_type,price_per_month,deposit_amount,
  total_rooms,available_rooms,allows_roommates,max_roommates,gender_policy,study_friendly,
  wifi,wifi_speed,meals_provided,meals_description,water_supply,electricity,backup_power,
  security,cctv,caretaker,laundry,common_room,kitchen_access,
  no_alcohol,no_smoking,visitors_allowed,curfew_time,
  status,is_approved,is_featured,avg_rating,review_count) VALUES

(2,'Sunrise Student Hostels','Modern student accommodation near UoN main campus. Clean, secure and study-friendly with fast WiFi.',
 'Ngara, Nairobi','Nairobi','Ngara',-1.2800,36.8240,
 'University of Nairobi',0.8,'single',8500,8500,
 40,12,1,2,'any',1,
 1,'20 Mbps',1,'Breakfast KES 100 | Dinner KES 150','piped',1,1,
 1,1,1,1,1,1,
 1,1,1,'10:30 PM',
 'available',1,1,4.5,23),

(2,'Campus View Hostels','Double rooms with beautiful view. Perfect for students who prefer sharing costs. 2 mins walk to KU gate.',
 'Kahawa West, Nairobi','Nairobi','Kahawa',-1.1800,36.9350,
 'Kenyatta University',0.2,'double',6000,6000,
 60,18,1,2,'female_only',1,
 1,'10 Mbps',0,NULL,'24hrs',1,0,
 1,1,1,1,0,1,
 1,1,1,'11:00 PM',
 'available',1,1,4.2,15),

(3,'Eastview Student Lodge','Affordable single rooms for students at MKU. Generator backup, borehole water, 24hr security.',
 'Thika Road, Nairobi','Nairobi','Kasarani',-1.2200,36.9000,
 'Mount Kenya University',1.2,'single',7000,7000,
 30,8,0,1,'male_only',1,
 1,'15 Mbps',0,NULL,'borehole',1,1,
 1,1,1,0,1,1,
 0,1,1,'11:30 PM',
 'available',1,0,3.9,8),

(3,'Green Palms Hostels','Ensuite rooms available — own bathroom! Close to JKUAT and technical colleges. Meals optional.',
 'Juja, Kiambu','Kiambu','Juja',-1.1000,37.0100,
 'JKUAT',0.5,'ensuite',12000,12000,
 25,5,1,2,'any',1,
 1,'30 Mbps',1,'All meals KES 250/day','piped',1,1,
 1,1,1,1,1,1,
 0,0,1,'No curfew',
 'available',1,1,4.7,31),

(2,'Nakuru Students Corner','Budget-friendly bedsitters near Egerton University. Ideal for 1st and 2nd years.',
 'Njoro, Nakuru','Nakuru','Njoro',-0.3400,35.9400,
 'Egerton University',1.0,'bedsitter',5500,5500,
 20,6,1,2,'any',1,
 1,'5 Mbps',0,NULL,'piped',1,0,
 1,0,1,0,0,1,
 0,1,1,'10:00 PM',
 'available',1,0,3.7,5);

-- Hostel images 
INSERT INTO hostel_images (hostel_id,image_url,is_primary) VALUES
(1,'/uploads/hostels/sample1a.jpg',1),(1,'/uploads/hostels/sample1b.jpg',0),
(2,'/uploads/hostels/sample2a.jpg',1),(2,'/uploads/hostels/sample2b.jpg',0),
(3,'/uploads/hostels/sample3a.jpg',1),
(4,'/uploads/hostels/sample4a.jpg',1),(4,'/uploads/hostels/sample4b.jpg',0),
(5,'/uploads/hostels/sample5a.jpg',1);

-- Nearby amenities
INSERT INTO nearby_amenities (hostel_id,name,category,distance_m) VALUES
(1,'Nakumatt Ngara','supermarket',300),(1,'Equity Bank ATM','atm',150),(1,'KFC Ngara','restaurant',500),
(2,'Carrefour Kahawa','supermarket',400),(2,'KU Health Centre','hospital',200),(2,'Kahawa Bus Stop','bus_stop',100),
(4,'Juja City Mall','supermarket',800),(4,'Total Petrol Station','shop',200),(4,'Naivas Juja','supermarket',600);

-- Sample roommate request
INSERT INTO roommate_requests (student_id,institution,course,year_of_study,gender,preferred_gender,budget_min,budget_max,bio,is_active) VALUES
(5,'Kenyatta University','Nursing',1,'female','female',5000,8000,'Looking for a quiet male roommate. I study a lot and prefer clean environments. Non-smoker.',1),

-- Sample study buddy request
INSERT INTO study_buddy_requests (student_id,institution,course,year_of_study,subjects,study_style,preferred_time,bio,is_active) VALUES
(5,'Kenyatta University','Nursing',1,'Anatomy, Physiology, Biochemistry','quiet','Evenings 6-9pm and Saturday mornings','1st year nursing student looking for study partners especially for anatomy and physiology. Library sessions preferred.',1),

