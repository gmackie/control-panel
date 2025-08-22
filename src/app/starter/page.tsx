"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntegrationSelector } from "@/components/starter/integration-selector";
import { 
  Download, 
  Code, 
  Settings, 
  Package, 
  Zap,
  CheckCircle,
  ArrowRight,
  Loader2,
  Copy,
  Terminal
} from "lucide-react";
import { StarterConfig } from "@/types/starter-app";

interface FormData {
  projectName: string;
  description: string;
  integrations: string[];
  features: string[];
  styling: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion';
  typescript: boolean;
  eslint: boolean;
  prettier: boolean;
  testing: 'none' | 'jest' | 'vitest' | 'playwright';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  deployment: 'vercel' | 'netlify' | 'docker' | 'k3s' | 'none';
}

export default function StarterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<any>(null);
  const [instructions, setInstructions] = useState<string>("");
  
  const [formData, setFormData] = useState<FormData>({
    projectName: "",
    description: "",
    integrations: [],
    features: [],
    styling: "tailwind",
    typescript: true,
    eslint: true,
    prettier: true,
    testing: "none",
    packageManager: "npm",
    deployment: "vercel",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.projectName.trim()) {
        newErrors.projectName = "Project name is required";
      } else if (!/^[a-z0-9-]+$/.test(formData.projectName)) {
        newErrors.projectName = "Project name must contain only lowercase letters, numbers, and hyphens";
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
      const config: StarterConfig = {
        ...formData,
        features: [], // Convert feature IDs to feature objects if needed
      };

      const response = await fetch("/api/starter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate starter app");
      }

      setGeneratedFiles(data.files);
      setInstructions(data.instructions);
      setStep(4);
    } catch (error) {
      console.error("Error generating starter app:", error);
      // Handle error
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAsZip = () => {
    // In a real implementation, this would create a ZIP file
    console.log("Downloading project as ZIP...");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const steps = [
    { id: 1, name: "Project Info", icon: Settings },
    { id: 2, name: "Integrations", icon: Package },
    { id: 3, name: "Configuration", icon: Code },
    { id: 4, name: "Generate", icon: Zap },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Next.js Starter App</h1>
        <p className="text-gray-400">
          Configure and generate a customized Next.js application with your preferred integrations
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
                className={`w-24 h-0.5 mx-4 ${
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
            <h2 className="text-xl font-semibold mb-4">Project Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="my-awesome-app"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                />
                {errors.projectName && (
                  <p className="text-sm text-red-500 mt-1">{errors.projectName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A brief description of your project"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Package Manager
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['npm', 'yarn', 'pnpm', 'bun'] as const).map(pm => (
                    <label
                      key={pm}
                      className={`flex items-center justify-center p-3 rounded-md border cursor-pointer transition-all ${
                        formData.packageManager === pm
                          ? "border-blue-500 bg-blue-950/20"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="packageManager"
                        value={pm}
                        checked={formData.packageManager === pm}
                        onChange={(e) => setFormData({ ...formData, packageManager: e.target.value as any })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{pm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Choose Integrations</h2>
            <IntegrationSelector
              selectedIntegrations={formData.integrations}
              onSelectionChange={(integrations) => setFormData({ ...formData, integrations })}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Configuration Options</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Development Tools</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.typescript}
                      onChange={(e) => setFormData({ ...formData, typescript: e.target.checked })}
                      className="rounded border-gray-800"
                    />
                    <span>TypeScript</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.eslint}
                      onChange={(e) => setFormData({ ...formData, eslint: e.target.checked })}
                      className="rounded border-gray-800"
                    />
                    <span>ESLint</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.prettier}
                      onChange={(e) => setFormData({ ...formData, prettier: e.target.checked })}
                      className="rounded border-gray-800"
                    />
                    <span>Prettier</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Styling</h3>
                <div className="space-y-2">
                  {(['tailwind', 'css-modules', 'styled-components', 'emotion'] as const).map(style => (
                    <label
                      key={style}
                      className={`flex items-center p-3 rounded-md border cursor-pointer transition-all ${
                        formData.styling === style
                          ? "border-blue-500 bg-blue-950/20"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="styling"
                        value={style}
                        checked={formData.styling === style}
                        onChange={(e) => setFormData({ ...formData, styling: e.target.value as any })}
                        className="sr-only"
                      />
                      <span className="text-sm">
                        {style === 'tailwind' && 'Tailwind CSS'}
                        {style === 'css-modules' && 'CSS Modules'}
                        {style === 'styled-components' && 'Styled Components'}
                        {style === 'emotion' && 'Emotion'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Testing Framework</h3>
                <div className="space-y-2">
                  {(['none', 'jest', 'vitest', 'playwright'] as const).map(test => (
                    <label
                      key={test}
                      className={`flex items-center p-3 rounded-md border cursor-pointer transition-all ${
                        formData.testing === test
                          ? "border-blue-500 bg-blue-950/20"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="testing"
                        value={test}
                        checked={formData.testing === test}
                        onChange={(e) => setFormData({ ...formData, testing: e.target.value as any })}
                        className="sr-only"
                      />
                      <span className="text-sm capitalize">{test}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Deployment Target</h3>
                <div className="space-y-2">
                  {(['vercel', 'netlify', 'docker', 'k3s', 'none'] as const).map(deploy => (
                    <label
                      key={deploy}
                      className={`flex items-center p-3 rounded-md border cursor-pointer transition-all ${
                        formData.deployment === deploy
                          ? "border-blue-500 bg-blue-950/20"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deployment"
                        value={deploy}
                        checked={formData.deployment === deploy}
                        onChange={(e) => setFormData({ ...formData, deployment: e.target.value as any })}
                        className="sr-only"
                      />
                      <span className="text-sm capitalize">{deploy}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && !generatedFiles && (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">Ready to Generate!</h2>
            <p className="text-gray-400 mb-8">
              Your Next.js starter app is ready to be generated with the following configuration:
            </p>
            
            <div className="bg-gray-900 rounded-lg p-6 mb-8 text-left max-w-2xl mx-auto">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Project Name:</span>
                  <span className="font-medium">{formData.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Integrations:</span>
                  <span className="font-medium">{formData.integrations.length} selected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TypeScript:</span>
                  <span className="font-medium">{formData.typescript ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Styling:</span>
                  <span className="font-medium capitalize">{formData.styling}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Testing:</span>
                  <span className="font-medium capitalize">{formData.testing}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Starter App
                </>
              )}
            </Button>
          </div>
        )}

        {step === 4 && generatedFiles && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Starter App Generated!</h2>
              <p className="text-gray-400">
                Your customized Next.js application is ready to download
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Button onClick={downloadAsZip}>
                <Download className="mr-2 h-4 w-4" />
                Download ZIP
              </Button>
              <Button variant="outline" onClick={() => window.open('https://github.com/new', '_blank')}>
                <Code className="mr-2 h-4 w-4" />
                Create GitHub Repo
              </Button>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Setup Instructions</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(instructions)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {instructions}
              </pre>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Generated Files</h3>
              <div className="space-y-2">
                {generatedFiles.slice(0, 10).map((file: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4 text-gray-500" />
                    <code className="text-gray-300">{file.path}</code>
                  </div>
                ))}
                {generatedFiles.length > 10 && (
                  <p className="text-sm text-gray-500 mt-2">
                    ... and {generatedFiles.length - 10} more files
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Buttons */}
      {!generatedFiles && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 4 && (
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