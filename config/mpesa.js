const axios = require('axios');

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY?.trim();
  const secret = process.env.MPESA_CONSUMER_SECRET?.trim();

  const base = 'https://sandbox.safaricom.co.ke';

  try {
    const { data } = await axios.get(
      `${base}/oauth/v1/generate?grant_type=client_credentials`,
      {
        auth: { username: key, password: secret },
        timeout: 15000,
      }
    );
    console.log('✅ Access token OK');
    return data.access_token;
  } catch (err) {
    const errMsg = err.response?.data?.errorMessage || err.message;
    const status = err.response?.status;
    console.log('❌ Token fetch failed. Status:', status, 'Message:', errMsg);
    throw new Error(`M-Pesa token failed (${status}): ${errMsg}`);
  }
}

function formatPhone(phone) {
  let p = phone.toString().trim().replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  console.log('Formatted phone:', p);
  return p;
}

async function stkPush(phone, amount, bookingId, desc = 'HostelHub Deposit') {
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();
  const base = 'https://sandbox.safaricom.co.ke';

  // Validate all required env vars before making any request
  if (!shortcode || !passkey || !callbackUrl) {
    throw new Error(`Missing M-Pesa config — SHORTCODE: ${shortcode}, PASSKEY: ${!!passkey}, CALLBACK: ${callbackUrl}`);
  }

  console.log('=== STK PUSH START ===');
  console.log('Shortcode:', shortcode);
  console.log('CallbackURL:', callbackUrl);
  console.log('Amount:', Math.ceil(amount));

  const token = await getAccessToken();

  // Generate timestamp in format YYYYMMDDHHmmss
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const timestamp =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  console.log('Timestamp:', timestamp);

  const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(parseFloat(amount)),
    PartyA: formatPhone(phone),
    PartyB: shortcode,
    PhoneNumber: formatPhone(phone),
    CallBackURL: callbackUrl,
    AccountReference: `HOSTEL${bookingId}`,
    TransactionDesc: desc,
  };

  console.log('Payload (no password):', { ...payload, Password: '***' });

  try {
    const { data } = await axios.post(
      `${base}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    console.log('✅ STK Push success:', data);
    return data;
  } catch (err) {
    const status = err.response?.status;
    const errData = err.response?.data;
    console.log('❌ STK Push failed. Status:', status);
    console.log('❌ STK Push error body:', JSON.stringify(errData, null, 2));
    throw new Error(`STK Push failed (${status}): ${errData?.errorMessage || errData?.ResultDesc || err.message}`);
  }
}

module.exports = { stkPush, formatPhone };6
