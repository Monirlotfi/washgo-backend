const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

const BASE = 'https://loutfihi-mounir-washgo-backend.hf.space/api/v1';
const clientId = 'cms22aszo0005v001dobnlfdu';
const bookingId = 'cmt7k74cq001fv901wfrc3yoy';

const token = jwt.sign({ sub: clientId, role: 'CLIENT' }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function attempt(n) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/bookings/${bookingId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score: 5, comment: 'Bo' }),
    });
    const ms = Date.now() - start;
    let data;
    try { data = await res.json(); } catch { data = await res.text(); }
    console.log(`Attempt ${n}: status=${res.status} (${ms}ms)`, JSON.stringify(data));
    return { status: res.status, data };
  } catch (e) {
    console.log(`Attempt ${n}: NETWORK ERROR (${Date.now() - start}ms) — ${e.message}`);
    return null;
  }
}

(async () => {
  await attempt(1);
})();
