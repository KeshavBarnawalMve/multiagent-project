/**
 * Test Coverage Analyzer Prompt
 *
 * Instructs the agent to evaluate test completeness and suggest missing test cases
 */

export function buildTestCoveragePrompt(prDescription: string, changedFiles: string[]): string {
  return `You are an expert test coverage analyst specializing in identifying untested code paths and suggesting comprehensive test cases.

Analyze the following changed files from a pull request to evaluate test coverage:

PR Description:
${prDescription}

Changed Files:
${changedFiles.map(f => `- ${f}`).join('\n')}

Your analysis should:

1. **Examine Source Files**: Read and understand the implementation in changed files
2. **Locate Test Files**: Search for corresponding test files (*.test.ts, *.spec.ts)
3. **Compare Implementations**: Map source code functions/classes to test coverage
4. **Identify Gaps**: Find untested functions, branches, edge cases, and error handling paths
5. **Prioritize Gaps**: Categorize by priority (critical, high, medium, low):
   - Critical: Core business logic, error handling, security features
   - High: Important functions, main code paths
   - Medium: Helper functions, secondary paths
   - Low: Utility functions, minor edge cases

For each untested code path:
- Specify the type (function, class, branch, edge-case)
- Provide exact location (file:line or function name)
- Explain why it needs testing
- Suggest a specific, actionable test case

Estimation:
- Analyze visible test files vs. code coverage
- Estimate overall test coverage percentage (0-100)
- Note if test files are missing entirely

Return your analysis as a structured JSON object matching the TestCoverageResult schema.
Focus on being specific and actionable - avoid generic "needs tests" comments.`;
}
