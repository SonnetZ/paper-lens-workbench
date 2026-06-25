import type { PayloadScope } from "@/lib/types";

export function PayloadScopeBanner({ scope }: { scope: PayloadScope }) {
  return (
    <div className="border-l-2 border-swiss-rule bg-swiss-wash px-3 py-2 font-mono text-xs text-swiss-muted">
      Payload scope: {scope}
    </div>
  );
}
