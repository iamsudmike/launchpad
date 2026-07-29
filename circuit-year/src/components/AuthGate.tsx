"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

const WEBAUTHN_KEY = "cy_webauthn_cred";
const UNLOCK_KEY = "cy_unlocked";

type Phase = "loading" | "unconfigured" | "signed_out" | "locked" | "ready";

export function webauthnEnrolled(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(WEBAUTHN_KEY);
}

export async function enrollWebauthn(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Circuit Year", id: location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "owner",
          displayName: "Owner",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    const rawId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(WEBAUTHN_KEY, rawId);
    return true;
  } catch {
    return false;
  }
}

export function disableWebauthn() {
  localStorage.removeItem(WEBAUTHN_KEY);
}

async function verifyWebauthn(): Promise<boolean> {
  const stored = localStorage.getItem(WEBAUTHN_KEY);
  if (!stored) return true;
  try {
    const rawId = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: rawId }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() =>
    supabaseConfigured() ? "loading" : "unconfigured",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = useCallback(async () => {
    if (await verifyWebauthn()) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setPhase("ready");
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setPhase("signed_out");
      } else if (webauthnEnrolled() && !sessionStorage.getItem(UNLOCK_KEY)) {
        setPhase("locked");
        void unlock();
      } else {
        setPhase("ready");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setPhase("signed_out");
    });
    return () => sub.subscription.unsubscribe();
  }, [unlock]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setPhase("ready");
    }
  }

  if (phase === "ready") return <>{children}</>;

  return (
    <main className="flex flex-1 min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-magenta glow-magenta">
          THE CIRCUIT YEAR
        </h1>
        <p className="font-mono text-xs text-dim mt-1 mb-8">
          PRIVATE PLANNING BOARD
        </p>

        {phase === "loading" && (
          <p className="font-mono text-xs text-dim pulse-soft">LOADING...</p>
        )}

        {phase === "unconfigured" && (
          <div className="card rounded-lg p-4 text-sm leading-relaxed">
            <p className="text-amber font-mono text-xs mb-2">SETUP NEEDED</p>
            <p>
              Set <code className="text-cyan">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and <code className="text-cyan">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
              then redeploy. See the README for full setup.
            </p>
          </div>
        )}

        {phase === "signed_out" && (
          <form onSubmit={signIn} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              className="card rounded-lg px-4 py-3 text-sm outline-none focus:border-cyan"
              autoComplete="username"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="card rounded-lg px-4 py-3 text-sm outline-none focus:border-cyan"
              autoComplete="current-password"
            />
            {error && (
              <p className="font-mono text-xs text-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-magenta text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
            >
              {busy ? "..." : "ENTER"}
            </button>
          </form>
        )}

        {phase === "locked" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-dim">Locked. Verify to continue.</p>
            <button
              onClick={unlock}
              className="rounded-lg bg-cyan text-bg font-mono text-sm font-bold py-3"
            >
              UNLOCK
            </button>
            <button
              onClick={async () => {
                await getSupabase().auth.signOut();
              }}
              className="font-mono text-xs text-dim underline"
            >
              sign out instead
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
