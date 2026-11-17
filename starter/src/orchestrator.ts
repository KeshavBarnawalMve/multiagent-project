import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { logger, logReviewStart, logReviewComplete, logReviewError } from './utils/logger.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import {
  codeQualityAnalyzerDefinition,
  testCoverageAnalyzerDefinition,
  refactoringSuggesterDefinition
} from './agents/index.js';
import type { ReviewReport } from './types/report-types.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  projectRoot?: string;
  maxTurns?: number;
}

/**
 * Main Code Review Orchestrator
 *
 * Coordinates three specialized subagents to perform comprehensive code review:
 * 1. Code Quality Analyzer - Finds bugs, security issues, performance problems
 * 2. Test Coverage Analyzer - Evaluates test completeness
 * 3. Refactoring Suggester - Identifies code improvement opportunities
 *
 * Uses Claude Agent SDK with:
 * - Multi-agent orchestration (Task tool for subagent invocation)
 * - GitHub MCP integration (fetch PR data)
 * - Structured outputs (ReviewReport schema)
 */
export class CodeReviewOrchestrator {
  private model: string;
  private projectRoot: string;
  private maxTurns: number;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/voc/work/project/starter';
    this.maxTurns = options.maxTurns || 20;
  }

  /**
   * Review a pull request using parallel subagent analysis
   *
   * Process:
   * 1. Fetches PR data using GitHub MCP tools
   * 2. Coordinates three subagents in parallel using Task tool
   * 3. Aggregates results into structured ReviewReport
   * 4. Validates output against ReviewReportSchema
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();

    logReviewStart(owner, repo, prNumber);

    try {
      // Define subagents for multi-agent orchestration
      const subagents: Record<string, AgentDefinition> = {
        'code-quality-analyzer': {
          description: codeQualityAnalyzerDefinition.description,
          prompt: `You are the Code Quality Analyzer. Analyze the pull request for security vulnerabilities, performance issues, and maintainability concerns. Focus on finding bugs, security risks, and code smells. Use the javascript-best-practices skill when analyzing JavaScript/TypeScript files.`,
          tools: codeQualityAnalyzerDefinition.tools,
          model: 'haiku'  // Use faster model for subagents
        },
        'test-coverage-analyzer': {
          description: testCoverageAnalyzerDefinition.description,
          prompt: `You are the Test Coverage Analyzer. Evaluate test completeness by comparing source files with test files. Identify untested code paths and suggest specific test cases. Estimate overall coverage percentage.`,
          tools: testCoverageAnalyzerDefinition.tools,
          model: 'haiku'
        },
        'refactoring-suggester': {
          description: refactoringSuggesterDefinition.description,
          prompt: `You are the Refactoring Suggester. Identify opportunities to improve code structure and modernize patterns. Suggest extract functions, rename, modernize patterns, simplify logic, and pattern improvements. Provide before/after examples.`,
          tools: refactoringSuggesterDefinition.tools,
          model: 'haiku'
        }
      };

      // Build orchestrator prompt
      const orchestratorPrompt = buildOrchestratorPrompt(owner, repo, prNumber);

      // Execute orchestrator with multi-agent coordination
      for await (const message of query({
        prompt: this.generateMessages(orchestratorPrompt),
        options: {
          model: this.model,
          cwd: this.projectRoot,
          // Enable MCP servers for GitHub API access
          mcpServers: {
            github: {
              type: 'stdio' as const,
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-github'],
              env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' }
            }
          },
          // Tools available to orchestrator:
          // - Task: Invoke subagents (code-quality-analyzer, test-coverage-analyzer, refactoring-suggester)
          // - mcp__github__*: GitHub MCP tools for fetching PR data
          allowedTools: [
            'Task',
            'mcp__github__*'  // All GitHub MCP tools with wildcard pattern
          ],
          // Register subagents for Task tool invocation
          agents: subagents,
          // Configuration for reliability
          maxTurns: this.maxTurns,
          // Enforce structured output matching ReviewReport schema
          outputFormat: {
            type: 'json_schema',
            schema: ReviewReportJSONSchema
          }
        }
      })) {
        // Log tool usage for debugging
        if (message.type === 'assistant') {
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                if (block.name === 'Task') {
                  const input = block.input as { description?: string };
                  logger.debug('Orchestrator invoking subagent', {
                    agent: input.description || 'unknown'
                  });
                } else if (block.name.startsWith('mcp__github__')) {
                  logger.debug('Orchestrator calling GitHub MCP', {
                    tool: block.name
                  });
                }
              }
            }
          }
        }

        // Handle successful structured output
        if (
          message.type === 'result' &&
          message.subtype === 'success' &&
          message.structured_output
        ) {
          // Validate output against schema
          const parsed = ReviewReportSchema.safeParse(message.structured_output);

          if (parsed.success) {
            const duration = Date.now() - startTime;
            const score = parsed.data.summary.overallScore;

            logReviewComplete(owner, repo, prNumber, score, duration);

            logger.info('Code review completed successfully', {
              owner,
              repo,
              prNumber,
              score,
              duration,
              fileCount: parsed.data.summary.totalFiles,
              criticalIssues: parsed.data.summary.criticalIssues
            });

            return parsed.data;
          } else {
            logger.error('Orchestrator schema validation failed', {
              errors: parsed.error.errors
            });
            throw new Error(`Schema validation failed: ${parsed.error.message}`);
          }
        }

        // Handle structured output retry exhaustion
        if (
          message.type === 'result' &&
          message.subtype === 'error_max_structured_output_retries'
        ) {
          throw new Error(
            'Code review orchestration failed: Structured output generation failed after maximum retries.'
          );
        }
      }

      throw new Error('Code review orchestration failed: No result received from agent');
    } catch (error) {
      const duration = Date.now() - startTime;

      logReviewError(owner, repo, prNumber, error instanceof Error ? error : new Error(String(error)));

      logger.error('Code review orchestration failed', {
        owner,
        repo,
        prNumber,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Create async generator for message streaming
   * Required by Agent SDK for streaming compatibility
   */
  private async *generateMessages(userMessage: string) {
    yield {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content: userMessage
      },
      parent_tool_use_id: null,
      session_id: 'code-review-orchestrator'
    };
  }
}
