"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/providers";

export function AlertMonitor() {
  const { authenticated } = useAuth();

  useEffect(() => {
    if (!authenticated) return;

    // Evaluate alerts every 60 seconds
    const evaluateAlerts = async () => {
      try {
        await fetch("/api/alerts/evaluate", { method: "POST" });
      } catch (error) {
        console.error("Failed to evaluate alerts:", error);
      }
    };

    // Initial evaluation
    evaluateAlerts();

    // Set up interval
    const interval = setInterval(evaluateAlerts, 60000);

    return () => clearInterval(interval);
  }, [authenticated]);

  // This component doesn't render anything
  return null;
}