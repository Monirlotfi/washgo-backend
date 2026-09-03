const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });

const prisma = new PrismaClient();
const BASE = 'https://washgo-production-3ff7.up.railway.app/api/v1';
const REAL_TEST_IMAGE = fs.readFileSync(path.join(__dirname, '..', 'washgo-mobile-main', 'assets', 'icon.png'));
const results = [];

function log(step, ok, detail, ms) {
  results.push({ step, ok, detail, ms });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${step} ${ms !== undefined ? `(${ms}ms)` : ''} — ${detail}`);
}
async function timed(fn) {
  const start = Date.now();
  const res = await fn();
  return { res, ms: Date.now() - start };
}
async function call(method, p, token, body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
function sign(userId, role) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, { expiresIn: '2h' });
}
async function withRetry(fn, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fn();
      if (r) return r;
      if (i === attempts) return r;
    } catch (e) { if (i === attempts) throw e; }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
async function getLatestOtp(phone) {
  return withRetry(() => prisma.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } }).then(o => o?.code));
}

(async () => {
  const baseNum = Date.now() % 90000000 + 10000000;
  const phoneFor = (o) => `+2126${String((baseNum + o) % 100000000).padStart(8, '0')}`;
  const clientPhone = phoneFor(1);
  const washerPhone = phoneFor(2);
  const washer2Phone = phoneFor(3);
  const washer3Phone = phoneFor(4);
  const stamp = Date.now().toString().slice(-4);

  let clientToken, clientUserId, vehicleId, bookingId;
  let washerToken, washerUserId, washerProfileId;
  let washer2UserId, washer2ProfileId;
  let washer3UserId, washer3ProfileId;
  let offerId;

  console.log(`\n=== FULL RAILWAY E2E TEST — ${BASE} ===\n`);

  // ---------- CLIENT ----------
  console.log('--- Client setup ---');
  await call('POST', '/auth/send-otp', null, { phone: clientPhone });
  const clientOtp = await getLatestOtp(clientPhone);
  log('Client OTP readable', !!clientOtp, `code=${clientOtp}`);
  await call('POST', '/auth/verify-otp', null, { phone: clientPhone, code: clientOtp });
  {
    const { res, ms } = await timed(() => call('POST', '/auth/register/client', null, { fullName: 'E2E Railway Client', phone: clientPhone, password: 'testpass123' }));
    const ok = res.status === 201 && res.data?.accessToken;
    log('registerClient', ok, `status=${res.status}`, ms);
    if (ok) { clientToken = res.data.accessToken; clientUserId = res.data.user.id; }
  }
  if (clientToken) {
    const { res, ms } = await timed(() => call('POST', '/vehicles', clientToken, { brand: 'Dacia', model: 'Logan', plate: `${stamp}-C-3`, size: 'MEDIUM', category: 'CITY_CAR' }));
    const ok = res.status === 201 && res.data?.id;
    log('addVehicle', ok, `status=${res.status}`, ms);
    if (ok) vehicleId = res.data.id;
  }

  // ---------- FORGOT PASSWORD ----------
  console.log('\n--- Forgot password flow ---');
  {
    const { res, ms } = await timed(() => call('POST', '/auth/send-otp', null, { phone: clientPhone, purpose: 'PASSWORD_RESET' }));
    log('forgotPassword: sendOtp(PASSWORD_RESET)', res.status === 200, `status=${res.status} ${JSON.stringify(res.data)}`, ms);
  }
  const resetOtp = await getLatestOtp(clientPhone);
  log('forgotPassword: OTP readable', !!resetOtp, `code=${resetOtp}`);
  {
    const { res, ms } = await timed(() => call('POST', '/auth/verify-otp', null, { phone: clientPhone, code: resetOtp, purpose: 'PASSWORD_RESET' }));
    log('forgotPassword: verifyOtp', res.status === 200, `status=${res.status}`, ms);
  }
  {
    const { res, ms } = await timed(() => call('POST', '/auth/reset-password', null, { phone: clientPhone, newPassword: 'newpass456' }));
    log('forgotPassword: resetPassword', res.status === 200, `status=${res.status} ${JSON.stringify(res.data)}`, ms);
  }
  {
    const { res, ms } = await timed(() => call('POST', '/auth/login', null, { phone: clientPhone, password: 'newpass456' }));
    const ok = res.status === 200 && res.data?.accessToken;
    log('forgotPassword: login with NEW password', ok, `status=${res.status}`, ms);
    if (ok) clientToken = res.data.accessToken; // refresh token post-reset
  }

  // ---------- WASHERS (3x: approve / reject / retry) ----------
  console.log('\n--- Washer setup (x3: approve/reject/retry) ---');
  async function registerWasher(phone, label) {
    await call('POST', '/auth/send-otp', null, { phone });
    const otp = await getLatestOtp(phone);
    await call('POST', '/auth/verify-otp', null, { phone, code: otp });
    const form = new FormData();
    form.append('fullName', `E2E ${label}`);
    form.append('phone', phone);
    form.append('password', 'testpass123');
    form.append('equipmentType', 'MOBILE');
    form.append('dataConsentAccepted', 'true');
    form.append('cinPhoto', new Blob([REAL_TEST_IMAGE], { type: 'image/png' }), 'cin.png');
    const start = Date.now();
    const res = await fetch(`${BASE}/auth/register/washer`, { method: 'POST', body: form });
    const data = await res.json();
    const ms = Date.now() - start;
    const ok = res.status === 201 && data?.accessToken;
    log(`registerWasher (${label})`, ok, `status=${res.status} ${ok ? '' : JSON.stringify(data)}`, ms);
    if (!ok) return {};
    const profile = await withRetry(() => prisma.washerProfile.findUnique({ where: { userId: data.user.id } }));
    return { token: data.accessToken, userId: data.user.id, profileId: profile?.id };
  }

  ({ token: washerToken, userId: washerUserId, profileId: washerProfileId } = await registerWasher(washerPhone, 'Washer1 (approve)'));
  ({ userId: washer2UserId, profileId: washer2ProfileId } = await registerWasher(washer2Phone, 'Washer2 (reject)'));
  ({ userId: washer3UserId, profileId: washer3ProfileId } = await registerWasher(washer3Phone, 'Washer3 (retry)'));

  const admin = await withRetry(() => prisma.user.findFirst({ where: { role: 'ADMIN' } }));
  const adminToken = sign(admin.id, 'ADMIN');

  // ---------- ADMIN ACTIONS ----------
  console.log('\n--- Admin actions (critical: no 408, verify notifications) ---');
  if (washerProfileId) {
    const { res, ms } = await timed(() => call('POST', `/admin/washers/${washerProfileId}/approve`, adminToken));
    log('admin APPROVE washer1 (no 408)', (res.status === 200 || res.status === 201), `status=${res.status}`, ms);
  }
  if (washer2ProfileId) {
    const { res, ms } = await timed(() => call('POST', `/admin/washers/${washer2ProfileId}/reject`, adminToken, { reason: 'CIN illisible (test E2E)' }));
    log('admin REJECT washer2 (no 408)', (res.status === 200 || res.status === 201), `status=${res.status}`, ms);
  }
  if (washer3ProfileId) {
    const { res, ms } = await timed(() => call('POST', `/admin/washers/${washer3ProfileId}/retry`, adminToken, { message: 'Merci de reprendre la photo CIN (test E2E)' }));
    log('admin RETRY(correction) washer3 (no 408)', (res.status === 200 || res.status === 201), `status=${res.status}`, ms);
  }

  const washerLat = 33.5900, washerLng = -7.6100;
  if (washerToken) {
    const { res, ms } = await timed(() => call('POST', '/washer/go-online', washerToken, { lat: washerLat, lng: washerLng }));
    const ok = res.status === 201 && res.data?.status === 'AVAILABLE';
    log('go-online (single request, fast)', ok, `status=${res.status} ${ok ? `status=${res.data.status}` : JSON.stringify(res.data)}`, ms);
  }
  if (washerToken) {
    const { res, ms } = await timed(() => call('GET', '/washer/bookings/available', washerToken));
    log('washer: check available bookings', res.status === 200, `status=${res.status} count=${Array.isArray(res.data) ? res.data.length : 'n/a'}`, ms);
  }

  // ---------- BOOKING LIFECYCLE ----------
  console.log('\n--- Booking lifecycle ---');
  if (clientToken && vehicleId) {
    const { res, ms } = await timed(() => call('POST', '/bookings', clientToken, {
      vehicleId, addressLabel: 'E2E Railway test near washer', lat: washerLat + 0.005, lng: washerLng + 0.005, washType: 'BASIC',
    }));
    const ok = res.status === 201 && res.data?.booking?.id;
    log('createBooking (near washer)', ok, `status=${res.status} ${ok ? `id=${res.data.booking.id}` : JSON.stringify(res.data)}`, ms);
    if (ok) bookingId = res.data.booking.id;
  }

  await new Promise((r) => setTimeout(r, 3000));

  if (washerToken && bookingId) {
    const { res, ms } = await timed(() => call('GET', '/washer/bookings/available', washerToken));
    const found = Array.isArray(res.data) ? res.data.find((b) => b.booking_id === bookingId) : null;
    log('available bookings list shows it', res.status === 200 && !!found, `status=${res.status} foundOurs=${!!found}`, ms);
  }

  if (washerToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/washer/bookings/${bookingId}/offer`, washerToken, { proposedPriceMAD: 15000 }));
    const ok = res.status === 201 && res.data?.id;
    log('washer makes offer', ok, `status=${res.status}`, ms);
    if (ok) offerId = res.data.id;
  }
  if (clientToken && bookingId && offerId) {
    const { res, ms } = await timed(() => call('POST', `/bookings/${bookingId}/offers/${offerId}/choose`, clientToken));
    log('client accepts offer', res.status === 201 && res.data?.status === 'ACCEPTED', `status=${res.status}`, ms);
  }
  if (washerToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/washer/bookings/${bookingId}/arrived`, washerToken));
    log('washer marks arrived', res.status === 200 || res.status === 201, `status=${res.status}`, ms);
  }
  if (washerToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/washer/bookings/${bookingId}/start`, washerToken));
    log('washer starts wash', res.status === 200 || res.status === 201, `status=${res.status}`, ms);
  }
  if (washerToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/washer/bookings/${bookingId}/complete`, washerToken));
    log('washer completes wash', res.status === 200 || res.status === 201, `status=${res.status}`, ms);
  }
  if (clientToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/bookings/${bookingId}/confirm-completion`, clientToken));
    log('client confirms completion (no 408)', res.status === 200 || res.status === 201, `status=${res.status}`, ms);
  }

  // ---------- RATING ----------
  console.log('\n--- Rating ---');
  if (clientToken && bookingId) {
    const { res, ms } = await timed(() => call('POST', `/bookings/${bookingId}/rate`, clientToken, { score: 5, comment: 'E2E Railway test review' }));
    const ok = res.status === 201 && res.data?.id;
    log('client submits rating', ok, `status=${res.status} ${ok ? '' : JSON.stringify(res.data)}`, ms);
  }

  // ---------- NOTIFICATION QUEUE CHECK (full chain: enqueued -> processed) ----------
  console.log('\n--- Notification queue check (BullMQ on Railway) ---');
  await new Promise((r) => setTimeout(r, 5000));
  const useTls = process.env.REDIS_TLS === 'true';
  const queue = new Queue('notifications', {
    connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT), password: process.env.REDIS_PASSWORD || undefined, tls: useTls ? {} : undefined, maxRetriesPerRequest: null },
  });
  const recent = await queue.getJobs(['completed', 'failed', 'waiting', 'active', 'delayed'], 0, 30);
  console.log(`Total jobs found in queue (any state): ${recent.length}`);
  const wanted = [
    ['ACCOUNT_APPROVED', washerUserId],
    ['ACCOUNT_REJECTED', washer2UserId],
    ['ACCOUNT_RETRY', washer3UserId],
    ['NEW_BOOKING_NEARBY', washerUserId],
    ['OFFER_RECEIVED', clientUserId],
    ['OFFER_ACCEPTED', washerUserId],
    ['WASHER_ARRIVED', clientUserId],
    ['WASH_STARTED', clientUserId],
    ['WASH_COMPLETED_BY_WASHER', clientUserId],
    ['BOOKING_CONFIRMED_BY_CLIENT', washerUserId],
  ];
  for (const [type, userId] of wanted) {
    const job = recent.find(j => j.data?.type === type && j.data?.userId === userId);
    if (job) {
      const state = await job.getState();
      log(`notification ${type}`, state === 'completed', `job id=${job.id} state=${state}`);
    } else {
      log(`notification ${type}`, false, 'NOT FOUND in queue');
    }
  }
  await queue.close();

  // ---------- CLEANUP ----------
  console.log('\n=== CLEANUP ===');
  const deleted = await prisma.user.deleteMany({ where: { phone: { in: [clientPhone, washerPhone, washer2Phone, washer3Phone] } } });
  console.log(`Deleted ${deleted.count} throwaway users (cascades vehicles/bookings/ratings/washerProfile).`);

  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.ok).length;
  console.log(`${passed}/${results.length} checks passed.`);
  for (const f of results.filter(r => !r.ok)) console.log(`  FAILED: ${f.step} — ${f.detail}`);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FATAL:', e.message, e.stack);
  await prisma.$disconnect();
  process.exit(1);
});
