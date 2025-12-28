"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import IntegrationList from "@/components/integrations/IntegrationList";
import CreateIntegrationModal from "@/components/integrations/CreateIntegrationModal";

export default function IntegrationsPage() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      router.push("/auth/signin");
    }
  }, [authenticated, router]);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIntegration = async (integrationData: any) => {
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(integrationData),
      });

      if (response.ok) {
        await fetchIntegrations();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Error creating integration:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-2 text-gray-600">
            Manage your third-party service integrations and API connections.
          </p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Add Integration
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <IntegrationList
            integrations={integrations}
            onRefresh={fetchIntegrations}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateIntegrationModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateIntegration}
        />
      )}
    </div>
  );
}
