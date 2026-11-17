/**
 * Centralized prompt management
 *
 * Prompts for multi-agent code review orchestration
 */

export { buildCodeQualityPrompt } from './code-quality-analyzer.prompt';
export { buildTestCoveragePrompt } from './test-coverage-analyzer.prompt';
export { buildRefactoringPrompt } from './refactoring-suggester.prompt';
export { buildOrchestratorPrompt } from './orchestrator.prompt';
