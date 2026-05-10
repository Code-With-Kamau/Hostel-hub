# 🎓 HostelHub — Complete Setup Guide

Kenya's student hostel booking platform with M-Pesa payments, WhatsApp integration,
university portal, admin commission system, and real-time chat.

---

## 📦 Tech Stack
- **Backend:** Node.js + Express.js + Socket.io
- **Database:** MySQL (via XAMPP)
- **Payments:** M-Pesa Daraja STK Push + B2C Refunds
- **Email:** Nodemailer (Gmail SMTP)
- **Frontend:** Vanilla JS SPA + Socket.io client
- **Reports:** PDFKit + json2csv

---

## ⚙️ Prerequisites
- [XAMPP](https://www.apachefriends.org/) (MySQL + phpMyAdmin)
- [Node.js](https://nodejs.org/) v18+
- A Safaricom Daraja developer account (sandbox for dev)
- A Gmail account with App Password enabled

---

## 🚀 Step-by-Step Installation

### 1. Clone / Download the Project
```bash
git clone https://github.com/Code-With-Kamau/Hostel-hub.git
cd Hostel-hub
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create the Database
1. Start XAMPP → Start **Apache** and **MySQL**
2. Open [phpMyAdmin](http://localhost/phpmyadmin)
3. Create a new database: `hostelhub_db`
4. Click the database → **Import** → Select `database/schema.sql` → Click **Go**

### 4. Set Up Environment Variables
```bash
cp .env.example .env
```
Then open `.env` and fill in:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=           # Leave blank for XAMPP default
DB_NAME=hostelhub_db

# JWT Secret (change this!)
JWT_SECRET=your_very_long_random_secret_here_at_least_32_chars

# App URL
APP_URL=http://localhost:3000

# M-Pesa (Sandbox)
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_daraja_key
MPESA_CONSUMER_SECRET=your_daraja_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/mpesa/callback

# Gmail (create App Password at myaccount.google.com/apppasswords)
SMTP_USER=youremail@gmail.com
SMTP_PASS=your_16_char_app_password
```

### 5. Start the Server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🔑 Default Login Credentials (from seed data)

| Role       | Email                          | Password       |
|------------|-------------------------------|----------------|
| Admin      | admin@hostelhub.co.ke         | Admin@1234     |
| Owner      | mary.wanjiku@gmail.com        | Owner@1234     |
| Student    | brian.kamau@student.uon.ac.ke | Student@1234   |
| University | housing@uon.ac.ke             | Univ@1234      |

> ⚠️ Change all passwords immediately in a production environment.

---

## 📱 M-Pesa Sandbox Testing

For local development, use the **Simulate Payment** button (only visible on localhost).
For real STK pushes, expose your local server with ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose port 3000
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL and set it as your `MPESA_CALLBACK_URL` in `.env`.

---

## 🏗️ Project Structure

```
hostelhub/
├── server.js                # Express + Socket.io server
├── package.json
├── .env.example             # Environment template
├── database/
│   ├── schema.sql           # Complete database schema + seed data
│   └── db.js                # MySQL connection pool
├── middleware/
│   ├── auth.js              # JWT authentication + role guards
│   └── upload.js            # Multer image uploads
├── config/
│   ├── mpesa.js             # M-Pesa Daraja API (STK Push + B2C)
│   └── email.js             # Nodemailer email service
├── utils/
│   └── validators.js        # Phone, email, password validators
├── routes/
│   ├── auth.js              # Register, login, verify email, forgot password
│   ├── hostels.js           # Hostel CRUD, images, reviews
│   ├── booking.js           # Book, cancel (3-day refund), release
│   ├── mpesa.js             # STK push, callback, 10% commission
│   ├── admin.js             # Admin panel, reports (CSV+PDF)
│   ├── university.js        # University portal + reports
│   ├── students.js          # Profile, saved, roommates, study buddy
│   ├── chat.js              # Conversations, messages, WhatsApp links
│   └── notifications.js     # In-app notifications
├── uploads/                 # Uploaded images (auto-created)
└── public/
    ├── index.html           # SPA shell
    ├── css/
    │   ├── main.css         # Design system, base components
    │   └── components.css   # Page-specific components
    └── js/
        ├── config.js        # API helper, auth tokens
        ├── utils.js         # Toast, modal, form validation
        ├── app.js           # SPA router, navbar, auth modals
        ├── chat.js          # Chat + Socket.io client
        └── pages/
            ├── home.js          # Browse hostels, search, filters
            ├── hostel-detail.js # Hostel detail, booking, reviews
            ├── dashboard.js     # Student dashboard, bookings
            ├── owner.js         # Owner panel, list hostel
            ├── admin-page.js    # Admin dashboard, reports
            └── university.js    # University portal
```

---

## ✨ Features

### 🔐 Authentication
- Email verification (link sent on register)
- Forgot password (reset link via email)
- Password strength validation (6+ chars, uppercase, number, special char)
- Password cannot contain user's name
- Kenya phone validation (+254 / 07XXXXXXXX)
- Role-based access: student | owner | admin | university

### 🏠 Hostel Listings
- Search, filter by type/gender/price/amenities
- Image gallery, map embed
- Availability updated in real-time
- Owner WhatsApp direct link

### 💳 Payments (M-Pesa)
- STK Push (Lipa Na M-Pesa)
- 10% admin commission auto-deducted
- 3-day free cancellation with automatic B2C refund
- Room released immediately on cancel/release

### 💬 Communication
- Real-time in-app chat (Socket.io)
- WhatsApp deep links for direct contact
- Typing indicators
- Unread message badges

### 🏫 University Portal
- View all approved hostels
- View all registered students with hostel/owner details
- Generate CSV/PDF reports

### 🛡️ Admin
- Approve/reject hostel listings
- Ban/unban users
- Commission tracking
- Full CSV/PDF reports (students + hostels)

---

## 🌍 Deployment (Production)

1. Set `NODE_ENV=production` in `.env`
2. Set `MPESA_ENV=production` and use live Daraja credentials
3. Set `APP_URL` to your live domain
4. Use a process manager: `npm install -g pm2 && pm2 start server.js`
5. Set up Nginx as a reverse proxy
6. Use MySQL on your server (not XAMPP)

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first for major changes.

---

## 📄 License
MIT License — Built for Kenyan students 🇰🇪
