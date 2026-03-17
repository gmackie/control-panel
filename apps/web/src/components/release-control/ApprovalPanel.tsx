"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ApprovalPanelProps {
  candidateLabel: string;
  approvalCount: number;
  requiredApproverCount: number;
  canApprove?: boolean;
  canRequestSecondApproval?: boolean;
  isSubmitting?: boolean;
  onApprove?: () => void;
  onRequestSecondApproval?: () => void;
}

export function ApprovalPanel({
  candidateLabel,
  approvalCount,
  requiredApproverCount,
  canApprove = true,
  canRequestSecondApproval = true,
  isSubmitting = false,
  onApprove,
  onRequestSecondApproval,
}: ApprovalPanelProps) {
  const awaitingMoreApprovals = approvalCount < requiredApproverCount;

  return (
    <Card className="border-gray-800 bg-gray-950 text-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Approval</CardTitle>
            <CardDescription className="text-gray-400">
              Review promotion readiness for {candidateLabel}.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-gray-700 text-gray-200">
            {approvalCount}/{requiredApproverCount} approvals
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-gray-300">
        <p>
          Production promotion remains human-gated. Approval snapshots are stored
          with the exact evidence seen at decision time.
        </p>
        {awaitingMoreApprovals ? (
          <p className="text-amber-300">
            Additional approval is required before the promotion can proceed.
          </p>
        ) : (
          <p className="text-emerald-300">
            Approval requirements are currently satisfied.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button onClick={onApprove} disabled={!canApprove || isSubmitting}>
          Approve Candidate
        </Button>
        <Button
          variant="outline"
          onClick={onRequestSecondApproval}
          disabled={!canRequestSecondApproval || isSubmitting}
        >
          Request Second Approval
        </Button>
      </CardFooter>
    </Card>
  );
}
