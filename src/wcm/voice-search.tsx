import { useEffect, useRef, useState } from "react";

// Voice input for the header search, using the browser's Web Speech API. Chrome and
// Safari ship it (the audio is processed by the browser vendor's speech service, not
// by us); where it is missing, e.g. Firefox, the button simply doesn't render.

type SpeechResult = { transcript: string };
type SpeechResultList = { length: number; [i: number]: { 0: SpeechResult; isFinal: boolean } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "Microphone access is blocked. Allow it in your browser settings to search by voice.",
  "service-not-allowed":
    "Microphone access is blocked. Allow it in your browser settings to search by voice.",
  "no-speech": "Didn't catch that. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice search needs an internet connection.",
};

export function VoiceSearchButton({
  onTranscript,
  onFinal,
  onMessage,
  onStart,
  onError,
  style,
}: {
  /** Live text while the shopper is still speaking. */
  onTranscript: (text: string) => void;
  /** The finished phrase. */
  onFinal: (text: string) => void;
  onMessage: (message: string) => void;
  /** The mic started listening. */
  onStart?: () => void;
  /** Recognition failed; `code` is the browser's error name (e.g. "not-allowed"). */
  onError?: (code: string) => void;
  style?: React.CSSProperties;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-PK";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      text = text.trim();
      onTranscript(text);
      if (e.results[e.results.length - 1]?.isFinal) finalText = text;
    };
    rec.onerror = (e) => {
      const message = ERROR_MESSAGES[e.error];
      if (message) onMessage(message);
      if (e.error !== "aborted") onError?.(e.error);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalText) onFinal(finalText);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      onStart?.();
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      // Keep focus in the search box so tapping the mic doesn't close the suggestion list early.
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggle}
      aria-label={listening ? "Stop voice search" : "Search by voice"}
      aria-pressed={listening}
      title={listening ? "Listening… tap to stop" : "Search by voice"}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        background: listening ? "var(--pill-rose-bg)" : "transparent",
        color: listening ? "var(--pill-rose-fg)" : "var(--ink-3)",
        animation: listening ? "wcmPulse 1.2s ease-in-out infinite" : undefined,
        ...style,
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    </button>
  );
}
