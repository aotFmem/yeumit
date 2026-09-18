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
  Clock,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Equipment, Transaction } from "@/lib/types";

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
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [activeLoans, setActiveLoans] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [returningId, setReturningId] = useState<string | null>(null);

  // ดึงข้อมูลทั้งหมด
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. รายการอุปกรณ์ทั้งหมด
      const { data: eqData } = await supabase.from("equipments").select("*");
      if (eqData && eqData.length > 0) {
        setEquipments(eqData);
      }

      // 2. รายการที่กำลังถูกยืมอยู่ทั้งหมด
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
      setActiveLoans(INITIAL_MOCK_TRANSACTIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // IT แอดมินกดรับคืนของ
  const handleAdminReturn = async (txId: string, equipName?: string) => {
    if (!confirm(`ยืนยันว่าได้รับ '${equipName || "อุปกรณ์"}' คืนเข้าคลัง IT แล้ว?`)) {
      return;
    }

    setReturningId(txId);
    try {
      if (txId.startsWith("demo-tx-")) {
        setActiveLoans((prev) => prev.filter((t) => t.id !== txId));
        alert(`IT บันทึกรับคืน '${equipName}' เรียบร้อยแล้ว`);
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

  const filteredLoans = activeLoans.filter(
    (loan) =>
      loan.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.equipments?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStock = equipments.reduce((acc, curr) => acc + curr.total_stock, 0);
  const totalBorrowed = activeLoans.length;
  const totalAvailable = equipments.reduce((acc, curr) => acc + curr.available_stock, 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* Header แดชบอร์ดเฉพาะ IT */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="กลับหน้าหลัก"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-bold tracking-wide">IT Staff Only</h1>
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-bold rounded">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ระบบติดตามอุปกรณ์คงคลัง รพช.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadData()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* สรุปสถิติ 3 กล่อง */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-xs">
            <p className="text-[10px] text-slate-500 font-medium">อุปกรณ์ทั้งหมด</p>
            <p className="text-base font-bold text-slate-800 mt-0.5">{totalStock}</p>
            <span className="text-[9px] text-slate-400">ชิ้นในระบบ</span>
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

        {/* รายการของที่ถูกยืมทั้งหมด (ใครถืออะไรอยู่) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>ของอยู่ที่ใครบ้าง ({activeLoans.length} รายการ)</span>
            </h2>
          </div>

          {/* ช่องค้นหา */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="ค้นหาชื่อคนยืม, แผนก, หรือชื่ออุปกรณ์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:bg-white outline-none transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              กำลังโหลดข้อมูล...
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              {activeLoans.length === 0
                ? "ขณะนี้ไม่มีอุปกรณ์ใดถูกยืมอยู่ ของอยู่ในห้อง IT ครบถ้วน"
                : "ไม่พบข้อมูลที่ค้นหา"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLoans.map((loan) => {
                const equip = loan.equipments;
                const isReturning = returningId === loan.id;

                return (
                  <div
                    key={loan.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {equip?.image_url ? (
                            <Image
                              src={equip.image_url}
                              alt={equip.name}
                              fill
                              sizes="44px"
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
      </div>
    </main>
  );
}
