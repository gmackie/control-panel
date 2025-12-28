"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { Pipeline, PipelineStage, PipelineStep } from "@/types/deployments";

interface PipelineViewProps {
  pipeline: Pipeline;
}

export function PipelineView({ pipeline }: PipelineViewProps) {
  const getStageIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "skipped":
        return <SkipForward className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "skipped":
        return <SkipForward className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "success";
      case "failed":
        return "error";
      case "running":
        return "secondary";
      case "skipped":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{pipeline.name}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span>Trigger: {pipeline.trigger}</span>
            {pipeline.triggeredBy && <span>by {pipeline.triggeredBy}</span>}
            {pipeline.duration && (
              <span>Duration: {Math.round(pipeline.duration / 60)}m {pipeline.duration % 60}s</span>
            )}
          </div>
        </div>
        <Badge variant={getStatusColor(pipeline.status) as any}>
          {pipeline.status}
        </Badge>
      </div>

      <div className="space-y-6">
        {pipeline.stages.map((stage, stageIdx) => (
          <div key={stage.id}>
            {stageIdx > 0 && (
              <div className="flex items-center justify-center py-2">
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </div>
            )}
            
            <div className="border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                {getStageIcon(stage.status)}
                <h4 className="font-medium">{stage.name}</h4>
                {stage.duration && (
                  <span className="text-sm text-gray-400">
                    {Math.round(stage.duration)}s
                  </span>
                )}
              </div>

              <div className="space-y-2 ml-8">
                {stage.steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-900/50"
                  >
                    {getStepIcon(step.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{step.name}</span>
                        {step.duration && (
                          <span className="text-xs text-gray-400">
                            {step.duration}s
                          </span>
                        )}
                      </div>
                      {step.command && (
                        <code className="text-xs text-gray-500 font-mono">
                          {step.command}
                        </code>
                      )}
                      {step.exitCode !== undefined && step.exitCode !== 0 && (
                        <p className="text-xs text-red-400 mt-1">
                          Exit code: {step.exitCode}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pipeline.startedAt && (
        <div className="mt-6 pt-6 border-t border-gray-800 text-sm text-gray-400">
          <div className="flex items-center justify-between">
            <span>Started: {new Date(pipeline.startedAt).toLocaleString()}</span>
            {pipeline.finishedAt && (
              <span>Finished: {new Date(pipeline.finishedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}