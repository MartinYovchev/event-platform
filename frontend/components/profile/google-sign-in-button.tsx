"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { googleAuthAction } from "@/lib/actions/auth";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleSignInButton({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleCredential = useCallback(
    (idToken: string) => {
      setError(null);
      startTransition(async () => {
        const result = await googleAuthAction(idToken);

        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.push(next);
        router.refresh();
      });
    },
    [router, next],
  );

  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !buttonRef.current) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (res) => handleCredential(res.credential),
    });
    google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
    });
  }, [scriptReady, handleCredential]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => setScriptReady(true)}
      />
      <div ref={buttonRef} className="flex justify-center" />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
