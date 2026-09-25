import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRequestAdminAuthorized } from "@/lib/adminAuth";

// Helper ฟังก์ชันซิงค์สต็อกของ Equipment จากจำนวน EquipmentItems
async function syncParentEquipmentStock(equipmentId: string) {
  try {
    // 1. ดึงรายการ items ทั้งหมดของอุปกรณ์นี้
    const { data: items, error } = await supabaseAdmin
      .from("equipment_items")
      .select("id, status")
      .eq("equipment_id", equipmentId);

    if (error || !items) return;

    // total_stock: เครื่องที่ไม่ใช่ 'retired' (ปลดระวาง)
    const activeItems = items.filter((i) => i.status !== "retired");
    const totalStock = activeItems.length;

    // available_stock: เครื่องที่สถานะ 'available' (พร้อมยืม)
    const availableStock = items.filter((i) => i.status === "available").length;

    await supabaseAdmin
      .from("equipments")
      .update({
        total_stock: totalStock,
        available_stock: availableStock,
      })
      .eq("id", equipmentId);
  } catch (err) {
    console.error("[syncParentEquipmentStock] Error:", err);
  }
}

// GET: ดึงรายการเครื่องย่อย (Serialized Items) ของอุปกรณ์
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipment_id");

    if (!equipmentId) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ equipment_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("equipment_items")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("item_code", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      items: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลเครื่องย่อย" },
      { status: 500 }
    );
  }
}

// POST: เพิ่มเครื่องย่อยใหม่ (เช่น S/N, เลขพัสดุ)
export async function POST(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { equipment_id, item_code, serial_number, asset_number, status, note } = body;

    if (!equipment_id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ equipment_id" },
        { status: 400 }
      );
    }

    const cleanCode = (item_code || "").trim();
    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่อเรียกเครื่องหรือเบอร์เครื่อง (เช่น เครื่องที่ 1 หรือ NB-01)" },
        { status: 400 }
      );
    }

    const VALID_ITEM_STATUSES = ["available", "borrowed", "maintenance", "retired"];
    if (status && !VALID_ITEM_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "สถานะของเครื่องไม่ถูกต้อง (ต้องเป็น available, borrowed, maintenance หรือ retired)",
        },
        { status: 400 }
      );
    }

    const newRecord = {
      equipment_id,
      item_code: cleanCode,
      serial_number: (serial_number || "").trim() || null,
      asset_number: (asset_number || "").trim() || null,
      status: status || "available",
      note: (note || "").trim() || null,
    };

    const { data, error } = await supabaseAdmin
      .from("equipment_items")
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: `ไม่สามารถเพิ่มเครื่องย่อยได้: ${error.message}` },
        { status: 500 }
      );
    }

    // ซิงค์สต็อกรวมของอุปกรณ์แม่
    await syncParentEquipmentStock(equipment_id);

    return NextResponse.json({
      success: true,
      item: data,
      message: `เพิ่ม '${cleanCode}' เข้าสู่รายการเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการเพิ่มเครื่องย่อย" },
      { status: 500 }
    );
  }
}

// PUT: แก้ไขข้อมูลเครื่องย่อย (S/N, เลขพัสดุ, สถานะ, หมายเหตุ)
export async function PUT(request: Request) {
  if (!isRequestAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "ไม่มีสิทธิ์ดำเนินการ (Admin Authorization Required)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, item_code, serial_number, asset_number, status, note } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรหัสเครื่องย่อย (id)" },
        { status: 400 }
      );
    }

    const cleanCode = (item_code || "").trim();
    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่อเรียกเครื่องหรือเบอร์เครื่อง" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      item_code: cleanCode,
      serial_number: (serial_number || "").trim() || null,
      asset_number: (asset_number || "").trim() || null,
      note: (note || "").trim() || null,
    };

    if (status) {
      const VALID_ITEM_STATUSES = ["available", "borrowed", "maintenance", "retired"];
      if (!VALID_ITEM_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: "สถานะของเครื่องไม่ถูกต้อง (ต้องเป็น available, borrowed, maintenance หรือ retired)",
          },
          { status: 400 }
        );
      }
      updatePayload.status = status;
    }

    const { data, error } = await supabaseAdmin
      .from("equipment_items")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: `ไม่สามารถแก้ไขข้อมูลเครื่องย่อยได้: ${error.message}` },
        { status: 500 }
      );
    }

    // ซิงค์สต็อกรวมของอุปกรณ์แม่
    if (data?.equipment_id) {
      await syncParentEquipmentStock(data.equipment_id);
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: `อัปเดตข้อมูล '${cleanCode}' เรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการแก้ไขเครื่องย่อย" },
      { status: 500 }
    );
  }
}

// DELETE: ลบเครื่องย่อยออกจากระบบ
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
        { success: false, error: "กรุณาระบุรหัสเครื่องย่อย (id)" },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบข้อมูลก่อนลบ
    const { data: item, error: findErr } = await supabaseAdmin
      .from("equipment_items")
      .select("id, equipment_id, item_code, status")
      .eq("id", id)
      .single();

    if (findErr || !item) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลเครื่องย่อยนี้ในระบบ" },
        { status: 404 }
      );
    }

    if (item.status === "borrowed") {
      return NextResponse.json(
        { success: false, error: `⚠️ ไม่สามารถลบ '${item.item_code}' ได้ เนื่องจากกำลังถูกยืมอยู่ กรุณารับคืนก่อนลบครับ` },
        { status: 400 }
      );
    }

    // 2. ดำเนินการลบ
    const { error: delErr } = await supabaseAdmin
      .from("equipment_items")
      .delete()
      .eq("id", id);

    if (delErr) {
      return NextResponse.json(
        { success: false, error: `ไม่สามารถลบเครื่องย่อยได้: ${delErr.message}` },
        { status: 500 }
      );
    }

    // 3. ซิงค์สต็อกของอุปกรณ์แม่
    await syncParentEquipmentStock(item.equipment_id);

    return NextResponse.json({
      success: true,
      message: `ลบเครื่อง '${item.item_code}' ออกจากระบบเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดในการลบเครื่องย่อย" },
      { status: 500 }
    );
  }
}
