// PDKS yük ve kaos testi (k6). Çalıştırma: .github/workflows/yuk-testi.yml
//
// Senaryolar (aynı anda ve art arda):
//  1. kiosklar   — 10 kiosk ekranı 3 sn'de bir QR yeniler (gerçek tabletler gibi)
//  2. mudurler   — 10 müdür canlı panoyu, yönetici tüm firmanın panosunu sürekli yeniler
//  3. sabah      — sabah yoğunluğu: 2.000 personel ~4 dakikada giriş yapıp okutur
//  4. cift       — kaos: 100 kişi aynı anda 3 kez okutur (yalnızca 1'i kaydedilmeli)
//  5. raporlar   — 5 yönetici aynı anda 2.000 kişilik aylık puantaj ve Excel ister
//  6. kaos       — ani yük: saniyede 20'den 150'ye çıkan giriş + ana sayfa istekleri (kırılma noktası)
import http from 'k6/http'
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import exec from 'k6/execution'

const BASE = __ENV.BASE_URL || 'http://localhost:5080'
const PASSWORD = 'Pdks123!'
const BRANCHES = 10
const PER_BRANCH = 200
const kiosks = JSON.parse(open(__ENV.KIOSKS_FILE || './kiosks.json'))

const scansOk = new Counter('okutma_basarili')
const scansRejected = new Counter('okutma_reddedildi')
const doubleOk = new Counter('cift_okutma_kaydedilen')

const json = { headers: { 'Content-Type': 'application/json' } }
const auth = (token, name) => ({ headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, tags: { name } })

// Kioskun ekranındaki QR'ın aynısı: {kioskId}.{30 sn'lik pencere}.{HMAC-SHA256 ilk 16 bayt, base64url}
function qrFor(kiosk) {
  const windowNo = Math.floor(Date.now() / 1000 / 30)
  const payload = `${kiosk.id}.${windowNo}`
  const sig = crypto.hmac('sha256', encoding.b64decode(kiosk.secret), payload, 'binary')
  const bytes = new Uint8Array(sig).slice(0, 16)
  return `${payload}.${encoding.b64encode(bytes.buffer, 'rawurl')}`
}

function login(email, name = 'login') {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password: PASSWORD }), { ...json, tags: { name } })
  check(res, { 'giriş 200': (r) => r.status === 200 })
  return res.status === 200 ? res.json('accessToken') : null
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    kiosklar: { executor: 'constant-vus', vus: BRANCHES, duration: '12m', exec: 'kioskScreen' },
    mudurler: { executor: 'constant-vus', vus: BRANCHES + 1, duration: '12m', exec: 'managerDashboard' },
    sabah: {
      executor: 'ramping-arrival-rate', exec: 'morningArrival', startTime: '15s',
      startRate: 2, timeUnit: '1s', preAllocatedVUs: 100, maxVUs: 400,
      // ~2.000 kişi: 1 dk'da 2'den 10/sn'ye çıkar, 3 dk 10/sn, sonra kalanlar
      stages: [{ target: 10, duration: '1m' }, { target: 10, duration: '3m' }, { target: 0, duration: '10s' }],
    },
    cift: { executor: 'per-vu-iterations', vus: 100, iterations: 1, exec: 'doubleScan', startTime: '1m' },
    raporlar: { executor: 'per-vu-iterations', vus: 5, iterations: 2, exec: 'reports', startTime: '5m', maxDuration: '4m' },
    kaos: {
      executor: 'ramping-arrival-rate', exec: 'chaos', startTime: '7m',
      startRate: 20, timeUnit: '1s', preAllocatedVUs: 200, maxVUs: 1500,
      stages: [{ target: 50, duration: '1m' }, { target: 150, duration: '2m' }, { target: 150, duration: '1m' }, { target: 0, duration: '15s' }],
    },
  },
  // Eşikler testi durdurmaz; her uç nokta için ayrı ölçüm çıksın diye tanımlı.
  thresholds: Object.fromEntries(
    ['login', 'scan', 'me', 'kiosk', 'dashboard', 'dashboard_admin', 'monthly', 'excel', 'team_report', 'chaos_login', 'chaos_me', 'double_scan']
      .flatMap((n) => [
        [`http_req_duration{name:${n}}`, ['p(95)<600000']],
        [`http_req_failed{name:${n}}`, ['rate<=1']],
        [`http_reqs{name:${n}}`, ['count>=0']],
      ]),
  ),
  setupTimeout: '2m',
}

export function setup() {
  const kioskTokens = kiosks.map((k) => login(k.email))
  const managerTokens = Array.from({ length: BRANCHES }, (_, b) => login(`lt-mudur-${b + 1}@yuk.test`))
  const adminToken = login('admin@pdks.local')
  return { kioskTokens, managerTokens, adminToken }
}

export function kioskScreen(data) {
  const n = exec.vu.idInTest % BRANCHES
  const res = http.get(`${BASE}/api/kiosk/state`, auth(data.kioskTokens[n], 'kiosk'))
  check(res, { 'kiosk 200': (r) => r.status === 200 })
  sleep(3)
}

