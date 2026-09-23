import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRequestAdminAuthorized } from "@/lib/adminAuth";
import { Equipment } from "@/lib/types";

// Helper สำหรับ Sanitize ข้อความ
function sanitizeInput(val: any, maxLength = 100): string {
  if (typeof val !== "string") return "";
  return val
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .slice(0, maxLength);
}

// GET: ดึงรายการอุปกรณ์ทั้งหมด (Admin view)
export async function GET(request: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from("equipments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API/Admin/Equipments/GET] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: `ไม่สามารถดึงข้อมูลอุปกรณ์ได้: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      equipments: data || [],
    });
  } catch (error: any) {
    console.error("[API/Admin/Equipments/GET] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์" },
      { status: 500 }
    );
  }
}

// POST: เพิ่มอุปกรณ์ใหม่ (ต้องมี Admin Authorization)
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

    const cleanName = sanitizeInput(name, 100);
    const cleanImageUrl = image_url ? String(image_url).trim().slice(0, 500) : null;

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่ออุปกรณ์ IT" },
        { status: 400 }
      );
    }

    const stockNumber = parseInt(total_stock, 10);
    if (isNaN(stockNumber) || stockNumber < 1 || stockNumber > 9999) {
      return NextResponse.json(
        { success: false, error: "จำนวนสต็อกทั้งหมดต้องเป็นตัวเลขระหว่าง 1 - 9,999" },
        { status: 400 }
      );
    }

    const newRecord = {
      name: cleanName,
      image_url: cleanImageUrl,
      total_stock: stockNumber,
      available_stock: stockNumber,
    };

    const { data, error } = await supabaseAdmin
      .from("equipments")
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error("[API/Admin/Equipments/POST] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: `ไม่สามารถเพิ่มอุปกรณ์ลงฐานข้อมูลได้: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      equipment: data,
      message: `เพิ่มอุปกรณ์ '${data.name}' เข้าสู่ระบบเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error("[API/Admin/Equipments/POST] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์" },
      { status: 500 }
    );
  }
}

// PUT: แก้ไขข้อมูลอุปกรณ์ (ต้องมี Admin Authorization)
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

    const cleanId = sanitizeInput(id, 64);
    const cleanName = sanitizeInput(name, 100);
    const cleanImageUrl = image_url ? String(image_url).trim().slice(0, 500) : null;

    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรหัสอุปกรณ์ (id)" },
        { status: 400 }
      );
    }

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่ออุปกรณ์ IT" },
        { status: 400 }
      );
    }

    const newTotalStock = parseInt(total_stock, 10);
    if (isNaN(newTotalStock) || newTotalStock < 0 || newTotalStock > 9999) {
      return NextResponse.json(
        { success: false, error: "จำนวนสต็อกต้องเป็นตัวเลขที่ถูกต้อง (>= 0)" },
        { status: 400 }
      );
    }

    // ดึงข้อมูลปัจจุบันมาคำนวณ available_stock ใหม่
    const { data: current, error: getErr } = await supabaseAdmin
      .from("equipments")
      .select("total_stock, available_stock")
      .eq("id", cleanId)
      .single();

    if (getErr || !current) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลอุปกรณ์นี้ในระบบ" },
        { status: 404 }
      );
    }

    const borrowedCount = Math.max(0, current.total_stock - current.available_stock);

    if (newTotalStock < borrowedCount) {
      return NextResponse.json(
        {
          success: false,
          error: `ไม่สามารถปรับสต็อกรวมให้น้อยกว่าจำนวนที่กำลังถูกยืมอยู่ (${borrowedCount} เครื่อง) ได้`,
        },
        { status: 400 }
      );
    }

    const newAvailableStock = newTotalStock - borrowedCount;

    const updatePayload = {
      name: cleanName,
      image_url: cleanImageUrl,
      total_stock: newTotalStock,
      available_stock: newAvailableStock,
    };

    const { data, error } = await supabaseAdmin
      .from("equipments")
      .update(updatePayload)
      .eq("id", cleanId)
      .select()
      .single();

    if (error) {
      console.error("[API/Admin/Equipments/PUT] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: `ไม่สามารถอัปเดตข้อมูลอุปกรณ์ได้: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      equipment: data,
      message: `อัปเดตข้อมูล '${data.name}' เรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error("[API/Admin/Equipments/PUT] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล" },
      { status: 500 }
    );
  }
}

// DELETE: ลบอุปกรณ์ (ต้องมี Admin Authorization)
export async function DELETE(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = sanitizeInput(searchParams.get("id"), 64);

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
      // Foreign Key constraint
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

      console.error("[API/Admin/Equipments/DELETE] Supabase error:", deleteError.message);
      return NextResponse.json(
        { success: false, error: `ไม่สามารถลบอุปกรณ์ได้: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ลบอุปกรณ์ออกจากระบบเรียบร้อยแล้ว",
    });
  } catch (error: any) {
    console.error("[API/Admin/Equipments/DELETE] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการลบอุปกรณ์" },
      { status: 500 }
    );
  }
}
