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
  Check,
  Search,
} from "lucide-react";
import { initializeLiff, closeLiff } from "@/lib/liff";
import { supabase } from "@/lib/supabaseClient";
import { Equipment, UserProfile } from "@/lib/types";

// รายการอุปกรณ์จำลอง (สำหรับกรณีที่ยังไม่ได้ใส่ Key หรือข้อมูลใน Supabase ยังว่าง)
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
    name: "Epson Full HD Mobile Projector (สินค้าหมด)",
    image_url:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80",
    total_stock: 2,
    available_stock: 0,
  },
  {
    id: "e7000000-0000-0000-0000-000000000007",
    name: "Anker 12-in-1 USB-C Docking Station",
    image_url:
      "https://images.unsplash.com/photo-1622445262464-84b14e4b7501?auto=format&fit=crop&w=600&q=80",
    total_stock: 5,
    available_stock: 5,
  },
];

export default function BorrowPage() {
  // สถานะ LIFF & โปรไฟล์ผู้ใช้
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [isLiffLoading, setIsLiffLoading] = useState(true);

  // สถานะฟอร์ม
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [isEquipmentsLoading, setIsEquipmentsLoading] = useState(true);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [borrowDate, setBorrowDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // สถานะการบันทึกข้อมูล
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    equipmentName: string;
    borrowDate: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 1. เริ่มต้นระบบ LINE LIFF เมื่อโหลดหน้าเว็บ
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

  // 2. ดึงรายการอุปกรณ์จาก Supabase ผ่าน Public Anon Client
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
            "[Supabase] ไม่พบข้อมูลหรือยังไม่ได้ใส่ Key ใช้งานชุดข้อมูลจำลองสำหรับทดสอบ"
          );
          setEquipments(FALLBACK_EQUIPMENTS);
        } else {
          setEquipments(data);
        }
      } catch (err) {
        console.warn("[Supabase] เกิดข้อผิดพลาด ใช้ชุดข้อมูลจำลอง:", err);
        setEquipments(FALLBACK_EQUIPMENTS);
      } finally {
        setIsEquipmentsLoading(false);
      }
    }
    fetchEquipments();
  }, []);

  // 3. ระบบนับถอยหลังปิดหน้าต่างเมื่อทำรายการสำเร็จ
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

  // อุปกรณ์ที่ถูกเลือกในปัจจุบัน
  const selectedEquipment = equipments.find((item) => item.id === selectedEquipmentId);
  const isOutOfStock = selectedEquipment ? selectedEquipment.available_stock <= 0 : false;

  // กรองรายการอุปกรณ์ตามช่องค้นหา
  const filteredEquipments = equipments.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ส่งคำขอยืมอุปกรณ์
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profile) {
      setErrorMessage("ไม่สามารถโหลดข้อมูลโปรไฟล์ LINE ได้ กรุณารีเฟรชหน้าจอใหม่อีกครั้ง");
      return;
    }

    if (!department.trim()) {
      setErrorMessage("กรุณากรอกแผนกหรือฝ่ายของคุณ");
      return;
    }

    if (!selectedEquipmentId) {
      setErrorMessage("กรุณาเลือกอุปกรณ์ IT ที่ต้องการยืม");
      return;
    }

    if (isOutOfStock) {
      setErrorMessage("อุปกรณ์ที่เลือกหมดสต็อกแล้ว กรุณาเลือกรายการอื่น");
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
        throw new Error(result.error || "เกิดข้อผิดพลาดในการบันทึกคำขอ");
      }

      // บันทึกสำเร็จ
      setSuccessData({
        message: result.message || "บันทึกคำขอยืมอุปกรณ์เรียบร้อยแล้ว!",
        equipmentName: result.transaction?.equipment_name || selectedEquipment?.name || "อุปกรณ์ IT",
        borrowDate: borrowDate,
      });

      // นับถอยหลัง 4 วินาทีแล้วปิดหน้าต่าง
      setCountdown(4);
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen pb-12 bg-slate-50">
      {/* แถบด้านบน (Header) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06C755] to-[#049f44] flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Yeum-IT</h1>
              <p className="text-[11px] font-medium text-slate-500">ระบบยืมอุปกรณ์ไอทีผ่าน LINE</p>
            </div>
          </div>

          {/* ป้ายสถานะการเชื่อมต่อ */}
          <div>
            {isMock ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                โหมดทดสอบ
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] mr-1.5 animate-pulse" />
                LINE ออนไลน์
              </span>
            )}
          </div>
        </div>
      </header>

      {/* เนื้อหาหลัก */}
      <div className="max-w-md mx-auto px-4 pt-4">
        {/* แถบแจ้งเตือนเมื่ออยู่ในโหมดทดสอบ Localhost */}
        {isMock && (
          <div className="mb-4 p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <span className="font-semibold">โหมดพัฒนาในเครื่อง (Local Dev):</span>{" "}
              กำลังเปิดนอกแอป LINE ระบบจึงจำลองโปรไฟล์ทดสอบให้ เพื่อให้คุณสามารถทดสอบหน้าเว็บได้ทันที
            </div>
          </div>
        )}

        {/* ข้อมูลผู้ขอยืม (ดึงจาก LINE LIFF) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 mb-4 transition-all">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2.5">
            ข้อมูลผู้ขอยืมอุปกรณ์
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
                    ยืนยันตัวตนแล้ว
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  รหัสผู้ใช้: {profile.userId}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-red-500 py-1">ไม่สามารถโหลดข้อมูลผู้ใช้ได้</div>
          )}
        </div>

        {/* เมื่อส่งคำขอสำเร็จ แสดงหน้านี้ */}
        {successData ? (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-emerald-200 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#06C755] flex items-center justify-center mx-auto mb-3.5 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-1">ส่งคำขอยืมอุปกรณ์สำเร็จ!</h2>
            <p className="text-xs text-slate-500 mb-4">{successData.message}</p>

            <div className="bg-slate-50 rounded-xl p-3.5 text-left border border-slate-100 space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">อุปกรณ์ที่ยืม:</span>
                <span className="font-semibold text-slate-800 text-right">{successData.equipmentName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">วันที่ยืม:</span>
                <span className="font-semibold text-slate-800">{successData.borrowDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">การแจ้งเตือน:</span>
                <span className="font-medium text-emerald-600">ส่งข้อความเข้า LINE เรียบร้อยแล้ว</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-4">
              หน้าต่างจะปิดอัตโนมัติในอีก{" "}
              <span className="font-bold text-emerald-600 text-sm">{countdown} วินาที</span>
            </div>

            <button
              type="button"
              onClick={() => closeLiff()}
              className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-medium text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-2"
            >
              <span>ปิดหน้าต่างทันที</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ฟอร์มการยืมอุปกรณ์ */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* แสดงข้อความแจ้งเตือนเมื่อเกิด Error */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2 animate-in fade-in">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* ช่องชื่อผู้ยืม (อ่านอย่างเดียว) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>ชื่อผู้ขอยืม</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">ดึงจากบัญชี LINE</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={profile?.displayName || "กำลังโหลดข้อมูลโปรไฟล์..."}
                  className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-700 font-medium text-sm rounded-xl border border-slate-200 cursor-not-allowed select-none focus:outline-none"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* ช่องกรอกแผนก / สังกัด */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label
                htmlFor="department"
                className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>แผนก / ฝ่าย / สังกัด</span>
                <span className="text-red-500">*</span>
              </label>

              <input
                id="department"
                type="text"
                required
                placeholder="เช่น แผนกไอที, การตลาด, พัฒนาธุรกิจ, บุคคล"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 text-sm rounded-xl border border-slate-300 focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 outline-none transition"
              />
            </div>

            {/* ช่องเลือกอุปกรณ์ IT พร้อมแสดงรูปภาพ (Visual Equipment Selector) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  <span>เลือกอุปกรณ์ IT ที่ต้องการยืม</span>
                  <span className="text-red-500">*</span>
                </label>
                {isEquipmentsLoading ? (
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> กำลังโหลดสต็อก
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal">
                    แตะที่อุปกรณ์เพื่อเลือก
                  </span>
                )}
              </div>

              {/* ช่องค้นหาอุปกรณ์ */}
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="ค้นหาชื่ออุปกรณ์..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-[#06C755] focus:bg-white outline-none transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* รายการการ์ดอุปกรณ์พร้อมรูปภาพ */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {isEquipmentsLoading ? (
                  <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#06C755] mb-2" />
                    กำลังโหลดรายการอุปกรณ์...
                  </div>
                ) : filteredEquipments.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    ไม่พบอุปกรณ์ที่ค้นหา
                  </div>
                ) : (
                  filteredEquipments.map((item) => {
                    const isSelected = selectedEquipmentId === item.id;
                    const outOfStock = item.available_stock <= 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!outOfStock && !submitting) {
                            setSelectedEquipmentId(item.id);
                          }
                        }}
                        className={`relative p-3 rounded-xl border transition-all flex items-center space-x-3 select-none ${
                          outOfStock
                            ? "bg-slate-50/80 border-slate-200 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-emerald-50/70 border-[#06C755] shadow-xs ring-2 ring-[#06C755]/20 cursor-pointer"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer"
                        }`}
                      >
                        {/* รูปภาพอุปกรณ์ */}
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-2xs">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Laptop className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* ข้อมูลอุปกรณ์ */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                            {item.name}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                outOfStock
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {outOfStock
                                ? "สินค้าหมด"
                                : `คงเหลือ ${item.available_stock} ชิ้น`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ทั้งหมด {item.total_stock} ชิ้น
                            </span>
                          </div>
                        </div>

                        {/* ไอคอนแสดงการเลือก */}
                        <div className="shrink-0 pl-1">
                          {outOfStock ? (
                            <span className="text-[10px] font-medium text-rose-500 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                              ของหมด
                            </span>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-[#06C755] text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ช่องเลือกวันที่ยืม */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <label
                htmlFor="borrowDate"
                className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันที่เริ่มยืมอุปกรณ์</span>
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

            {/* ปุ่มยืนยันการยืม */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !selectedEquipmentId || isOutOfStock}
                className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : !selectedEquipmentId ? (
                  <span>กรุณาแตะเลือกอุปกรณ์ด้านบน</span>
                ) : isOutOfStock ? (
                  <span>อุปกรณ์ที่เลือกหมดสต็อก</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันการยืมอุปกรณ์</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400 pt-1">
              *เมื่อกดยืนยัน ระบบจะส่งการแจ้งเตือนไปยังเจ้าหน้าที่ IT ทันที
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
