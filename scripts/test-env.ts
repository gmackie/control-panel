import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

console.log("Environment Variables Check:");
console.log("GITHUB_ID:", process.env.GITHUB_ID ? "✓ Set" : "✗ Missing");
console.log(
  "GITHUB_SECRET:",
  process.env.GITHUB_SECRET ? "✓ Set" : "✗ Missing"
);
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL || "✗ Missing");
console.log(
  "NEXTAUTH_SECRET:",
  process.env.NEXTAUTH_SECRET ? "✓ Set" : "✗ Missing"
);
console.log(
  "TURSO_DATABASE_URL:",
  process.env.TURSO_DATABASE_URL ? "✓ Set" : "✗ Missing"
);
console.log(
  "TURSO_AUTH_TOKEN:",
  process.env.TURSO_AUTH_TOKEN ? "✓ Set" : "✗ Missing"
);
