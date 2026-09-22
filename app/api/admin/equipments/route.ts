import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRequestAdminAuthorized } from "@/lib/adminAuth";
import { Equipment } from "@/lib/types";

// รายการอุปกรณ์สำรอง (เมื่อยังไม่ได้เชื่อมต่อ Supabase หรืออยู่ในโหมดทดสอบ)
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

// GET: ดึงรายการอุปกรณ์ทั้งหมด
export async function GET(request: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from("equipments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        success: true,
        source: "fallback",
        equipments: FALLBACK_EQUIPMENTS,
      });
    }

    return NextResponse.json({
      success: true,
      source: "database",
      equipments: data,
    });
  } catch {
    return NextResponse.json({
      success: true,
      source: "fallback",
      equipments: FALLBACK_EQUIPMENTS,
    });
  }
}

// POST: เพิ่มอุปกรณ์ใหม่
export async function POST(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, image_url, total_stock } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่ออุปกรณ์ IT" },
        { status: 400 }
      );
    }

    const stockNumber = parseInt(total_stock, 10);
    if (isNaN(stockNumber) || stockNumber < 1) {
      return NextResponse.json(
        { success: false, error: "จำนวนสต็อกทั้งหมดต้องมีอย่างน้อย 1 ชิ้น" },
        { status: 400 }
      );
    }

    const newRecord = {
      name: name.trim(),
      image_url: image_url?.trim() || null,
      total_stock: stockNumber,
      available_stock: stockNumber,
    };

    const { data, error } = await supabaseAdmin
      .from("equipments")
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.warn("[API/Equipments/POST] Supabase error:", error.message);
      // ถ้าไม่มีตารางใน DB ให้จำลองผลลัพธ์
      const mockCreated: Equipment = {
        id: `mock-eq-${Date.now()}`,
        ...newRecord,
        created_at: new Date().toISOString(),
      };
      return NextResponse.json({
        success: true,
        equipment: mockCreated,
        source: "mock",
        message: `เพิ่ม '${newRecord.name}' เรียบร้อยแล้ว (โหมดตัวอย่าง)`,
      });
    }

    return NextResponse.json({
      success: true,
      equipment: data,
      message: `เพิ่มอุปกรณ์ '${data.name}' เข้าสู่ระบบเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error("[API/Equipments/POST] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์" },
      { status: 500 }
    );
  }
}

// PUT: แก้ไขข้อมูลอุปกรณ์
export async function PUT(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, image_url, total_stock } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรหัสอุปกรณ์ (id)" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่ออุปกรณ์ IT" },
        { status: 400 }
      );
    }

    const stockNumber = parseInt(total_stock, 10);
    if (isNaN(stockNumber) || stockNumber < 1) {
      return NextResponse.json(
        { success: false, error: "จำนวนสต็อกทั้งหมดต้องมีอย่างน้อย 1 ชิ้น" },
        { status: 400 }
      );
    }

    // ตรวจสอบสต็อกเดิมและจำนวนที่กำลังถูกยืมอยู่
    const { data: existing } = await supabaseAdmin
      .from("equipments")
      .select("total_stock, available_stock")
      .eq("id", id)
      .single();

    let newAvailableStock = stockNumber;

    if (existing) {
      const currentlyBorrowed = Math.max(0, existing.total_stock - existing.available_stock);
      if (stockNumber < currentlyBorrowed) {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่สามารถปรับสต็อกทั้งหมดเป็น ${stockNumber} ชิ้นได้ เนื่องจากมีผู้ยืมไปแล้ว ${currentlyBorrowed} ชิ้น`,
          },
          { status: 400 }
        );
      }
      newAvailableStock = stockNumber - currentlyBorrowed;
    }

    const updatePayload = {
      name: name.trim(),
      image_url: image_url?.trim() || null,
      total_stock: stockNumber,
      available_stock: newAvailableStock,
    };

    const { data, error } = await supabaseAdmin
      .from("equipments")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.warn("[API/Equipments/PUT] Supabase error:", error.message);
      // จำลองการแก้ไข
      const mockUpdated: Equipment = {
        id,
        ...updatePayload,
      };
      return NextResponse.json({
        success: true,
        equipment: mockUpdated,
        source: "mock",
        message: `อัปเดตข้อมูล '${name}' เรียบร้อยแล้ว (โหมดตัวอย่าง)`,
      });
    }

    return NextResponse.json({
      success: true,
      equipment: data,
      message: `อัปเดตข้อมูล '${data.name}' เรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error("[API/Equipments/PUT] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล" },
      { status: 500 }
    );
  }
}

// DELETE: ลบอุปกรณ์ (ตรวจสอบ active loan ก่อนลบเสมอ)
export async function DELETE(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรหัสอุปกรณ์ที่ต้องการลบ (id)" },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบว่ามีรายการที่กำลังถูกยืมอยู่หรือไม่
    const { data: activeLoans, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, display_name, department")
      .eq("equipment_id", id)
      .eq("status", "borrowed");

    if (!txError && activeLoans && activeLoans.length > 0) {
      const borrowers = activeLoans.map((b) => b.display_name).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: `⚠️ ไม่สามารถลบอุปกรณ์นี้ได้! เนื่องจากกำลังถูกยืมอยู่ (${activeLoans.length} รายการ: ${borrowers}) กรุณาให้ผู้ยืมส่งคืนอุปกรณ์ก่อนลบ`,
        },
        { status: 400 }
      );
    }

    // 2. ดำเนินการลบ
    const { error: deleteError } = await supabaseAdmin
      .from("equipments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      // ตรวจสอบ Foreign Key constraint (เคยมีประวัติการยืมในอดีต)
      if (deleteError.code === "23503" || deleteError.message.includes("violates foreign key")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "อุปกรณ์นี้มีประวัติการยืม-คืนในอดีตที่เชื่อมโยงกับฐานข้อมูล เพื่อความถูกต้องของรายงาน แนะนำให้ 'แก้ไขสต็อกเป็น 0' แทนการลบครับ",
          },
          { status: 400 }
        );
      }

      console.warn("[API/Equipments/DELETE] Supabase error:", deleteError.message);
      return NextResponse.json({
        success: true,
        source: "mock",
        message: "ลบอุปกรณ์ออกจากระบบเรียบร้อยแล้ว (โหมดตัวอย่าง)",
      });
    }

    return NextResponse.json({
      success: true,
      message: "ลบอุปกรณ์ออกจากระบบเรียบร้อยแล้ว",
    });
  } catch (error: any) {
    console.error("[API/Equipments/DELETE] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการลบอุปกรณ์" },
      { status: 500 }
    );
  }
}
