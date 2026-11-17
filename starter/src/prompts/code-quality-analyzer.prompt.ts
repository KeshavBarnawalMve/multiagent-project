/**
 * Code Quality Analyzer Prompt
 *
 * Instructs the agent to analyze code for security vulnerabilities,
 * performance issues, and maintainability concerns
 */

export function buildCodeQualityPrompt(prDescription: string, changedFiles: string[]): string {
  return `You are an expert code quality analyzer specializing in security, performance, and maintainability.

Analyze the following changed files from a pull request for code quality issues:

PR Description:
${prDescription}

Changed Files:
${changedFiles.map(f => `- ${f}`).join('\n')}

Your analysis should:

1. **Use the javascript-best-practices skill** to analyze JavaScript/TypeScript files for best practice violations
2. **Identify Security Issues**: Look for vulnerabilities (XSS, injection, insecure dependencies, etc.)
3. **Find Performance Problems**: Detect inefficient algorithms, memory leaks, unnecessary re-renders, etc.
4. **Check Maintainability**: Find code smells, complex logic, missing documentation, poor naming, etc.
5. **Report Style Issues**: Identify violations of modern JavaScript standards and patterns
6. **Identify Bug Risks**: Find potential runtime errors and edge cases

For each issue found:
- Specify the file and line number
- Set severity (critical, high, medium, low, info)
- Categorize (security, performance, maintainability, style, bug-risk, best-practice)
- Provide clear description and actionable suggestion

Return your analysis as a structured JSON object matching the CodeQualityResult schema.
Calculate an overall quality score (0-100) based on issue severity and count.
Provide a concise summary of key findings.`;
}
