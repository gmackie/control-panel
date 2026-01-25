"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export const WIZARD_STEPS = [
  { id: "basics", title: "Basics", description: "Name and template" },
  { id: "modules", title: "Modules", description: "Select integrations" },
  { id: "providers", title: "Providers", description: "Git, deploy, database" },
  { id: "review", title: "Review", description: "Confirm and create" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export const GIT_PROVIDERS = [
  { value: "github", label: "GitHub", description: "GitHub.com repositories" },
  { value: "gitea", label: "Gitea", description: "Self-hosted Gitea server" },
] as const;

export const DEPLOY_PROVIDERS = [
  { value: "vercel", label: "Vercel", description: "Serverless deployment platform" },
  { value: "kubernetes", label: "Kubernetes", description: "Self-hosted K8s cluster" },
] as const;

export const DB_PROVIDERS = [
  { value: "neon", label: "Neon", description: "Serverless PostgreSQL" },
  { value: "turso", label: "Turso", description: "Distributed SQLite" },
  { value: "supabase", label: "Supabase", description: "PostgreSQL with extras" },
] as const;

export interface WizardFormState {
  templateId: string;
  appName: string;
  appSlug: string;
  description: string;
  selectedModules: string[];
  gitProvider: "github" | "gitea";
  deployProvider: "vercel" | "kubernetes";
  dbProvider: "neon" | "turso" | "supabase";
  repoVisibility: "public" | "private";
  autoProvision: boolean;
}

export interface WizardState {
  currentStep: number;
  form: WizardFormState;
  errors: Record<string, string>;
  isSubmitting: boolean;
  slugValidation: {
    isValidating: boolean;
    isAvailable: boolean | null;
    error: string | null;
  };
}

interface WizardContextValue {
  state: WizardState;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  updateForm: <K extends keyof WizardFormState>(field: K, value: WizardFormState[K]) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearError: (field: string) => void;
  setSlugValidation: (validation: Partial<WizardState["slugValidation"]>) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  resetWizard: () => void;
}

const initialFormState: WizardFormState = {
  templateId: "",
  appName: "",
  appSlug: "",
  description: "",
  selectedModules: [],
  gitProvider: "github",
  deployProvider: "vercel",
  dbProvider: "neon",
  repoVisibility: "private",
  autoProvision: false,
};

const initialState: WizardState = {
  currentStep: 0,
  form: initialFormState,
  errors: {},
  isSubmitting: false,
  slugValidation: {
    isValidating: false,
    isAvailable: null,
    error: null,
  },
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}

interface WizardProviderProps {
  children: ReactNode;
}

export function WizardProvider({ children }: WizardProviderProps) {
  const [state, setState] = useState<WizardState>(initialState);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < WIZARD_STEPS.length) {
      setState((prev) => ({ ...prev, currentStep: step }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, WIZARD_STEPS.length - 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  const updateForm = useCallback(<K extends keyof WizardFormState>(
    field: K,
    value: WizardFormState[K]
  ) => {
    setState((prev) => ({
      ...prev,
      form: { ...prev.form, [field]: value },
      errors: { ...prev.errors, [field]: "" },
    }));
  }, []);

  const setErrors = useCallback((errors: Record<string, string>) => {
    setState((prev) => ({ ...prev, errors }));
  }, []);

  const clearError = useCallback((field: string) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: "" },
    }));
  }, []);

  const setSlugValidation = useCallback((validation: Partial<WizardState["slugValidation"]>) => {
    setState((prev) => ({
      ...prev,
      slugValidation: { ...prev.slugValidation, ...validation },
    }));
  }, []);

  const setIsSubmitting = useCallback((isSubmitting: boolean) => {
    setState((prev) => ({ ...prev, isSubmitting }));
  }, []);

  const resetWizard = useCallback(() => {
    setState(initialState);
  }, []);

  const value: WizardContextValue = {
    state,
    goToStep,
    nextStep,
    prevStep,
    canGoNext: state.currentStep < WIZARD_STEPS.length - 1,
    canGoPrev: state.currentStep > 0,
    updateForm,
    setErrors,
    clearError,
    setSlugValidation,
    setIsSubmitting,
    resetWizard,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}
