const axios = require('axios');

const BASE_URL = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// ── Generate OAuth token ───────────────────────────────────────────────────
async function getAccessToken() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;

  if (!key || !secret) throw new Error('M-Pesa credentials not configured');

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    timeout: 10000,
  });

  return data.access_token;
}

// ── STK Push (Lipa Na M-Pesa Online) ──────────────────────────────────────
async function stkPush({ phone, amount, accountRef, description }) {
  const token      = await getAccessToken();
  const shortcode  = process.env.MPESA_SHORTCODE;
  const passkey    = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  // Normalize phone to 254XXXXXXXXX
  const normalizedPhone = normalizePhone(phone);

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(amount),
    PartyA:            normalizedPhone,
    PartyB:            shortcode,
    PhoneNumber:       normalizedPhone,
    CallBackURL:       callbackUrl,
    AccountReference:  accountRef.slice(0, 12),
    TransactionDesc:   description.slice(0, 13),
  };

  const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return data;
}

// ── B2C Refund ─────────────────────────────────────────────────────────────
async function b2cRefund({ phone, amount, remarks }) {
  const token          = await getAccessToken();
  const shortcode      = process.env.MPESA_SHORTCODE;
  const initiator      = process.env.MPESA_INITIATOR_NAME;
  const securityCred   = process.env.MPESA_SECURITY_CREDENTIAL;
  const resultUrl      = `${process.env.APP_URL}/api/mpesa/b2c/result`;
  const timeoutUrl     = `${process.env.APP_URL}/api/mpesa/b2c/timeout`;

  const normalizedPhone = normalizePhone(phone);

  const payload = {
    InitiatorName:      initiator,
    SecurityCredential: securityCred,
    CommandID:          'BusinessPayment',
    Amount:             Math.ceil(amount),
    PartyA:             shortcode,
    PartyB:             normalizedPhone,
    Remarks:            (remarks || 'Refund').slice(0, 100),
    QueueTimeOutURL:    timeoutUrl,
    ResultURL:          resultUrl,
    Occasion:           'Deposit Refund',
  };

  const { data } = await axios.post(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return data;
}

// ── Phone normalizer ───────────────────────────────────────────────────────
function normalizePhone(phone) {
  const cleaned = String(phone).replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0')   && cleaned.length === 10) return '254' + cleaned.slice(1);
  if (cleaned.length === 9)                               return '254' + cleaned;
  throw new Error(`Invalid phone number: ${phone}`);
}

module.exports = { getAccessToken, stkPush, b2cRefund, normalizePhone };
