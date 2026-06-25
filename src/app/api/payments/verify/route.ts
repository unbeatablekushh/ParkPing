export const runtime = 'nodejs'

import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Verify request body:', body)
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderType,
      vehicleId,
      deliveryAddress
    } = body

    // Step 1: Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(sign)
      .digest('hex')

    console.log('Signature match:', expectedSign === razorpay_signature)

    if (expectedSign !== razorpay_signature) {
      console.error('Signature mismatch')
      return Response.json({ 
        success: false, 
        error: 'Signature verification failed' 
      }, { status: 400 })
    }

    // Step 2: Get user session
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('User:', user?.id)
    console.log('Auth error:', authError)

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 })
    }

    // Step 3: Update order in database
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'paid',
        razorpay_payment_id,
        razorpay_signature
      })
      .eq('razorpay_order_id', razorpay_order_id)

    console.log('Order update error:', orderError)

    if (orderError) {
      console.error('Order update failed:', orderError)
      return Response.json({ 
        success: false, 
        error: 'Order update failed: ' + orderError.message 
      }, { status: 500 })
    }

    // Step 4: Handle subscription specific logic
    if (orderType === 'subscription') {
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + 90)

      console.log('Creating subscription...')
      console.log('User ID:', user.id)
      console.log('Ends at:', endsAt)

      // Insert into subscriptions table
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'quarterly',
          amount: 9900,
          status: 'active',
          razorpay_payment_id,
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString()
        })

      console.log('Subscription error:', subError)

      if (subError) {
        console.error('Subscription insert failed:', subError)
        return Response.json({ 
          success: false, 
          error: 'Subscription failed: ' + subError.message 
        }, { status: 500 })
      }

      // Update profile is_subscribed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          is_subscribed: true,
          subscription_ends_at: endsAt.toISOString()
        })
        .eq('id', user.id)

      console.log('Profile update error:', profileError)

      if (profileError) {
        console.error('Profile update failed:', profileError)
        return Response.json({ 
          success: false, 
          error: 'Profile update failed: ' + profileError.message 
        }, { status: 500 })
      }
    }

    // Step 5: Handle sticker order
    if (orderType === 'sticker' && vehicleId) {
      const { error: qrError } = await supabase
        .from('qr_codes')
        .update({ delivery_status: 'ordered' })
        .eq('vehicle_id', vehicleId)

      console.log('QR update error:', qrError)
      
      // Update delivery address in order if provided
      if (deliveryAddress) {
        await supabase
          .from('orders')
          .update({ delivery_address: deliveryAddress })
          .eq('razorpay_order_id', razorpay_order_id)
      }
    }

    console.log('Payment verified successfully!')
    return Response.json({ success: true })

  } catch (error) {
    console.error('Verify route crash:', error)
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Server error'
    }, { status: 500 })
  }
}
