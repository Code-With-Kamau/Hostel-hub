require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hostelhub_db',
  connectionLimit: 10,
  timezone: '+03:00',
  waitForConnections: true,
  queueLimit: 0,
});

pool.getConnection()
  .then(conn => { console.log('✅ Database connected'); conn.release(); })
  .catch(err => console.error('❌ DB connection failed:', err.message));

module.exports = pool;
