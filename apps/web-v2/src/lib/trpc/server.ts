import { appRouter, createContext } from "@repo/api";

export async function createServerCaller() {
  const ctx = await createContext({
    headers: new Headers(),
    userId: null,
  });

  return appRouter.createCaller(ctx);
}
