/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js')

// Parse config from URL params
const params = new URL(location.href).searchParams
const config = {
  apiKey: params.get('apiKey') || self.__FIREBASE_CONFIG__?.apiKey || '',
  authDomain: params.get('authDomain') || self.__FIREBASE_CONFIG__?.authDomain || '',
  projectId: params.get('projectId') || self.__FIREBASE_CONFIG__?.projectId || '',
  messagingSenderId: params.get('messagingSenderId') || self.__FIREBASE_CONFIG__?.messagingSenderId || '',
  appId: params.get('appId') || self.__FIREBASE_CONFIG__?.appId || ''
}

firebase.initializeApp(config)

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '🚨 ParkPing Alert'
  const options = {
    body: payload.notification?.body || 'Someone needs you to move your car!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 200, 500, 200, 1000],
    data: payload.data,
    actions: [
      { action: 'respond', title: 'Respond Now' }
    ]
  }
  self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = data.url || '/dashboard?tab=alerts'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
