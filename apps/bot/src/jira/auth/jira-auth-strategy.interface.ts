/**
 * Abstraction for Jira authentication strategies.
 * Implementations provide HTTP headers needed to authenticate with the Jira API.
 */
export interface JiraAuthStrategy {
  /**
   * Returns HTTP headers required for Jira API authentication.
   * The returned record is spread into every outgoing request.
   */
  getAuthHeaders(): Promise<Record<string, string>>;
}

/** DI token for the active JiraAuthStrategy */
export const JIRA_AUTH_STRATEGY = 'JIRA_AUTH_STRATEGY';
