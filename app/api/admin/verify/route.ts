import { NextResponse } from "next/server";
import { verifyAdminCredentials, generateAdminToken } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";
import { AdminAuthVerifyRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);

    // 1. ตรวจสอบ Rate Limit ป้องกันการสุ่มรหัสผ่าน (Brute-Force Protection)
    const rateLimit = checkRateLimit(`admin-verify:${clientIp}`, {
      limit: 6,
      windowMs: 5 * 60 * 1000, // 6 attempts per 5 minutes
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `คุณพยายามเข้าสู่ระบบมากเกินไป กรุณารอ ${rateLimit.retryAfterSeconds} วินาทีก่อนลองใหม่อีกครั้ง`,
        },
        { status: 429 }
      );
    }

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

    // 2. สร้าง Token เข้ารหัส HMAC ปลอดภัย
    const token = generateAdminToken();

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
