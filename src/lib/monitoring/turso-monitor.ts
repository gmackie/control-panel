import { TursoDatabase } from "@/types";

export async function getTursoDatabaseStatus(): Promise<TursoDatabase[]> {
  const databases: TursoDatabase[] = [];
  
  // Check if we have Turso credentials
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!tursoUrl || !tursoToken) {
    return databases;
  }
  
  try {
    // Extract database name from URL
    const dbMatch = tursoUrl.match(/libsql:\/\/([^-]+)-/);
    const dbName = dbMatch ? dbMatch[1] : "gmac-io";
    
    // Test database connection
    const startTime = Date.now();
    const response = await fetch(tursoUrl.replace("libsql://", "https://"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tursoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statements: ["SELECT 1"]
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;
    
    databases.push({
      id: dbName,
      name: dbName,
      appId: "gmac-io",
      location: "aws-us-west-2",
      size: 0, // Would need Turso API to get actual size
      connections: 0, // Would need monitoring to track
      operations: {
        reads: 0,
        writes: 0,
      },
      status: isHealthy ? "healthy" : "error" as any,
    });
  } catch (error) {
    console.error("Error checking Turso database:", error);
    
    // Return a default entry with error status
    databases.push({
      id: "gmac-io",
      name: "gmac-io",
      appId: "gmac-io",
      location: "aws-us-west-2",
      size: 0,
      connections: 0,
      operations: {
        reads: 0,
        writes: 0,
      },
      status: "error" as any,
    });
  }
  
  return databases;
}