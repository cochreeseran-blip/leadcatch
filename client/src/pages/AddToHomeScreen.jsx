import { useState, useEffect } from "react";

// ============================================================================
// KnockTrakr — "Add to Home Screen" onboarding screen
// Drops in right after a rep sets their password.
// Auto-detects iPhone vs Android and shows the right steps.
// ----------------------------------------------------------------------------
// To wire into your app: render <AddToHomeScreen repName="Mike" onSkip={...} />
// after the set-password step succeeds.
// ============================================================================

const NAVY = "#0A2540";
const RED = "#C8102E";
const BLUE = "#1B4F8C";

function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    // iPad on iOS 13+ reports as Mac, so check touch
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

// Already installed? (running in standalone mode)
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator?.standalone === true
  );
}

export default function AddToHomeScreen({ repName = "", onSkip = () => {} }) {
  const [platform, setPlatform] = useState("other");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [androidInstalling, setAndroidInstalling] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    // Android/Chrome: capture the native install prompt so we can fire it on a button tap
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    setAndroidInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
    setAndroidInstalling(false);
  }

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        {/* Brand bar */}
        <div style={styles.brandRow}>
          <span style={styles.knock}>KNOCK</span>
          <span style={styles.trakr}>TRAKR</span>
        </div>
        <div style={styles.redRule} />

        {installed ? (
          <Done repName={repName} onDone={onSkip} />
        ) : (
          <>
            <div style={styles.checkCircle}>
              <CheckIcon />
            </div>
            <h1 style={styles.h1}>
              {repName ? `You're in, ${repName}.` : "You're in."}
            </h1>
            <p style={styles.sub}>
              One quick step so KnockTrakr lives on your phone like a normal app —
              no browser, no hunting for a link.
            </p>

            {platform === "ios" && <IosSteps />}
            {platform === "android" && (
              <AndroidSteps
                canPrompt={!!deferredPrompt}
                installing={androidInstalling}
                onInstall={handleAndroidInstall}
              />
            )}
            {platform === "other" && <DesktopNote />}

            <button style={styles.skip} onClick={onSkip}>
              I'll do this later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function IosSteps() {
  return (
    <div style={styles.stepsWrap}>
      <Step
        n={1}
        text={
          <>
            Tap the <Share /> <b>Share</b> button at the bottom of Safari.
          </>
        }
      />
      <Step
        n={2}
        text={
          <>
            Scroll down and tap <b>Add to Home Screen</b>.
          </>
        }
      />
      <Step
        n={3}
        text={
          <>
            Tap <b>Add</b> in the top corner. That's it — look for the icon on
            your home screen.
          </>
        }
        last
      />
      <div style={styles.tip}>
        Don't see the Share button? Make sure you opened this in <b>Safari</b>,
        not another app's browser.
      </div>
    </div>
  );
}

function AndroidSteps({ canPrompt, installing, onInstall }) {
  if (canPrompt) {
    return (
      <div style={styles.stepsWrap}>
        <button
          style={{ ...styles.installBtn, opacity: installing ? 0.7 : 1 }}
          onClick={onInstall}
          disabled={installing}
        >
          {installing ? "Installing…" : "Add KnockTrakr to my phone"}
        </button>
        <div style={styles.tip}>
          Tap the button, then tap <b>Install</b> when your phone asks.
        </div>
      </div>
    );
  }
  // Fallback manual steps if the native prompt isn't available
  return (
    <div style={styles.stepsWrap}>
      <Step
        n={1}
        text={
          <>
            Tap the <b>⋮</b> menu in the top-right of Chrome.
          </>
        }
      />
      <Step
        n={2}
        text={
          <>
            Tap <b>Add to Home screen</b> (or <b>Install app</b>).
          </>
        }
      />
      <Step
        n={3}
        text={
          <>
            Tap <b>Add</b>. The icon drops onto your home screen.
          </>
        }
        last
      />
    </div>
  );
}

function DesktopNote() {
  return (
    <div style={styles.stepsWrap}>
      <div style={styles.tip}>
        You're on a computer right now. To put KnockTrakr on your phone, open
        this same link <b>on your phone</b> and you'll see the steps to add it to
        your home screen.
      </div>
    </div>
  );
}

function Done({ repName, onDone }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={styles.checkCircle}>
        <CheckIcon />
      </div>
      <h1 style={styles.h1}>You're all set{repName ? `, ${repName}` : ""}.</h1>
      <p style={styles.sub}>
        KnockTrakr is on your phone. Open it from your home screen any time you
        head out to knock.
      </p>
      <button style={styles.installBtn} onClick={onDone}>
        Start knocking
      </button>
    </div>
  );
}

function Step({ n, text, last }) {
  return (
    <div style={{ ...styles.step, marginBottom: last ? 0 : 14 }}>
      <div style={styles.stepNum}>{n}</div>
      <div style={styles.stepText}>{text}</div>
    </div>
  );
}

function Share() {
  return (
    <span style={styles.inlineIcon} aria-label="share icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "-3px" }}>
        <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const styles = {
  screen: {
    minHeight: "100vh",
    width: "100%",
    background: `linear-gradient(160deg, ${NAVY} 0%, #061829 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#fff",
    borderRadius: 20,
    padding: "28px 24px 22px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    boxSizing: "border-box",
  },
  brandRow: { display: "flex", justifyContent: "center", alignItems: "baseline" },
  knock: { fontWeight: 800, fontSize: 26, letterSpacing: "-0.5px", color: NAVY },
  trakr: { fontWeight: 800, fontSize: 26, letterSpacing: "-0.5px", color: RED },
  redRule: {
    height: 4,
    width: 54,
    background: RED,
    borderRadius: 4,
    margin: "12px auto 22px",
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${BLUE}, ${NAVY})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: `0 8px 20px rgba(27,79,140,0.4)`,
  },
  h1: {
    fontSize: 23,
    fontWeight: 800,
    color: NAVY,
    textAlign: "center",
    margin: "0 0 8px",
    letterSpacing: "-0.3px",
  },
  sub: {
    fontSize: 15.5,
    lineHeight: 1.5,
    color: "#4A5A6A",
    textAlign: "center",
    margin: "0 auto 22px",
    maxWidth: 360,
  },
  stepsWrap: { marginBottom: 18 },
  step: { display: "flex", alignItems: "flex-start", gap: 12 },
  stepNum: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: NAVY,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepText: { fontSize: 16, lineHeight: 1.45, color: "#1F2D3A", paddingTop: 3 },
  inlineIcon: {
    display: "inline-flex",
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "#EAF1F8",
    alignItems: "center",
    justifyContent: "center",
    verticalAlign: "-7px",
    margin: "0 2px",
  },
  tip: {
    marginTop: 16,
    background: "#F4F7FA",
    border: "1px solid #E1E9F0",
    borderRadius: 10,
    padding: "11px 13px",
    fontSize: 13.5,
    lineHeight: 1.45,
    color: "#4A5A6A",
  },
  installBtn: {
    width: "100%",
    background: RED,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "16px 18px",
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(200,16,46,0.32)",
    marginTop: 4,
  },
  skip: {
    width: "100%",
    background: "transparent",
    color: "#8295A6",
    border: "none",
    padding: "14px 0 4px",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 10,
  },
};
