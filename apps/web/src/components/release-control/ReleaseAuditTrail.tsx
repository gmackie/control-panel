"use client";

import { FileClock, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuditEntry {
  id?: string;
  source?: string | null;
  evidenceType?: string | null;
  payload?: string | null;
  observedAt?: string | Date | null;
  createdAt?: string | Date | null;
  blockerReason?: string | null;
  justification?: string | null;
  approvedBy?: string | null;
  ticketUrl?: string | null;
}

interface ReleaseAuditTrailProps {
  audit?: {
    evidence?: AuditEntry[];
    overrides?: AuditEntry[];
  } | null;
}

function formatTimestamp(value?: string | Date | null) {
  if (!value) {
    return "Unknown time";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

export function ReleaseAuditTrail({ audit }: ReleaseAuditTrailProps) {
  const evidence = audit?.evidence ?? [];
  const overrides = audit?.overrides ?? [];

  return (
    <Card className="border-gray-800 bg-gray-950 text-gray-100">
      <CardHeader>
        <CardTitle className="text-lg">Release Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.length === 0 && overrides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 p-4 text-sm text-gray-400">
            No approval snapshots or override records have been attached yet.
          </div>
        ) : null}

        {evidence.slice(0, 4).map((entry, index) => (
          <div
            key={entry.id ?? `${entry.evidenceType}-${index}`}
            className="rounded-xl border border-gray-800 bg-black/20 p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <FileClock className="h-3.5 w-3.5" />
              {entry.evidenceType ?? "audit event"}
            </div>
            <p className="mt-2 text-sm text-white">{entry.source ?? "release-control"}</p>
            <p className="mt-1 text-xs text-gray-400">
              Captured {formatTimestamp(entry.observedAt ?? entry.createdAt)}
            </p>
          </div>
        ))}

        {overrides.slice(0, 2).map((override, index) => (
          <div
            key={override.id ?? `${override.blockerReason}-${index}`}
            className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Override
            </div>
            <p className="mt-2 text-sm text-white">
              {override.blockerReason ?? "Manual override"}
            </p>
            {override.justification ? (
              <p className="mt-1 text-xs text-gray-300">{override.justification}</p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              {override.approvedBy ?? "Unknown operator"} · {formatTimestamp(override.createdAt)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
