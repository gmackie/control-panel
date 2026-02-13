"use client";

import { use } from "react";
import { ApplicationIntegrationsManager } from "@/components/applications/ApplicationIntegrationsManager";

export default function ApplicationIntegrationsPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);

  return <ApplicationIntegrationsManager applicationId={params.id} mode="page" />;
}