export function managerDashboard(data) {
  const n = exec.vu.idInTest % (BRANCHES + 1)
  if (n === BRANCHES) {
    const res = http.get(`${BASE}/api/dashboard/live`, auth(data.adminToken, 'dashboard_admin'))
    check(res, { 'yönetici panosu 200': (r) => r.status === 200 })
    sleep(10)
  } else {
    const res = http.get(`${BASE}/api/dashboard/live`, auth(data.managerTokens[n], 'dashboard'))
    check(res, { 'müdür panosu 200': (r) => r.status === 200 })
    sleep(5)
  }
}

export function morningArrival() {
  const it = exec.scenario.iterationInTest
  if (it >= BRANCHES * PER_BRANCH) return
  const b = (it % BRANCHES) + 1
  const i = Math.floor(it / BRANCHES) + 1
  const token = login(`lt-${b}-${i}@yuk.test`)
  if (!token) return

  http.get(`${BASE}/api/me/attendance`, auth(token, 'me'))
  const res = http.post(`${BASE}/api/attendance/scan`, JSON.stringify({ qrToken: qrFor(kiosks[b - 1]), action: 'CheckIn' }), auth(token, 'scan'))
  if (res.status === 200) scansOk.add(1)
  else scansRejected.add(1)
  check(res, { 'okutma 200': (r) => r.status === 200 })
}

// Aynı kişi aynı anda 3 kez okutur (çift dokunma, zayıf bağlantıda yeniden gönderme).
export function doubleScan() {
  const i = exec.vu.idInTest % 100 + 1
  const token = login(`lt-cift-${i}@yuk.test`)
  if (!token) return
  const body = JSON.stringify({ qrToken: qrFor(kiosks[0]), action: 'CheckIn' })
  const params = auth(token, 'double_scan')
  const responses = http.batch([
    ['POST', `${BASE}/api/attendance/scan`, body, params],
    ['POST', `${BASE}/api/attendance/scan`, body, params],
    ['POST', `${BASE}/api/attendance/scan`, body, params],
  ])
  doubleOk.add(responses.filter((r) => r.status === 200).length)
}

export function reports(data) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const from = new Date(Date.now() - 27 * 864e5).toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  const params = (name) => ({ ...auth(data.adminToken, name), timeout: '180s' })

  let res = http.get(`${BASE}/api/reports/monthly?year=${y}&month=${m}`, params('monthly'))
  check(res, { 'aylık puantaj 200': (r) => r.status === 200 })
  res = http.get(`${BASE}/api/reports/monthly/export?year=${y}&month=${m}`, { ...params('excel'), responseType: 'none' })
  check(res, { 'excel 200': (r) => r.status === 200 })
  res = http.get(`${BASE}/api/reports/attendance?from=${from}&to=${to}`, params('team_report'))
  check(res, { 'ekip raporu 200': (r) => r.status === 200 })
}

export function chaos() {
  const n = Math.floor(Math.random() * BRANCHES * PER_BRANCH)
  const token = login(`lt-${(n % BRANCHES) + 1}-${Math.floor(n / BRANCHES) + 1}@yuk.test`, 'chaos_login')
  if (!token) return
  http.get(`${BASE}/api/me/attendance`, auth(token, 'chaos_me'))
}

// ---- Özet: uç nokta başına süre ve hata oranı ----
const labels = {
  login: 'Giriş (sabah)', me: 'Bugünüm ekranı', scan: 'QR okutma', kiosk: 'Kiosk QR yenileme',
  dashboard: 'Müdür canlı pano (200 kişi)', dashboard_admin: 'Yönetici canlı pano (2.000+ kişi)',
  monthly: 'Aylık puantaj (2.000+ kişi)', excel: 'Puantaj Excel', team_report: 'Ekip raporu (4 hafta)',
  double_scan: 'Çift okutma isteği', chaos_login: 'Kaos: giriş', chaos_me: 'Kaos: Bugünüm',
}

export function handleSummary(data) {
  const ms = (v) => (v == null ? '-' : v >= 1000 ? `${(v / 1000).toFixed(2)} sn` : `${Math.round(v)} ms`)
  const rows = Object.entries(labels).map(([name, label]) => {
    const d = data.metrics[`http_req_duration{name:${name}}`]?.values
    const f = data.metrics[`http_req_failed{name:${name}}`]?.values
    const n = data.metrics[`http_reqs{name:${name}}`]?.values?.count
    if (!d || !n) return null
    return `| ${label} | ${n} | ${ms(d.med)} | ${ms(d['p(95)'])} | ${ms(d.max)} | %${((f?.rate || 0) * 100).toFixed(1)} |`
  }).filter(Boolean)

  const total = data.metrics.http_reqs.values
  const lines = [
    '## PDKS yük testi sonucu',
    '',
    `Toplam ${total.count} istek, saniyede ortalama ${total.rate.toFixed(1)} istek. Genel hata oranı: %${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}`,
    '',
    '| İşlem | İstek | Ortanca | %95 | En uzun | Hata |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    `Sabah okutması: ${data.metrics.okutma_basarili?.values.count || 0} başarılı, ${data.metrics.okutma_reddedildi?.values.count || 0} reddedilen.`,
    `Çift okutma: 100 kişi × 3 eş zamanlı istek → ${data.metrics.cift_okutma_kaydedilen?.values.count || 0} başarılı yanıt (doğrusu 100).`,
  ]
  const md = lines.join('\n')
  return { stdout: md + '\n', 'ozet.md': md + '\n', 'ozet.json': JSON.stringify(data.metrics) }
}
