/**
 * API Package
 * 
 * tRPC router definitions and exports
 */

export { appRouter, type AppRouter } from "./routers";
export { createContext, type Context } from "./context";
export { router, publicProcedure, protectedProcedure } from "./trpc";
export type { 
  DiscoveredResource, 
  ApplicationResource, 
  IntegrationSecret 
} from "./routers/integrations";
