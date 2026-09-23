"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  RotateCcw,
  PackageCheck,
  Clock,
  CheckCircle,
  BarChart3,
  Shield,
  KeyRound,
  X,
  ShieldCheck,
  Users,
  QrCode,
} from "lucide-react";
import liff from "@line/liff";
import { initializeLiff, closeLiff } from "@/lib/liff";
import { supabase } from "@/lib/supabaseClient";
import { Equipment, UserProfile, Transaction } from "@/lib/types";
import QrScannerModal from "@/components/QrScannerModal";

const HOSPITAL_DEPARTMENTS = [
  "ผู้ป่วยนอก (OPD)",
  "อุบัติเหตุและฉุกเฉิน (ER)",
  "ผู้ป่วยใน (IPD)",
  "เวชปฏิบัติครอบครัวและบริการด้านปฐมภูมิ (PCU)",
  "ทันตกรรม",
  "สุขภาพจิต",
  "เทคนิคการแพทย์ (ห้องแล็บ / LAB)",
  "รังสีการแพทย์ (เอกซเรย์ / X-Ray)",
  "กายภาพบำบัด",
  "โภชนศาสตร์",
  "ประกันสุขภาพ ยุทธศาสตร์ และสารสนเทศ (IT)",
  "บริหารทั่วไป",
  "อื่นๆ / บุคลากรภายนอก",
];

