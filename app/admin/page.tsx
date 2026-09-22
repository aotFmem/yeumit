"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Laptop,
  Users,
  Search,
  Loader2,
  ArrowLeft,
  RefreshCw,
  QrCode,
  X,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Package,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
} from "lucide-react";
import liff from "@line/liff";
import { initializeLiff } from "@/lib/liff";
import { supabase } from "@/lib/supabaseClient";
import { Equipment, Transaction, UserProfile } from "@/lib/types";

const OFFICIAL_IT_QR_CODE = "IT-RETURN-2026";
const ADMIN_STORAGE_KEY = "yeum_it_admin_auth";

// รายการรูปภาพอุปกรณ์มาตรฐาน (Quick Image Presets)
const IMAGE_PRESETS = [
  {
    name: "MacBook / โน้ตบุ๊กบาง",
    url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    badge: "💻 Laptop",
  },
  {
    name: "โน้ตบุ๊กสำนักงาน (Dell)",
    url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80",
    badge: "💻 Notebook",
  },
  {
    name: "iPad / แท็บเล็ต",
    url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
    badge: "📱 Tablet",
  },
  {
    name: "โปรเจคเตอร์พกพา",
    url: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80",
    badge: "📽️ Projector",
  },
  {
    name: "จอมอนิเตอร์ 27 นิ้ว",
    url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
    badge: "🖥️ Monitor",
  },
  {
    name: "เมาส์ไร้สายเพื่อสุขภาพ",
    url: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80",
    badge: "🖱️ Mouse",
  },
  {
    name: "Docking Station / Hub",
    url: "https://images.unsplash.com/photo-1622445262464-84b14e4b7501?auto=format&fit=crop&w=600&q=80",
    badge: "🔌 Docking",
  },
  {
    name: "ไมโครโฟน / ลำโพงประชุม",
    url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
    badge: "🎙️ Mic/Speaker",
  },
];

// รายการอุปกรณ์เริ่มต้นกรณีจำลอง
const INITIAL_FALLBACK_EQUIPMENTS: Equipment[] = [
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
    name: "Epson Full HD Mobile Projector",
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

// รายการยืมจำลองเริ่มต้น
const INITIAL_MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-001",
    line_user_id: "U_MOCK_DEV_001",
    display_name: "พว.สมใจ ใจดี (OPD)",
    department: "กลุ่มงานการพยาบาล - แผนกผู้ป่วยนอก (OPD)",
    equipment_id: "e4000000-0000-0000-0000-000000000004",
    borrow_date: "2026-09-15",
    return_date: null,
    status: "borrowed",
    equipments: {
      id: "e4000000-0000-0000-0000-000000000004",
      name: 'iPad Air 11" M2 + Apple Pencil',
      image_url:
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
      total_stock: 3,
      available_stock: 1,
    },
  },
  {
    id: "demo-tx-002",
    line_user_id: "U_MOCK_USER_002",
    display_name: "นพ.วิชาญ บริรักษ์ (ER)",
    department: "กลุ่มงานการพยาบาล - แผนกอุบัติเหตุและฉุกเฉิน (ER)",
    equipment_id: "e1000000-0000-0000-0000-000000000001",
    borrow_date: "2026-09-14",
    return_date: null,
    status: "borrowed",
    equipments: {
      id: "e1000000-0000-0000-0000-000000000001",
      name: 'MacBook Pro 14" M3 (Space Gray)',
      image_url:
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
      total_stock: 5,
      available_stock: 3,
    },
  },
  {
    id: "demo-tx-003",
    line_user_id: "U_MOCK_USER_003",
    display_name: "ภก.ธนกร โอสถ (เภสัชกรรม)",
    department: "กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค",
    equipment_id: "e6000000-0000-0000-0000-000000000006",
    borrow_date: "2026-09-16",
    return_date: null,
    status: "borrowed",
    equipments: {
      id: "e6000000-0000-0000-0000-000000000006",
      name: "Epson Full HD Mobile Projector",
      image_url:
        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80",
      total_stock: 2,
      available_stock: 0,
    },
  },
];

