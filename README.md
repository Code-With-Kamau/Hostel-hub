# 🎓 HostelHub — Kenya's Student Hostel Finder

> The smart way for Kenyan university, college and polytechnic students to find, book and pay for verified student hostels — with roommate matching, study buddy finder and nearby amenities.

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?style=flat-square&logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

</div>

---

## 📸 Overview

HostelHub solves a real problem faced by thousands of Kenyan students every semester — finding affordable, safe and well-located accommodation near their campus. Unlike general rental platforms, HostelHub is built **specifically for students**, with features like campus distance display, gender policy filters, roommate matching and a study buddy finder baked right in.

Students can search by university, filter by room type and budget, pay the deposit via M-Pesa, and connect with other students — all from one platform.

---

## ✨ Features

### 🎓 For Students
- **Campus-First Search** — Every hostel shows the nearest university and exact distance in km to the campus gate
- **Smart Filters** — Filter by room type, gender policy (Male Only / Female Only / Mixed / Any), price range, WiFi, meals, study-friendly, security, generator backup and more
- **Live Map** — Browse all hostels on a Google Maps view with custom pin markers
- **Near Me** — Use your device GPS to find hostels within a set radius of your location
- **M-Pesa Booking** — Book a room and pay the refundable deposit instantly via Safaricom STK Push
- **Roommate Finder** — Post a "looking for roommate" request with your gender, budget, course and preferred roommate type. Browse and message other students looking for roommates
- **Study Buddy Finder** — Post what subjects you need a study partner for, your study style (quiet / group / discussions) and preferred times. Connect with coursemates
- **Nearby Amenities** — Each hostel shows nearby shops, supermarkets, pharmacies, ATMs, restaurants, hospitals, bus stops and more — with distances in metres
- **Save Hostels** — Bookmark hostels and come back to them later
- **Reviews & Ratings** — Read and write reviews that show the reviewer's institution and course
- **Real-Time Chat** — Message hostel owners directly via Socket.io live chat

### 🏢 For Hostel Owners
- **List Your Hostel** — Full listing form covering 30+ hostel attributes including room type, gender policy, curfew time, WiFi speed, meals description and campus distance
- **Map Pin Picker** — Click on a Google Maps modal to set your hostel's exact GPS coordinates with automatic reverse geocoding
- **Nearby Amenities Builder** — Add amenities (supermarket, pharmacy, ATM, etc.) with distances during listing
- **Manage Availability** — Update available rooms in real time
- **Booking Dashboard** — See all student bookings with their name, institution, course, year of study and payment status
- **Instant Notifications** — Get alerted the moment a student books or pays

### 🛡️ For Admins
- **Approval Queue** — Review and approve or reject hostel listings before they go live
- **Platform Stats** — Total users, students, owners, hostels, pending approvals, confirmed bookings and total deposits collected
- **User Management** — View all users filtered by role, ban/unban accounts
- **Booking Oversight** — Monitor all bookings and M-Pesa receipts platform-wide

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js v18+ | Server runtime |
| **Framework** | Express.js 4.18 | REST API + middleware |
| **Database** | MySQL 8.0 via mysql2 | Primary data store |
| **Authentication** | JWT + bcryptjs | Secure user sessions (7-day tokens) |
| **Real-Time** | Socket.io 4.7 | Live chat + typing indicators |
| **Payments** | Safaricom Daraja API | M-Pesa STK Push deposits |
| **Maps** | Google Maps JavaScript API | Hostel map, pin picker, directions |
| **File Uploads** | Multer | Local disk storage for photos |
| **Email** | Nodemailer | Booking confirmations |
| **Security** | Helmet + express-rate-limit | HTTP headers + rate limiting |
| **Frontend** | Vanilla JS SPA | No framework, custom router |
| **Styling** | Custom CSS | Plus Jakarta Sans + Inter fonts |

---

## 📁 Project Structure

