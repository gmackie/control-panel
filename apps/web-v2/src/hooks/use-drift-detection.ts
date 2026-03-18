"use client";

import { useEffect, useCallback } from "react";

const DRIFT_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Polls for secret drift every 5 minutes.
 * Calls /api/secrets/drift to compare DB vs K8s values.
 */
export function useDriftDetection(applicationId: string | undefined) {
  const checkDrift = useCallback(async () => {
    if (!applicationId) return;
    try {
      await fetch("/api/secrets/drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
    } catch {
      // Silently fail — drift is advisory
    }
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;

    // Check immediately on mount
    checkDrift();

    // Then poll every 5 minutes
    const interval = setInterval(checkDrift, DRIFT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [applicationId, checkDrift]);

  return { checkDrift };
}
