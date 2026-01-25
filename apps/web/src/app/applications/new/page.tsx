"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  WizardProvider,
  useWizard,
  WIZARD_STEPS,
} from "./_components/wizard-context";
import { WizardProgress } from "./_components/wizard-progress";
import { WizardNavigation } from "./_components/wizard-navigation";
import { BasicsStep } from "./_components/basics-step";
import { ModulesStep } from "./_components/modules-step";
import { ProvidersStep } from "./_components/providers-step";
import { ReviewStep } from "./_components/review-step";

interface ProvisioningResult {
  step: string;
  provider: string;
  status: "pending" | "success" | "failed" | "skipped";
  message?: string;
}

function WizardContent() {
  const router = useRouter();
  const { state, setErrors, setIsSubmitting, nextStep } = useWizard();
  const { currentStep, form, slugValidation, isSubmitting } = state;
  const [provisioningResults, setProvisioningResults] = useState<ProvisioningResult[] | null>(null);

  const instantiateMutation = trpc.templates.instantiate.useMutation({
    onSuccess: (data) => {
      setProvisioningResults(
        data.provisioningStatus.map((step) => ({
          step: step.step,
          provider: step.provider,
          status: step.status as "pending" | "success" | "failed" | "skipped",
          message: step.message,
        }))
      );

      setTimeout(() => {
        router.push(`/applications/${data.applicationId}`);
      }, 2000);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setErrors({ submit: error.message });
    },
  });

  const validateBasicsStep = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!form.templateId) {
      errors.templateId = "Please select a template";
    }
    if (!form.appName.trim()) {
      errors.appName = "Application name is required";
    }
    if (!form.appSlug.trim()) {
      errors.appSlug = "URL slug is required";
    } else if (slugValidation.isAvailable === false) {
      errors.appSlug = "This slug is already taken";
    } else if (slugValidation.error) {
      errors.appSlug = slugValidation.error;
    }

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return false;
    }
    return true;
  }, [form, slugValidation, setErrors]);

  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 0:
        return validateBasicsStep();
      case 1:
      case 2:
        return true;
      case 3:
        return true;
      default:
        return true;
    }
  }, [currentStep, validateBasicsStep]);

  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const handleSubmit = useCallback(() => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    instantiateMutation.mutate({
      templateId: form.templateId,
      appName: form.appName,
      appSlug: form.appSlug,
      description: form.description || undefined,
      modules: form.selectedModules,
      gitProvider: form.gitProvider,
      deployProvider: form.deployProvider,
      dbProvider: form.dbProvider,
      repoVisibility: form.repoVisibility,
      autoProvision: form.autoProvision,
    });
  }, [form, validateCurrentStep, setIsSubmitting, instantiateMutation]);

  const isCurrentStepValid = useCallback((): boolean => {
    switch (currentStep) {
      case 0:
        return (
          !!form.templateId &&
          !!form.appName.trim() &&
          !!form.appSlug.trim() &&
          slugValidation.isAvailable !== false &&
          !slugValidation.isValidating
        );
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  }, [currentStep, form, slugValidation]);

  const renderStep = () => {
    if (provisioningResults) {
      return <ReviewStep provisioningResults={provisioningResults} />;
    }

    switch (currentStep) {
      case 0:
        return <BasicsStep />;
      case 1:
        return <ModulesStep />;
      case 2:
        return <ProvidersStep />;
      case 3:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (currentStep === 1 && form.selectedModules.length === 0 && form.templateId) {
    }
  }, [currentStep, form.templateId, form.selectedModules]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/applications">
            <Button variant="ghost" size="icon" className="hover:bg-zinc-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create New Application</h1>
            <p className="text-zinc-400 text-sm">
              Set up a new application from a template
            </p>
          </div>
        </div>

        {!provisioningResults && <WizardProgress />}

        <Card className="p-6 bg-zinc-900 border-zinc-800">
          {renderStep()}

          {state.errors.submit && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {state.errors.submit}
            </div>
          )}

          {!provisioningResults && (
            <WizardNavigation
              onSubmit={currentStep === WIZARD_STEPS.length - 1 ? handleSubmit : handleNext}
              isValid={isCurrentStepValid()}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
