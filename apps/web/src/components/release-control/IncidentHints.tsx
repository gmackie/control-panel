"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IncidentHintsProps {
  candidate?: {
    queueState?: string | null;
    blockers?: Array<{ reason: string; source?: string; severity?: string }>;
    promotionPrStatus?: string | null;
  } | null;
  audit?: {
    evidence?: Array<{ source?: string | null; evidenceType?: string | null }>;
  } | null;
}

export function IncidentHints({ candidate, audit }: IncidentHintsProps) {
  const hints: string[] = [];

  if (candidate?.queueState === "degraded") {
    hints.push("Release is already marked degraded, which raises the probability that the current candidate is correlated with active impact.");
  }

  if (candidate?.blockers?.some((blocker) => blocker.reason === "active_critical_incident")) {
    hints.push("A critical incident signal is attached to this release path. Treat any promotion or rollback action as incident-linked.");
  }

  if (audit?.evidence?.some((entry) => entry.source === "prometheus")) {
    hints.push("Prometheus evidence exists for this candidate, so alert timing can be compared against rollout timing.");
  }

  if (candidate?.promotionPrStatus === "merged") {
    hints.push("The promotion PR is already merged, so any degradation likely reflects rollout or runtime behavior rather than approval drift.");
  }

  return (
    <Card className="border-gray-800 bg-gray-950 text-gray-100">
      <CardHeader>
        <CardTitle className="text-lg">Probable-Cause Hints</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hints.length > 0 ? (
          hints.map((hint, index) => (
            <div
              key={index}
              className="rounded-xl border border-fuchsia-900/40 bg-fuchsia-950/20 p-4"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-fuchsia-300">
                <Sparkles className="h-3.5 w-3.5" />
                Heuristic
              </div>
              <p className="mt-2 text-sm text-gray-100">{hint}</p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-800 p-4 text-sm text-gray-400">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              No strong hints
            </div>
            <p className="mt-2">
              No strong release-to-incident signal has been inferred yet. Use the audit trail and environment state for manual correlation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
