"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BlockerCard {
  reason: string;
  severity?: "hard" | "advisory" | string;
  message?: string;
  source?: string;
}

interface BlockerCardsProps {
  blockers: BlockerCard[];
}

export function BlockerCards({ blockers }: BlockerCardsProps) {
  if (blockers.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {blockers.map((blocker, index) => {
        const isHard = blocker.severity === "hard";

        return (
          <Card
            key={`${blocker.reason}-${index}`}
            className={
              isHard
                ? "border-red-900/60 bg-red-950/40"
                : "border-amber-900/60 bg-amber-950/30"
            }
          >
            <CardContent className="flex gap-3 p-4">
              {isHard ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-red-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  {blocker.reason.replaceAll("_", " ")}
                </p>
                {blocker.message ? (
                  <p className="text-xs text-gray-300">{blocker.message}</p>
                ) : null}
                {blocker.source ? (
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    Source: {blocker.source}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
