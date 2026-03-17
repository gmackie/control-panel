"use client";

import { useEffect, useState } from "react";
import { GitPullRequestArrow, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { IncidentHints } from "@/components/release-control/IncidentHints";
import { PromotionDiffPanel } from "@/components/release-control/PromotionDiffPanel";
import { ReleaseAuditTrail } from "@/components/release-control/ReleaseAuditTrail";
import { ReleaseQueue } from "@/components/release-control/ReleaseQueue";
import { RollbackAssistant } from "@/components/release-control/RollbackAssistant";
import { TrustBanner } from "@/components/release-control/TrustBanner";

export default function DeploymentsPage() {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );

  const releaseQueue = trpc.releaseQueue.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const sourceTrust = trpc.sourceTrust.summary.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const releaseAudit = trpc.releaseAudit.candidate.useQuery(selectedCandidateId ?? "", {
    enabled: Boolean(selectedCandidateId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const firstCandidate = releaseQueue.data?.[0];
    if (firstCandidate && !selectedCandidateId) {
      setSelectedCandidateId(firstCandidate.candidateId);
    }
  }, [releaseQueue.data, selectedCandidateId]);

  const selectedCandidate =
    releaseQueue.data?.find(
      (candidate) => candidate.candidateId === selectedCandidateId,
    ) ?? releaseQueue.data?.[0] ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.12),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,15,28,1))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
        <section className="rounded-[28px] border border-white/10 bg-black/20 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Release Control Room
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-white">
                  Release Queue
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Review candidate readiness, source trust, blockers, and the exact
                  GitOps promotion payload for supported staging and production
                  releases.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void Promise.all([
                    releaseQueue.refetch(),
                    sourceTrust.refetch(),
                  ]);
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 ${releaseQueue.isFetching || sourceTrust.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button>
                <GitPullRequestArrow className="h-4 w-4" />
                Open Promotion PR
              </Button>
            </div>
          </div>
        </section>

        <TrustBanner trust={sourceTrust.data} isLoading={sourceTrust.isLoading} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            <ReleaseQueue
              candidates={releaseQueue.data ?? []}
              isLoading={releaseQueue.isLoading}
              isError={Boolean(releaseQueue.error)}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={(candidate) =>
                setSelectedCandidateId(candidate.candidateId)
              }
            />
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-4">
              <PromotionDiffPanel candidate={selectedCandidate} />
              <IncidentHints candidate={selectedCandidate} audit={releaseAudit.data} />
              <ReleaseAuditTrail audit={releaseAudit.data} />
              <RollbackAssistant
                currentCandidate={selectedCandidate}
                candidates={(releaseQueue.data ?? []).map((candidate) => ({
                  candidateId: candidate.candidateId,
                  applicationSlug: candidate.applicationSlug,
                  forgeGraphRevId: candidate.forgeGraphRevId,
                  knownGoodStatus: candidate.knownGoodStatus ?? null,
                  createdAt: candidate.createdAt ? new Date(candidate.createdAt) : null,
                }))}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
