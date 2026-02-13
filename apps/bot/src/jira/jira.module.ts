import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JiraClientService } from './jira-client.service.js';
import { JiraIssueService } from './jira-issue.service.js';
import { JiraTransitionPolicyService } from './jira-transition-policy.service.js';
import { JiraProcessor } from '../shared/queue/jira.processor.js';
import {
  JIRA_AUTH_STRATEGY,
  JiraBasicAuthStrategy,
  JiraOAuth2Strategy,
} from './auth/index.js';

const jiraAuthStrategyProvider = {
  provide: JIRA_AUTH_STRATEGY,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const mode = configService.get<string>('JIRA_AUTH_MODE') ?? 'basic';
    switch (mode) {
      case 'oauth2':
        return new JiraOAuth2Strategy(configService);
      case 'basic':
      default:
        return new JiraBasicAuthStrategy(configService);
    }
  },
};

@Module({
  providers: [
    jiraAuthStrategyProvider,
    JiraClientService,
    JiraIssueService,
    JiraTransitionPolicyService,
    JiraProcessor,
  ],
  exports: [JiraClientService, JiraIssueService, JiraTransitionPolicyService],
})
export class JiraModule {}
