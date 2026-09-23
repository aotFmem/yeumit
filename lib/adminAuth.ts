import crypto from "crypto";

// Default admin passcode fallback (Warns in production if not set)
export const DEFAULT_ADMIN_PASSCODE = "admin1234";

export function getAdminPasscode(): string {
  const passcode =
    process.env.ADMIN_PASSCODE ||
    process.env.NEXT_PUBLIC_ADMIN_PIN ||
    DEFAULT_ADMIN_PASSCODE;

  if (process.env.NODE_ENV === "production" && passcode === DEFAULT_ADMIN_PASSCODE) {
    console.warn(
      "⚠️ [SECURITY WARNING] Using default ADMIN_PASSCODE in production! Please set ADMIN_PASSCODE in your environment variables."
    );
  }
  return passcode;
}

export function getAdminSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "yeum-it-hospital-secret-salt-2026"
  );
}

export function getAdminLineIds(): string[] {
  const envIds = process.env.ADMIN_LINE_IDS || process.env.LINE_ADMIN_TARGET_ID || "";
  return envIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id !== "your-admin-user-id-or-group-id");
}

/**
 * Generate a cryptographically signed Admin Session Token
 */
export function generateAdminToken(): string {
  const passcode = getAdminPasscode();
  const secret = getAdminSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`yeum-it-admin:${passcode}`)
    .digest("hex");

  return `yeum-it-token.${signature}`;
}

/**
 * Verify Admin Passcode or Line User ID credentials
 */
export function verifyAdminCredentials(
  passcode?: string,
  lineUserId?: string
): {
  authorized: boolean;
  reason?: string;
} {
  // 1. Check LINE User ID if provided
  if (lineUserId) {
    const adminIds = getAdminLineIds();
    if (adminIds.length > 0 && adminIds.includes(lineUserId)) {
      return { authorized: true };
    }
  }

  // 2. Check Passcode using constant-time comparison
  if (passcode) {
    const expectedPasscode = getAdminPasscode();
    const cleanPasscode = passcode.trim();
    const cleanExpected = expectedPasscode.trim();

    const passBuffer = Buffer.from(cleanPasscode);
    const expectedBuffer = Buffer.from(cleanExpected);

    if (
      passBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(passBuffer, expectedBuffer)
    ) {
      return { authorized: true };
    }
    return { authorized: false, reason: "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง" };
  }

  return { authorized: false, reason: "กรุณาระบุรหัสผ่านผู้ดูแลระบบ" };
}

/**
 * Strictly verify that an incoming Request is from an authorized Admin.
 * Checks Bearer header or x-admin-token against cryptographically signed token or passcode.
 */
export function isRequestAdminAuthorized(request: Request): boolean {
  const authHeader =
    request.headers.get("x-admin-token") || request.headers.get("authorization");
  if (!authHeader) return false;

  const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!rawToken) return false;

  const expectedToken = generateAdminToken();
  const expectedPasscode = getAdminPasscode().trim();

  // Verify signed token using constant-time comparison
  const rawTokenBuffer = Buffer.from(rawToken);
  const expectedTokenBuffer = Buffer.from(expectedToken);

  if (
    rawTokenBuffer.length === expectedTokenBuffer.length &&
    crypto.timingSafeEqual(rawTokenBuffer, expectedTokenBuffer)
  ) {
    return true;
  }

  // Also accept exact raw passcode (for direct API scripts or curl)
  const passcodeBuffer = Buffer.from(expectedPasscode);
  if (
    rawTokenBuffer.length === passcodeBuffer.length &&
    crypto.timingSafeEqual(rawTokenBuffer, passcodeBuffer)
  ) {
    return true;
  }

  return false;
}
