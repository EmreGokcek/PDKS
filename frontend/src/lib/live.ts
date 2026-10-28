import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { refreshSession, session } from './api'

/**
 * Canlı bağlantı (SignalR). Sunucu yalnızca "bir şey değişti" der; ilgili sorgular yeniden çekilir.
 * - attendance {userId}: biri okuttu ya da kaydı düzeltildi → pano, raporlar, kişinin kendi ekranı
 * - notifications: yeni bildirim → zil
 * Bağlantı koparsa kendiliğinden yeniden dener; o sırada sayfalar eskisi gibi belirli aralıklarla yenilenir.
 */

type Status = 'connecting' | 'live' | 'offline'

let status: Status = 'offline'
const statusListeners = new Set<() => void>()
const changeListeners = new Set<(userId: string) => void>()

function setStatus(next: Status) {
  if (status === next) return
  status = next
  statusListeners.forEach((l) => l())
}

let connection: HubConnection | null = null
let ownerId: string | null = null
let retryTimer: ReturnType<typeof setTimeout> | undefined

function start(userId: string, qc: QueryClient) {
  if (connection && ownerId === userId) return
  stop()
  ownerId = userId

  const conn = new HubConnectionBuilder()
    .withUrl('/api/hubs/live', {
      // Süresi dolmuşsa yenisini al (yeniden bağlanırken de çağrılır).
      accessTokenFactory: async () => session.token ?? (await refreshSession())?.accessToken ?? '',
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(LogLevel.None)
    .build()

  conn.on('attendance', (msg: { userId?: string }) => {
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['reports'] })
    if (msg?.userId === userId) {
      void qc.invalidateQueries({ queryKey: ['attendance'] })
      void qc.invalidateQueries({ queryKey: ['me', 'month'] })
    }
    if (msg?.userId) changeListeners.forEach((l) => l(msg.userId!))
  })
  conn.on('notifications', () => void qc.invalidateQueries({ queryKey: ['notifications'] }))

  conn.onreconnecting(() => setStatus('connecting'))
  conn.onreconnected(() => {
    setStatus('live')
    // Kopukken kaçanlar için bir kez tazele.
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['notifications'] })
  })
  conn.onclose(() => {
    setStatus('offline')
    if (connection === conn) retryTimer = setTimeout(() => void connect(conn), 60_000)
  })

  connection = conn
  void connect(conn)
}

async function connect(conn: HubConnection) {
  if (connection !== conn || conn.state !== HubConnectionState.Disconnected) return
  setStatus('connecting')
  try {
    await conn.start()
    if (connection === conn) setStatus('live')
    else void conn.stop()
  } catch {
    setStatus('offline')
    if (connection === conn) retryTimer = setTimeout(() => void connect(conn), 30_000)
  }
}

function stop() {
  clearTimeout(retryTimer)
  const conn = connection
  connection = null
  ownerId = null
  setStatus('offline')
  if (conn) void conn.stop()
}

// Çıkış yapılınca bağlantı kapanır.
session.subscribe((res) => {
  if (!res) stop()
})

/** Giriş yapmış kullanıcı için canlı bağlantıyı açık tutar (uygulama çerçevesinde bir kez çağrılır). */
export function useLiveConnection(userId: string | null | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!userId) return
    start(userId, qc)
  }, [userId, qc])
}

/** Canlı bağlantının durumu (panodaki "Canlı" işareti için). */
export function useLiveStatus(): Status {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => void statusListeners.delete(l)
    },
    () => status,
  )
}

/** Bir kişinin kaydı değişince haber verir (panoda kartı kısa süre vurgulamak için). */
export function onAttendanceChange(listener: (userId: string) => void) {
  changeListeners.add(listener)
  return () => void changeListeners.delete(listener)
}
