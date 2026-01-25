import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface PipelineStep {
  stage: string;
  status: PipelineStageStatus;
}

interface PipelineStageDotProps {
  status: PipelineStageStatus;
  isLast?: boolean;
}

function PipelineStageDot({ status, isLast }: PipelineStageDotProps) {
  const statusConfig = {
    pending: { color: "#64748b", icon: null, animate: false },
    running: { color: "#3b82f6", icon: null, animate: true },
    success: { color: "#22c55e", icon: "checkmark" as const, animate: false },
    failed: { color: "#ef4444", icon: "close" as const, animate: false },
    skipped: { color: "#94a3b8", icon: null, animate: false },
  };

  const config = statusConfig[status];

  return (
    <View style={styles.dotContainer}>
      <View style={[styles.dot, { backgroundColor: config.color }]}>
        {config.icon && (
          <Ionicons name={config.icon} size={10} color="#fff" />
        )}
        {status === "running" && (
          <View style={styles.runningPulse} />
        )}
      </View>
      {!isLast && (
        <View
          style={[
            styles.connector,
            { backgroundColor: status === "success" ? config.color : "#334155" },
          ]}
        />
      )}
    </View>
  );
}

interface PipelineStageDotsProp {
  steps: PipelineStep[];
  compact?: boolean;
}

export function PipelineStageDots({ steps, compact = false }: PipelineStageDotsProp) {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {steps.map((step, index) => {
          const statusConfig = {
            pending: "#64748b",
            running: "#3b82f6",
            success: "#22c55e",
            failed: "#ef4444",
            skipped: "#94a3b8",
          };
          return (
            <View
              key={step.stage}
              style={[
                styles.compactDot,
                { backgroundColor: statusConfig[step.status] },
              ]}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <PipelineStageDot
          key={step.stage}
          status={step.status}
          isLast={index === steps.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  connector: {
    width: 12,
    height: 2,
  },
  runningPulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    opacity: 0.3,
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
