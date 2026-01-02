import { Client } from "@notionhq/client";

export type NotionTaskStatus = "not_started" | "in_progress" | "done" | "blocked" | "cancelled";
export type NotionTaskPriority = "low" | "medium" | "high" | "urgent";

export interface NotionTask {
  id: string;
  notionPageId: string;
  title: string;
  status: NotionTaskStatus;
  priority?: NotionTaskPriority;
  dueDate?: string;
  assignee?: string;
  description?: string;
  tags?: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, unknown>;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, { type: string; name: string }>;
}

export interface NotionSyncResult {
  tasks: NotionTask[];
  syncedAt: string;
  hasMore: boolean;
  nextCursor?: string;
}

export interface TaskUpdatePayload {
  status?: NotionTaskStatus;
  priority?: NotionTaskPriority;
  dueDate?: string;
  assignee?: string;
  customProperties?: Record<string, unknown>;
}

export interface TaskLinkMetadata {
  aiSessionId?: string;
  gitBranch?: string;
  prNumber?: number;
  prUrl?: string;
}

const STATUS_MAP: Record<string, NotionTaskStatus> = {
  "not started": "not_started",
  "to do": "not_started",
  "todo": "not_started",
  "backlog": "not_started",
  "in progress": "in_progress",
  "doing": "in_progress",
  "working": "in_progress",
  "done": "done",
  "complete": "done",
  "completed": "done",
  "blocked": "blocked",
  "on hold": "blocked",
  "cancelled": "cancelled",
  "canceled": "cancelled",
};

const PRIORITY_MAP: Record<string, NotionTaskPriority> = {
  "low": "low",
  "medium": "medium",
  "high": "high",
  "urgent": "urgent",
  "critical": "urgent",
  "p0": "urgent",
  "p1": "high",
  "p2": "medium",
  "p3": "low",
};

interface NotionPageResponse {
  id: string;
  object: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}

interface NotionDatabaseResponse {
  id: string;
  object: string;
  url: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, { type: string; name?: string }>;
}

export class NotionClient {
  private client: Client;

  constructor(apiToken: string) {
    this.client = new Client({ auth: apiToken });
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    const response = await this.client.databases.retrieve({
      database_id: databaseId,
    }) as unknown as NotionDatabaseResponse;

    const title = response.title
      .map(t => t.plain_text)
      .join("");

    const properties: Record<string, { type: string; name: string }> = {};
    for (const [name, prop] of Object.entries(response.properties)) {
      properties[name] = { type: prop.type, name };
    }

    return {
      id: response.id,
      title,
      url: response.url,
      properties,
    };
  }

  async queryTasks(
    databaseId: string,
    options?: {
      filter?: Record<string, unknown>;
      sorts?: Array<{ property?: string; timestamp?: string; direction: string }>;
      pageSize?: number;
      startCursor?: string;
    }
  ): Promise<NotionSyncResult> {
    const queryParams: Record<string, unknown> = {
      database_id: databaseId,
      page_size: options?.pageSize || 100,
    };

    if (options?.filter) {
      queryParams.filter = options.filter;
    }
    if (options?.sorts) {
      queryParams.sorts = options.sorts;
    } else {
      queryParams.sorts = [{ timestamp: "last_edited_time", direction: "descending" }];
    }
    if (options?.startCursor) {
      queryParams.start_cursor = options.startCursor;
    }

    const response = await (this.client.databases as unknown as {
      query: (params: Record<string, unknown>) => Promise<{
        results: NotionPageResponse[];
        has_more: boolean;
        next_cursor: string | null;
      }>;
    }).query(queryParams);

    const tasks = response.results
      .filter((page): page is NotionPageResponse => page.object === "page" && "properties" in page)
      .map(page => this.pageToTask(page));

    return {
      tasks,
      syncedAt: new Date().toISOString(),
      hasMore: response.has_more,
      nextCursor: response.next_cursor ?? undefined,
    };
  }

  async getTask(pageId: string): Promise<NotionTask> {
    const page = await this.client.pages.retrieve({
      page_id: pageId,
    }) as unknown as NotionPageResponse;

    return this.pageToTask(page);
  }

  async updateTask(pageId: string, updates: TaskUpdatePayload): Promise<NotionTask> {
    const properties: Record<string, unknown> = {};

    if (updates.status) {
      properties["Status"] = {
        status: { name: this.statusToNotionStatus(updates.status) },
      };
    }

    if (updates.priority) {
      properties["Priority"] = {
        select: { name: this.priorityToNotionPriority(updates.priority) },
      };
    }

    if (updates.dueDate) {
      properties["Due Date"] = {
        date: { start: updates.dueDate },
      };
    }

    if (updates.customProperties) {
      Object.assign(properties, updates.customProperties);
    }

    const page = await (this.client.pages.update as (params: { page_id: string; properties: Record<string, unknown> }) => Promise<unknown>)({
      page_id: pageId,
      properties,
    }) as NotionPageResponse;

    return this.pageToTask(page);
  }

