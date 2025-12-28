/**
 * tRPC Client for Web
 * 
 * Creates the tRPC client hooks for use in React components
 */

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@repo/api";

/**
 * tRPC React hooks
 * 
 * Usage:
 * const { data } = trpc.notifications.list.useQuery({});
 * const mutation = trpc.notifications.markAsRead.useMutation();
 */
export const trpc = createTRPCReact<AppRouter>();
