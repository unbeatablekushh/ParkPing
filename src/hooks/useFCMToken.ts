'use client'

import { useEffect, useState, useCallback } from 'react'
import { messaging, getToken } from '@/lib/firebase'
import { createClient } from '@/lib/supabase/client'

export function useFCMToken() {
  const [token, setToken] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default')

  const requestAndSave = useCallback(async () => {
    // Check browser support
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionStatus('unsupported')
      return null
    }

    try {
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)

      if (permission !== 'granted' || !messaging) {
        return null
      }

      // Register service worker with Firebase config passed in URL
      const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      }
      const params = new URLSearchParams(config as unknown as Record<string, string>).toString()
      const swRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`)

      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      })

      if (fcmToken) {
        setToken(fcmToken)

        // Save to profiles table
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase
            .from('profiles')
            .update({ fcm_token: fcmToken })
            .eq('id', session.user.id)
        }
      }

      return fcmToken
    } catch (err) {
      console.error('FCM token error:', err)
      return null
    }
  }, [])

  useEffect(() => {
    requestAndSave()
  }, [requestAndSave])

  return { token, permissionStatus, requestAndSave }
}