  async addLinkMetadata(pageId: string, metadata: TaskLinkMetadata): Promise<void> {
    const properties: Record<string, unknown> = {};

    if (metadata.aiSessionId) {
      properties["AI Session ID"] = {
        rich_text: [{ text: { content: metadata.aiSessionId } }],
      };
    }

    if (metadata.gitBranch) {
      properties["Git Branch"] = {
        rich_text: [{ text: { content: metadata.gitBranch } }],
      };
    }

    if (metadata.prNumber) {
      properties["PR Number"] = {
        number: metadata.prNumber,
      };
    }

    if (metadata.prUrl) {
      properties["PR URL"] = {
        url: metadata.prUrl,
      };
    }

    if (Object.keys(properties).length > 0) {
      await (this.client.pages.update as (params: { page_id: string; properties: Record<string, unknown> }) => Promise<unknown>)({
        page_id: pageId,
        properties,
      });
    }
  }

  async createTask(
    databaseId: string,
    title: string,
    options?: {
      status?: NotionTaskStatus;
      priority?: NotionTaskPriority;
      dueDate?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<NotionTask> {
    const properties: Record<string, unknown> = {
      Name: {
        title: [{ text: { content: title } }],
      },
    };

    if (options?.status) {
      properties["Status"] = {
        status: { name: this.statusToNotionStatus(options.status) },
      };
    }

    if (options?.priority) {
      properties["Priority"] = {
        select: { name: this.priorityToNotionPriority(options.priority) },
      };
    }

    if (options?.dueDate) {
      properties["Due Date"] = {
        date: { start: options.dueDate },
      };
    }

    if (options?.tags && options.tags.length > 0) {
      properties["Tags"] = {
        multi_select: options.tags.map(tag => ({ name: tag })),
      };
    }

    const createParams: Record<string, unknown> = {
      parent: { database_id: databaseId },
      properties,
    };
    
    if (options?.description) {
      createParams.children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: options.description } }],
          },
        },
      ];
    }
    
    const page = await (this.client.pages.create as (params: Record<string, unknown>) => Promise<unknown>)(createParams) as NotionPageResponse;

    return this.pageToTask(page);
  }

  async searchDatabases(query?: string): Promise<NotionDatabase[]> {
    const searchParams: Record<string, unknown> = {
      filter: { property: "object", value: "database" },
      page_size: 20,
    };
    if (query) {
      searchParams.query = query;
    }
    
    const response = await (this.client.search as (params: Record<string, unknown>) => Promise<{ results: Array<{ object: string; id: string }> }>)(searchParams);

    const databases: NotionDatabase[] = [];
    
    for (const item of response.results) {
      if (item.object === "database") {
        const db = item as unknown as NotionDatabaseResponse;
        if (db.title && db.properties && db.url) {
          const title = db.title.map(t => t.plain_text).join("");
          const properties: Record<string, { type: string; name: string }> = {};
          
          for (const [name, prop] of Object.entries(db.properties)) {
            properties[name] = { type: prop.type, name };
          }
          
          databases.push({
            id: db.id,
            title,
            url: db.url,
            properties,
          });
        }
      }
    }
    
    return databases;
  }

  private pageToTask(page: NotionPageResponse): NotionTask {
    const props = page.properties as Record<string, unknown>;

    const title = this.extractTitle(props);
    const status = this.extractStatus(props);
    const priority = this.extractPriority(props);
    const dueDate = this.extractDate(props, "Due Date") || this.extractDate(props, "Due");
    const assignee = this.extractPerson(props, "Assignee") || this.extractPerson(props, "Assigned to");
    const tags = this.extractMultiSelect(props, "Tags") || this.extractMultiSelect(props, "Labels");

    return {
      id: page.id.replace(/-/g, ""),
      notionPageId: page.id,
      title,
      status,
      priority,
      dueDate,
      assignee,
      tags,
      url: page.url,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
      properties: props,
    };
  }

  private extractTitle(props: Record<string, unknown>): string {
    for (const prop of Object.values(props)) {
      const p = prop as { type?: string; title?: Array<{ plain_text: string }> };
      if (p.type === "title" && p.title) {
        return p.title.map(t => t.plain_text).join("");
      }
    }
    return "Untitled";
  }

  private extractStatus(props: Record<string, unknown>): NotionTaskStatus {
    const statusProp = props["Status"] as { type?: string; status?: { name: string }; select?: { name: string } } | undefined;
    if (statusProp?.type === "status" && statusProp.status) {
      const name = statusProp.status.name.toLowerCase();
      return STATUS_MAP[name] || "not_started";
    }
    if (statusProp?.type === "select" && statusProp.select) {
      const name = statusProp.select.name.toLowerCase();
      return STATUS_MAP[name] || "not_started";
    }
    return "not_started";
  }

  private extractPriority(props: Record<string, unknown>): NotionTaskPriority | undefined {
    const prop = props["Priority"] as { type?: string; select?: { name: string } } | undefined;
    if (prop?.type === "select" && prop.select) {
      const name = prop.select.name.toLowerCase();
      return PRIORITY_MAP[name];
    }
    return undefined;
  }

  private extractDate(props: Record<string, unknown>, key: string): string | undefined {
    const prop = props[key] as { type?: string; date?: { start: string } } | undefined;
    if (prop?.type === "date" && prop.date) {
      return prop.date.start;
    }
    return undefined;
  }

  private extractPerson(props: Record<string, unknown>, key: string): string | undefined {
    const prop = props[key] as { type?: string; people?: Array<{ name?: string }> } | undefined;
    if (prop?.type === "people" && prop.people && prop.people.length > 0) {
      return prop.people[0].name || undefined;
    }
    return undefined;
  }

  private extractMultiSelect(props: Record<string, unknown>, key: string): string[] | undefined {
    const prop = props[key] as { type?: string; multi_select?: Array<{ name: string }> } | undefined;
    if (prop?.type === "multi_select" && prop.multi_select) {
      return prop.multi_select.map(s => s.name);
    }
    return undefined;
  }

  private statusToNotionStatus(status: NotionTaskStatus): string {
    const map: Record<NotionTaskStatus, string> = {
      "not_started": "Not started",
      "in_progress": "In progress",
      "done": "Done",
      "blocked": "Blocked",
      "cancelled": "Cancelled",
    };
    return map[status] || "Not started";
  }

  private priorityToNotionPriority(priority: NotionTaskPriority): string {
    const map: Record<NotionTaskPriority, string> = {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "urgent": "Urgent",
    };
    return map[priority] || "Medium";
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.users.me({});
      return true;
    } catch {
      return false;
    }
  }
}

