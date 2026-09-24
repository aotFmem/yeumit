import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";
import { BorrowRequestPayload } from "@/lib/types";

// Helper สำหรับตัดข้อความและลบอักขระควบคุม (Sanitize input)
function sanitizeString(val: any, maxLength = 100): string {
  if (typeof val !== "string") return "";
  return val
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // strip control characters
    .slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);

    // 1. ตรวจสอบ Rate Limit ป้องกันการกดสแปมรัว
    const rateLimit = checkRateLimit(`borrow:${clientIp}`, {
      limit: 15,
      windowMs: 60 * 1000, // 15 requests per minute
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `ทำรายการถี่เกินไป กรุณารอ ${rateLimit.retryAfterSeconds} วินาทีก่อนลองใหม่อีกครั้ง`,
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as BorrowRequestPayload;
    const {
      line_user_id,
      display_name,
      department,
      equipment_id,
      item_id,
      borrow_date,
      time_slot,
      purpose,
      internal_phone,
    } = body;

    // 2. ตรวจสอบและ Sanitize ข้อมูลที่ส่งเข้ามา
    const cleanLineUserId = sanitizeString(line_user_id, 64);
    const cleanDisplayName = sanitizeString(display_name, 100);
    const cleanDepartment = sanitizeString(department, 100);
    const cleanEquipmentId = sanitizeString(equipment_id, 64);
    const cleanItemId = sanitizeString(item_id, 64);
    const cleanBorrowDate = sanitizeString(borrow_date, 20);
    const cleanTimeSlot = sanitizeString(time_slot, 100);
    const cleanPurpose = sanitizeString(purpose, 250);
    const cleanInternalPhone = sanitizeString(internal_phone, 50);

    if (
      !cleanLineUserId ||
      !cleanDisplayName ||
      !cleanDepartment ||
      !cleanEquipmentId ||
      !cleanBorrowDate
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, แผนก, อุปกรณ์, วันที่ยืม)",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบรูปแบบวันที่ ISO YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanBorrowDate)) {
      return NextResponse.json(
        { success: false, error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // ตรวจสอบเครื่องย่อย (Serialized Item) ถ้ามีการเลือกเครื่องเฉพาะ
    let itemDetail: any = null;
    if (cleanItemId) {
      const { data: itemData, error: itemErr } = await supabaseAdmin
        .from("equipment_items")
        .select("id, item_code, serial_number, asset_number, status")
        .eq("id", cleanItemId)
        .eq("equipment_id", cleanEquipmentId)
        .single();

      if (itemErr || !itemData) {
        return NextResponse.json(
          { success: false, error: "ไม่พบข้อมูลเครื่องที่เลือก" },
          { status: 404 }
        );
      }
      if (itemData.status !== "available") {
        return NextResponse.json(
          { success: false, error: `ขออภัย '${itemData.item_code}' ถูกยืมหรือไม่อยู่ในสถานะพร้อมยืมแล้ว` },
          { status: 400 }
        );
      }
      itemDetail = itemData;
    }

    let equipmentName = "IT Equipment";
    let transactionId = "";

    // 3. ทำรายการยืม
    // กรณีที่ไม่ได้เลือกเครื่องเฉพาะ ให้ลองใช้ PostgreSQL Atomic Function ก่อน
    let rpcSuccess = false;
    let rpcData: any = null;
    if (!itemDetail) {
      const res = await supabaseAdmin.rpc("borrow_equipment_atomic", {
        p_line_user_id: cleanLineUserId,
        p_display_name: cleanDisplayName,
        p_department: cleanDepartment,
        p_equipment_id: cleanEquipmentId,
        p_borrow_date: cleanBorrowDate,
      });
      rpcData = res.data;
      if (!res.error && rpcData?.success) {
        rpcSuccess = true;
      }
    }

    if (!rpcSuccess) {
      // Direct query execution (หรือกรณีเลือกเครื่องเฉพาะตัว)
      const { data: equipment, error: fetchErr } = await supabaseAdmin
        .from("equipments")
        .select("id, name, available_stock")
        .eq("id", cleanEquipmentId)
        .single();

      if (fetchErr || !equipment) {
        return NextResponse.json(
          { success: false, error: "ไม่พบข้อมูลอุปกรณ์นี้ในระบบ" },
          { status: 404 }
        );
      }

      if (equipment.available_stock <= 0) {
        return NextResponse.json(
          { success: false, error: `ขออภัย '${equipment.name}' ถูกยืมหมดแล้ว` },
          { status: 400 }
        );
      }

      equipmentName = equipment.name;

      // หักสต็อกอุปกรณ์ (-1)
      const { error: updateErr } = await supabaseAdmin
        .from("equipments")
        .update({ available_stock: Math.max(0, equipment.available_stock - 1) })
        .eq("id", cleanEquipmentId);

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: `ไม่สามารถอัปเดตสต็อกได้: ${updateErr.message}` },
          { status: 500 }
        );
      }

      // ปรับสถานะเครื่องย่อยเป็น 'borrowed'
      if (itemDetail) {
        await supabaseAdmin
          .from("equipment_items")
          .update({ status: "borrowed" })
          .eq("id", itemDetail.id);
      }

      // บันทึกรายการยืมลงตาราง transactions
      const insertRecord: any = {
        line_user_id: cleanLineUserId,
        display_name: cleanDisplayName,
        department: cleanDepartment,
        equipment_id: cleanEquipmentId,
        borrow_date: cleanBorrowDate,
        status: "borrowed",
      };
      if (cleanTimeSlot) insertRecord.time_slot = cleanTimeSlot;
      if (cleanPurpose) insertRecord.purpose = cleanPurpose;
      if (cleanInternalPhone) insertRecord.internal_phone = cleanInternalPhone;
      if (itemDetail) {
        insertRecord.item_id = itemDetail.id;
        insertRecord.serial_number = itemDetail.serial_number;
        insertRecord.asset_number = itemDetail.asset_number;
      }

      let { data: txData, error: insertErr } = await supabaseAdmin
        .from("transactions")
        .insert(insertRecord)
        .select("id")
        .single();

      // หากตารางยังไม่มีคอลัมน์ใหม่ ให้ fallback บันทึกลง field พื้นฐาน
      if (insertErr && (insertErr.message.includes("column") || insertErr.code === "42703")) {
        const deptWithMeta = [
          cleanDepartment,
          cleanInternalPhone ? `(โทร: ${cleanInternalPhone})` : "",
          cleanTimeSlot ? `[${cleanTimeSlot}]` : "",
        ]
          .filter(Boolean)
          .join(" ");

        const fallbackRes = await supabaseAdmin
          .from("transactions")
          .insert({
            line_user_id: cleanLineUserId,
            display_name: cleanDisplayName,
            department: deptWithMeta,
            equipment_id: cleanEquipmentId,
            borrow_date: cleanBorrowDate,
            status: "borrowed",
          })
          .select("id")
          .single();
        txData = fallbackRes.data;
        insertErr = fallbackRes.error;
      }

      if (insertErr) {
        // Rollback สต็อกถ้าบันทึกรายการยืมไม่สำเร็จ
        await supabaseAdmin
          .from("equipments")
          .update({ available_stock: equipment.available_stock })
          .eq("id", cleanEquipmentId);

        return NextResponse.json(
          { success: false, error: `ไม่สามารถบันทึกรายการยืมได้: ${insertErr.message}` },
          { status: 500 }
        );
      }

      transactionId = txData?.id || "";
    } else {
      transactionId = rpcData?.transaction_id || "";
      equipmentName = rpcData?.equipment_name || "IT Equipment";
    }

    // 4. ส่งการแจ้งเตือนเข้า LINE (Messaging API / Notify)
    let notifySuccess = false;
    const messagingToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetUserId = process.env.LINE_ADMIN_TARGET_ID || cleanLineUserId;
    const notifyToken = process.env.LINE_NOTIFY_TOKEN;

    const timeSlotText = cleanTimeSlot || "เต็มวัน (08:30 - 16:30 น.)";
    const purposeText = cleanPurpose || "ใช้งานทั่วไปในโรงพยาบาล";
    const phoneText = cleanInternalPhone ? ` (เบอร์ต่อ: ${cleanInternalPhone})` : "";
    const itemInfoText = itemDetail
      ? `\nเครื่องที่ยืม: ${itemDetail.item_code}${itemDetail.serial_number ? ` (S/N: ${itemDetail.serial_number})` : ""}${itemDetail.asset_number ? ` (พัสดุ: ${itemDetail.asset_number})` : ""}`
      : "";

    const formattedMessage = `🔔 มีรายการขอยืมอุปกรณ์ IT ใหม่!\nผู้ยืม: ${cleanDisplayName}\nแผนก: ${cleanDepartment}${phoneText}\nอุปกรณ์: ${equipmentName}${itemInfoText}\nวันที่: ${borrowDateFormatted(cleanBorrowDate)}\nช่วงเวลา: ${timeSlotText}\nวัตถุประสงค์: ${purposeText}`;

    // A. LINE Messaging API
    if (messagingToken && messagingToken !== "your-channel-access-token-here") {
      try {
        const lineApiRes = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${messagingToken}`,
          },
          body: JSON.stringify({
            to: targetUserId,
            messages: [{ type: "text", text: formattedMessage }],
          }),
        });

        if (lineApiRes.ok) {
          notifySuccess = true;
        }
      } catch (lineErr) {
        console.error("[API/Borrow] LINE Messaging API dispatch error:", lineErr);
      }
    }
    // B. LINE Notify (Fallback)
    else if (notifyToken && notifyToken !== "your-line-notify-token-here") {
      try {
        const params = new URLSearchParams();
        params.append("message", formattedMessage);

        const notifyRes = await fetch("https://notify-api.line.me/api/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${notifyToken}`,
          },
          body: params.toString(),
        });

        if (notifyRes.ok) {
          notifySuccess = true;
        }
      } catch (notifyErr) {
        console.error("[API/Borrow] LINE Notify dispatch failed:", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `บันทึกรายการขอยืม '${equipmentName}' เรียบร้อยแล้ว`,
      transaction: {
        id: transactionId,
        equipment_name: equipmentName,
        borrow_date: cleanBorrowDate,
      },
      notifySent: notifySuccess,
    });
  } catch (error: any) {
    console.error("[API/Borrow] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}

function borrowDateFormatted(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
