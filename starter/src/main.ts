import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 *
 * Example:
 *   npm run dev -- facebook react 12345
 *   npm run dev -- torvalds linux 1
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  try {
    // ============================================================================
    // PHASE 1: Validate Command Line Arguments
    // ============================================================================
    if (!owner || !repo || !prStr) {
      console.error('❌ Missing required arguments');
      console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
      console.error('Example: npm run dev -- facebook react 12345');
      process.exit(1);
    }

    const prNumber = parseInt(prStr, 10);
    if (isNaN(prNumber) || prNumber <= 0) {
      console.error(`❌ Invalid PR number: "${prStr}". Must be a positive integer.`);
      process.exit(1);
    }

    console.log(`📋 Reviewing ${owner}/${repo}#${prNumber}...`);

    // ============================================================================
    // PHASE 2: Validate Authentication
    // ============================================================================
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasAWSCredentials =
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY &&
      !!process.env.AWS_REGION;

    if (!hasAnthropicKey && !hasAWSCredentials) {
      console.error('❌ Missing authentication credentials');
      console.error('\nOption 1: Anthropic API');
      console.error('  Set environment variable: ANTHROPIC_API_KEY=sk-ant-...');
      console.error('\nOption 2: AWS Bedrock');
      console.error('  Set environment variables:');
      console.error('    AWS_ACCESS_KEY_ID=...');
      console.error('    AWS_SECRET_ACCESS_KEY=...');
      console.error('    AWS_REGION=us-east-1');
      process.exit(1);
    }

    if (hasAWSCredentials) {
      console.log('🔐 Using AWS Bedrock authentication');
    } else {
      console.log('🔐 Using Anthropic API authentication');
    }

    // ============================================================================
    // PHASE 3: Validate ANTHROPIC_MODEL
    // ============================================================================
    const model = process.env.ANTHROPIC_MODEL;
    if (!model) {
      console.error('❌ Missing ANTHROPIC_MODEL environment variable');
      console.error('For Anthropic API: claude-sonnet-4-5-20250929');
      console.error('For AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0');
      process.exit(1);
    }

    console.log(`🤖 Using model: ${model}`);

    // ============================================================================
    // PHASE 4: Create Orchestrator and Review PR
    // ============================================================================
    const orchestrator = new CodeReviewOrchestrator({
      model,
      projectRoot: process.env.PROJECT_ROOT
    });

    console.log('⏳ Orchestrating multi-agent code review...');
    console.log('  - Code Quality Analyzer');
    console.log('  - Test Coverage Analyzer');
    console.log('  - Refactoring Suggester');

    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // ============================================================================
    // PHASE 5: Generate Reports
    // ============================================================================
    const reportGenerator = new ReportGenerator();

    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate filename with PR info
    const timestamp = new Date().toISOString().split('T')[0];
    const baseFilename = `${owner}_${repo}_pr${prNumber}_${timestamp}`;

    // Generate Markdown Report
    const markdownReport = reportGenerator.generateMarkdownReport(report);
    const markdownPath = path.join(reportsDir, `${baseFilename}.md`);
    fs.writeFileSync(markdownPath, markdownReport, 'utf-8');
    console.log(`\n✅ Markdown report: ${markdownPath}`);

    // Generate HTML Report
    const htmlReport = reportGenerator.generateHTMLReport(report);
    const htmlPath = path.join(reportsDir, `${baseFilename}.html`);
    fs.writeFileSync(htmlPath, htmlReport, 'utf-8');
    console.log(`✅ HTML report: ${htmlPath}`);

    // Generate JSON Report
    const jsonReport = reportGenerator.generateJSONReport(report);
    const jsonPath = path.join(reportsDir, `${baseFilename}.json`);
    fs.writeFileSync(jsonPath, jsonReport, 'utf-8');
    console.log(`✅ JSON report: ${jsonPath}`);

    // ============================================================================
    // PHASE 6: Display Summary
    // ============================================================================
    const { summary } = report;
    console.log('\n' + '='.repeat(60));
    console.log('📊 CODE REVIEW SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Score:        ${summary.overallScore}/100`);
    console.log(`Files Reviewed:       ${summary.totalFiles}`);
    console.log(`Critical Issues:      ${summary.criticalIssues}`);
    console.log(`High Priority Tests:  ${summary.highPriorityTests}`);
    console.log(`Refactoring Opps:     ${summary.refactoringOpportunities}`);
    console.log('='.repeat(60) + '\n');

    console.log('✨ Code review completed successfully!');
    logger.info('Code review completed', {
      owner,
      repo,
      prNumber,
      score: summary.overallScore,
      status: 'success'
    });
  } catch (error) {
    console.error('❌ Code review failed');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      logger.error('Code review failed', {
        error: error.message,
        stack: error.stack
      });
    } else {
      console.error('Unknown error');
      logger.error('Code review failed', {
        error: String(error)
      });
    }
    process.exit(1);
  }
}

main();
