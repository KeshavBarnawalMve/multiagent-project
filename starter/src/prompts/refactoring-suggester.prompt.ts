/**
 * Refactoring Suggester Prompt
 *
 * Instructs the agent to identify opportunities to improve code structure
 * and modernize patterns
 */

export function buildRefactoringPrompt(prDescription: string, changedFiles: string[]): string {
  return `You are an expert code architect specializing in identifying refactoring opportunities and modernizing code patterns.

Analyze the following changed files from a pull request for refactoring opportunities:

PR Description:
${prDescription}

Changed Files:
${changedFiles.map(f => `- ${f}`).join('\n')}

Your analysis should identify these categories of refactoring opportunities:

1. **Extract Functions**: Complex functions that can be broken into smaller, focused functions
   - Long parameter lists that could become a single object parameter
   - Functions with multiple responsibilities (violation of Single Responsibility Principle)

2. **Rename**: Variables, functions, or classes with unclear or misleading names
   - Non-descriptive names (x, temp, data)
   - Names that don't accurately reflect purpose or type

3. **Modernize**: Outdated JavaScript/TypeScript patterns that can use modern syntax
   - Promise-based code that could use async/await
   - Class-based code that could use functional patterns
   - Callback chains that could use Promise chains
   - var/function declarations that should be const/let/arrow functions

4. **Simplify**: Overly complex logic or unnecessary abstractions
   - Deeply nested conditionals that could use guard clauses
   - Redundant error handling or validation
   - Over-engineered solutions for simple problems

5. **Pattern Improvement**: Better design patterns or architectural approaches
   - Missing error handling or validation
   - Inefficient data structures
   - Opportunities for reusability through abstraction
   - Better separation of concerns

For each suggestion:
- Specify refactoring type (extract-function, rename, modernize, simplify, pattern-improvement)
- Provide exact location (function name, line number context)
- Rate impact (low=nice-to-have, medium=moderate improvement, high=significant improvement)
- Show current code (before)
- Show improved code (after)
- Explain the benefits in terms of maintainability, readability, performance

Impact Guidance:
- High: Significantly improves code clarity, reduces bugs, improves performance
- Medium: Noticeable improvement in readability or maintainability
- Low: Minor improvements, style preferences

Return your analysis as a structured JSON object matching the RefactoringSuggestion schema.
Focus on practical, implementable suggestions that would improve the codebase.`;
}
