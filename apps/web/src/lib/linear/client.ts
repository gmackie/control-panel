const LINEAR_API_URL = 'https://api.linear.app/graphql';

export interface LinearConfig {
  apiKey: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  teamIds: string[];
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  position: number;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state: LinearWorkflowState;
  assignee?: LinearUser;
  labels: { nodes: LinearLabel[] };
  project?: LinearProject;
  team: LinearTeam;
  url: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimate?: number;
}

export interface LinearIssueInput {
  title: string;
  description?: string;
  teamId: string;
  projectId?: string;
  assigneeId?: string;
  stateId?: string;
  priority?: number;
  labelIds?: string[];
  dueDate?: string;
  estimate?: number;
}

export interface LinearIssueUpdateInput {
  title?: string;
  description?: string;
  stateId?: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  dueDate?: string;
  estimate?: number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

export class LinearClient {
  private apiKey: string;

  constructor(config?: Partial<LinearConfig>) {
    this.apiKey = config?.apiKey || process.env.LINEAR_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[LinearClient] No API key provided');
    }
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    if (!result.data) {
      throw new Error('Linear API returned no data');
    }

    return result.data;
  }

  async getTeams(): Promise<LinearTeam[]> {
    const query = `
      query Teams {
        teams {
          nodes {
            id
            name
            key
            description
          }
        }
      }
    `;

    const data = await this.graphql<{ teams: { nodes: LinearTeam[] } }>(query);
    return data.teams.nodes;
  }

  async getProjects(teamId?: string): Promise<LinearProject[]> {
    const query = `
      query Projects($teamId: String) {
        projects(filter: { team: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
            description
            state
          }
        }
      }
    `;

    const data = await this.graphql<{ projects: { nodes: LinearProject[] } }>(query, { teamId });
    return data.projects.nodes;
  }

  async getLabels(teamId?: string): Promise<LinearLabel[]> {
    const query = `
      query Labels($teamId: String) {
        issueLabels(filter: { team: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
            color
            description
          }
        }
      }
    `;

    const data = await this.graphql<{ issueLabels: { nodes: LinearLabel[] } }>(query, { teamId });
    return data.issueLabels.nodes;
  }

  async getWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const query = `
      query WorkflowStates($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
            type
            color
            position
          }
        }
      }
    `;

    const data = await this.graphql<{ workflowStates: { nodes: LinearWorkflowState[] } }>(query, { teamId });
    return data.workflowStates.nodes;
  }

  async getIssues(options?: {
    teamId?: string;
    projectId?: string;
    stateId?: string;
    assigneeId?: string;
    first?: number;
    after?: string;
  }): Promise<{ issues: LinearIssue[]; hasMore: boolean; endCursor?: string }> {
    const query = `
      query Issues($teamId: String, $projectId: String, $stateId: String, $assigneeId: String, $first: Int, $after: String) {
        issues(
          first: $first
          after: $after
          filter: {
            team: { id: { eq: $teamId } }
            project: { id: { eq: $projectId } }
            state: { id: { eq: $stateId } }
            assignee: { id: { eq: $assigneeId } }
          }
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            createdAt
            updatedAt
            dueDate
            estimate
            state {
              id
              name
              type
              color
              position
            }
            assignee {
              id
              name
              email
              avatarUrl
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            project {
              id
              name
            }
            team {
              id
              name
              key
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await this.graphql<{
      issues: {
        nodes: LinearIssue[];
        pageInfo: { hasNextPage: boolean; endCursor?: string };
      };
    }>(query, {
      teamId: options?.teamId,
      projectId: options?.projectId,
      stateId: options?.stateId,
      assigneeId: options?.assigneeId,
      first: options?.first || 50,
      after: options?.after,
    });

    return {
      issues: data.issues.nodes,
      hasMore: data.issues.pageInfo.hasNextPage,
      endCursor: data.issues.pageInfo.endCursor,
    };
  }

  async getIssue(id: string): Promise<LinearIssue | null> {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          url
          createdAt
          updatedAt
          dueDate
          estimate
          state {
            id
            name
            type
            color
            position
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          project {
            id
            name
          }
          team {
            id
            name
            key
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{ issue: LinearIssue }>(query, { id });
      return data.issue;
    } catch {
      return null;
    }
  }

  async createIssue(input: LinearIssueInput): Promise<LinearIssue> {
    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            createdAt
            updatedAt
            state {
              id
              name
              type
              color
              position
            }
            assignee {
              id
              name
              email
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            team {
              id
              name
              key
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      issueCreate: { success: boolean; issue: LinearIssue };
    }>(mutation, { input });

    if (!data.issueCreate.success) {
      throw new Error('Failed to create Linear issue');
    }

    return data.issueCreate.issue;
  }

  async updateIssue(id: string, input: LinearIssueUpdateInput): Promise<LinearIssue> {
    const mutation = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            createdAt
            updatedAt
            state {
              id
              name
              type
              color
              position
            }
            assignee {
              id
              name
              email
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            team {
              id
              name
              key
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      issueUpdate: { success: boolean; issue: LinearIssue };
    }>(mutation, { id, input });

    if (!data.issueUpdate.success) {
      throw new Error('Failed to update Linear issue');
    }

    return data.issueUpdate.issue;
  }

  async deleteIssue(id: string): Promise<boolean> {
    const mutation = `
      mutation DeleteIssue($id: String!) {
        issueDelete(id: $id) {
          success
        }
      }
    `;

    const data = await this.graphql<{ issueDelete: { success: boolean } }>(mutation, { id });
    return data.issueDelete.success;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getTeams();
      return true;
    } catch {
      return false;
    }
  }
}
