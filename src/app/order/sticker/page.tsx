"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { PaymentButton } from "@/components/PaymentButton";
import { CheckCircle2, ChevronLeft, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi"
];

interface Vehicle {
  id: string;
  car_number: string;
  make: string;
  model: string;
}

interface Profile {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  delivery_address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

function StickerOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(searchParams.get("vehicleId") || "");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Address fields
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const [{ data: prof }, { data: vehs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('vehicles').select('*').eq('user_id', session.user.id)
      ]);

      setProfile(prof);
      setVehicles(vehs || []);
      if (vehs && vehs.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vehs[0].id);
      }
      
      if (prof?.delivery_address) {
        const addr = prof.delivery_address;
        setAddressLine1(addr.line1 || "");
        setAddressLine2(addr.line2 || "");
        setCity(addr.city || "");
        setState(addr.state || "");
        setPincode(addr.pincode || "");
      }

      setLoading(false);
    };

    fetchInitialData();
  }, [supabase, router, selectedVehicleId]);

  const handleSuccess = async () => {
    if (saveAddress && profile) {
      await supabase.from('profiles').update({
        delivery_address: {
          line1: addressLine1,
          line2: addressLine2,
          city,
          state,
          pincode
        }
      }).eq('id', profile.id);
    }
    setSuccess(true);
  };

  const isFormValid = addressLine1 && city && state && pincode.length === 6 && selectedVehicleId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden text-center p-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </motion.div>
          <h2 className="text-3xl font-bold text-secondary mb-3">Order Placed! 🎉</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Your premium QR stickers are being prepared. Expect delivery in 5-7 business days.
          </p>
          <Link href="/dashboard">
            <Button variant="primary" className="w-full h-14 text-lg">Go to Dashboard →</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-primary mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Section 1 & 3: Info & Select Vehicle */}
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary">Order Your ParkPing QR Sticker 🚗</h1>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4">What You Get</h3>
              <ul className="space-y-3">
                {[
                  "2 premium laminated QR stickers",
                  "Front + rear windshield stickers",
                  "Pre-registered to your vehicle",
                  "Delivered in 5-7 business days",
                  "Weather resistant and durable"
                ].map((item, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-600">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4">1. Select Vehicle</h3>
              {vehicles.length === 0 ? (
                <div className="p-4 bg-orange-50 rounded-xl text-sm text-orange-700">
                  Register a vehicle first to order a sticker.
                </div>
              ) : (
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 font-medium"
                >
                  <option value="">Select a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.car_number} &mdash; {v.make} {v.model}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Section 2, 4 & 5: Summary, Address & Pay */}
          <div className="space-y-6">
            {/* Price Breakdown Card */}
            <Card className="shadow-lg border-0 overflow-hidden">
               <div className="h-2 bg-primary w-full" />
               <CardContent className="p-6">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">Order Summary</h3>
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase">Sticker Pack</div>
                 </div>
                 <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex justify-between">
                       <span>QR Sticker &times; 2</span>
                       <span>₹149</span>
                    </div>
                    <div className="flex justify-between">
                       <span>Delivery charges</span>
                       <span>₹49</span>
                    </div>
                    <div className="h-px bg-gray-100 my-2" />
                    <div className="flex justify-between text-lg font-bold text-secondary">
                       <span>Total</span>
                       <span>₹198</span>
                    </div>
                 </div>
               </CardContent>
            </Card>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">2. Delivery Address</h3>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Address Line 1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Address Line 2 (Optional)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="PIN Code (6 digits)"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />
                <label className="flex items-center text-sm text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={() => setSaveAddress(!saveAddress)}
                    className="mr-2 rounded text-primary focus:ring-primary"
                  />
                  Save address to profile for future orders
                </label>
              </div>
            </div>

            {/* Pay Button */}
            <div className="space-y-4">
                  <PaymentButton
                    orderType="sticker"
                    vehicleId={selectedVehicleId}
                    deliveryAddress={{ line1: addressLine1, line2: addressLine2, city, state, pincode }}
                    onSuccess={handleSuccess}
                    buttonText={isFormValid ? "Pay ₹198 & Order Now 🚀" : "Please complete address"}
                    userName={profile?.full_name}
                    userEmail={profile?.email}
                    userPhone={profile?.phone}
                    className={`w-full h-16 text-lg tracking-wide ${!isFormValid && "opacity-50 pointer-events-none"}`}
                  />
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">Secure Razorpay Payment</span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Track Order in Dashboard
                    </span>
                  </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StickerOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <StickerOrderContent />
    </Suspense>
  );
}
