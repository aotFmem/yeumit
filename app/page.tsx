"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Laptop,
  Calendar,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ExternalLink,
  XCircle,
  Sparkles,
} from "lucide-react";
import { initializeLiff, closeLiff } from "@/lib/liff";
import { supabase } from "@/lib/supabaseClient";
import { Equipment, UserProfile } from "@/lib/types";

// Fallback demo equipment when Supabase credentials are not yet populated
const FALLBACK_EQUIPMENTS: Equipment[] = [
  {
    id: "e1000000-0000-0000-0000-000000000001",
    name: 'MacBook Pro 14" M3 (Space Gray)',
    image_url:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    total_stock: 5,
    available_stock: 3,
  },
  {
    id: "e2000000-0000-0000-0000-000000000002",
    name: "Dell XPS 15 (Core i7, 32GB RAM)",
    image_url:
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80",
    total_stock: 4,
    available_stock: 2,
  },
  {
    id: "e3000000-0000-0000-0000-000000000003",
    name: 'Dell UltraSharp 27" 4K Monitor',
    image_url:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
    total_stock: 6,
    available_stock: 4,
  },
  {
    id: "e4000000-0000-0000-0000-000000000004",
    name: 'iPad Air 11" M2 + Apple Pencil',
    image_url:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
    total_stock: 3,
    available_stock: 1,
  },
  {
    id: "e5000000-0000-0000-0000-000000000005",
    name: "Logitech MX Master 3S Wireless Mouse",
    image_url:
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80",
    total_stock: 10,
    available_stock: 8,
  },
  {
    id: "e6000000-0000-0000-0000-000000000006",
    name: "Epson Full HD Mobile Projector (Out of Stock)",
    image_url:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80",
    total_stock: 2,
    available_stock: 0,
  },
];

