"use client";

import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, useWizard } from "./wizard-context";

export function WizardProgress() {
  const { state, goToStep } = useWizard();
  const { currentStep } = state;

  return (
    <div className="flex items-center justify-between mb-8">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index <= currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isClickable && goToStep(index)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-3 group",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-blue-500 text-white",
                  !isCompleted && !isCurrent && "bg-zinc-800 text-zinc-400"
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-white",
                    !isCurrent && "text-zinc-400"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-zinc-500">{step.description}</p>
              </div>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4",
                  index < currentStep ? "bg-green-500" : "bg-zinc-800"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
