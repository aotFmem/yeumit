import { NextResponse } from "next/server";
import { verifyAdminCredentials, getAdminPasscode } from "@/lib/adminAuth";
import { AdminAuthVerifyRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminAuthVerifyRequest;
    const { passcode, line_user_id } = body;

    const verification = verifyAdminCredentials(passcode, line_user_id);

    if (!verification.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: verification.reason || "การตรวจสอบสิทธิ์ไม่ถูกต้อง",
        },
        { status: 401 }
      );
    }

    // Generate session token
    const token = `yeum-it-admin-token-${Buffer.from(getAdminPasscode()).toString("base64")}`;

    return NextResponse.json({
      success: true,
      message: "ยืนยันสิทธิ์ผู้ดูแลระบบสำเร็จ",
      token,
      is_admin: true,
    });
  } catch (error: any) {
    console.error("[API/Admin/Verify] Error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์" },
      { status: 500 }
    );
  }
}
