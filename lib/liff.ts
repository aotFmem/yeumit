import liff from "@line/liff";
import { UserProfile } from "./types";

export interface LiffInitResult {
  isMock: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  profile: UserProfile;
  error?: string;
}

const MOCK_PROFILE: UserProfile = {
  userId: "U_MOCK_DEV_001",
  displayName: "Somchai Developer (Dev Mock)",
  pictureUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  statusMessage: "Developing IT Borrowing System locally",
};

/**
 * Initialize LIFF SDK safely.
 * Detects local/non-HTTPS environments or unconfigured LIFF IDs and falls back to mock user profile.
 */
export async function initializeLiff(liffId?: string): Promise<LiffInitResult> {
  const activeLiffId = liffId || process.env.NEXT_PUBLIC_LIFF_ID;

  // Check if we are running in a local / non-HTTPS environment
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "http:");

  if (!activeLiffId || activeLiffId === "your-liff-id-here" || activeLiffId.trim() === "") {
    console.info(
      "[LIFF] NEXT_PUBLIC_LIFF_ID is not configured. Falling back to Mock LIFF Mode for local development."
    );
    return {
      isMock: true,
      isLoggedIn: true,
      isInClient: false,
      profile: MOCK_PROFILE,
    };
  }

  try {
    await liff.init({ liffId: activeLiffId });

    if (!liff.isLoggedIn()) {
      if (isLocalHost) {
        console.warn(
          "[LIFF] Running on localhost and not logged in. Using Mock LIFF fallback to avoid redirect loop."
        );
        return {
          isMock: true,
          isLoggedIn: true,
          isInClient: false,
          profile: MOCK_PROFILE,
        };
      } else {
        liff.login();
        return {
          isMock: false,
          isLoggedIn: false,
          isInClient: liff.isInClient(),
          profile: MOCK_PROFILE,
        };
      }
    }

    const realProfile = await liff.getProfile();
    return {
      isMock: false,
      isLoggedIn: true,
      isInClient: liff.isInClient(),
      profile: {
        userId: realProfile.userId,
        displayName: realProfile.displayName,
        pictureUrl: realProfile.pictureUrl,
        statusMessage: realProfile.statusMessage,
      },
    };
  } catch (err: any) {
    console.warn(
      "[LIFF] Failed to initialize official LINE LIFF SDK (likely local development or non-registered origin). Falling back to Mock LIFF mode:",
      err?.message || err
    );
    return {
      isMock: true,
      isLoggedIn: true,
      isInClient: false,
      profile: MOCK_PROFILE,
      error: err?.message || String(err),
    };
  }
}

/**
 * Closes the LIFF window if running inside LINE app,
 * or provides a graceful fallback in standard web browsers.
 */
export function closeLiff(): void {
  try {
    if (typeof window !== "undefined" && liff.isInClient()) {
      liff.closeWindow();
    } else {
      console.info("[LIFF] liff.closeWindow() called in standard browser environment.");
      window.close();
    }
  } catch (e) {
    console.warn("[LIFF] Error while attempting to close window:", e);
  }
}
