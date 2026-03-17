"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildRollbackPlan,
  suggestRollbackTarget,
  type RollbackCandidateRecord,
} from "@/lib/release-control/rollback-service";

interface RollbackAssistantProps {
  currentCandidate?: {
    candidateId: string;
    applicationSlug: string;
    forgeGraphRevId: string;
    desiredEnvironment?: string | null;
  } | null;
  candidates: RollbackCandidateRecord[];
}

export function RollbackAssistant({
  currentCandidate,
  candidates,
}: RollbackAssistantProps) {
  const [confirmed, setConfirmed] = useState(false);
  const suggestion = useMemo(() => suggestRollbackTarget(candidates), [candidates]);

  const rollbackPlan =
    currentCandidate && suggestion && confirmed
      ? buildRollbackPlan({
          applicationSlug: currentCandidate.applicationSlug,
          environment: currentCandidate.desiredEnvironment ?? "production",
          currentCandidateId: currentCandidate.candidateId,
          targetCandidateId: suggestion.candidateId,
          targetForgeGraphRevId: suggestion.forgeGraphRevId,
          confirmed: true,
        })
      : null;

  return (
    <Card className="border-gray-800 bg-gray-950 text-gray-100">
      <CardHeader>
        <CardTitle className="text-lg">Rollback Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestion ? (
          <>
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                <RotateCcw className="h-3.5 w-3.5" />
                Suggested Target
              </div>
              <p className="mt-2 font-mono text-sm text-white">
                {suggestion.forgeGraphRevId}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Suggested because it is the latest known-good release candidate.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-gray-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I confirm that this rollback target is correct and should be used to generate a rollback PR.
              </span>
            </label>

            {rollbackPlan ? (
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                  Rollback Plan
                </p>
                <p className="mt-2 text-sm text-white">{rollbackPlan.title}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">
                  {rollbackPlan.branch}
                </p>
              </div>
            ) : null}

            <Button disabled={!confirmed || !currentCandidate}>
              <RotateCcw className="h-4 w-4" />
              Generate Rollback PR
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-800 p-4 text-sm text-gray-400">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              No known-good target
            </div>
            <p className="mt-2">
              The control room cannot suggest a rollback target until a release becomes known-good or is manually pinned.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
