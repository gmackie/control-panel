import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { PipelineStageDots, type PipelineStageStatus } from "./PipelineStageDots";

interface PipelineStep {
  stage: string;
  status: PipelineStageStatus;
}

interface DeploymentCardProps {
  appName: string;
  commitMessage: string;
  commitSha: string;
  branch: string;
  environment: string;
  steps: PipelineStep[];
  onPress?: () => void;
}

export function DeploymentCard({
  appName,
  commitMessage,
  commitSha,
  branch,
  environment,
  steps,
  onPress,
}: DeploymentCardProps) {
  const { colors, isDark } = useTheme();

  const envColors: Record<string, string> = {
    production: "#ef4444",
    staging: "#f59e0b",
    development: "#3b82f6",
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>
          {appName}
        </Text>
        <View style={[styles.envBadge, { backgroundColor: envColors[environment] || "#64748b" }]}>
          <Text style={styles.envText}>{environment.slice(0, 4).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={[styles.commitMessage, { color: colors.textMuted }]} numberOfLines={1}>
        {commitMessage || "No commit message"}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.branch, { color: colors.textMuted }]}>
          {branch}@{commitSha.slice(0, 7)}
        </Text>
        <PipelineStageDots steps={steps} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    width: 220,
    marginRight: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  envBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  envText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  commitMessage: {
    fontSize: 13,
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  branch: {
    fontSize: 11,
    fontFamily: "monospace",
  },
});
