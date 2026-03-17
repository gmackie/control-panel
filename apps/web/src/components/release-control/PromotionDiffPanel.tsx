"use client";

import { ArrowRight, GitBranch, Package, ShieldCheck, Waypoints } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReleaseCandidateSummary {
  applicationSlug: string;
  forgeGraphRevId: string;
  imageTag?: string | null;
  imageDigest?: string | null;
  promotionPrStatus?: string | null;
  promotionPrNumber?: number | null;
  desiredEnvironment?: string | null;
}

interface PromotionDiffPanelProps {
  candidate?: ReleaseCandidateSummary | null;
}

export function PromotionDiffPanel({ candidate }: PromotionDiffPanelProps) {
  return (
    <Card className="border-gray-800 bg-gray-950 text-gray-100">
      <CardHeader>
        <CardTitle className="text-lg">Promotion Diff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {candidate ? (
          <>
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                <GitBranch className="h-3.5 w-3.5" />
                Candidate
              </div>
              <div className="mt-2 flex items-center gap-3 text-white">
                <span className="font-semibold">{candidate.applicationSlug}</span>
                <ArrowRight className="h-4 w-4 text-gray-600" />
                <span className="font-mono text-sm">{candidate.forgeGraphRevId}</span>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm text-gray-300">Artifact</span>
                </div>
                <span className="font-mono text-xs text-white">
                  {candidate.imageDigest ?? candidate.imageTag ?? "Artifact not linked"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Waypoints className="h-4 w-4 text-fuchsia-300" />
                  <span className="text-sm text-gray-300">Target</span>
                </div>
                <Badge variant="outline" className="border-gray-700 text-gray-100">
                  {candidate.desiredEnvironment ?? "production"}
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-gray-300">Promotion PR</span>
                </div>
                <span className="text-sm text-white">
                  {candidate.promotionPrNumber
                    ? `#${candidate.promotionPrNumber} · ${candidate.promotionPrStatus ?? "open"}`
                    : candidate.promotionPrStatus ?? "Not opened"}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-800 p-6 text-sm text-gray-400">
            Select a candidate to inspect the exact revision, artifact, and GitOps promotion target.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
