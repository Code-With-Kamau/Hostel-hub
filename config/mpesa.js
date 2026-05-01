const axios = require('axios');

async function getAccessToken() {
  const { MPESA_CONSUMER_KEY: key, MPESA_CONSUMER_SECRET: secret, MPESA_ENV: env } = process.env;
  const base = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const { data } = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`,
    { auth: { username: key, password: secret } });
  return data.access_token;
}

function formatPhone(phone) {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

function assertMpesaConfigured() {
  const missing = [];
  if (!process.env.MPESA_CONSUMER_KEY) missing.push('MPESA_CONSUMER_KEY');
  if (!process.env.MPESA_CONSUMER_SECRET) missing.push('MPESA_CONSUMER_SECRET');
  if (!process.env.MPESA_SHORTCODE) missing.push('MPESA_SHORTCODE');
  if (!process.env.MPESA_PASSKEY) missing.push('MPESA_PASSKEY');
  if (!process.env.MPESA_CALLBACK_URL) missing.push('MPESA_CALLBACK_URL');
  if (missing.length) {
    throw new Error(`M-Pesa not configured (missing: ${missing.join(', ')}).`);
  }
}

async function stkPush(phone, amount, bookingId, desc = 'HostelHub Deposit') {
  assertMpesaConfigured();
  const token = await getAccessToken();
  const base = process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString('base64');
  const { data } = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, {
    BusinessShortCode: process.env.MPESA_SHORTCODE, Password: password, Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline', Amount: Math.ceil(amount),
    PartyA: formatPhone(phone), PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: formatPhone(phone), CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: `HOSTEL${bookingId}`, TransactionDesc: desc,
  }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

module.exports = { stkPush, formatPhone, assertMpesaConfigured };
