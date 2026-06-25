export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { scanId, content, senderType } = body

    if (!scanId || !content || !senderType) {
      return Response.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data, error } = await supabase
      .from('messages')
      .insert({
        scan_id: scanId,
        content: content,
        sender_type: senderType,
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Message insert error:', error)
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      messageId: data.id
    })

  } catch (error) {
    console.error('Messages send route error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Unknown error'
    }, { status: 500 })
  }
}