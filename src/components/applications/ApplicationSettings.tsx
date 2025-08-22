"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface ApplicationSettingsProps {
  applicationId: string;
}

export function ApplicationSettings({ applicationId }: ApplicationSettingsProps) {
  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Application Settings</h2>
        <p className="text-sm text-gray-400 mt-1">
          Configure your application settings and preferences
        </p>
      </div>
      
      <div className="text-center py-8">
        <Settings className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Settings coming soon</h3>
        <p className="text-gray-400">
          Configure domains, CORS, rate limits, and more
        </p>
      </div>
    </Card>
  );
}