// รายการอุปกรณ์จำลอง
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
    name: "Epson Full HD Mobile Projector (ถูกยืมหมดแล้ว)",
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
  // สลับแท็บ "ยืมอุปกรณ์" หรือ "คืนอุปกรณ์" (สำหรับผู้ใช้ทั่วไป)
  const [activeTab, setActiveTab] = useState<"borrow" | "return">("borrow");

  // สถานะ LIFF & โปรไฟล์ผู้ใช้
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLiffLoading, setIsLiffLoading] = useState(true);

  // สถานะการยืม (Borrow Tab)
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [isEquipmentsLoading, setIsEquipmentsLoading] = useState(true);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [borrowDate, setBorrowDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = useState<string>("ครึ่งวันเช้า (08:30 - 12:00 น.)");
  const [purpose, setPurpose] = useState<string>("อื่นๆ");
  const [internalPhone, setInternalPhone] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    equipmentName: string;
    borrowDate: string;
    timeSlot?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // สถานะการคืน (Return Tab) แบบสแกน QR Code (ไม่ใช้ PIN)
  const [borrowedItems, setBorrowedItems] = useState<Transaction[]>([]);
  const [isLoadingBorrowed, setIsLoadingBorrowed] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string | null>(null);
  const [activeReturnTx, setActiveReturnTx] = useState<Transaction | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  const OFFICIAL_QR_VALUE = "IT-RETURN-2026";

  // ฟังก์ชันดำเนินการส่งคืนอุปกรณ์ด้วย QR Code
  const processQrReturn = async (txId: string, scannedCode: string, equipName?: string) => {
    setReturningId(txId);
    setQrScanError(null);
    setErrorMessage(null);

    const rawCode = (scannedCode || "").trim();
    const upperCode = rawCode.toUpperCase();

    // ตรวจสอบว่า QR Code ตรงกับป้ายที่โต๊ะ IT หรือไม่ (รองรับหลายรูปแบบ)
    const isValidCode =
      upperCode === OFFICIAL_QR_VALUE ||
      upperCode === "IT2026" ||
      upperCode.includes("IT-RETURN") ||
      upperCode.includes("IT2026") ||
      upperCode.includes("CODE=IT-RETURN");

    if (!isValidCode) {
      const errorMsg = `❌ QR Code ไม่ถูกต้อง! รหัสที่อ่านได้: "${rawCode}" (กรุณาสแกนจากป้ายจุดรับคืนที่เคาน์เตอร์ IT เท่านั้น)`;
      setQrScanError(errorMsg);
      setErrorMessage(errorMsg);
      setReturningId(null);
      alert(`❌ รหัส QR Code ไม่ถูกต้อง!\n\nรหัสที่อ่านได้จากกล้อง: "${rawCode}"\n\nกรุณาส่องกล้องไปที่ป้ายจุดรับคืนอุปกรณ์ของเคาน์เตอร์ IT (IT-RETURN-2026)`);
      return;
    }

    try {
      const res = await fetch("/api/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txId,
          line_user_id: profile?.userId,
          qr_code: rawCode,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "ไม่สามารถทำรายการคืนอุปกรณ์ได้");
      }

      // นำรายการที่คืนออกจากหน้าจอทันที (Optimistic update)
      setBorrowedItems((prev) => prev.filter((item) => item.id !== txId));

      // คืนสต็อกอุปกรณ์เข้าคลังทันที
      if (activeReturnTx?.equipment_id) {
        setEquipments((prev) =>
          prev.map((eq) =>
            eq.id === activeReturnTx.equipment_id
              ? { ...eq, available_stock: Math.min(eq.available_stock + 1, eq.total_stock) }
              : eq
          )
        );
      }

      setIsQrModalOpen(false);
      setActiveReturnTx(null);

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([100, 50, 100]);
      }

      const finalSuccessMsg = result.message || `สแกน QR คืน '${equipName || "อุปกรณ์"}' สำเร็จเรียบร้อยแล้ว ขอบคุณครับ!`;
      setReturnSuccessMsg(finalSuccessMsg);
      alert(`✅ คืนอุปกรณ์สำเร็จ!\n\n${finalSuccessMsg}`);

      // ซิงค์ข้อมูลกับฐานข้อมูลในเบื้องหลัง
      if (profile?.userId) {
        setTimeout(() => {
          fetchUserBorrowedItems(profile.userId);
          fetchEquipments();
        }, 600);
      }
    } catch (err: any) {
      const errMsg = err?.message || "เกิดข้อผิดพลาดในการตรวจสอบ QR Code";
      setQrScanError(`❌ คืนอุปกรณ์ไม่สำเร็จ: ${errMsg}`);
      setErrorMessage(`❌ คืนอุปกรณ์ไม่สำเร็จ: ${errMsg}`);
      alert(`❌ ทำรายการคืนไม่สำเร็จ:\n\n${errMsg}`);
    } finally {
      setReturningId(null);
    }
  };

  // เรียกใช้กล้องสแกน QR ผ่าน LINE LIFF หรือเปิด Live Camera Modal
  const triggerQrScanner = async (tx: Transaction) => {
    setActiveReturnTx(tx);
    setQrScanError(null);
    setErrorMessage(null);

    // 1. ถ้าทำงานอยู่ในแอป LINE บนมือถือ ให้ลองเรียก scanCodeV2 ของ LINE ก่อน
    if (typeof window !== "undefined" && liff.isInClient() && typeof liff.scanCodeV2 === "function") {
      try {
        const res = await liff.scanCodeV2();
        const scannedText = typeof res === "string" ? res : res?.value;
        if (scannedText) {
          await processQrReturn(tx.id, scannedText, tx.equipments?.name);
          return;
        }
      } catch (e: any) {
        console.warn("LINE LIFF scanCodeV2 error or not enabled in console, falling back to Webview camera modal:", e);
      }
    }

    // 2. ถ้าไม่ได้อยู่ใน LINE หรือ scanCodeV2 ไม่รองรับ ให้เปิด Live Camera Viewfinder Modal
    setIsQrModalOpen(true);
  };

  // 1. เริ่มต้นระบบ LINE LIFF เมื่อโหลดหน้าเว็บ
  useEffect(() => {
    async function setupLiff() {
      try {
        const result = await initializeLiff();
        setProfile(result.profile);
      } catch (err) {
        console.error("LIFF initialization error:", err);
      } finally {
        setIsLiffLoading(false);
      }
    }
    setupLiff();
  }, []);

  // 2. ดึงรายการอุปกรณ์ทั้งหมด
  const fetchEquipments = async () => {
    setIsEquipmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("equipments")
        .select("*")
        .order("name", { ascending: true });

      if (error || !data || data.length === 0) {
        setEquipments(FALLBACK_EQUIPMENTS);
      } else {
        setEquipments(data);
      }
    } catch {
      setEquipments(FALLBACK_EQUIPMENTS);
    } finally {
      setIsEquipmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipments();
  }, []);

  // 3. ดึงรายการที่ผู้ใช้คนนี้ยืมอยู่
  const fetchUserBorrowedItems = async (userId: string) => {
    setIsLoadingBorrowed(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, equipments(*)")
        .eq("line_user_id", userId)
        .eq("status", "borrowed")
        .order("borrow_date", { ascending: false });

      if (error || !data) {
        setBorrowedItems([]);
      } else {
        setBorrowedItems(data);
      }
    } catch {
      setBorrowedItems([]);
    } finally {
      setIsLoadingBorrowed(false);
    }
  };

  useEffect(() => {
    if (profile?.userId) {
      fetchUserBorrowedItems(profile.userId);
    }
  }, [profile]);

  // 4. ระบบนับถอยหลังปิดหน้าต่างเมื่อทำรายการยืมสำเร็จ
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

  // ข้อมูลอุปกรณ์ที่เลือก
  const selectedEquipment = equipments.find((item) => item.id === selectedEquipmentId);
  const isOutOfStock = selectedEquipment ? selectedEquipment.available_stock <= 0 : false;

  // กรองรายการอุปกรณ์ตามช่องค้นหา
  const filteredEquipments = equipments.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ส่งคำขอยืมอุปกรณ์
  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profile) {
      setErrorMessage("ไม่สามารถโหลดข้อมูลโปรไฟล์ LINE ได้ กรุณารีเฟรชหน้าจอใหม่อีกครั้ง");
      return;
    }

    if (!department) {
      setErrorMessage("กรุณาเลือกแผนกของคุณ");
      return;
    }

    if (!selectedEquipmentId) {
      setErrorMessage("กรุณาเลือกอุปกรณ์ IT ที่ต้องการยืม");
      return;
    }

    if (isOutOfStock) {
      setErrorMessage("อุปกรณ์ที่เลือกถูกยืมหมดแล้วในขณะนี้ กรุณาเลือกอุปกรณ์อื่น");
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
          department: department,
          equipment_id: selectedEquipmentId,
          borrow_date: borrowDate,
          time_slot: timeSlot,
          purpose: purpose.trim() || "ใช้งานทั่วไปในโรงพยาบาล",
          internal_phone: internalPhone.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "เกิดข้อผิดพลาดในการบันทึกคำขอ");
      }

      setSuccessData({
        message: result.message || "บันทึกคำขอยืมอุปกรณ์เรียบร้อยแล้ว!",
        equipmentName: result.transaction?.equipment_name || selectedEquipment?.name || "อุปกรณ์ IT",
        borrowDate: borrowDate,
        timeSlot: timeSlot,
      });

      // รีเฟรชข้อมูล
      fetchUserBorrowedItems(profile.userId);
      fetchEquipments();

      setCountdown(4);
    } catch (err: any) {
      console.error("Borrow failed:", err);
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  // ส่งคำขอคืนอุปกรณ์ (ยกเลิกระบบ PIN คืนได้ทันที)
  const handleDirectReturn = async (txId: string, equipName?: string) => {
    if (!profile) return;
    if (!confirm(`ยืนยันการคืน '${equipName || "อุปกรณ์"}' นี้เข้าห้อง IT?`)) {
      return;
    }

    setReturningId(txId);
    setReturnSuccessMsg(null);
    setErrorMessage(null);

    try {
      if (txId.startsWith("demo-tx-")) {
        setBorrowedItems((prev) => prev.filter((item) => item.id !== txId));
        setReturnSuccessMsg(`คืน '${equipName || "อุปกรณ์"}' สำเร็จเรียบร้อยแล้ว!`);
        return;
      }

      const res = await fetch("/api/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txId,
          line_user_id: profile.userId,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "ไม่สามารถทำรายการคืนอุปกรณ์ได้");
      }

      setReturnSuccessMsg(result.message || `คืน '${equipName || "อุปกรณ์"}' สำเร็จแล้ว!`);
      fetchUserBorrowedItems(profile.userId);
      fetchEquipments();
    } catch (err: any) {
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดในการคืนอุปกรณ์ กรุณาลองใหม่");
    } finally {
      setReturningId(null);
    }
  };

  // คำนวณจำนวนวันที่ยืมมาแล้ว
  const calculateDaysBorrowed = (dateStr: string) => {
    try {
      const bDate = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - bDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 0 ? "ยืมวันนี้" : `ยืมมาแล้ว ${diffDays} วัน`;
    } catch {
      return dateStr;
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
              <p className="text-[11px] font-medium text-slate-500">ระบบยืม-คืนอุปกรณ์ IT โรงพยาบาล</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* ปุ่มสำหรับเจ้าหน้าที่ IT เข้าแดชบอร์ดเฉพาะทาง */}
            <Link
              href="/admin"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="สำหรับเจ้าหน้าที่ IT"
            >
              <Shield className="w-4 h-4 text-slate-700" />
            </Link>

            {/* ป้ายสถานะระบบ */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] mr-1.5 animate-pulse" />
              พร้อมใช้งาน
            </span>
          </div>
        </div>
      </header>

      {/* เนื้อหาหลัก */}
      <div className="max-w-md mx-auto px-4 pt-3">
        {/* เมนู 2 แท็บสำหรับผู้ใช้ทั่วไป: "ยืมอุปกรณ์" vs "คืนอุปกรณ์" */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center mb-4 select-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab("borrow");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === "borrow"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>ยืมอุปกรณ์</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("return");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === "return"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนอุปกรณ์</span>
            {borrowedItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#06C755] text-white text-[10px] font-bold">
                {borrowedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* ข้อมูลผู้ใช้งาน LINE */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 mb-4 transition-all">
          {isLiffLoading ? (
            <div className="flex items-center space-x-3 py-1 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-slate-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ) : profile ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                {profile.pictureUrl ? (
                  <Image
                    src={profile.pictureUrl}
                    alt={profile.displayName}
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-sm">
                    {profile.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-900 text-sm truncate">
                    {profile.displayName}
                  </span>
                  <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5 mr-0.5 text-slate-400" />
                    ยืนยันตัวตนแล้ว
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  UID: {profile.userId}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-red-500 py-1">ไม่สามารถโหลดข้อมูลผู้ใช้ได้</div>
          )}
        </div>

        {/* แจ้งเตือน Error */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2 animate-in fade-in">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* แท็บที่ 1: ระบบยืมอุปกรณ์ (BORROW TAB) */}
        {/* ========================================================================= */}
        {activeTab === "borrow" && (
          <>
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
                    <span className="font-semibold text-slate-800 text-right">
                      {successData.equipmentName}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">วันที่ยืม:</span>
                    <span className="font-semibold text-slate-800">{successData.borrowDate}</span>
                  </div>
                  {successData.timeSlot && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">ช่วงเวลา:</span>
                      <span className="font-semibold text-emerald-700">{successData.timeSlot}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">การแจ้งเตือน:</span>
                    <span className="font-medium text-emerald-600">ส่งข้อความเข้า LINE เรียบร้อย</span>
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
              <form onSubmit={handleBorrowSubmit} className="space-y-3.5">
                {/* 1. แผนกในโรงพยาบาล */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                  <label
                    htmlFor="department"
                    className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
                  >
                    <span className="flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>แผนก</span>
                      <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">เลือกจากรายการ</span>
                  </label>

                  <div className="relative">
                    <select
                      id="department"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={submitting}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 text-xs rounded-xl border border-slate-300 focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 outline-none transition appearance-none cursor-pointer"
                    >
                      <option value="" disabled>
                        -- เลือกแผนกในโรงพยาบาล --
                      </option>
                      {HOSPITAL_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>

                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* 2. เลือกอุปกรณ์ IT พร้อมรูปภาพ */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      <span>เลือกอุปกรณ์ IT ที่ต้องการยืม</span>
                      <span className="text-red-500">*</span>
                    </label>
                    {isEquipmentsLoading ? (
                      <span className="text-[10px] text-slate-400 flex items-center">
                        <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> กำลังโหลด
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-normal">
                        แตะที่รูปเพื่อเลือก
                      </span>
                    )}
                  </div>

                  {/* ช่องค้นหาอุปกรณ์ */}
                  <div className="relative mb-2.5">
                    <input
                      type="text"
                      placeholder="ค้นหาชื่ออุปกรณ์ไอที..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-[#06C755] focus:bg-white outline-none transition"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* การ์ดอุปกรณ์พร้อมรูปภาพ */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {isEquipmentsLoading ? (
                      <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#06C755] mb-2" />
                        กำลังโหลดอุปกรณ์...
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
                            className={`relative p-2.5 rounded-xl border transition-all flex items-center space-x-3 select-none ${
                              outOfStock
                                ? "bg-slate-50/80 border-slate-200 opacity-60 cursor-not-allowed"
                                : isSelected
                                ? "bg-emerald-50/70 border-[#06C755] shadow-xs ring-2 ring-[#06C755]/20 cursor-pointer"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer"
                            }`}
                          >
                            {/* รูปภาพอุปกรณ์ */}
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80">
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
                                    ? "ถูกยืมหมดแล้ว"
                                    : `ว่าง ${item.available_stock} เครื่อง`}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ทั้งหมด {item.total_stock} เครื่อง
                                </span>
                              </div>
                            </div>

                            {/* ไอคอนเลือก */}
                            <div className="shrink-0 pl-1">
                              {outOfStock ? (
                                <span className="text-[10px] font-medium text-rose-500 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                                  ไม่มีเครื่องว่าง
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

                {/* 3. วันที่และช่วงเวลาที่ต้องการยืม */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
                  <div>
                    <label
                      htmlFor="borrowDate"
                      className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>วันที่ต้องการใช้งาน</span>
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-300 focus:border-[#06C755] focus:bg-white outline-none transition cursor-pointer"
                    />
                  </div>

                  {/* ตัวเลือกช่วงเวลายืม (ครึ่งวันเช้า / บ่าย / เต็มวัน) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>ช่วงเวลาที่ใช้งาน (เพื่อจัดคิวให้ผู้อื่นยืมต่อได้)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "ครึ่งวันเช้า (08:30 - 12:00 น.)", label: "🌅 ครึ่งวันเช้า", desc: "08:30 - 12:00 น." },
                        { id: "ครึ่งวันบ่าย (13:00 - 16:30 น.)", label: "🌇 ครึ่งวันบ่าย", desc: "13:00 - 16:30 น." },
                        { id: "เต็มวัน (08:30 - 16:30 น.)", label: "🌕 เต็มวัน", desc: "08:30 - 16:30 น." },
                        { id: "ยืมหลายวัน / ออกหน่วย", label: "📅 ยืมหลายวัน", desc: "ออกหน่วย / ต่อเนื่อง" },
                      ].map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setTimeSlot(slot.id)}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            timeSlot === slot.id
                              ? "bg-emerald-50 border-[#06C755] text-emerald-900 font-semibold shadow-2xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="text-xs">{slot.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">{slot.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. วัตถุประสงค์และเบอร์โทรติดต่อ */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
                  {/* วัตถุประสงค์การใช้งาน */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>วัตถุประสงค์การใช้งาน</span>
                    </label>

                    {/* ชิปตัวเลือกด่วน */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        "ประชุม Zoom / สสจ.",
                        "อบรมวิชาการ / ระบบงาน",
                        "ออกหน่วยตรวจ / คลินิกเคลื่อนที่",
                        "ใช้งานทดแทนเครื่องส่งซ่อม",
                        "อื่นๆ",
                      ].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPurpose(p)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg border transition ${
                            purpose === p
                              ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="ระบุวัตถุประสงค์ (เช่น อื่นๆ, ประชุม, นำเสนอผลงาน)..."
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-[#06C755] focus:bg-white outline-none transition"
                    />
                  </div>

                  {/* เบอร์ต่อภายใน */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>เบอร์โทรศัพท์ / เบอร์ต่อภายในแผนก</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">เพื่อให้ IT ติดต่อง่าย</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ต่อ 102, ต่อ 204 หรือ 081-xxx-xxxx"
                      value={internalPhone}
                      onChange={(e) => setInternalPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-[#06C755] focus:bg-white outline-none transition"
                    />
                  </div>
                </div>

                {/* ปุ่มกดยืนยันการยืม */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting || !selectedEquipmentId || isOutOfStock || !department}
                    className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังบันทึกข้อมูล...</span>
                      </>
                    ) : !department ? (
                      <span>กรุณาเลือกแผนกด้านบน</span>
                    ) : !selectedEquipmentId ? (
                      <span>กรุณาแตะเลือกอุปกรณ์</span>
                    ) : isOutOfStock ? (
                      <span>อุปกรณ์ที่เลือกถูกยืมหมดแล้ว</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ยืนยันการยืมอุปกรณ์</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-center text-slate-400 pt-0.5">
                  *เมื่อกดยืนยัน ระบบจะส่งการแจ้งเตือนไปยังเจ้าหน้าที่ IT ทันที
                </p>
              </form>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* แท็บที่ 2: ระบบคืนอุปกรณ์ (แบบไม่มี PIN - คืนได้ทันที 1-Click Return) */}
        {/* ========================================================================= */}
        {activeTab === "return" && (
          <div className="space-y-3">
            {/* แจ้งเตือนคืนสำเร็จ */}
            {returnSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-[#06C755] shrink-0" />
                <div className="flex-1 font-medium">{returnSuccessMsg}</div>
              </div>
            )}

            {/* แจ้งเตือนข้อผิดพลาดในการสแกนคืน */}
            {qrScanError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between space-x-2 animate-in fade-in">
                <div className="flex items-start space-x-2 flex-1">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="leading-relaxed font-medium">{qrScanError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setQrScanError(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <PackageCheck className="w-4 h-4 text-[#06C755]" />
                  <span>อุปกรณ์ที่คุณกำลังยืมอยู่</span>
                </h2>
                <span className="text-[10px] text-slate-400">
                  {borrowedItems.length} รายการที่ค้างคืน
                </span>
              </div>

              {isLoadingBorrowed ? (
                <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#06C755] mb-2" />
                  กำลังตรวจสอบรายการยืมของคุณ...
                </div>
              ) : borrowedItems.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2 stroke-[1.5]" />
                  <p className="font-semibold text-slate-700">ไม่มีอุปกรณ์ที่ค้างส่งคืน</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    คุณไม่มีรายการอุปกรณ์ที่กำลังยืมอยู่ในขณะนี้
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {borrowedItems.map((tx) => {
                    const equip = tx.equipments;
                    const isReturning = returningId === tx.id;

                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 transition"
                      >
                        <div className="flex items-center space-x-3">
                          {/* รูปอุปกรณ์ */}
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                            {equip?.image_url ? (
                              <Image
                                src={equip.image_url}
                                alt={equip.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Laptop className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                              {equip?.name || "อุปกรณ์ IT"}
                            </h3>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {tx.department}
                            </p>
                            <p className="text-[10px] text-slate-400 flex items-center mt-0.5">
                              <Clock className="w-3 h-3 mr-1" />
                              ยืมเมื่อ: {tx.borrow_date} ({calculateDaysBorrowed(tx.borrow_date)})
                            </p>
                          </div>
                        </div>

                        {/* ปุ่มกดคืนอุปกรณ์ด้วยการสแกน QR Code เท่านั้น (ไม่มี PIN) */}
                        <button
                          type="button"
                          disabled={isReturning}
                          onClick={() => triggerQrScanner(tx)}
                          className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-700 border border-emerald-300 hover:border-[#06C755] font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 shadow-2xs disabled:opacity-50"
                        >
                          {isReturning ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>กำลังตรวจสอบการคืน...</span>
                            </>
                          ) : (
                            <>
                              <QrCode className="w-3.5 h-3.5 text-[#06C755]" />
                              <span>📷 สแกน QR ที่โต๊ะ IT เพื่อส่งคืน</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer & ลิงก์เข้าหน้าผู้ดูแลระบบ IT */}
        <div className="pt-8 pb-4 text-center text-slate-400 text-[11px] space-y-1">
          <p>กลุ่มงานประกันสุขภาพ ยุทธศาสตร์ และสารสนเทศทางการแพทย์ (IT)</p>
          <p>
            <Link
              href="/admin"
              className="text-slate-400 hover:text-blue-600 transition inline-flex items-center space-x-1 underline decoration-dotted underline-offset-4"
            >
              <Lock className="w-3 h-3" />
              <span>เข้าสู่ระบบผู้ดูแลระบบ (IT Staff Only)</span>
            </Link>
          </p>
        </div>
      </div>

      {/* MODAL: กล้องสแกน QR Code จุดคืนของ IT (Live Viewfinder + Image Upload + Counter confirm) */}
      <QrScannerModal
        isOpen={isQrModalOpen && !!activeReturnTx}
        equipmentName={activeReturnTx?.equipments?.name}
        isProcessing={returningId === activeReturnTx?.id}
        onClose={() => {
          setIsQrModalOpen(false);
          setActiveReturnTx(null);
          setQrScanError(null);
        }}
        onScanSuccess={(scannedCode) => {
          if (activeReturnTx) {
            processQrReturn(activeReturnTx.id, scannedCode, activeReturnTx.equipments?.name);
          }
        }}
      />
    </main>
  );
}
