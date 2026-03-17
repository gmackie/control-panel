"use client";

import { startTransition, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Rocket, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReleaseCandidateRow } from "./ReleaseCandidateRow";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "blocked", label: "Blocked" },
  { key: "releasing", label: "Releasing" },
  { key: "awaiting_approval", label: "Awaiting Approval" },
] as const;

interface QueueCandidate {
  candidateId: string;
  applicationSlug: string;
  forgeGraphRevId: string;
  queueState: string;
  imageTag?: string | null;
  imageDigest?: string | null;
  promotionPrStatus?: string | null;
  promotionPrNumber?: number | null;
  desiredEnvironment?: string | null;
  blockers: Array<{
    reason: string;
    severity?: "hard" | "advisory" | string;
    message?: string;
    source?: string;
  }>;
}

interface ReleaseQueueProps {
  candidates?: QueueCandidate[];
  isLoading?: boolean;
  isError?: boolean;
  onSelectCandidate?: (candidate: QueueCandidate) => void;
  selectedCandidateId?: string | null;
}

export function ReleaseQueue({
  candidates = [],
  isLoading = false,
  isError = false,
  onSelectCandidate,
  selectedCandidateId,
}: ReleaseQueueProps) {
  const [activeFilter, setActiveFilter] =
    useState<(typeof FILTERS)[number]["key"]>("all");

  const filteredCandidates = candidates.filter((candidate) =>
    activeFilter === "all" ? true : candidate.queueState === activeFilter,
  );

  useEffect(() => {
    if (filteredCandidates.length > 0 && !selectedCandidateId) {
      onSelectCandidate?.(filteredCandidates[0]!);
    }
  }, [filteredCandidates, onSelectCandidate, selectedCandidateId]);

  if (isLoading) {
    return (
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardContent className="flex items-center gap-3 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          <p>Loading release candidates…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-900/60 bg-red-950/30 text-white">
        <CardContent className="flex items-center gap-3 p-6">
          <ShieldX className="h-5 w-5 text-red-300" />
          <p>Release queue data could not be loaded. Retry once source trust recovers.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => {
              startTransition(() => setActiveFilter(filter.key));
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredCandidates.length > 0 ? (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => (
            <ReleaseCandidateRow
              key={candidate.candidateId}
              candidate={candidate}
              isSelected={selectedCandidateId === candidate.candidateId}
              onSelect={() => onSelectCandidate?.(candidate)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardContent className="space-y-3 p-8 text-center">
            <Rocket className="mx-auto h-8 w-8 text-cyan-300" />
            <h3 className="text-lg font-semibold">No candidates in this lane</h3>
            <p className="text-sm text-gray-400">
              The selected filter does not currently have release candidates to review.
            </p>
            <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocked
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
