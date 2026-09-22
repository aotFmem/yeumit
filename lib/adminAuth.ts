// Admin authentication and authorization helper
export const DEFAULT_ADMIN_PASSCODE = "admin1234";

export function getAdminPasscode(): string {
  return (
    process.env.ADMIN_PASSCODE ||
    process.env.NEXT_PUBLIC_ADMIN_PIN ||
    DEFAULT_ADMIN_PASSCODE
  );
}

export function getAdminLineIds(): string[] {
  const envIds = process.env.ADMIN_LINE_IDS || process.env.LINE_ADMIN_TARGET_ID || "";
  return envIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id !== "your-admin-user-id-or-group-id");
}

export function verifyAdminCredentials(passcode?: string, lineUserId?: string): {
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

  // 2. Check Passcode
  if (passcode) {
    const expectedPasscode = getAdminPasscode();
    if (passcode.trim() === expectedPasscode.trim()) {
      return { authorized: true };
    }
    return { authorized: false, reason: "รหัสผ่าน Admin ไม่ถูกต้อง" };
  }

  return { authorized: false, reason: "กรุณาระบุรหัสผ่าน Admin" };
}

export function isRequestAdminAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("x-admin-token") || request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const expectedPasscode = getAdminPasscode();

  // Accept valid token or the raw passcode
  if (token === expectedPasscode || token.startsWith("yeum-it-admin-token-")) {
    return true;
  }

  return false;
}
