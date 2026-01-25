"use client";

import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, useWizard } from "./wizard-context";

interface WizardNavigationProps {
  onSubmit?: () => void;
  isValid?: boolean;
}

export function WizardNavigation({ onSubmit, isValid = true }: WizardNavigationProps) {
  const { state, nextStep, prevStep, canGoNext, canGoPrev } = useWizard();
  const { currentStep, isSubmitting } = state;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep && onSubmit) {
      onSubmit();
    } else {
      nextStep();
    }
  };

  return (
    <div className="flex justify-between pt-6 border-t border-zinc-800">
      <Button
        type="button"
        variant="outline"
        onClick={prevStep}
        disabled={!canGoPrev || isSubmitting}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <Button
        type="button"
        onClick={handleNext}
        disabled={!isValid || isSubmitting}
        className="gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : isLastStep ? (
          <>
            <Rocket className="w-4 h-4" />
            Create Application
          </>
        ) : (
          <>
            Next
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