```
hostelhub/
│
├── server.js                    # App entry — Express + Socket.io setup
├── package.json
├── .env.example                 # Environment variables template
│
├── database/
│   ├── schema.sql               # Full MySQL schema + sample seed data
│   └── db.js                    # MySQL2 connection pool
│
├── routes/
│   ├── auth.js                  # Register, login, profile update
│   ├── hostels.js               # Hostel CRUD, search, save, review
│   ├── booking.js               # Booking creation and management
│   ├── mpesa.js                 # M-Pesa STK push, callback, simulate
│   ├── students.js              # Roommate matching, study buddies, amenities
│   ├── chat.js                  # Conversations and messages
│   ├── notifications.js         # User notifications
│   └── admin.js                 # Admin dashboard endpoints
│
├── middleware/
│   ├── auth.js                  # JWT verification + role guards
│   └── upload.js                # Multer config for hostel + profile photos
│
├── config/
│   └── mpesa.js                 # Daraja API helpers (STK push, token)
│
├── public/                      # Single Page Application frontend
│   ├── index.html               # SPA shell with navbar, modal, toasts
│   ├── css/
│   │   └── main.css             # Full design system (navy + purple theme)
│   └── js/
│       ├── config.js            # API URL, constants
│       ├── utils.js             # Toast, modal, formatters, hostel card builder
│       ├── map.js               # Google Maps module (markers, pin picker)
│       ├── chat.js              # Socket.io client + ChatPage
│       ├── app.js               # SPA router + nav + notifications
│       └── pages/
│           ├── home.js          # Homepage — hero, map, filters, hostel grid
│           ├── hostel-detail.js # Hostel detail, gallery, booking, reviews
│           ├── dashboard.js     # Student dashboard (bookings, roommate, buddy)
│           └── owner.js         # Owner + Admin + Community pages
│
└── uploads/
    ├── hostels/                 # Uploaded hostel photos
    └── profiles/                # User profile photos
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [XAMPP](https://www.apachefriends.org) or any MySQL 8.0+ server
- A modern web browser

The following are **optional** — the app runs fully in development without them:
- [Google Maps API Key](https://console.cloud.google.com) — map shows a placeholder without it
- [Safaricom Daraja Account](https://developer.safaricom.co.ke) — use the **Simulate Payment** button instead

---

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/hostelhub.git
cd hostelhub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

1. Start **XAMPP** and click **Start** next to both **Apache** and **MySQL**
2. Open your browser and go to `http://localhost/phpmyadmin`
3. Click **New** in the left sidebar
4. Name the database `hostelhub_db` and click **Create**
5. Click on `hostelhub_db` in the sidebar → click the **Import** tab
6. Click **Choose File** → select `database/schema.sql` from your project folder
7. Scroll down and click **Import**

You should see a green success message. The schema creates all 12 tables and inserts sample data including demo users and 5 hostels.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` in VS Code and fill in your values:

```env
# Server
PORT=3000

# Database — XAMPP defaults (no password)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hostelhub_db

# Security
JWT_SECRET=hostelhub_super_secret_key_change_this_in_production

# Google Maps (optional for dev)
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY_HERE

# M-Pesa Daraja (optional for dev — use Simulate button instead)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
MPESA_ENV=sandbox

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=HostelHub <your@gmail.com>

# App
APP_URL=http://localhost:3000
NODE_ENV=development
```

> **Tip:** Leave `DB_PASSWORD` blank for XAMPP's default MySQL setup.

### 5. Create upload folders

```bash
mkdir -p uploads/hostels uploads/profiles
```

Also create a default hostel image:
```
public/images/default-hostel.jpg   ← save any building photo here
```

### 6. Start the server

```bash
node server.js
```

For development with auto-restart on file changes:
```bash
npm run dev
```

You should see:
```
╔══════════════════════════════════════════╗
║   🎓 HostelHub Server Running             ║
╠══════════════════════════════════════════╣
║  Local:    http://localhost:3000          ║
║  Roles:    student | owner | admin        ║
╚══════════════════════════════════════════╝

✅ Database connected
```

### 7. Open in your browser

```
http://localhost:3000
```

---

## 👤 Demo Accounts

The schema seeds these accounts for testing. All passwords are hashed with bcrypt — use any password you like since these match the hash for the word `password`:

| Role | Email | Notes |
|---|---|---|
| **Admin** | admin@hostelhub.co.ke | Full platform access |
| **Owner** | mary.wanjiku@gmail.com | Has 2 listed hostels |
| **Owner** | grace.muthoni@gmail.com | Has 1 listed hostel |
| **Student** | brian.kamau@student.uon.ac.ke | UoN, CS Year 2 |

> **Quick test login:** Go to `http://localhost:3000#login` and enter any of the emails above with password `password`.

---

## 💳 M-Pesa Integration

HostelHub uses the **Safaricom Daraja API** (Lipa Na M-Pesa Online — STK Push) for booking deposits.

### Development (no keys needed)
Click the **"🧪 Simulate Payment (Dev Mode)"** button in any payment modal. This:
- Skips the real Daraja API entirely
- Marks the payment as completed with a fake receipt number
- Confirms the booking automatically
- Sends in-app notifications to both student and owner
- Decrements available rooms by 1

