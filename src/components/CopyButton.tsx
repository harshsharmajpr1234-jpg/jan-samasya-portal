"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable — text is selectable anyway */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:border-saffron"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-leaf" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}
