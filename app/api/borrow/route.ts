import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BorrowRequestPayload } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BorrowRequestPayload;
    const {
      line_user_id,
      display_name,
      department,
      equipment_id,
      borrow_date,
      time_slot,
      purpose,
      internal_phone,
    } = body;

    // Validate incoming payload
    if (!line_user_id || !display_name || !department || !equipment_id || !borrow_date) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: line_user_id, display_name, department, equipment_id, borrow_date",
        },
        { status: 400 }
      );
    }

    let equipmentName = "IT Equipment";
    let transactionId = "";

    // Attempt atomic borrowing via PostgreSQL function first
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("borrow_equipment_atomic", {
      p_line_user_id: line_user_id,
      p_display_name: display_name,
      p_department: department,
      p_equipment_id: equipment_id,
      p_borrow_date: borrow_date,
    });

    if (rpcError) {
      // If RPC doesn't exist or failed with specific error, handle gracefully
      if (rpcError.message.includes("Equipment is out of stock")) {
        return NextResponse.json(
          { success: false, error: "The selected equipment is currently out of stock." },
          { status: 400 }
        );
      }

      // Fallback to standard Supabase Service Role query & updates
      console.warn(
        "[API/Borrow] Atomic RPC failed or not installed. Falling back to direct service_role queries:",
        rpcError.message
      );

      // 1. Fetch equipment and verify stock
      const { data: equipment, error: fetchErr } = await supabaseAdmin
        .from("equipments")
        .select("id, name, available_stock")
        .eq("id", equipment_id)
        .single();

      if (fetchErr || !equipment) {
        return NextResponse.json(
          { success: false, error: "Equipment not found or could not be verified." },
          { status: 404 }
        );
      }

      if (equipment.available_stock <= 0) {
        return NextResponse.json(
          { success: false, error: `Sorry, '${equipment.name}' is currently out of stock.` },
          { status: 400 }
        );
      }

      equipmentName = equipment.name;

      // 2. Decrement available stock using service_role
      const { error: updateErr } = await supabaseAdmin
        .from("equipments")
        .update({ available_stock: equipment.available_stock - 1 })
        .eq("id", equipment_id);

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: `Failed to update equipment inventory: ${updateErr.message}` },
          { status: 500 }
        );
      }

      // 3. Insert transaction record using service_role
      const insertRecord: any = {
        line_user_id,
        display_name,
        department,
        equipment_id,
        borrow_date,
        status: "borrowed",
      };
      if (time_slot) insertRecord.time_slot = time_slot;
      if (purpose) insertRecord.purpose = purpose;
      if (internal_phone) insertRecord.internal_phone = internal_phone;

      let { data: txData, error: insertErr } = await supabaseAdmin
        .from("transactions")
        .insert(insertRecord)
        .select("id")
        .single();

      // If columns are not in DB schema yet, retry with base fields
      if (insertErr && (insertErr.message.includes("column") || insertErr.code === "42703")) {
        const deptWithMeta = [
          department,
          internal_phone ? `(โทร: ${internal_phone})` : "",
          time_slot ? `[${time_slot}]` : "",
        ]
          .filter(Boolean)
          .join(" ");

        const fallbackRes = await supabaseAdmin
          .from("transactions")
          .insert({
            line_user_id,
            display_name,
            department: deptWithMeta,
            equipment_id,
            borrow_date,
            status: "borrowed",
          })
          .select("id")
          .single();
        txData = fallbackRes.data;
        insertErr = fallbackRes.error;
      }

      if (insertErr) {
        // Rollback stock decrement if transaction insert fails
        await supabaseAdmin
          .from("equipments")
          .update({ available_stock: equipment.available_stock })
          .eq("id", equipment_id);

        return NextResponse.json(
          { success: false, error: `Failed to record transaction: ${insertErr.message}` },
          { status: 500 }
        );
      }

      transactionId = txData?.id || "";
    } else {
      transactionId = rpcData?.transaction_id || "";
      equipmentName = rpcData?.equipment_name || "IT Equipment";
    }

    // 4. Send Notification (Supports modern LINE Messaging API & legacy LINE Notify)
    let notifySuccess = false;
    const messagingToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetUserId = process.env.LINE_ADMIN_TARGET_ID || line_user_id; // Send to Admin ID/Group ID or to borrower directly
    const notifyToken = process.env.LINE_NOTIFY_TOKEN;

    const timeSlotText = time_slot || "เต็มวัน (08:30 - 16:30 น.)";
    const purposeText = purpose || "ใช้งานทั่วไปในโรงพยาบาล";
    const phoneText = internal_phone ? ` (เบอร์ต่อ: ${internal_phone})` : "";

    const formattedMessage = `🔔 มีรายการขอยืมอุปกรณ์ IT ใหม่!\nผู้ยืม: ${display_name}\nแผนก: ${department}${phoneText}\nอุปกรณ์: ${equipmentName}\nวันที่: ${borrowDateFormatted(borrow_date)}\nช่วงเวลา: ${timeSlotText}\nวัตถุประสงค์: ${purposeText}`;

    // A. Priority: Modern LINE Messaging API (LINE Official Account / Bot)
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
            messages: [
              {
                type: "text",
                text: formattedMessage,
              },
            ],
          }),
        });

        if (lineApiRes.ok) {
          notifySuccess = true;
          console.info("[API/Borrow] LINE Messaging API push sent successfully to:", targetUserId);
        } else {
          const errText = await lineApiRes.text();
          console.warn("[API/Borrow] LINE Messaging API returned non-OK status:", lineApiRes.status, errText);
        }
      } catch (lineErr) {
        console.error("[API/Borrow] LINE Messaging API dispatch error:", lineErr);
      }
    }
    // B. Fallback: Legacy LINE Notify (Discontinued after March 31, 2025)
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
          console.info("[API/Borrow] LINE Notify dispatched successfully.");
        } else {
          const errText = await notifyRes.text();
          console.warn("[API/Borrow] LINE Notify returned non-OK status:", notifyRes.status, errText);
        }
      } catch (notifyErr) {
        console.error("[API/Borrow] LINE Notify dispatch failed:", notifyErr);
      }
    } else {
      console.info(
        "[API/Borrow] Neither LINE_CHANNEL_ACCESS_TOKEN nor LINE_NOTIFY_TOKEN is configured. Skipped sending notification."
      );
    }

    return NextResponse.json({
      success: true,
      message: "IT Equipment borrow request confirmed!",
      transaction: {
        id: transactionId,
        equipment_name: equipmentName,
        borrow_date,
      },
      notifySent: notifySuccess,
    });
  } catch (error: any) {
    console.error("[API/Borrow] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error occurred." },
      { status: 500 }
    );
  }
}

function borrowDateFormatted(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
