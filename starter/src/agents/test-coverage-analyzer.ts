/**
 * Test Coverage Analyzer Agent
 *
 * Specialized agent that evaluates test completeness by:
 * - Comparing source files with test files
 * - Identifying untested code paths (functions, branches, edge cases)
 * - Suggesting specific, actionable test cases
 * - Estimating overall coverage percentage
 *
 * Uses Claude Skills for specialized testing knowledge and patterns
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger.js';
import { TestCoverageResultSchema, TestCoverageResultJSONSchema } from '../types/index.js';
import { buildTestCoveragePrompt } from '../prompts/test-coverage-analyzer.prompt.js';
import type { TestCoverageResult } from '../types/index.js';

/**
 * Configuration for the Test Coverage Analyzer agent
 */
interface TestCoverageAnalyzerConfig {
  model: string;
  projectRoot: string;
}

/**
 * Analyze test coverage for changed files in a pull request
 *
 * Estimates test coverage by comparing source files with test files
 * and identifying untested code paths without actually running tests
 *
 * @param prDescription - Description of the pull request
 * @param changedFiles - List of files changed in the PR
 * @param config - Agent configuration (model, projectRoot)
 * @returns Structured test coverage analysis result
 */
export async function analyzeTestCoverage(
  prDescription: string,
  changedFiles: string[],
  config: TestCoverageAnalyzerConfig
): Promise<TestCoverageResult> {
  const startTime = Date.now();

  logger.debug('Test Coverage Analyzer starting', {
    fileCount: changedFiles.length,
    model: config.model
  });

  try {
    // Build the prompt for the agent
    const prompt = buildTestCoveragePrompt(prDescription, changedFiles);

    // Execute the agent query with structured output
    for await (const message of query({
      prompt,
      options: {
        model: config.model,
        cwd: config.projectRoot,
        // Load Claude Skills from .claude/skills directory
        settingSources: ['project'],
        // Tools available to this agent:
        // - Skill: Invoke custom skills for testing patterns and best practices
        // - Read: Read source and test files
        // - Grep: Search for test patterns, assert calls, describe blocks
        // - Glob: Find test files (*test.ts, *spec.ts)
        allowedTools: ['Skill', 'Read', 'Grep', 'Glob'],
        // Enforce structured output matching our schema
        outputFormat: {
          type: 'json_schema',
          schema: TestCoverageResultJSONSchema
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
        const parsed = TestCoverageResultSchema.safeParse(message.structured_output);

        if (parsed.success) {
          const duration = Date.now() - startTime;
          logger.debug('Test Coverage Analyzer completed successfully', {
            duration,
            coverageEstimate: parsed.data.coverageEstimate,
            untestedPathCount: parsed.data.untestedPaths.length
          });

          return parsed.data;
        } else {
          logger.error('Test Coverage Analyzer schema validation failed', {
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
          'Test Coverage Analysis failed: Structured output generation failed after maximum retries.'
        );
      }
    }

    throw new Error('Test Coverage Analysis failed: No result received from agent');
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Test Coverage Analyzer failed', {
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
export const testCoverageAnalyzerDefinition = {
  name: 'Test Coverage Analyzer',
  description: 'Evaluates test completeness by analyzing source files against test files. Identifies untested code paths (functions, branches, edge cases) and suggests specific, actionable test cases. Estimates overall coverage percentage without running tests.',
  tools: ['Skill', 'Read', 'Grep', 'Glob'],
  outputSchema: TestCoverageResultJSONSchema
};
