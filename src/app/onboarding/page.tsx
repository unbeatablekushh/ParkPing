"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, CheckCircle2, Download } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCarNumber, generateQRCodeString, PARKPING_URL } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Step 1 Data
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 Data
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 Data
  const [carNumber, setCarNumber] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [purchaseYear, setPurchaseYear] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [carColor, setCarColor] = useState("");
  const [rcFile, setRcFile] = useState<File | null>(null);

  // Step 4 Data — QR code generated after vehicle registration
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
         setUserId(session.user.id);
         const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
         if (data) {
             setFullName(data.full_name || "");
             setAge(data.age?.toString() || "");
             setGender(data.gender || "");
             setDob(data.date_of_birth || "");
             setPhone(data.phone || localStorage.getItem("temp_phone") || "");
         } else {
             setPhone(localStorage.getItem("temp_phone") || "");
         }
      }
    };
    fetchUser();
  }, [supabase.auth, supabase]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !age || !gender || !dob || !phone) {
        toast("Please fill in all personal details.", "error"); return;
    }
    setLoading(true);
    
    const { error } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        age: parseInt(age),
        gender,
        date_of_birth: dob,
        phone
    }, { onConflict: 'id' });
    
    await supabase.auth.updateUser({
        data: { full_name: fullName, age: parseInt(age), gender, date_of_birth: dob }
    });

    setLoading(false);
    if (error) toast(error.message, "error");
    else setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
       toast("Password does not meet requirements.", "error"); return;
    }
    if (password !== confirmPassword) {
        toast("Passwords do not match.", "error"); return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    
    if (error) toast(error.message, "error");
    else setStep(3);
  };

  const completeOnboarding = async () => {
      setLoading(true);
      await supabase.from('profiles').upsert({ id: userId, profile_completed: true }, { onConflict: 'id' });
      setLoading(false);
      setStep(4);
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carNumber || !carMake || !carModel || !purchaseYear || !fuelType || !chassisNumber || !engineNumber) {
        toast("Please fill in all mandatory fields.", "error"); return;
    }
    if (!rcFile) {
        toast("RC Photo is mandatory for registration.", "error"); return;
    }
    setLoading(true);

    // Upload RC Photo
    let rcImageUrl = "";
    try {
      const fileExt = rcFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `rc-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('rc_images')
        .upload(filePath, rcFile);

      if (uploadError) {
        throw new Error("Failed to upload RC: " + uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('rc_images')
        .getPublicUrl(filePath);
      
      rcImageUrl = publicUrl;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      toast(errorMessage, "error");
      setLoading(false);
      return;
    }

    // Insert vehicle
    const { data: vehicle, error: vehError } = await supabase.from('vehicles').insert({
        user_id: userId,
        car_number: carNumber,
        owner_name: fullName,
        make: carMake,
        model: carModel,
        purchase_year: parseInt(purchaseYear),
        fuel_type: fuelType,
        chassis_number: chassisNumber,
        engine_number: engineNumber,
        color: carColor,
        rc_image_url: rcImageUrl,
        is_verified: false
    }).select('id').single();

    if (vehError || !vehicle) {
      toast("Failed to register vehicle: " + (vehError?.message || "Unknown error"), "error");
      setLoading(false);
      return;
    }

    // Auto-generate QR code record
    const qrString = generateQRCodeString();
    const { error: qrError } = await supabase.from('qr_codes').insert({
      vehicle_id: vehicle.id,
      user_id: userId,
      car_number: carNumber,
      owner_name: fullName,
      qr_code_string: qrString,
      is_active: true,
      delivery_status: 'pending',
    });

    if (qrError) {
      console.error("QR code creation failed:", qrError);
    } else {
      setQrCodeString(qrString);
    }

    setLoading(false);
    await completeOnboarding();
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    canvas.width = 512;
    canvas.height = 512;
    
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const link = document.createElement('a');
      link.download = `parkping-${carNumber.replace(/\s/g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Utilities
  const calculateStrength = () => {
     let c = 0;
     if (password.length >= 8) c++;
     if (/[A-Z]/.test(password)) c++;
     if (/[0-9]/.test(password)) c++;
     if (/[^a-zA-Z0-9]/.test(password)) c++;
     return c;
  }
  const strength = calculateStrength();
  const strengthColors = ["bg-red-200", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10">
        
        {/* Progress Bar */}
        {step < 4 && (
            <div className="mb-8">
                <div className="flex justify-between items-end mb-2 text-sm font-medium text-gray-500">
                    <span>Step {step} of 3</span>
                    <span className="text-primary font-bold">{Math.round((step/3)*100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${(step/3)*100}%` }}></div>
                </div>
            </div>
        )}

        <Card className="shadow-2xl border-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-orange-400 w-full" />
          <CardContent className="px-8 pt-10 pb-12">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-secondary">Tell us about yourself</h2>
                  </div>
                  <form onSubmit={handleStep1} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                            <input required type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                            <select required value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white">
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                            <input required type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                        </div>
                    </div>
                    <Button type="submit" className="w-full mt-6 h-12" isLoading={loading}>Continue →</Button>
                  </form>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-secondary">Create a secure password</h2>
                    <p className="mt-2 text-sm text-gray-500">You&apos;ll use this to login next time instead of OTP</p>
                  </div>
                  <form onSubmit={handleStep2} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                            <input required type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400">
                                {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                            <input required type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                        </div>
                    </div>
                    
                    {/* Strength visualizer */}
                    <div className="pt-2">
                        <div className="flex gap-1 h-1.5 mb-2">
                           {[1,2,3,4].map(i => (
                               <div key={i} className={`flex-1 rounded-full ${i <= strength ? strengthColors[strength] : 'bg-gray-200'}`} />
                           ))}
                        </div>
                        <ul className="text-xs text-gray-500 space-y-1">
                            <li className={password.length >= 8 ? "text-green-500" : ""}>✓ Minimum 8 characters</li>
                            <li className={/[A-Z]/.test(password) ? "text-green-500" : ""}>✓ At least one uppercase letter</li>
                            <li className={/[0-9]/.test(password) ? "text-green-500" : ""}>✓ At least one number</li>
                            <li className={/[^a-zA-Z0-9]/.test(password) ? "text-green-500" : ""}>✓ At least one special character</li>
                        </ul>
                    </div>

                    <Button type="submit" disabled={strength < 4 || password !== confirmPassword} className="w-full mt-6 h-12" isLoading={loading}>Create Password →</Button>
                  </form>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-secondary">Register your first vehicle</h2>
                    <p className="mt-2 text-sm text-gray-500">Add your car details to get your ParkPing QR sticker</p>
                  </div>
                  <form onSubmit={handleStep3} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Car Registration Number</label>
                        <input required type="text" value={carNumber} onChange={e => setCarNumber(formatCarNumber(e.target.value))} placeholder="MH 01 AB 1234" maxLength={13} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary uppercase text-lg font-bold tracking-wider" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Maker</label>
                            <select required value={carMake} onChange={e => setCarMake(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary bg-white">
                                <option value="">Select</option>
                                {["Maruti Suzuki", "Hyundai", "Tata", "Honda", "Toyota", "Mahindra", "Kia", "MG", "BMW", "Mercedes-Benz", "Others"].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Car Model</label>
                            <input required type="text" value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="Creta, Swift, etc." className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Year</label>
                            <select required value={purchaseYear} onChange={e => setPurchaseYear(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary bg-white">
                                <option value="">Year</option>
                                {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                            <select required value={fuelType} onChange={e => setFuelType(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary bg-white">
                                <option value="">Fuel</option>
                                {["Petrol", "Diesel", "Electric (EV)", "CNG", "Hybrid"].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chassis (Last 5)</label>
                            <input required type="text" value={chassisNumber} onChange={e => setChassisNumber(e.target.value)} placeholder="XXXXX" maxLength={25} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Engine (Last 5)</label>
                            <input required type="text" value={engineNumber} onChange={e => setEngineNumber(e.target.value)} placeholder="XXXXX" maxLength={25} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-xs">Vehicle Color</label>
                        <input required type="text" value={carColor} onChange={e => setCarColor(e.target.value)} placeholder="White, Black, Red, etc." className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">Upload RC Photo (Compulsory)</label>
                        <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${rcFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary'}`}>
                            <input type="file" required accept="image/*" onChange={e => setRcFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="text-center">
                                {rcFile ? (
                                    <p className="text-green-600 font-bold">✓ {rcFile.name}</p>
                                ) : (
                                    <p className="text-gray-500 text-xs">Tap to upload front page of RC</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full mt-6 h-12" isLoading={loading}>Register Vehicle →</Button>
                    <div className="text-center mt-4">
                        <button type="button" onClick={() => completeOnboarding()} className="text-sm font-medium text-gray-500 hover:text-gray-900">Skip for now →</button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="text-center py-4">
                     {qrCodeString ? (
                       <>
                         <motion.div
                           initial={{ scale: 0 }}
                           animate={{ scale: 1 }}
                           transition={{ type: "spring", stiffness: 200, damping: 20 }}
                         >
                           <h2 className="text-3xl font-bold text-secondary mb-2">Your QR Code is Ready! 🎉</h2>
                           <p className="text-gray-500 mb-6 text-sm">
                             Your car <strong>{carNumber}</strong> is registered with ParkPing.
                           </p>
                         </motion.div>

                         {/* QR Code Display */}
                         <div ref={qrRef} className="bg-white border-2 border-gray-100 rounded-2xl p-6 inline-block shadow-lg mb-6">
                           <QRCodeSVG
                             value={`${PARKPING_URL}/scan?code=${qrCodeString}`}
                             size={200}
                             bgColor="#ffffff"
                             fgColor="#1A1A2E"
                             level="H"
                             includeMargin={true}
                           />
                           <p className="text-xs text-gray-400 font-mono mt-2">{qrCodeString}</p>
                         </div>

                         <div className="space-y-3 max-w-sm mx-auto">
                           <Button
                             className="w-full h-12"
                             variant="outline"
                             onClick={handleDownloadQR}
                           >
                             <Download className="w-4 h-4 mr-2" /> Download QR Code
                           </Button>

                           <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left">
                             <p className="text-sm font-semibold text-orange-800 mb-1">📋 Instructions</p>
                             <p className="text-xs text-orange-700 leading-relaxed">
                               Print this QR code and stick it on your windshield (front and back).
                               You can also order a premium weather-proof sticker from your dashboard.
                             </p>
                           </div>

                           <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 text-lg" onClick={() => router.push("/dashboard")}>
                             Go to Dashboard →
                           </Button>
                         </div>
                       </>
                     ) : (
                       <>
                         <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                         >
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                         </motion.div>
                         <h2 className="text-3xl font-bold text-secondary mb-3">You&apos;re all set! 🎉</h2>
                         <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                            Your ParkPing account is ready. Head to the dashboard to manage your vehicles.
                         </p>
                         <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 text-lg" onClick={() => router.push("/dashboard")}>
                            Go to Dashboard →
                         </Button>
                       </>
                     )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
