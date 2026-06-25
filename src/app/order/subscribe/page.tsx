"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { PaymentButton } from "@/components/PaymentButton";
import { CheckCircle2, ChevronLeft, Zap, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface Profile {
  full_name?: string;
  email?: string;
  phone?: string;
}

export default function SubscribePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
      setLoading(false);
    };

    fetchProfile();
  }, [supabase, router]);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 3000);
  };

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
            className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Star className="w-12 h-12 text-primary" fill="currentColor" />
          </motion.div>
          <h2 className="text-3xl font-bold text-secondary mb-3">Welcome to Premium! ⭐</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Your quarterly subscription is now active. All premium features are unlocked.
          </p>
          <div className="text-sm text-gray-400">
             Redirecting to Dashboard in 3 seconds...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 bg-[url('/grid.svg')] bg-center">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-primary mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3" /> Membership Plans
          </div>
          <h1 className="text-4xl font-bold text-secondary mb-4">Upgrade Your ParkPing Experience</h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Unlock premium features and get priority priority support for just ₹99 per quarter.
          </p>
        </div>

        <div className="relative">
          {/* Most Popular Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
             <div className="bg-secondary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg border border-white/20">
                Most Popular
             </div>
          </div>

          <Card className="shadow-2xl border-2 border-primary/20 overflow-hidden relative">
             <div className="h-2 bg-gradient-to-r from-primary to-orange-400 w-full" />
             <CardContent className="p-8 sm:p-12">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-10">
                   <div>
                      <h2 className="text-3xl font-bold text-secondary">Quarterly Premium</h2>
                      <p className="text-gray-500 font-medium">Billed every 3 months</p>
                   </div>
                   <div className="text-center sm:text-right">
                      <div className="text-5xl font-extrabold text-secondary tracking-tight">₹99</div>
                      <div className="text-primary font-semibold">/ 3 months</div>
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 mb-12">
                   {[
                      "Unlimited alerts per day",
                      "Anonymous chat with owner",
                      "90 day scan history",
                      "Real-time push notifications",
                      "Multiple vehicle support",
                      "Priority customer support"
                   ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                         </div>
                         <span className="text-gray-700 text-sm font-medium">{feature}</span>
                      </div>
                   ))}
                </div>

                <div className="space-y-4">
                  <PaymentButton
                    orderType="subscription"
                    onSuccess={handleSuccess}
                    buttonText="Subscribe for ₹99"
                    userName={profile?.full_name}
                    userEmail={profile?.email}
                    userPhone={profile?.phone}
                    className="w-full h-16 text-xl tracking-wide bg-gradient-to-r from-primary to-orange-500 hover:to-orange-600 shadow-xl shadow-primary/20"
                  />
                  <p className="text-center text-xs text-gray-500">
                    Cancel anytime. No hidden charges. 🔒 Secure payment via Razorpay.
                  </p>
                </div>
             </CardContent>
          </Card>
          
          <div className="mt-8 text-center bg-white/50 backdrop-blur-sm border border-white p-6 rounded-2xl">
             <h4 className="font-bold text-secondary mb-2 flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Why go Premium?
             </h4>
             <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
                Free members get 3 alerts/day and 1 vehicle. Premium members get full control, priority notifications, and private owner chat.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