export default function AdminDashboardPage() {
  // --- สถานะการตรวจสอบสิทธิ์ Admin ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [passcodeInput, setPasscodeInput] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>("");
  const [liffProfile, setLiffProfile] = useState<UserProfile | null>(null);

  // --- แถบเมนูหลัก ---
  const [activeTab, setActiveTab] = useState<"inventory" | "loans">("inventory");

  // --- ข้อมูลระบบ ---
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [activeLoans, setActiveLoans] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [returningId, setReturningId] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // --- ฟอร์ม เพิ่ม/แก้ไข อุปกรณ์ ---
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formStock, setFormStock] = useState<number>(1);
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ตรวจสอบสถานะการเข้าสู่ระบบเริ่มต้น
  useEffect(() => {
    const checkInitialAuth = async () => {
      setAuthChecking(true);
      try {
        // 1. ตรวจสอบ LINE LIFF Profile
        try {
          const liffRes = await initializeLiff();
          if (liffRes && liffRes.profile) {
            const profile = liffRes.profile;
            setLiffProfile(profile);
            // ตรวจสอบว่า LINE ID ตรงกับแอดมินหรือไม่ผ่าน API
            const verifyRes = await fetch("/api/admin/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ line_user_id: profile.userId }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setIsAuthenticated(true);
              setAdminToken(verifyData.token || "admin-liff-session");
              sessionStorage.setItem(ADMIN_STORAGE_KEY, verifyData.token || "admin-liff-session");
              setAuthChecking(false);
              return;
            }
          }
        } catch {
          // LIFF initialization failed or running outside LINE browser
        }

        // 2. ตรวจสอบ Saved Session ใน Storage
        const savedToken =
          sessionStorage.getItem(ADMIN_STORAGE_KEY) || localStorage.getItem(ADMIN_STORAGE_KEY);
        if (savedToken) {
          setIsAuthenticated(true);
          setAdminToken(savedToken);
        }
      } finally {
        setAuthChecking(false);
      }
    };

    checkInitialAuth();
  }, []);

  // โหลดข้อมูลเมื่อยืนยันสิทธิ์แล้ว
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. ดึงรายการอุปกรณ์ผ่าน API /api/admin/equipments
      const eqRes = await fetch("/api/admin/equipments", {
        headers: { "x-admin-token": adminToken || "admin1234" },
      });
      const eqResult = await eqRes.json();
      if (eqRes.ok && eqResult.equipments && eqResult.equipments.length > 0) {
        setEquipments(eqResult.equipments);
      } else {
        // Fallback จาก Supabase client หรือ Fallback data
        const { data: eqData } = await supabase.from("equipments").select("*");
        if (eqData && eqData.length > 0) {
          setEquipments(eqData);
        } else {
          setEquipments(INITIAL_FALLBACK_EQUIPMENTS);
        }
      }

      // 2. ดึงรายการที่กำลังถูกยืมอยู่ทั้งหมด
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("*, equipments(*)")
        .eq("status", "borrowed")
        .order("borrow_date", { ascending: true });

      if (txErr || !txData || txData.length === 0) {
        setActiveLoans(INITIAL_MOCK_TRANSACTIONS);
      } else {
        setActiveLoans(txData);
      }
    } catch {
      setEquipments(INITIAL_FALLBACK_EQUIPMENTS);
      setActiveLoans(INITIAL_MOCK_TRANSACTIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, adminToken]);

  // เข้าสู่ระบบด้วยรหัสผ่าน
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setLoginError("กรุณากรอกรหัสผ่าน Admin");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: passcodeInput.trim(),
          line_user_id: liffProfile?.userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "รหัสผ่านไม่ถูกต้อง");
      }

      setIsAuthenticated(true);
      const token = data.token || "admin1234";
      setAdminToken(token);
      sessionStorage.setItem(ADMIN_STORAGE_KEY, token);
      localStorage.setItem(ADMIN_STORAGE_KEY, token);
      setPasscodeInput("");
    } catch (err: any) {
      setLoginError(err?.message || "เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ออกจากระบบ Admin
  const handleLogout = () => {
    if (confirm("ต้องการออกจากระบบผู้ดูแลห้อง IT หรือไม่?")) {
      setIsAuthenticated(false);
      setAdminToken("");
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  };

  // เปิด Modal เพิ่มอุปกรณ์
  const handleOpenAddModal = () => {
    setFormMode("add");
    setEditingId(null);
    setFormName("");
    setFormStock(1);
    setFormImageUrl(IMAGE_PRESETS[0].url);
    setShowFormModal(true);
  };

  // เปิด Modal แก้ไขอุปกรณ์
  const handleOpenEditModal = (eq: Equipment) => {
    setFormMode("edit");
    setEditingId(eq.id);
    setFormName(eq.name);
    setFormStock(eq.total_stock);
    setFormImageUrl(eq.image_url || "");
    setShowFormModal(true);
  };

  // บันทึกฟอร์ม เพิ่ม/แก้ไข อุปกรณ์
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("กรุณากรอกชื่ออุปกรณ์");
      return;
    }
    if (formStock < 1) {
      alert("จำนวนสต็อกทั้งหมดต้องมีอย่างน้อย 1 ชิ้น");
      return;
    }

    setFormSubmitting(true);
    try {
      const isEdit = formMode === "edit" && editingId;
      const url = "/api/admin/equipments";
      const method = isEdit ? "PUT" : "POST";
      const body = {
        id: editingId,
        name: formName.trim(),
        total_stock: formStock,
        image_url: formImageUrl.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken || "admin1234",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถบันทึกข้อมูลได้");
      }

      alert(data.message || (isEdit ? "แก้ไขอุปกรณ์สำเร็จ!" : "เพิ่มอุปกรณ์สำเร็จ!"));
      setShowFormModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setFormSubmitting(false);
    }
  };

  // ลบอุปกรณ์ (มีระบบเช็คว่าติดยืมอยู่หรือไม่)
  const handleDeleteEquipment = async (eq: Equipment) => {
    const borrowedCount = Math.max(0, eq.total_stock - eq.available_stock);
    if (borrowedCount > 0) {
      alert(
        `⚠️ ไม่สามารถลบ '${eq.name}' ได้ในขณะนี้!\n\nเนื่องจากมีรายการยืมค้างอยู่ ${borrowedCount} ชิ้น กรุณาให้ผู้ยืมส่งคืนอุปกรณ์เข้าห้อง IT ให้ครบก่อนลบครับ`
      );
      return;
    }

    if (!confirm(`⚠️ ยืนยันการลบอุปกรณ์ '${eq.name}' ออกจากระบบ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }

    setDeletingId(eq.id);
    try {
      const res = await fetch(`/api/admin/equipments?id=${encodeURIComponent(eq.id)}`, {
        method: "DELETE",
        headers: {
          "x-admin-token": adminToken || "admin1234",
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบ");
      }

      alert(data.message || `ลบอุปกรณ์ '${eq.name}' เรียบร้อยแล้ว`);
      // Update UI state immediately
      setEquipments((prev) => prev.filter((item) => item.id !== eq.id));
    } catch (err: any) {
      alert(err?.message || "เกิดข้อผิดพลาดในการลบอุปกรณ์");
    } finally {
      setDeletingId(null);
    }
  };

  // IT แอดมินกดรับคืนของ
  const handleAdminReturn = async (txId: string, equipName?: string) => {
    if (!confirm(`ยืนยันว่าได้รับ '${equipName || "อุปกรณ์"}' คืนเข้าคลัง IT แล้ว?`)) {
      return;
    }

    setReturningId(txId);
    try {
      if (txId.startsWith("demo-tx-")) {
        const loan = activeLoans.find((t) => t.id === txId);
        setActiveLoans((prev) => prev.filter((t) => t.id !== txId));
        if (loan?.equipment_id) {
          setEquipments((prev) =>
            prev.map((eq) =>
              eq.id === loan.equipment_id
                ? { ...eq, available_stock: Math.min(eq.available_stock + 1, eq.total_stock) }
                : eq
            )
          );
        }
        alert(`IT บันทึกรับคืน '${equipName || "อุปกรณ์"}' เรียบร้อยแล้ว`);
        return;
      }

      const res = await fetch("/api/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txId,
          is_admin_override: true,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "เกิดข้อผิดพลาด");
      }

      alert(result.message || "บันทึกรับคืนอุปกรณ์สำเร็จ!");
      loadData();
    } catch (err: any) {
      alert(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setReturningId(null);
    }
  };

  // คำนวณจำนวนวันที่ยืมมาแล้ว
  const calculateDays = (dateStr: string) => {
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

  // กรองรายการอุปกรณ์ตามคำค้นหา
  const filteredEquipments = equipments.filter((eq) =>
    eq.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // กรองรายการที่กำลังถูกยืม
  const filteredLoans = activeLoans.filter(
    (loan) =>
      loan.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.equipments?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStock = equipments.reduce((acc, curr) => acc + curr.total_stock, 0);
  const totalBorrowed = activeLoans.length;
  const totalAvailable = equipments.reduce((acc, curr) => acc + curr.available_stock, 0);

  // -------------------------------------------------------------
  // 1. หน้าจอโหลดสถานะสิทธิ์
  // -------------------------------------------------------------
  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm font-medium">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // 2. หน้าจอยืนยันตัวตน Admin (เมื่อยังไม่ได้ Login)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              ระบบผู้ดูแลห้อง IT (IT Portal)
            </h1>
            <p className="text-xs text-slate-400">
              กรุณายืนยันสิทธิ์เพื่อจัดการอุปกรณ์และรายการยืม-คืน
            </p>
          </div>

          {/* ตรวจพบ LINE User */}
          {liffProfile && (
            <div className="mb-4 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                {liffProfile.pictureUrl ? (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-600">
                    <Image
                      src={liffProfile.pictureUrl}
                      alt={liffProfile.displayName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                    👤
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate">
                    {liffProfile.displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {liffProfile.userId.slice(0, 10)}...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(liffProfile.userId);
                  alert(`คัดลอก LINE User ID เรียบร้อย:\n${liffProfile.userId}`);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
                title="คัดลอก User ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ฟอร์มกรอกรหัสผ่าน */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                รหัสผ่าน IT Admin (Passcode)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="กรอกรหัสผ่าน Admin..."
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/90 text-white placeholder-slate-500 rounded-xl border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>เข้าสู่ระบบ (Sign In)</span>
                </>
              )}
            </button>
          </form>

          {/* Hint Card */}
          <div className="mt-5 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-center">
            💡 รหัสผ่านเริ่มต้นสำหรับทดสอบระบบ:{" "}
            <code className="px-1.5 py-0.5 bg-slate-800 text-blue-400 rounded font-mono font-bold">
              admin1234
            </code>
          </div>

          {/* Back to User Home */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับสู่หน้ายืม-คืน สำหรับผู้ใช้งานทั่วไป</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // 3. หน้าจอหลักเมื่อเข้าสู่ระบบ Admin สำเร็จ
  // -------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Header แดชบอร์ดเฉพาะ IT */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="กลับหน้าหลักยืม-คืน"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-bold tracking-wide">IT Management</h1>
                <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 text-[9px] font-black rounded uppercase tracking-wider">
                  Admin Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ระบบจัดการคลังและติดตาม รพช.</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-300 transition"
              title="เปิดป้าย QR รับคืน"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => loadData()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-300 transition"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-3.5 space-y-3.5">
        {/* สรุปสถิติ 3 กล่อง */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-xs">
            <p className="text-[10px] text-slate-500 font-medium">อุปกรณ์ทั้งหมด</p>
            <p className="text-base font-bold text-slate-800 mt-0.5">{totalStock}</p>
            <span className="text-[9px] text-slate-400">{equipments.length} รายการ</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-blue-200 text-center shadow-xs">
            <p className="text-[10px] text-blue-600 font-medium">กำลังถูกยืม</p>
            <p className="text-base font-bold text-blue-700 mt-0.5">{totalBorrowed}</p>
            <span className="text-[9px] text-blue-500">คนถือครอง</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-emerald-200 text-center shadow-xs">
            <p className="text-[10px] text-emerald-600 font-medium">พร้อมใช้งาน</p>
            <p className="text-base font-bold text-emerald-700 mt-0.5">{totalAvailable}</p>
            <span className="text-[9px] text-emerald-500">อยู่ในห้อง IT</span>
          </div>
        </div>

        {/* แถบสลับแท็บ Navigation (จัดการอุปกรณ์ VS รายการคนยืม) */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center space-x-1.5 transition ${
              activeTab === "inventory"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span>จัดการอุปกรณ์ ({equipments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("loans")}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center space-x-1.5 transition ${
              activeTab === "loans"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>ของอยู่ที่ใคร ({activeLoans.length})</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* แท็บ 1: จัดการอุปกรณ์คงคลัง (เพิ่ม / แก้ไข / ลบ) */}
        {/* ========================================================= */}
        {activeTab === "inventory" && (
          <div className="space-y-3">
            {/* แถบเครื่องมือ: ค้นหา + ปุ่มเพิ่มอุปกรณ์ใหม่ */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ค้นหาชื่ออุปกรณ์ IT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มอุปกรณ์</span>
              </button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                กำลังโหลดรายการอุปกรณ์...
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>ไม่พบรายการอุปกรณ์</p>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
                >
                  + คลิกที่นี่เพื่อเพิ่มอุปกรณ์แรก
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEquipments.map((eq) => {
                  const borrowed = Math.max(0, eq.total_stock - eq.available_stock);
                  const isDeleting = deletingId === eq.id;

                  return (
                    <div
                      key={eq.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        {/* รูปอุปกรณ์ */}
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {eq.image_url ? (
                            <Image
                              src={eq.image_url}
                              alt={eq.name}
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

                        {/* รายละเอียด */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 leading-snug">
                            {eq.name}
                          </h3>

                          {/* สถิติสต็อก */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded-lg">
                              ทั้งหมด <b>{eq.total_stock}</b> ชิ้น
                            </span>

                            {eq.available_stock > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold rounded-lg">
                                ว่าง {eq.available_stock} ชิ้น
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg">
                                ของหมด
                              </span>
                            )}

                            {borrowed > 0 && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-medium rounded-lg">
                                ถูกยืม {borrowed}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ปุ่มแก้ไข / ลบ */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(eq)}
                          className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-medium text-[11px] rounded-lg border border-slate-200 hover:border-blue-200 flex items-center space-x-1 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>แก้ไข</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteEquipment(eq)}
                          className="px-2.5 py-1 text-slate-600 hover:text-red-600 hover:bg-red-50 font-medium text-[11px] rounded-lg border border-slate-200 hover:border-red-200 flex items-center space-x-1 transition disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>{isDeleting ? "กำลังลบ..." : "ลบ"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* แท็บ 2: ของอยู่ที่ใครบ้าง (Active Loans) */}
        {/* ========================================================= */}
        {activeTab === "loans" && (
          <div className="space-y-3">
            {/* ช่องค้นหา */}
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาชื่อคนยืม, แผนก, หรือชื่ออุปกรณ์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition shadow-2xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                กำลังโหลดข้อมูลรายการยืม...
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p>
                  {activeLoans.length === 0
                    ? "ขณะนี้ไม่มีอุปกรณ์ใดถูกยืมอยู่ ของอยู่ในห้อง IT ครบถ้วน"
                    : "ไม่พบข้อมูลที่ค้นหา"}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredLoans.map((loan) => {
                  const equip = loan.equipments;
                  const isReturning = returningId === loan.id;

                  return (
                    <div
                      key={loan.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
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
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {equip?.name || "อุปกรณ์ IT"}
                            </h3>
                            <p className="text-[11px] font-semibold text-blue-700 truncate mt-0.5">
                              👤 {loan.display_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              🏥 {loan.department}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                          {calculateDays(loan.borrow_date)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>ยืมเมื่อ: {loan.borrow_date}</span>
                        <button
                          type="button"
                          disabled={isReturning}
                          onClick={() => handleAdminReturn(loan.id, equip?.name)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 font-medium text-[11px] rounded-lg border border-slate-200 transition disabled:opacity-50"
                        >
                          {isReturning ? "กำลังบันทึก..." : "✓ IT กดยืนยันรับของแล้ว"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: เพิ่ม / แก้ไข อุปกรณ์ IT */}
      {/* ========================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                {formMode === "add" ? (
                  <Plus className="w-5 h-5" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {formMode === "add" ? "เพิ่มอุปกรณ์ IT ใหม่" : "แก้ไขข้อมูลอุปกรณ์"}
                </h3>
                <p className="text-[11px] text-slate-500">จัดการข้อมูลอุปกรณ์ในคลัง IT รพช.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEquipment} className="space-y-3.5">
              {/* ชื่ออุปกรณ์ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่ออุปกรณ์ IT <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น โน้ตบุ๊ก Acer Aspire, จอคอม Dell 24 นิ้ว"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition"
                  required
                />
              </div>

              {/* จำนวนสต็อกทั้งหมด */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนสต็อกทั้งหมด (ชิ้น) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={formStock}
                  onChange={(e) => setFormStock(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  ระบุจำนวนเครื่อง/ชิ้นทั้งหมดที่มีในโรงพยาบาล
                </span>
              </div>

              {/* URL รูปภาพ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL รูปภาพอุปกรณ์ (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Presets รูปอุปกรณ์สำเร็จรูป */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>หรือคลิกเลือกรูปตัวอย่างมาตรฐาน:</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200/80">
                  {IMAGE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormImageUrl(preset.url)}
                      className={`text-left p-1.5 rounded-lg text-[10px] transition border flex items-center space-x-1.5 ${
                        formImageUrl === preset.url
                          ? "bg-blue-50 border-blue-400 text-blue-800 font-semibold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <span className="truncate">{preset.badge}</span>
                      {formImageUrl === preset.url && (
                        <Check className="w-3 h-3 text-blue-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* พรีวิวรูปภาพ */}
              {formImageUrl && (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">ตัวอย่างรูปภาพ:</p>
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden mx-auto border border-slate-200 bg-white">
                    <Image
                      src={formImageUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              )}

              {/* ปุ่มบันทึก */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>{formMode === "add" ? "เพิ่มอุปกรณ์" : "บันทึกการแก้ไข"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ป้าย QR Code จุดคืนของ IT */}
      {/* ========================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 text-center shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#06C755] flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-slate-900">ป้าย QR จุดรับคืนอุปกรณ์ IT</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
              ตั้งที่โต๊ะเคาน์เตอร์ IT รพช. ให้ผู้ยืมสแกน
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-emerald-300 inline-block mb-3">
              <div className="w-40 h-40 bg-white p-2.5 rounded-xl shadow-xs flex flex-col items-center justify-center mx-auto">
                <QrCode className="w-32 h-32 text-slate-900" />
              </div>
              <p className="text-[11px] font-mono font-bold text-emerald-800 mt-2">
                {OFFICIAL_IT_QR_CODE}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 mb-4">
              ผู้ยืมจะต้องนำอุปกรณ์มาสแกนป้ายนี้ที่ห้อง IT เท่านั้น ถึงจะทำรายการคืนสำเร็จ
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
