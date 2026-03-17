"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockerReason: string;
  isSubmitting?: boolean;
  onConfirm: (payload: { justification: string; ticketUrl: string }) => void;
}

export function OverrideDialog({
  open,
  onOpenChange,
  blockerReason,
  isSubmitting = false,
  onConfirm,
}: OverrideDialogProps) {
  const [justification, setJustification] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  const canSubmit = justification.trim().length > 0 && ticketUrl.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gray-800 bg-gray-950 text-gray-100">
        <DialogHeader>
          <DialogTitle>Request Override</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/40 p-3 text-sm text-amber-100">
            Override requested for blocker: <span className="font-mono">{blockerReason}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-justification">Justification</Label>
            <Textarea
              id="override-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Explain why this override is required."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-ticket">Ticket or incident link</Label>
            <Input
              id="override-ticket"
              value={ticketUrl}
              onChange={(event) => setTicketUrl(event.target.value)}
              placeholder="https://linear.app/... or incident link"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ justification, ticketUrl })}
            disabled={!canSubmit || isSubmitting}
          >
            Submit Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