export class NotionService {
  private client: NotionClient | null = null;

  private getClient(): NotionClient {
    if (!this.client) {
      const token = process.env.NOTION_API_TOKEN;
      if (!token) {
        throw new Error("NOTION_API_TOKEN environment variable is not set");
      }
      this.client = new NotionClient(token);
    }
    return this.client;
  }

  async syncTasks(databaseId: string, cursor?: string): Promise<NotionSyncResult> {
    return this.getClient().queryTasks(databaseId, { startCursor: cursor });
  }

  async syncActiveTasks(databaseId: string): Promise<NotionSyncResult> {
    return this.getClient().queryTasks(databaseId, {
      filter: {
        property: "Status",
        status: {
          does_not_equal: "Done",
        },
      },
    });
  }

  async getTask(pageId: string): Promise<NotionTask> {
    return this.getClient().getTask(pageId);
  }

  async updateTaskStatus(pageId: string, status: NotionTaskStatus): Promise<NotionTask> {
    return this.getClient().updateTask(pageId, { status });
  }

  async linkTaskToAISession(
    pageId: string,
    aiSessionId: string,
    gitBranch: string
  ): Promise<void> {
    await this.getClient().addLinkMetadata(pageId, {
      aiSessionId,
      gitBranch,
    });
    await this.getClient().updateTask(pageId, { status: "in_progress" });
  }

  async linkTaskToPR(pageId: string, prNumber: number, prUrl: string): Promise<void> {
    await this.getClient().addLinkMetadata(pageId, {
      prNumber,
      prUrl,
    });
  }

  async completeTask(pageId: string): Promise<NotionTask> {
    return this.getClient().updateTask(pageId, { status: "done" });
  }

  async listDatabases(query?: string): Promise<NotionDatabase[]> {
    return this.getClient().searchDatabases(query);
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.getClient().getDatabase(databaseId);
  }

  async createTask(
    databaseId: string,
    title: string,
    options?: {
      status?: NotionTaskStatus;
      priority?: NotionTaskPriority;
      dueDate?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<NotionTask> {
    return this.getClient().createTask(databaseId, title, options);
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.getClient().healthCheck();
    } catch {
      return false;
    }
  }
}

export const notionService = new NotionService();
