"use client";

import { ApplicationIntegrationsManager } from "@/components/applications/ApplicationIntegrationsManager";

interface IntegrationsListProps {
  applicationId: string;
}

export function IntegrationsList({ applicationId }: IntegrationsListProps) {
  return <ApplicationIntegrationsManager applicationId={applicationId} mode="embedded" />;
}