### Production setup
1. Register at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an app and get your Consumer Key and Consumer Secret
3. Set `MPESA_ENV=production` in your `.env`
4. Your `MPESA_CALLBACK_URL` must be a **publicly accessible HTTPS URL**
5. For local testing use [ngrok](https://ngrok.com): `ngrok http 3000` then use the HTTPS URL

### Payment flow
```
Student books hostel
      ↓
Enters M-Pesa phone number
      ↓
POST /api/mpesa/pay → Daraja STK Push
      ↓
Student receives PIN prompt on phone
      ↓
Student enters PIN
      ↓
Daraja sends callback to POST /api/mpesa/callback
      ↓
Booking confirmed → Rooms decremented → Notifications sent
```

---

## 🗺️ Google Maps Features

| Feature | Where it appears |
|---|---|
| Hostel map with custom navy pin markers | Homepage |
| Click marker → info popup with photo, price, "View" button | Homepage |
| "Near Me" button using browser GPS | Homepage filter bar |
| Hostel location map with marker | Hostel detail page |
| "Get Directions" → opens Google Maps navigation | Hostel detail page |
| Click-to-pin modal with reverse geocoding | Owner add hostel form |

Without a Google Maps API key the map section renders as a placeholder and all other features work normally.

---

## 🎓 Student-Specific Features

### Roommate Matching
Students post what they are looking for in a roommate:
- Their gender and preferred roommate gender
- Budget range (min and max per month)
- Institution and course (auto-filled from profile)
- Move-in date
- A personal bio describing their lifestyle

Other students can browse these posts filtered by institution and send a direct chat message.

### Study Buddy Finder
Students post what subjects they want to study together:
- Subjects (comma separated)
- Study style preference: Quiet / Group discussion / Discussions / Any
- Preferred times (e.g. "Weekday evenings 6–9pm")
- Bio

Filtered by institution, students can connect via the real-time chat.

### Nearby Amenities
Hostel owners add nearby places during listing. Each amenity shows:
- Category emoji (🛒 🏥 💊 🏦 ☕ 📚 🚌 etc.)
- Name
- Distance in metres (or km if over 1000m)

Categories supported: shop, supermarket, pharmacy, hospital, bank, ATM, restaurant, café, gym, library, church, mosque, salon, market, bus stop.

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create account (student or owner) |
| POST | `/api/auth/login` | None | Login → returns JWT token |
| GET | `/api/auth/me` | Required | Get current user profile |
| PUT | `/api/auth/profile` | Required | Update name, phone, institution, photo |

### Hostels
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/hostels/all` | Optional | Search/filter hostels with pagination |
| GET | `/api/hostels/:id` | Optional | Get hostel with images, reviews, amenities |
| POST | `/api/hostels/add` | Owner/Admin | Submit new hostel for approval |
| PUT | `/api/hostels/:id` | Owner/Admin | Update hostel details |
| DELETE | `/api/hostels/:id` | Owner/Admin | Delete hostel |
| GET | `/api/hostels/owner/my` | Owner | Get owner's own listings |
| POST | `/api/hostels/:id/save` | Required | Toggle save/unsave a hostel |
| GET | `/api/hostels/saved/list` | Required | Get user's saved hostels |
| POST | `/api/hostels/:id/review` | Student | Add or update a review |

**Available search parameters for `GET /api/hostels/all`:**

| Parameter | Type | Example |
|---|---|---|
| `search` | string | `Westlands` |
| `institution` | string | `Kenyatta University` |
| `room_type` | string | `single`, `double`, `ensuite` |
| `min_price` | number | `4000` |
| `max_price` | number | `10000` |
| `county` | string | `Nairobi` |
| `gender_policy` | string | `female_only` |
| `allows_roommates` | boolean | `true` |
| `wifi` | boolean | `true` |
| `meals_provided` | boolean | `true` |
| `study_friendly` | boolean | `true` |
| `security` | boolean | `true` |
| `backup_power` | boolean | `true` |
| `lat` + `lng` + `radius` | number | `-1.29, 36.82, 5` |
| `sort` | string | `newest`, `price_asc`, `price_desc`, `rating`, `distance` |
| `page` + `limit` | number | `1`, `12` |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/booking/book` | Student | Create a new booking |
| GET | `/api/booking/my` | Student | Student's own bookings |
| GET | `/api/booking/owner` | Owner | All bookings for owner's hostels |
| POST | `/api/booking/:id/cancel` | Student | Cancel a pending booking |

### Payments
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/mpesa/pay` | Required | Initiate M-Pesa STK push |
| POST | `/api/mpesa/callback` | None | Daraja payment callback (Safaricom calls this) |
| POST | `/api/mpesa/simulate` | Required | **Dev only** — simulate successful payment |

### Student Community
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/students/roommates` | Optional | List active roommate requests |
| POST | `/api/students/roommates` | Student | Create / update my roommate post |
| DELETE | `/api/students/roommates/mine` | Student | Deactivate my roommate post |
| GET | `/api/students/study-buddies` | Optional | List active study buddy requests |
| POST | `/api/students/study-buddies` | Student | Create / update my study buddy post |
| GET | `/api/students/amenities/:id` | None | Get nearby amenities for a hostel |
| POST | `/api/students/amenities/:id` | Owner | Add a nearby amenity |

### Chat
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/chat/conversations` | Required | List all conversations with unread count |
| GET | `/api/chat/messages/:convId` | Required | Get messages in a conversation |
| GET | `/api/chat/unread-count` | Required | Total unread message count |

### Notifications
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | Required | Get user's notifications |
| PUT | `/api/notifications/read-all` | Required | Mark all as read |
| PUT | `/api/notifications/:id/read` | Required | Mark one as read |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin | Platform stats + recent activity |
| GET | `/api/admin/hostels` | Admin | All hostels (filterable) |
| PUT | `/api/admin/hostels/:id/approve` | Admin | Approve or reject a hostel |
| GET | `/api/admin/users` | Admin | All users (filterable by role) |
| PUT | `/api/admin/users/:id` | Admin | Ban/unban or change role |
| GET | `/api/admin/bookings` | Admin | All platform bookings |

---

## 🔐 Security

- Passwords hashed with **bcryptjs** (10 salt rounds)
- Authentication via **JWT tokens** (7-day expiry)
- HTTP headers hardened with **Helmet.js**
- Rate limiting: 300 requests/15 min general, 20 requests/15 min on auth routes
- File upload validation: images and videos only, 50MB limit
- SQL injection protected via **parameterized queries** (mysql2 prepared statements)
- `.env` file excluded from version control via `.gitignore`

---

## 🗄️ Database Schema Overview

```
users ──────────────────────────────────────────────────────────┐
  ├── hostels (owner_id → users.id)                              │
  │     ├── hostel_images (hostel_id → hostels.id)              │
  │     ├── nearby_amenities (hostel_id → hostels.id)           │
  │     ├── reviews (hostel_id, student_id → users.id)          │
  │     └── saved_hostels (user_id → users.id)                  │
  ├── bookings (hostel_id → hostels.id, student_id → users.id)  │
  │     └── payments (booking_id → bookings.id)                 │
  ├── messages (sender_id, receiver_id → users.id)              │
  ├── notifications (user_id → users.id)                        │
  ├── roommate_requests (student_id → users.id)                 │
  ├── study_buddy_requests (student_id → users.id)              │
  └── admin_logs (admin_id → users.id) ──────────────────────────┘
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| `Error: connect ECONNREFUSED 127.0.0.1:3306` | MySQL is not running — start it in XAMPP |
| `Error: Unknown database 'hostelhub_db'` | Create the database in phpMyAdmin first |
| `Cannot find module 'express'` | Run `npm install` in the project folder |
| Port 3000 already in use | Change `PORT=3001` in `.env` |
| Images not loading | Create `public/images/default-hostel.jpg` (any JPEG file) |
| Map not showing | Add `GOOGLE_MAPS_API_KEY` to `.env` — or ignore, map is optional |
| M-Pesa STK push fails | Use the **🧪 Simulate Payment** button — works without Daraja keys |
| Blank page in browser | Open DevTools (`F12`) → Console tab to see JavaScript errors |
| Uploads folder missing | Run `mkdir -p uploads/hostels uploads/profiles` |

---

## 🗺️ Roadmap

- [ ] Email verification on student registration
- [ ] Student ID upload and verification badge
- [ ] Push notifications (Web Push API)
- [ ] Cloudinary integration for cloud-hosted images
- [ ] Hostel owner verified badge after ID check
- [ ] Monthly rent payment tracking (not just deposit)
- [ ] Roommate compatibility score (based on study habits, sleep schedule)
- [ ] Mobile app (React Native)
- [ ] Multi-language support (Swahili / English toggle)
- [ ] Virtual hostel tours (360° photo support)
- [ ] Integration with university portals for student verification
- [ ] Hostel rating badges (e.g. "Top Rated Near UoN 2025")

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit:
   ```bash
   git commit -m "Add: description of your change"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request with a clear description of what you changed and why

### Commit message convention
```
Add: new feature
Fix: bug or broken functionality
Update: improvement to existing feature
Remove: deleted code or files
Docs: documentation changes only
Style: CSS / UI changes only
```

---

## 🙏 Acknowledgements

- [Safaricom Daraja](https://developer.safaricom.co.ke) — M-Pesa API
- [Google Maps Platform](https://developers.google.com/maps) — Maps and Geocoding
- [Socket.io](https://socket.io) — Real-time chat engine
- [Font Awesome](https://fontawesome.com) — Icons
- [Google Fonts](https://fonts.google.com) — Plus Jakarta Sans + Inter

---

<div align="center">

**Built with ❤️ for Kenyan students**

*"No student should spend their first week on campus without a place to sleep."*

⭐ **Star this repo if it helped you!**

</div>
