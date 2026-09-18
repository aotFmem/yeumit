import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction_id, line_user_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรหัสรายการยืม (transaction_id)" },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบข้อมูลการยืมในตาราง transactions
    const { data: transaction, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("*, equipments(*)")
      .eq("id", transaction_id)
      .single();

    if (txErr || !transaction) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลรายการยืมนี้ในระบบ" },
        { status: 404 }
      );
    }

    if (transaction.status === "returned") {
      return NextResponse.json(
        { success: false, error: "รายการนี้ทำรายการคืนอุปกรณ์ไปเรียบร้อยแล้ว" },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์ผู้คืน (ต้องเป็นคนเดียวกับที่ยืม หรือแอดมิน)
    if (line_user_id && transaction.line_user_id !== line_user_id) {
      return NextResponse.json(
        { success: false, error: "คุณไม่มีสิทธิ์ทำรายการคืนอุปกรณ์ของผู้อื่น" },
        { status: 403 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const equipmentId = transaction.equipment_id;
    const equipmentName = transaction.equipments?.name || "อุปกรณ์ IT";

    // 2. อัปเดตสถานะในตาราง transactions เป็น 'returned'
    const { error: updateTxErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "returned",
        return_date: todayStr,
      })
      .eq("id", transaction_id);

    if (updateTxErr) {
      return NextResponse.json(
        { success: false, error: `ไม่สามารถอัปเดตสถานะการคืนได้: ${updateTxErr.message}` },
        { status: 500 }
      );
    }

    // 3. คืนสต็อกในตาราง equipments (+1 available_stock)
    if (equipmentId) {
      const { data: equipment } = await supabaseAdmin
        .from("equipments")
        .select("available_stock, total_stock")
        .eq("id", equipmentId)
        .single();

      if (equipment) {
        const newStock = Math.min(equipment.available_stock + 1, equipment.total_stock);
        await supabaseAdmin
          .from("equipments")
          .update({ available_stock: newStock })
          .eq("id", equipmentId);
      }
    }

    // 4. ส่งการแจ้งเตือนเข้า LINE (Messaging API / Notify)
    const messagingToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetUserId = process.env.LINE_ADMIN_TARGET_ID || transaction.line_user_id;
    const notifyToken = process.env.LINE_NOTIFY_TOKEN;

    const formattedMessage = `✅ แจ้งเตือนคืนอุปกรณ์ IT สำเร็จ!\nผู้คืน: ${transaction.display_name}\nแผนก: ${transaction.department}\nรายการ: ${equipmentName}\nวันที่คืน: ${todayStr}`;

    // ส่งผ่าน LINE Messaging API
    if (messagingToken && messagingToken !== "your-channel-access-token-here") {
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
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
      } catch (lineErr) {
        console.error("[API/Return] LINE Messaging API dispatch error:", lineErr);
      }
    } else if (notifyToken && notifyToken !== "your-line-notify-token-here") {
      try {
        const params = new URLSearchParams();
        params.append("message", formattedMessage);
        await fetch("https://notify-api.line.me/api/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${notifyToken}`,
          },
          body: params.toString(),
        });
      } catch (notifyErr) {
        console.error("[API/Return] LINE Notify error:", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `คืน '${equipmentName}' เรียบร้อยแล้ว ขอบคุณครับ!`,
      equipment_name: equipmentName,
      return_date: todayStr,
    });
  } catch (error: any) {
    console.error("[API/Return] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
