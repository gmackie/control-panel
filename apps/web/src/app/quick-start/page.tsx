"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  CheckCircle,
  ArrowRight,
  Loader2,
  Copy,
  Terminal,
  Smartphone,
  Database,
  CreditCard,
  BarChart3,
  Shield,
  Layers,
  ArrowLeft,
  ExternalLink,
  Check,
} from "lucide-react";
import Link from "next/link";
import { QUICK_START_TEMPLATES, QuickStartConfig } from "@/types/starter-app";

export default function QuickStartPage() {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    commands: string[];
    nextSteps: string[];
  } | null>(null);

  const [config, setConfig] = useState<QuickStartConfig>({
    projectName: "",
    description: "",
    templateId: "vercel-monorepo",
    includeMobile: true,
    autoProvision: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const template = QUICK_START_TEMPLATES.find((t) => t.id === config.templateId) || QUICK_START_TEMPLATES[0];

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!config.projectName.trim()) {
        newErrors.projectName = "Project name is required";
      } else if (!/^[a-z][a-z0-9-]*$/.test(config.projectName)) {
        newErrors.projectName =
          "Must start with a letter and contain only lowercase letters, numbers, and hyphens";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleGenerate = async () => {
    if (!validateStep(step)) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/quick-start/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate project");
      }

      setResult(data);
      setStep(3);
    } catch (error) {
      console.error("Error generating project:", error);
      setErrors({ generate: "Failed to generate project. Please try again." });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const steps = [
    { id: 1, name: "Configure", icon: Layers },
    { id: 2, name: "Review", icon: CheckCircle },
    { id: 3, name: "Get Started", icon: Zap },
  ];

  const stackIcons: Record<string, React.ReactNode> = {
    database: <Database className="h-4 w-4" />,
    auth: <Shield className="h-4 w-4" />,
    payments: <CreditCard className="h-4 w-4" />,
    analytics: <BarChart3 className="h-4 w-4" />,
    monitoring: <Shield className="h-4 w-4" />,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/starter">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Starter Options
          </Button>
        </Link>
      </div>

      <div className="text-center mb-8">
        <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600">
          Quick Start
        </Badge>
        <h1 className="text-3xl font-bold mb-2">Vercel Monorepo Template</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Get a production-ready Next.js + Expo monorepo with tRPC, Turso,
          Clerk, Stripe, PostHog, and Sentry - all pre-wired and ready to deploy
          to Vercel.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step > s.id
                  ? "bg-green-600 text-white"
                  : step === s.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {step > s.id ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <s.icon className="h-5 w-5" />
              )}
            </div>
            <span className="ml-2 text-sm font-medium">{s.name}</span>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-4 ${
                  step > s.id ? "bg-green-600" : "bg-gray-800"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Configure Your Project</h2>

            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={config.projectName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    projectName: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder="my-saas-app"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
              />
              {errors.projectName && (
                <p className="text-sm text-red-500 mt-1">{errors.projectName}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <input
                type="text"
                value={config.description}
                onChange={(e) =>
                  setConfig({ ...config, description: e.target.value })
                }
                placeholder="A brief description of your project"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Mobile App Toggle */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="font-medium">Include Mobile App</p>
                    <p className="text-sm text-gray-400">
                      Add Expo (React Native) app with shared tRPC API
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeMobile}
                    onChange={(e) =>
                      setConfig({ ...config, includeMobile: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Auto Provision Toggle */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  <div>
                    <p className="font-medium">Auto-Provision Services</p>
                    <p className="text-sm text-gray-400">
                      Run interactive setup to configure Turso, Clerk, Stripe,
                      etc.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoProvision}
                    onChange={(e) =>
                      setConfig({ ...config, autoProvision: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Included Stack */}
            <div>
              <h3 className="text-sm font-medium mb-3">Included Stack</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(template.stack).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 bg-gray-900 rounded-lg p-3"
                  >
                    {stackIcons[key] || <Layers className="h-4 w-4" />}
                    <div>
                      <p className="text-xs text-gray-400 capitalize">{key}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Review Configuration</h2>

            <div className="bg-gray-900 rounded-lg p-6 space-y-4">
              <div className="flex justify-between border-b border-gray-800 pb-3">
                <span className="text-gray-400">Project Name</span>
                <span className="font-medium">{config.projectName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-3">
                <span className="text-gray-400">Template</span>
                <span className="font-medium">{template.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-3">
                <span className="text-gray-400">Mobile App</span>
                <span className="font-medium">
                  {config.includeMobile ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="h-4 w-4" /> Included
                    </span>
                  ) : (
                    <span className="text-gray-500">Not included</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Auto-Provision</span>
                <span className="font-medium">
                  {config.autoProvision ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="h-4 w-4" /> Enabled
                    </span>
                  ) : (
                    <span className="text-gray-500">Manual setup</span>
                  )}
                </span>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-sm font-medium mb-3">What You Get</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {template.features
                  .filter(
                    (f) => config.includeMobile || !f.includes("Expo")
                  )
                  .map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-300"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
              </div>
            </div>

            {errors.generate && (
              <p className="text-sm text-red-500">{errors.generate}</p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Project
                </>
              )}
            </Button>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Ready to Get Started!
              </h2>
              <p className="text-gray-400">
                Run these commands to create your {config.projectName} project
              </p>
            </div>

            {/* Commands */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Terminal Commands
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(result.commands.join("\n"))}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto">
                {result.commands.map((cmd, i) => (
                  <div key={i} className="py-1">
                    <span className="text-gray-500">$</span> {cmd}
                  </div>
                ))}
              </pre>
            </div>

            {/* Next Steps */}
            <div>
              <h3 className="text-sm font-medium mb-3">Next Steps</h3>
              <div className="space-y-2">
                {result.nextSteps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-gray-900 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-3">
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Deploy to Vercel
                </Button>
              </a>
              <a
                href="https://github.com/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Create GitHub Repo
                </Button>
              </a>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Buttons */}
      {step < 3 && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step === 1 && (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
