"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Car, Camera, CheckCircle2, Download, AlertCircle } from "lucide-react";
import { formatCarNumber, generateQRCodeString, PARKPING_URL } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";


export default function RegisterVehiclePage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    carNumber: "",
    make: "",
    model: "",
    color: "",
    purchaseYear: "",
    fuelType: "",
    chassisNumber: "",
    engineNumber: ""
  });

  const [rcFile, setRcFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.carNumber || !form.make || !form.model || !form.fullName || !form.purchaseYear || !form.fuelType || !form.chassisNumber || !form.engineNumber) {
      return toast("Please fill in all mandatory fields.", "error");
    }

    if (!rcFile) {
      return toast("Please upload a photo of your RC book. It is compulsory.", "error");
    }

    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
       toast("You must be logged in to register a vehicle.", "error");
       setLoading(false);
       return;
    }

    // Upload RC Photo
    let rcImageUrl = "";
    try {
      const fileExt = rcFile.name.split('.').pop();
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `rc-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('rc_images')
        .upload(filePath, rcFile);

      if (uploadError) {
        throw new Error("Failed to upload RC photo: " + uploadError.message);
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
        user_id: session.user.id,
        car_number: form.carNumber,
        owner_name: form.fullName, // New field
        chassis_number: form.chassisNumber, // New field
        engine_number: form.engineNumber, // New field
        make: form.make,
        model: form.model,
        color: form.color || null,
        purchase_year: parseInt(form.purchaseYear),
        fuel_type: form.fuelType,
        rc_image_url: rcImageUrl, // New field
        is_verified: false // Mandatory RC uploaded, pending admin verification
    }).select('id').single();

    if (vehError || !vehicle) {
       toast("Failed to register vehicle: " + (vehError?.message || "Unknown error"), "error");
       setLoading(false);
       return;
    }

    // Auto-generate QR code
    const qrString = generateQRCodeString();
    const { error: qrError } = await supabase.from('qr_codes').insert({
      vehicle_id: vehicle.id,
      user_id: session.user.id,
      car_number: form.carNumber,
      owner_name: form.fullName,
      qr_code_string: qrString,
      is_active: true,
      delivery_status: 'pending',
    });

    if (!qrError) {
      setQrCodeString(qrString);
    } else {
      console.error("QR code creation failed:", qrError);
    }

    setLoading(false);
    setSuccess(true);
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
      link.download = `parkping-${form.carNumber.replace(/\s/g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4 py-20">
          <Card className="max-w-md w-full p-8 text-center shadow-xl animate-in zoom-in duration-500">
            {qrCodeString ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful! 🎉</h2>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                  Your car <strong>{form.carNumber}</strong> is now registered. Our team will verify your RC photo shortly.
                </p>

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

                <div className="space-y-3">
                  <Button className="w-full h-12" variant="outline" onClick={handleDownloadQR}>
                    <Download className="w-4 h-4 mr-2" /> Download QR Code
                  </Button>

                  <Button className="w-full h-12" onClick={() => router.push("/dashboard")}>
                    Go to Dashboard
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Registered!</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Your car <strong>{form.carNumber}</strong> is securely saved.
                </p>
                <Button className="w-full h-12" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </>
            )}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black text-secondary tracking-tight">Register Your Vehicle</h1>
          <p className="mt-2 text-gray-500 max-w-lg mx-auto">Please enter your vehicle details exactly as they appear on your RC.</p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="p-8 space-y-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Owner Full Name (As per RC)</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        placeholder="John Doe"
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Registration Number</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-6 rounded-2xl border-2 border-gray-100 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-2xl font-black text-gray-900 tracking-widest uppercase"
                        placeholder="MH 01 AB 1234"
                        value={form.carNumber}
                        onChange={(e) => setForm({ ...form, carNumber: formatCarNumber(e.target.value) })}
                        maxLength={13}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Chassis Number (Last 5 digits)</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        placeholder="XXXXX"
                        value={form.chassisNumber}
                        onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
                        maxLength={25}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Engine Number (Last 5 digits)</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        placeholder="XXXXX"
                        value={form.engineNumber}
                        onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
                        maxLength={25}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Year</label>
                      <select
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        value={form.purchaseYear}
                        onChange={(e) => setForm({ ...form, purchaseYear: e.target.value })}
                      >
                        <option value="">Select Year</option>
                        {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Fuel Type</label>
                      <select
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        value={form.fuelType}
                        onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
                      >
                        <option value="">Select Fuel</option>
                        {["Petrol", "Diesel", "Electric (EV)", "CNG", "Hybrid"].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Maker</label>
                      <select
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        value={form.make}
                        onChange={(e) => setForm({ ...form, make: e.target.value })}
                      >
                        <option value="">Select Company</option>
                        {["Maruti Suzuki", "Hyundai", "Tata", "Honda", "Toyota", "Mahindra", "Kia", "MG", "BMW", "Mercedes-Benz", "Others"].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Model Name</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        placeholder="Creta, Swift, etc."
                        value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Color</label>
                      <input
                        type="text"
                        required
                        className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-primary transition-all bg-gray-50 focus:bg-white outline-none"
                        placeholder="White, Black, Red, etc."
                        value={form.color}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4 mb-6">
                      <AlertCircle className="text-blue-600 w-6 h-6 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-900 text-lg">Upload RC Photo</p>
                        <p className="text-sm text-blue-700">Please upload a clear photo of your Registration Certificate (front page). This is mandatory for verification.</p>
                      </div>
                    </div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">RC Book Photo (Compulsory)</label>
                    <input 
                      type="file" 
                      id="rc-upload" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => setRcFile(e.target.files?.[0] || null)}
                    />
                    <label 
                      htmlFor="rc-upload"
                      className={`w-full border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group flex flex-col items-center ${
                        rcFile ? 'border-success bg-green-50/30' : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {rcFile ? (
                        <div className="text-success flex flex-col items-center">
                          <CheckCircle2 className="w-12 h-12 mb-3" />
                          <p className="font-bold text-lg">File Selected: {rcFile.name}</p>
                          <p className="text-sm opacity-70">Click to change</p>
                        </div>
                      ) : (
                        <>
                          <Camera className="w-12 h-12 text-gray-400 mb-4 group-hover:text-primary transition-colors" />
                          <p className="text-xl font-bold text-gray-700">Choose RC Image</p>
                          <p className="text-sm text-gray-400 mt-1">PNG, JPG or PDF up to 5MB</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-16 text-xl font-bold shadow-lg shadow-primary/20 rounded-2xl" 
                  isLoading={loading}
                >
                  Register {form.carNumber || "My Car"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
