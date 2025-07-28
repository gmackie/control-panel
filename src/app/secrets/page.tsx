import { SecretsList } from "@/components/secrets/secrets-list";

export default function SecretsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Secrets Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage API keys, tokens, and other sensitive configuration across your services
        </p>
      </div>
      
      <SecretsList />
    </div>
  );
}