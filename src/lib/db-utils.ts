// import { db } from './db'
// import { services, customers, deployments, alerts, databases, revenueMetrics, usageAnalytics } from './schema'
// import { desc } from 'drizzle-orm'

// const checkDb = () => {
//   if (!db) {
//     throw new Error('Database not available')
//   }
//   return db
// }

export async function getAllServices() {
  // try {
  //   const database = checkDb();
  //   return await database
  //     .select()
  //     .from(services)
  //     .orderBy(desc(services.createdAt));
  // } catch (error) {
  //   console.warn('Database not available, returning empty array')
  //   return []
  // }
  console.warn("Database not available, returning empty array");
  return [];
}

export async function createService(serviceData: any) {
  // try {
  //   const database = checkDb();
  //   return await database.insert(services).values(serviceData);
  // } catch (error) {
  //   console.warn('Database not available, returning null')
  //   return null
  // }
  console.warn("Database not available, returning null");
  return null;
}

export async function getAllCustomers() {
  // try {
  //   const database = checkDb();
  //   return await database
  //     .select()
  //     .from(customers)
  //     .orderBy(desc(customers.createdAt));
  // } catch (error) {
  //   console.warn('Database not available, returning empty array')
  //   return []
  // }
  console.warn("Database not available, returning empty array");
  return [];
}

export async function getRecentDeployments() {
  // try {
  //   const database = checkDb();
  //   return await database
  //     .select()
  //     .from(deployments)
  //     .orderBy(desc(deployments.timestamp))
  //     .limit(5);
  // } catch (error) {
  //   console.warn('Database not available, returning empty array')
  //   return []
  // }
  console.warn("Database not available, returning empty array");
  return [];
}

export async function getMetrics() {
  // try {
  //   const database = checkDb();
  //   return await database
  //     .select()
  //     .from(revenueMetrics)
  //     .orderBy(desc(revenueMetrics.timestamp));
  // } catch (error) {
  //   console.warn('Database not available, returning empty array')
  //   return []
  // }
  console.warn("Database not available, returning empty array");
  return [];
}

export async function getAnalytics() {
  // try {
  //   const database = checkDb();
  //   return await database
  //     .select()
  //     .from(usageAnalytics)
  //     .orderBy(desc(usageAnalytics.timestamp));
  // } catch (error) {
  //   console.warn('Database not available, returning empty array')
  //   return []
  // }
  console.warn("Database not available, returning empty array");
  return [];
}
