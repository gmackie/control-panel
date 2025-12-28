"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Shield, 
  Activity, 
  Server, 
  Database, 
  Lock,
  Zap,
  BarChart,
  Users,
  Code
} from "lucide-react";

export default function UnauthenticatedHomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-6">
              GMAC.IO Control Panel
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Centralized management for your infrastructure, applications, and business operations
            </p>
            <Button
              onClick={() => signIn("github")}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Lock className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
            <p className="text-sm text-gray-500 mt-4">
              Access restricted to authorized users only
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          Powerful Features for Complete Control
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <Server className="h-8 w-8 text-blue-500 mr-3" />
              <h3 className="text-lg font-semibold">Service Management</h3>
            </div>
            <p className="text-gray-400">
              Monitor and manage all your services across Kubernetes clusters with real-time health status
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <Database className="h-8 w-8 text-green-500 mr-3" />
              <h3 className="text-lg font-semibold">Database Operations</h3>
            </div>
            <p className="text-gray-400">
              Manage Turso databases, view metrics, and handle migrations from a single interface
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <BarChart className="h-8 w-8 text-purple-500 mr-3" />
              <h3 className="text-lg font-semibold">Business Analytics</h3>
            </div>
            <p className="text-gray-400">
              Track revenue, customer metrics, and usage analytics with Stripe and Clerk integrations
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <Shield className="h-8 w-8 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold">Secrets Management</h3>
            </div>
            <p className="text-gray-400">
              Securely manage environment variables and secrets across all your applications
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <Activity className="h-8 w-8 text-yellow-500 mr-3" />
              <h3 className="text-lg font-semibold">Real-time Monitoring</h3>
            </div>
            <p className="text-gray-400">
              Live metrics, health checks, and performance monitoring with instant alerts
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center mb-4">
              <Code className="h-8 w-8 text-cyan-500 mr-3" />
              <h3 className="text-lg font-semibold">Starter App Generator</h3>
            </div>
            <p className="text-gray-400">
              Create customized Next.js applications with pre-configured integrations
            </p>
          </Card>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-green-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">
            Enterprise-Grade Security
          </h3>
          <p className="text-gray-400">
            Protected with GitHub OAuth authentication and restricted access controls. 
            Only authorized users can access the control panel.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
          <p>&copy; 2024 GMAC.IO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}