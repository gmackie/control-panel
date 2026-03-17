"use client";

import { ArrowUpRight, Clock3, Eye, GitCommitHorizontal, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BlockerCards } from "./BlockerCards";

interface ReleaseCandidateRowProps {
  candidate: {
    candidateId: string;
    applicationSlug: string;
    forgeGraphRevId: string;
    queueState: string;
    imageTag?: string | null;
    imageDigest?: string | null;
    promotionPrStatus?: string | null;
    desiredEnvironment?: string | null;
    blockers: Array<{
      reason: string;
      severity?: "hard" | "advisory" | string;
      message?: string;
      source?: string;
    }>;
  };
  isSelected?: boolean;
  onSelect?: () => void;
}

function getQueueBadgeVariant(queueState: string) {
  switch (queueState) {
    case "ready":
      return "success" as const;
    case "blocked":
    case "degraded":
      return "error" as const;
    case "releasing":
      return "warning" as const;
    case "awaiting_approval":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function ReleaseCandidateRow({
  candidate,
  isSelected = false,
  onSelect,
}: ReleaseCandidateRowProps) {
  return (
    <Card
      className={
        isSelected
          ? "border-cyan-500/60 bg-slate-950/90 text-white"
          : "border-gray-800 bg-gray-950/80 text-white"
      }
      data-testid="release-candidate-row"
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{candidate.applicationSlug}</p>
              <Badge variant={getQueueBadgeVariant(candidate.queueState)} className="capitalize">
                {candidate.queueState.replaceAll("_", " ")}
              </Badge>
              {candidate.promotionPrStatus ? (
                <Badge variant="outline" className="border-gray-700 text-gray-200">
                  PR {candidate.promotionPrStatus}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4 text-cyan-300" />
                <span className="font-mono">{candidate.forgeGraphRevId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-fuchsia-300" />
                <span className="font-mono text-xs">
                  {candidate.imageTag ?? candidate.imageDigest ?? "artifact pending"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-300" />
                <span>{candidate.desiredEnvironment ?? "production"} lane</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onSelect}>
              <Eye className="h-4 w-4" />
              Inspect Diff
            </Button>
            <Button>
              <ArrowUpRight className="h-4 w-4" />
              Open Promotion
            </Button>
          </div>
        </div>

        <BlockerCards blockers={candidate.blockers} />
      </CardContent>
    </Card>
  );
}
