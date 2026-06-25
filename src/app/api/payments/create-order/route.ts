import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderType, vehicleId, deliveryAddress } = await request.json();
    const userId = session.user.id;

    // Calculate amount in paise
    let amount = 0;
    if (orderType === 'sticker') {
      amount = 19800; // ₹198
    } else if (orderType === 'subscription') {
      amount = 9900; // ₹99
    } else {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        orderType,
        userId,
        vehicleId: vehicleId || '',
      },
    });

    // Save pending order to Supabase
    const { error: dbError } = await supabase.from('orders').insert({
      user_id: userId,
      vehicle_id: vehicleId || null,
      order_type: orderType,
      amount: amount,
      currency: 'INR',
      razorpay_order_id: order.id,
      payment_status: 'pending',
      delivery_address: deliveryAddress || null,
    });

    if (dbError) {
      console.error('Database error saving order:', dbError);
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    if (!order || !order.id) {
       return NextResponse.json({ error: 'Razorpay failed to return an order ID' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    console.error("Razorpay order creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    
    // Check for common configuration errors
    if (errorMessage.includes("key_id") || errorMessage.includes("key_secret")) {
       return NextResponse.json({ error: "Razorpay credentials missing on server. Check Vercel Env Vars." }, { status: 500 });
    }

    return NextResponse.json({ error: `Order creation failed: ${errorMessage}` }, { status: 500 });
  }
}
