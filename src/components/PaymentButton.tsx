"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

interface PaymentButtonProps {
  orderType: "sticker" | "subscription";
  vehicleId?: string;
  deliveryAddress?: object;
  onSuccess: () => void;
  buttonText: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  className?: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => Promise<void>;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

const loadRazorpay = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function PaymentButton({
  orderType,
  vehicleId,
  deliveryAddress,
  onSuccess,
  buttonText,
  userName,
  userEmail,
  userPhone,
  className,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handlePayment = async () => {
    setLoading(true);

    try {
      // 1. Load Razorpay Script
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        toast("Razorpay SDK failed to load. Are you online?", "error");
        setLoading(false);
        return;
      }

      // 2. Create Order
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType, vehicleId, deliveryAddress }),
      });

      const orderData = await res.json();
      if (!res.ok) {
        toast(orderData.error || "Failed to create order", "error");
        setLoading(false);
        return;
      }

      // 3. Open Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ParkPing",
        description:
          orderType === "sticker"
            ? "2x Premium QR Stickers"
            : "Quarterly Premium Subscription",
        image: "/favicon.ico",
        order_id: orderData.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const result = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderType,
              vehicleId,
              deliveryAddress,
            }),
          });

          const data = await result.json();
          if (data.success) {
            toast("Payment successful!", "success");
            onSuccess();
          } else {
            toast("Payment verification failed. Please contact support.", "error");
            setLoading(false);
          }
        },
        prefill: {
          name: userName || "",
          email: userEmail || "",
          contact: userPhone || "",
        },
        theme: {
          color: "#FF6B35",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay(options);
      rzp.open();
    } catch (error: unknown) {
      console.error("Payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
      toast(errorMessage, "error");
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      isLoading={loading}
      className={className}
      variant="primary"
    >
      {buttonText}
    </Button>
  );
}
