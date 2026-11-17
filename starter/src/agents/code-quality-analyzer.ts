/**
 * Code Quality Analyzer Agent
 *
 * Specialized agent that analyzes code for:
 * - Security vulnerabilities
 * - Performance issues
 * - Maintainability concerns
 * - Style and best practice violations
 * - Potential bug risks
 *
 * Uses Claude Skills (javascript-best-practices) for specialized analysis
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger.js';
import { CodeQualityResultSchema, CodeQualityResultJSONSchema } from '../types/index.js';
import { buildCodeQualityPrompt } from '../prompts/code-quality-analyzer.prompt.js';
import type { CodeQualityResult } from '../types/index.js';

/**
 * Configuration for the Code Quality Analyzer agent
 */
interface CodeQualityAnalyzerConfig {
  model: string;
  projectRoot: string;
}

/**
 * Analyze code quality for changed files in a pull request
 *
 * @param prDescription - Description of the pull request
 * @param changedFiles - List of files changed in the PR
 * @param config - Agent configuration (model, projectRoot)
 * @returns Structured code quality analysis result
 */
export async function analyzeCodeQuality(
  prDescription: string,
  changedFiles: string[],
  config: CodeQualityAnalyzerConfig
): Promise<CodeQualityResult> {
  const startTime = Date.now();

  logger.debug('Code Quality Analyzer starting', {
    fileCount: changedFiles.length,
    model: config.model
  });

  try {
    // Build the prompt for the agent
    const prompt = buildCodeQualityPrompt(prDescription, changedFiles);

    // Execute the agent query with structured output
    for await (const message of query({
      prompt,
      options: {
        model: config.model,
        cwd: config.projectRoot,
        // Load Claude Skills from .claude/skills directory
        settingSources: ['project'],
        // Tools available to this agent:
        // - Skill: Invoke custom skills (javascript-best-practices, etc.)
        // - Read: Read file contents
        // - Grep: Search file contents for patterns
        // - Glob: Find files by pattern
        allowedTools: ['Skill', 'Read', 'Grep', 'Glob'],
        // Enforce structured output matching our schema
        outputFormat: {
          type: 'json_schema',
          schema: CodeQualityResultJSONSchema
        }
      }
    })) {
      // Log tool usage for debugging
      if (message.type === 'assistant') {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              logger.debug('Agent using tool', { tool: block.name });
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
        const parsed = CodeQualityResultSchema.safeParse(message.structured_output);

        if (parsed.success) {
          const duration = Date.now() - startTime;
          logger.debug('Code Quality Analyzer completed successfully', {
            duration,
            issueCount: parsed.data.issues.length,
            overallScore: parsed.data.overallScore
          });

          return parsed.data;
        } else {
          logger.error('Code Quality Analyzer schema validation failed', {
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
          'Code Quality Analysis failed: Structured output generation failed after maximum retries.'
        );
      }
    }

    throw new Error('Code Quality Analysis failed: No result received from agent');
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Code Quality Analyzer failed', {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Agent definition for use in multi-agent orchestration
 * Describes the agent's purpose and capabilities for the orchestrator
 */
export const codeQualityAnalyzerDefinition = {
  name: 'Code Quality Analyzer',
  description: 'Analyzes code for security vulnerabilities, performance issues, maintainability concerns, and best practice violations. Uses JavaScript best practices skill for specialized analysis.',
  tools: ['Skill', 'Read', 'Grep', 'Glob'],
  outputSchema: CodeQualityResultJSONSchema
};
