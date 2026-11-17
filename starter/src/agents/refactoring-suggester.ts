/**
 * Refactoring Suggester Agent
 *
 * Specialized agent that identifies opportunities to improve code structure
 * and modernize patterns:
 * - Extract functions from complex logic
 * - Rename variables/functions for clarity
 * - Modernize outdated patterns
 * - Simplify overly complex code
 * - Improve design patterns
 *
 * Differs from Code Quality Analyzer:
 * - Quality Analyzer finds bugs/security issues
 * - Refactoring Suggester improves architecture/maintainability
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger.js';
import { RefactoringSuggestionSchema, RefactoringSuggestionJSONSchema } from '../types/index.js';
import { buildRefactoringPrompt } from '../prompts/refactoring-suggester.prompt.js';
import type { RefactoringSuggestion } from '../types/index.js';

/**
 * Configuration for the Refactoring Suggester agent
 */
interface RefactoringSuggesterConfig {
  model: string;
  projectRoot: string;
}

/**
 * Suggest refactoring opportunities for changed files in a pull request
 *
 * Identifies opportunities to:
 * - Improve code structure and maintainability
 * - Modernize patterns to current standards
 * - Simplify complex logic
 * - Apply better design patterns
 *
 * @param prDescription - Description of the pull request
 * @param changedFiles - List of files changed in the PR
 * @param config - Agent configuration (model, projectRoot)
 * @returns Structured refactoring suggestions result
 */
export async function suggestRefactorings(
  prDescription: string,
  changedFiles: string[],
  config: RefactoringSuggesterConfig
): Promise<RefactoringSuggestion> {
  const startTime = Date.now();

  logger.debug('Refactoring Suggester starting', {
    fileCount: changedFiles.length,
    model: config.model
  });

  try {
    // Build the prompt for the agent
    const prompt = buildRefactoringPrompt(prDescription, changedFiles);

    // Execute the agent query with structured output
    for await (const message of query({
      prompt,
      options: {
        model: config.model,
        cwd: config.projectRoot,
        // Load Claude Skills from .claude/skills directory
        settingSources: ['project'],
        // Tools available to this agent:
        // - Skill: Invoke custom skills for design patterns and architecture
        // - Read: Read and understand source code structure
        // - Grep: Search for specific patterns that indicate refactoring opportunities
        // - Glob: Find related files and understand project structure
        allowedTools: ['Skill', 'Read', 'Grep', 'Glob'],
        // Enforce structured output matching our schema
        outputFormat: {
          type: 'json_schema',
          schema: RefactoringSuggestionJSONSchema
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
        const parsed = RefactoringSuggestionSchema.safeParse(message.structured_output);

        if (parsed.success) {
          const duration = Date.now() - startTime;
          logger.debug('Refactoring Suggester completed successfully', {
            duration,
            suggestionCount: parsed.data.suggestions.length
          });

          return parsed.data;
        } else {
          logger.error('Refactoring Suggester schema validation failed', {
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
          'Refactoring Analysis failed: Structured output generation failed after maximum retries.'
        );
      }
    }

    throw new Error('Refactoring Analysis failed: No result received from agent');
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Refactoring Suggester failed', {
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
export const refactoringSuggesterDefinition = {
  name: 'Refactoring Suggester',
  description: 'Identifies opportunities to improve code structure and modernize patterns. Suggests specific refactorings (extract functions, rename, modernize patterns, simplify logic) with before/after examples. Focuses on maintainability and architectural improvements.',
  tools: ['Skill', 'Read', 'Grep', 'Glob'],
  outputSchema: RefactoringSuggestionJSONSchema
};
