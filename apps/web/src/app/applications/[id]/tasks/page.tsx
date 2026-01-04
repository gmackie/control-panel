"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckSquare,
  RefreshCw,
  ExternalLink,
  Code,
} from "lucide-react";
import { TaskBoard } from "@/components/tasks";

interface ApplicationData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  repository?: {
    fullName: string;
    url: string;
  };
}

export default function TasksPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);

  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: ApplicationData;
  }>({
    queryKey: ["unified-app", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json();
    },
  });

  const app = data?.data;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4" />
          <div className="h-12 bg-gray-800 rounded w-1/2" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="min-w-[300px] h-[400px] bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Application not found</h2>
          <p className="text-gray-400 mb-4">
            The application you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
          </p>
          <Link href="/applications">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-full space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/applications" className="hover:text-gray-200">
          Applications
        </Link>
        <span>/</span>
        <Link
          href={`/applications/${params.id}`}
          className="hover:text-gray-200"
        >
          {app.name}
        </Link>
        <span>/</span>
        <span className="text-gray-200">Tasks</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-950/20 rounded-lg">
            <CheckSquare className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Tasks</h1>
              <Badge variant="secondary" className="bg-gray-800">
                {app.name}
              </Badge>
            </div>
            <p className="text-gray-400 mt-1">
              Manage and track tasks for {app.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/applications/${params.id}`}>
            <Button variant="outline" size="sm">
              <Code className="h-4 w-4 mr-2" />
              Overview
            </Button>
          </Link>
          {app.repository?.url && (
            <a
              href={app.repository.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Repository
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Task Board */}
      <TaskBoard applicationId={params.id} />
    </div>
  );
}