export default function BorrowPage() {
  // LIFF & Profile States
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [isLiffLoading, setIsLiffLoading] = useState(true);

  // Form States
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [isEquipmentsLoading, setIsEquipmentsLoading] = useState(true);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [department, setDepartment] = useState("");
  const [borrowDate, setBorrowDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    equipmentName: string;
    borrowDate: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 1. Initialize LIFF on Mount with graceful mock fallback
  useEffect(() => {
    async function setupLiff() {
      try {
        const result = await initializeLiff();
        setProfile(result.profile);
        setIsMock(result.isMock);
      } catch (err) {
        console.error("LIFF initialization error:", err);
      } finally {
        setIsLiffLoading(false);
      }
    }
    setupLiff();
  }, []);

  // 2. Fetch Equipments from Supabase via Anon Client
  useEffect(() => {
    async function fetchEquipments() {
      setIsEquipmentsLoading(true);
      try {
        const { data, error } = await supabase
          .from("equipments")
          .select("*")
          .order("name", { ascending: true });

        if (error || !data || data.length === 0) {
          console.info(
            "[Supabase] Could not fetch equipments from database (empty or unconfigured). Using fallback IT equipment catalogue."
          );
          setEquipments(FALLBACK_EQUIPMENTS);
        } else {
          setEquipments(data);
        }
      } catch (err) {
        console.warn("[Supabase] Query error, falling back to local dataset:", err);
        setEquipments(FALLBACK_EQUIPMENTS);
      } finally {
        setIsEquipmentsLoading(false);
      }
    }
    fetchEquipments();
  }, []);

  // 3. Close window timer countdown when success occurs
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      closeLiff();
    }
  }, [countdown]);

  // Selected Equipment Details
  const selectedEquipment = equipments.find((item) => item.id === selectedEquipmentId);
  const isOutOfStock = selectedEquipment ? selectedEquipment.available_stock <= 0 : false;

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profile) {
      setErrorMessage("LINE User Profile is not loaded yet. Please refresh.");
      return;
    }

    if (!department.trim()) {
      setErrorMessage("Please specify your department.");
      return;
    }

    if (!selectedEquipmentId) {
      setErrorMessage("Please select an IT equipment item to borrow.");
      return;
    }

    if (isOutOfStock) {
      setErrorMessage("The selected equipment is out of stock. Please choose another item.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_user_id: profile.userId,
          display_name: profile.displayName,
          department: department.trim(),
          equipment_id: selectedEquipmentId,
          borrow_date: borrowDate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit borrow request.");
      }

      // Success
      setSuccessData({
        message: result.message || "Borrow request confirmed!",
        equipmentName: result.transaction?.equipment_name || selectedEquipment?.name || "Equipment",
        borrowDate: borrowDate,
      });

      // Start 4-second countdown before calling liff.closeWindow()
      setCountdown(4);
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen pb-12">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06C755] to-[#049f44] flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Yeum-IT</h1>
              <p className="text-[11px] font-medium text-slate-500">LINE Equipment Borrowing</p>
            </div>
          </div>

          {/* Mode Indicator Badge */}
          <div>
            {isMock ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                Mock LIFF
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] mr-1.5 animate-pulse" />
                LINE Online
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Mock Dev Alert Banner (shows only when running in mock fallback) */}
        {isMock && (
          <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <span className="font-semibold">Local Development Mode:</span> Running outside official
              LINE LIFF. A test profile is loaded so you can test all features smoothly without HTTPS.
            </div>
          </div>
        )}

        {/* User Profile Card (Read-only from LIFF) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 mb-5 transition-all">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2.5">
            Borrower Profile
          </div>

          {isLiffLoading ? (
            <div className="flex items-center space-x-3 py-1 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-slate-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ) : profile ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                {profile.pictureUrl ? (
                  <Image
                    src={profile.pictureUrl}
                    alt={profile.displayName}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-base">
                    {profile.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-900 text-sm truncate">
                    {profile.displayName}
                  </span>
                  <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                    <Lock className="w-2.5 h-2.5 mr-0.5 text-slate-400" />
                    Verified
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  UID: {profile.userId}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-red-500 py-1">Failed to load borrower profile.</div>
          )}
        </div>

        {/* Success Modal / Banner */}
        {successData ? (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-emerald-200 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#06C755] flex items-center justify-center mx-auto mb-3.5 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Borrow Request Submitted!</h2>
            <p className="text-xs text-slate-500 mb-4">{successData.message}</p>

            <div className="bg-slate-50 rounded-xl p-3.5 text-left border border-slate-100 space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Item:</span>
                <span className="font-semibold text-slate-800 text-right">{successData.equipmentName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Borrow Date:</span>
                <span className="font-semibold text-slate-800">{successData.borrowDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Notification:</span>
                <span className="font-medium text-emerald-600">Dispatched to LINE Notify</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-4">
              Window will automatically close in{" "}
              <span className="font-bold text-emerald-600">{countdown}s</span>
            </div>

            <button
              type="button"
              onClick={() => closeLiff()}
              className="w-full py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-medium text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-2"
            >
              <span>Close Window</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Borrowing Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2 animate-in fade-in">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Read-Only Borrower Name Field */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Borrower Name</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">From LINE</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={profile?.displayName || "Loading profile..."}
                  className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-700 font-medium text-sm rounded-xl border border-slate-200 cursor-not-allowed select-none focus:outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Department Input */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label
                htmlFor="department"
                className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Department / Team</span>
                <span className="text-red-500">*</span>
              </label>

              <input
                id="department"
                type="text"
                required
                placeholder="e.g. IT Support, Product, Marketing"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 text-sm rounded-xl border border-slate-300 focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 outline-none transition"
              />
            </div>

            {/* Equipment Selection Dropdown */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label
                htmlFor="equipment"
                className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
              >
                <span className="flex items-center space-x-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  <span>IT Equipment</span>
                  <span className="text-red-500">*</span>
                </span>
                {isEquipmentsLoading && (
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> Loading stock
                  </span>
                )}
              </label>

              <div className="relative">
                <select
                  id="equipment"
                  required
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  disabled={submitting || isEquipmentsLoading}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 text-sm rounded-xl border border-slate-300 focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 outline-none transition appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>
                    -- Select IT Equipment --
                  </option>
                  {equipments.map((item) => {
                    const outOfStock = item.available_stock <= 0;
                    return (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={outOfStock}
                        className={outOfStock ? "text-slate-400 bg-slate-50" : "text-slate-900"}
                      >
                        {item.name} {outOfStock ? "— (Out of Stock)" : `(${item.available_stock} available)`}
                      </option>
                    );
                  })}
                </select>

                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>

              {/* Selected Equipment Preview Card */}
              {selectedEquipment && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3 animate-in fade-in">
                  {selectedEquipment.image_url && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                      <Image
                        src={selectedEquipment.image_url}
                        alt={selectedEquipment.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-slate-800 truncate">
                      {selectedEquipment.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          selectedEquipment.available_stock > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {selectedEquipment.available_stock > 0
                          ? `${selectedEquipment.available_stock} Available`
                          : "Out of Stock"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Total: {selectedEquipment.total_stock}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Borrow Date Picker */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label
                htmlFor="borrowDate"
                className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Borrow Date</span>
                <span className="text-red-500">*</span>
              </label>

              <input
                id="borrowDate"
                type="date"
                required
                min={todayStr}
                value={borrowDate}
                onChange={(e) => setBorrowDate(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 text-sm rounded-xl border border-slate-300 focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 outline-none transition cursor-pointer"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !selectedEquipmentId || isOutOfStock}
                className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Request...</span>
                  </>
                ) : isOutOfStock ? (
                  <span>Selected Item Out of Stock</span>
                ) : (
                  <>
                    <span>Confirm & Borrow Item</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400 pt-1">
              By confirming, a notification will be sent to the IT Department.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
