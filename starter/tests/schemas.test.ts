import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema
} from '../src/types/index.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from '../src/types/report-types.js';

/**
 * Schema Validation Tests
 *
 * Tests that verify Zod schemas properly validate data
 * and that JSON schemas are properly exported
 */

describe('CodeQualityResultSchema', () => {
  describe('Valid Data', () => {
    it('should parse valid code quality result', () => {
      const validData = {
        file: 'src/main.ts',
        issues: [
          {
            line: 42,
            severity: 'high' as const,
            category: 'security' as const,
            description: 'XSS vulnerability in template',
            suggestion: 'Use DOMPurify to sanitize input'
          }
        ],
        overallScore: 75,
        summary: 'Found 1 high severity issue'
      };

      expect(() => CodeQualityResultSchema.parse(validData)).not.toThrow();
      const parsed = CodeQualityResultSchema.parse(validData);
      expect(parsed.file).toBe('src/main.ts');
      expect(parsed.issues).toHaveLength(1);
      expect(parsed.overallScore).toBe(75);
    });

    it('should parse with multiple issues', () => {
      const validData = {
        file: 'src/utils.ts',
        issues: [
          {
            line: 10,
            severity: 'critical' as const,
            category: 'security' as const,
            description: 'SQL Injection risk',
            suggestion: 'Use parameterized queries'
          },
          {
            line: 25,
            severity: 'medium' as const,
            category: 'performance' as const,
            description: 'Inefficient loop',
            suggestion: 'Use Set instead of array'
          },
          {
            line: 40,
            severity: 'low' as const,
            category: 'style' as const,
            description: 'Unused variable',
            suggestion: 'Remove unused variable'
          }
        ],
        overallScore: 60,
        summary: 'Multiple issues found'
      };

      const parsed = CodeQualityResultSchema.parse(validData);
      expect(parsed.issues).toHaveLength(3);
      expect(parsed.issues[0].severity).toBe('critical');
      expect(parsed.issues[1].category).toBe('performance');
    });
  });

  describe('Invalid Data', () => {
    it('should reject missing required file field', () => {
      const invalidData = {
        issues: [],
        overallScore: 80,
        summary: 'All good'
      };

      expect(() => CodeQualityResultSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should reject invalid severity level', () => {
      const invalidData = {
        file: 'src/test.ts',
        issues: [
          {
            line: 10,
            severity: 'extreme' as unknown,
            category: 'security' as const,
            description: 'Issue',
            suggestion: 'Fix it'
          }
        ],
        overallScore: 50,
        summary: 'Issues found'
      };

      expect(() => CodeQualityResultSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should reject invalid score (outside 0-100)', () => {
      const invalidData = {
        file: 'src/test.ts',
        issues: [],
        overallScore: 150,
        summary: 'Score too high'
      };

      expect(() => CodeQualityResultSchema.parse(invalidData)).toThrow(ZodError);
    });
  });

  describe('Edge Cases', () => {
    it('should accept empty issues array', () => {
      const validData = {
        file: 'src/perfect.ts',
        issues: [],
        overallScore: 100,
        summary: 'No issues found'
      };

      const parsed = CodeQualityResultSchema.parse(validData);
      expect(parsed.issues).toHaveLength(0);
    });

    it('should accept score boundaries (0 and 100)', () => {
      const dataMin = {
        file: 'src/worst.ts',
        issues: [],
        overallScore: 0,
        summary: 'Critical state'
      };

      const dataMax = {
        file: 'src/best.ts',
        issues: [],
        overallScore: 100,
        summary: 'Perfect code'
      };

      expect(() => CodeQualityResultSchema.parse(dataMin)).not.toThrow();
      expect(() => CodeQualityResultSchema.parse(dataMax)).not.toThrow();
    });
  });

  describe('JSON Schema Export', () => {
    it('should export valid JSON schema', () => {
      expect(CodeQualityResultJSONSchema).toBeDefined();
      expect(typeof CodeQualityResultJSONSchema).toBe('object');
    });

    it('JSON schema should have required properties', () => {
      const schema = CodeQualityResultJSONSchema as Record<string, unknown>;
      expect(schema.required).toBeDefined();
      expect(Array.isArray(schema.required)).toBe(true);
    });
  });
});

describe('TestCoverageResultSchema', () => {
  describe('Valid Data', () => {
    it('should parse valid test coverage result', () => {
      const validData = {
        file: 'src/services/auth.ts',
        hasTests: true,
        testFiles: ['tests/services/auth.test.ts'],
        untestedPaths: [
          {
            type: 'branch' as const,
            location: 'login() - error case',
            priority: 'high' as const,
            reasoning: 'Network error handling not tested',
            suggestedTest: 'expect(() => login()).toThrow(NetworkError)'
          }
        ],
        coverageEstimate: 85,
        summary: 'Good coverage with one gap'
      };

      const parsed = TestCoverageResultSchema.parse(validData);
      expect(parsed.file).toBe('src/services/auth.ts');
      expect(parsed.coverageEstimate).toBe(85);
      expect(parsed.untestedPaths).toHaveLength(1);
    });
  });

  describe('Invalid Data', () => {
    it('should reject invalid priority level', () => {
      const invalidData = {
        file: 'src/test.ts',
        hasTests: true,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function' as const,
            location: 'getData()',
            priority: 'optional' as unknown,
            reasoning: 'Not fully tested',
            suggestedTest: 'Test it'
          }
        ],
        coverageEstimate: 50,
        summary: 'Issues'
      };

      expect(() => TestCoverageResultSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should reject invalid untested type', () => {
      const invalidData = {
        file: 'src/test.ts',
        hasTests: true,
        testFiles: [],
        untestedPaths: [
          {
            type: 'statement' as unknown,
            location: 'line 42',
            priority: 'high' as const,
            reasoning: 'Not tested',
            suggestedTest: 'Add test'
          }
        ],
        coverageEstimate: 50,
        summary: 'Issues'
      };

      expect(() => TestCoverageResultSchema.parse(invalidData)).toThrow(ZodError);
    });
  });

  describe('Edge Cases', () => {
    it('should accept file with no tests', () => {
      const validData = {
        file: 'src/constants.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0,
        summary: 'No tests found'
      };

      const parsed = TestCoverageResultSchema.parse(validData);
      expect(parsed.hasTests).toBe(false);
      expect(parsed.testFiles).toHaveLength(0);
    });

    it('should accept coverage boundaries (0 and 100)', () => {
      const dataNoCoverage = {
        file: 'src/untested.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0,
        summary: 'No coverage'
      };

      const dataFullCoverage = {
        file: 'src/tested.ts',
        hasTests: true,
        testFiles: ['tests/tested.test.ts'],
        untestedPaths: [],
        coverageEstimate: 100,
        summary: 'Full coverage'
      };

      expect(() => TestCoverageResultSchema.parse(dataNoCoverage)).not.toThrow();
      expect(() => TestCoverageResultSchema.parse(dataFullCoverage)).not.toThrow();
    });
  });

  describe('JSON Schema Export', () => {
    it('should export valid JSON schema', () => {
      expect(TestCoverageResultJSONSchema).toBeDefined();
      expect(typeof TestCoverageResultJSONSchema).toBe('object');
    });
  });
});

describe('RefactoringSuggestionSchema', () => {
  describe('Valid Data', () => {
    it('should parse valid refactoring suggestion', () => {
      const validData = {
        file: 'src/components/Button.tsx',
        suggestions: [
          {
            type: 'extract-function' as const,
            location: 'handleClick() - lines 50-70',
            impact: 'high' as const,
            description: 'Complex validation logic should be extracted',
            before: 'if (x && y && z) { /* 20 lines */ }',
            after: 'if (validateInputs(x, y, z)) { /* 2 lines */ }',
            benefits: 'Improves readability and testability'
          }
        ],
        summary: 'One refactoring opportunity'
      };

      const parsed = RefactoringSuggestionSchema.parse(validData);
      expect(parsed.file).toBe('src/components/Button.tsx');
      expect(parsed.suggestions).toHaveLength(1);
      expect(parsed.suggestions[0].type).toBe('extract-function');
    });

    it('should parse multiple suggestions with different types', () => {
      const validData = {
        file: 'src/utils.ts',
        suggestions: [
          {
            type: 'rename' as const,
            location: 'variable x',
            impact: 'medium' as const,
            description: 'Unclear name',
            before: 'let x = 5;',
            after: 'let maxRetries = 5;',
            benefits: 'Better code clarity'
          },
          {
            type: 'modernize' as const,
            location: 'function getData()',
            impact: 'high' as const,
            description: 'Use async/await instead of promises',
            before: 'return fetch().then(r => r.json()).catch(e => null);',
            after: 'try { return await fetch().json(); } catch { return null; }',
            benefits: 'More readable, easier to debug'
          },
          {
            type: 'simplify' as const,
            location: 'conditional logic',
            impact: 'low' as const,
            description: 'Simplify nested conditions',
            before: 'if (a) { if (b) { return true; } }',
            after: 'if (a && b) { return true; }',
            benefits: 'Reduces nesting'
          }
        ],
        summary: 'Multiple refactoring opportunities'
      };

      const parsed = RefactoringSuggestionSchema.parse(validData);
      expect(parsed.suggestions).toHaveLength(3);
      expect(parsed.suggestions[0].type).toBe('rename');
      expect(parsed.suggestions[1].type).toBe('modernize');
      expect(parsed.suggestions[2].type).toBe('simplify');
    });
  });

  describe('Invalid Data', () => {
    it('should reject invalid refactoring type', () => {
      const invalidData = {
        file: 'src/test.ts',
        suggestions: [
          {
            type: 'optimize' as unknown,
            location: 'function foo()',
            impact: 'high' as const,
            description: 'Make it faster',
            before: 'old code',
            after: 'new code',
            benefits: 'Better performance'
          }
        ],
        summary: 'Issues'
      };

      expect(() => RefactoringSuggestionSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should reject invalid impact level', () => {
      const invalidData = {
        file: 'src/test.ts',
        suggestions: [
          {
            type: 'rename' as const,
            location: 'variable x',
            impact: 'critical' as unknown,
            description: 'Rename variable',
            before: 'let x = 1;',
            after: 'let count = 1;',
            benefits: 'Clearer name'
          }
        ],
        summary: 'Issues'
      };

      expect(() => RefactoringSuggestionSchema.parse(invalidData)).toThrow(ZodError);
    });
  });

  describe('Edge Cases', () => {
    it('should accept empty suggestions array', () => {
      const validData = {
        file: 'src/perfect.ts',
        suggestions: [],
        summary: 'No refactoring needed'
      };

      const parsed = RefactoringSuggestionSchema.parse(validData);
      expect(parsed.suggestions).toHaveLength(0);
    });

    it('should accept all refactoring types', () => {
      const types: Array<'extract-function' | 'rename' | 'modernize' | 'simplify' | 'pattern-improvement'> = [
        'extract-function',
        'rename',
        'modernize',
        'simplify',
        'pattern-improvement'
      ];

      types.forEach(type => {
        const validData = {
          file: 'src/test.ts',
          suggestions: [
            {
              type,
              location: 'somewhere',
              impact: 'medium' as const,
              description: 'Suggestion',
              before: 'before',
              after: 'after',
              benefits: 'better'
            }
          ],
          summary: 'Has suggestion'
        };

        expect(() => RefactoringSuggestionSchema.parse(validData)).not.toThrow();
      });
    });

    it('should accept all impact levels', () => {
      const impacts: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      impacts.forEach(impact => {
        const validData = {
          file: 'src/test.ts',
          suggestions: [
            {
              type: 'rename' as const,
              location: 'var x',
              impact,
              description: 'Suggestion',
              before: 'before',
              after: 'after',
              benefits: 'better'
            }
          ],
          summary: 'Has suggestion'
        };

        expect(() => RefactoringSuggestionSchema.parse(validData)).not.toThrow();
      });
    });
  });

  describe('JSON Schema Export', () => {
    it('should export valid JSON schema', () => {
      expect(RefactoringSuggestionJSONSchema).toBeDefined();
      expect(typeof RefactoringSuggestionJSONSchema).toBe('object');
    });
  });
});

describe('ReviewReportSchema', () => {
  describe('Valid Data', () => {
    it('should parse valid review report', () => {
      const validData = {
        pullRequest: {
          owner: 'facebook',
          repo: 'react',
          number: 12345
        },
        fileReviews: [
          {
            file: 'src/main.ts',
            codeQuality: {
              file: 'src/main.ts',
              issues: [],
              overallScore: 85,
              summary: 'Good quality'
            },
            testCoverage: {
              file: 'src/main.ts',
              hasTests: true,
              testFiles: ['tests/main.test.ts'],
              untestedPaths: [],
              coverageEstimate: 90,
              summary: 'Well tested'
            },
            refactorings: {
              file: 'src/main.ts',
              suggestions: [],
              summary: 'No refactoring needed'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 85,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 5000,
          agentVersions: {
            'code-quality': '1.0',
            'test-coverage': '1.0',
            'refactoring': '1.0'
          }
        }
      };

      const parsed = ReviewReportSchema.parse(validData);
      expect(parsed.pullRequest.owner).toBe('facebook');
      expect(parsed.summary.totalFiles).toBe(1);
      expect(parsed.fileReviews).toHaveLength(1);
    });
  });

  describe('JSON Schema Export', () => {
    it('should export valid JSON schema for ReviewReport', () => {
      expect(ReviewReportJSONSchema).toBeDefined();
      expect(typeof ReviewReportJSONSchema).toBe('object');
    });
  });
});
