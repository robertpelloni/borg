/**
 * AIOS Code Review Service
 * 
 * AI-powered code review system with multiple review modes and GitHub integration.
 * 
 * Features:
 * - Simple single-pass code review
 * - Comprehensive multi-persona review (Security, Performance, Maintainability)
 * - Structured JSON output with severity scoring
 * - GitHub PR auto-commenting integration
 * - Custom review personas
 * 
 * @module services/CodeReviewService
 */

import { EventEmitter } from 'events';
import { getLLMProviderRegistry, Message } from '../providers/LLMProviderRegistry.js';

// ============================================
// Types & Interfaces
// ============================================

export interface ReviewPersona {
    role: string;
    prompt: string;
}

export interface ReviewRequest {
    /** The code to review (diff, file content, or code block) */
    codeContext: string;
    /** LLM provider to use */
    provider: string;
    /** Model to use */
    model: string;
    /** API key for the provider */
    apiKey: string;
    /** Custom system prompt (for simple review) */
    systemPrompt?: string;
    /** Review type: simple or comprehensive */
    reviewType?: 'simple' | 'comprehensive';
    /** Custom personas for comprehensive review */
    customPersonas?: ReviewPersona[];
    /** Output format */
    outputFormat?: 'markdown' | 'json';
    /** GitHub PR URL for auto-commenting */
    prUrl?: string;
    /** GitHub token for commenting */
    githubToken?: string;
    /** File path (for context) */
    filePath?: string;
    /** Language hint */
    language?: string;
}

export interface ReviewIssue {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: 'Security' | 'Performance' | 'Style' | 'Logic' | 'Maintainability' | 'Documentation' | 'Testing';
    file?: string;
    line?: number;
    description: string;
    suggestion: string;
    codeSnippet?: string;
}

export interface ReviewResult {
    summary: string;
    score: number; // 0-100
    issues: ReviewIssue[];
    strengths?: string[];
    recommendations?: string[];
    rawOutput?: string;
    metadata?: {
        provider: string;
        model: string;
        reviewType: string;
        durationMs: number;
    };
}

// ============================================
// Code Review Service Class
// ============================================

export class CodeReviewService extends EventEmitter {
    private registry = getLLMProviderRegistry();

    private defaultPersonas: ReviewPersona[] = [
        {
            role: 'Security Expert',
            prompt: `You are a Security Expert. Review this code strictly for:
- Security vulnerabilities (injection, XSS, CSRF, etc.)
- Authentication/authorization flaws
- Data handling and validation issues
- Secrets or sensitive data exposure
- Dependency vulnerabilities
Be specific about the vulnerability type and remediation.`,
        },
        {
            role: 'Performance Engineer',
            prompt: `You are a Performance Engineer. Review this code for:
- Algorithmic inefficiencies (O(n^2) where O(n) is possible, etc.)
- Memory leaks or excessive allocations
- I/O bottlenecks (N+1 queries, blocking calls, etc.)
- Caching opportunities
- Resource management
Be specific about performance impact and optimization suggestions.`,
        },
        {
            role: 'Clean Code Advocate',
            prompt: `You are a Senior Engineer focused on maintainability. Review for:
- Naming conventions and clarity
- SOLID principle violations
- Code duplication
- Function/class length and complexity
- Error handling patterns
- Documentation gaps
Be specific about what to refactor and why.`,
        },
    ];

    constructor() {
        super();
    }

    /**
     * Run a code review
     */
    async review(request: ReviewRequest): Promise<ReviewResult> {
        const startTime = Date.now();
        
        this.emit('review:started', { 
            filePath: request.filePath,
            reviewType: request.reviewType || 'simple',
        });

        let result: ReviewResult;

        try {
            if (request.outputFormat === 'json' || request.reviewType === 'comprehensive') {
                if (request.reviewType === 'comprehensive') {
                    result = await this.runComprehensiveReview(request);
                } else {
                    result = await this.runStructuredReview(request);
                }
            } else {
                const textResult = await this.runSimpleReview(request);
                result = this.parseMarkdownToResult(textResult);
            }

            // Add metadata
            result.metadata = {
                provider: request.provider,
                model: request.model,
                reviewType: request.reviewType || 'simple',
                durationMs: Date.now() - startTime,
            };

            // Auto-comment on GitHub PR if configured
            if (request.prUrl && request.githubToken) {
                await this.postGitHubComment(request.prUrl, request.githubToken, result);
            }

            this.emit('review:completed', { 
                filePath: request.filePath,
                score: result.score,
                issueCount: result.issues.length,
            });

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            this.emit('review:error', { 
                filePath: request.filePath,
                error: errorMessage,
            });

            return {
                summary: 'Review failed due to an error.',
                score: 0,
                issues: [],
                rawOutput: errorMessage,
                metadata: {
                    provider: request.provider,
                    model: request.model,
                    reviewType: request.reviewType || 'simple',
                    durationMs: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Simple single-pass review
     */
    private async runSimpleReview(request: ReviewRequest): Promise<string> {
        const systemPrompt = request.systemPrompt || `You are an expert code reviewer.
Review the provided code ${request.language ? `(${request.language})` : ''}.
${request.filePath ? `File: ${request.filePath}` : ''}

Analyze for:
- Potential bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and maintainability
- Best practices violations

Be concise and actionable. Format as markdown with sections for each category.`;

        const result = await this.registry.complete({
            provider: request.provider,
            model: request.model,
            apiKey: request.apiKey,
            messages: [{ role: 'user', content: request.codeContext }],
            systemPrompt,
            maxTokens: 2000,
        });

        return result.content;
    }

    /**
     * Structured review with JSON output
     */
    private async runStructuredReview(request: ReviewRequest): Promise<ReviewResult> {
        const systemPrompt = `You are an expert code reviewer. Analyze the code and provide a structured JSON response.
${request.language ? `Language: ${request.language}` : ''}
${request.filePath ? `File: ${request.filePath}` : ''}

Response Format (JSON only, no markdown):
{
    "summary": "Brief overall summary of the code quality and main issues",
    "score": 85,
    "strengths": ["List of things done well"],
    "issues": [
        {
            "severity": "critical" | "high" | "medium" | "low" | "info",
            "category": "Security" | "Performance" | "Style" | "Logic" | "Maintainability" | "Documentation" | "Testing",
            "description": "Clear description of the issue",
            "suggestion": "Actionable fix recommendation",
            "line": 10
        }
    ],
    "recommendations": ["High-level improvement suggestions"]
}

Focus on:
1. Correctness and logic bugs
2. Security vulnerabilities  
3. Performance issues
4. Code style and maintainability`;

        const result = await this.registry.complete({
            provider: request.provider,
            model: request.model,
            apiKey: request.apiKey,
            messages: [{ role: 'user', content: request.codeContext }],
            systemPrompt,
            maxTokens: 3000,
            jsonMode: true,
        });

        try {
            const parsed = JSON.parse(result.content);
            return {
                summary: parsed.summary || 'No summary provided.',
                score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
                strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
                issues: Array.isArray(parsed.issues) ? this.normalizeIssues(parsed.issues) : [],
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                rawOutput: result.content,
            };
        } catch {
            return {
                summary: 'Failed to parse structured review.',
                score: 0,
                issues: [],
                rawOutput: result.content,
            };
        }
    }

    /**
     * Comprehensive multi-persona review
     */
    private async runComprehensiveReview(request: ReviewRequest): Promise<ReviewResult> {
        const personas = request.customPersonas || this.defaultPersonas;

        // Run all persona reviews in parallel
        const personaReviews = await Promise.all(
            personas.map(async (persona) => {
                try {
                    const result = await this.registry.complete({
                        provider: request.provider,
                        model: request.model,
                        apiKey: request.apiKey,
                        messages: [{ role: 'user', content: request.codeContext }],
                        systemPrompt: persona.prompt,
                        maxTokens: 1500,
                    });
                    return { role: persona.role, content: result.content };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error';
                    return { role: persona.role, content: `[Review failed: ${msg}]` };
                }
            })
        );

        // Compile the reviews
        const compiledReview = personaReviews
            .map(r => `### ${r.role}\n${r.content}`)
            .join('\n\n');

        // Synthesize into structured output
        const synthesisPrompt = `You are a Lead Software Architect.
Synthesize the following expert reviews into a final Code Review Scorecard.

Review Contents:
${compiledReview}

Response Format (JSON only):
{
    "summary": "Executive summary based on all expert feedback",
    "score": 75,
    "strengths": ["Key strengths identified by reviewers"],
    "issues": [
        {
            "severity": "critical" | "high" | "medium" | "low" | "info",
            "category": "Security" | "Performance" | "Style" | "Logic" | "Maintainability",
            "description": "Issue description",
            "suggestion": "How to fix",
            "line": 0
        }
    ],
    "recommendations": ["Top improvement priorities"]
}`;

        try {
            const synthesis = await this.registry.complete({
                provider: request.provider,
                model: request.model,
                apiKey: request.apiKey,
                messages: [{ role: 'user', content: 'Synthesize the expert reviews.' }],
                systemPrompt: synthesisPrompt,
                maxTokens: 3000,
                jsonMode: true,
            });

            const parsed = JSON.parse(synthesis.content);
            return {
                summary: parsed.summary || 'No summary provided.',
                score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
                strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
                issues: Array.isArray(parsed.issues) ? this.normalizeIssues(parsed.issues) : [],
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                rawOutput: compiledReview,
            };
        } catch {
            // Fallback to markdown if synthesis fails
            return this.parseMarkdownToResult(compiledReview);
        }
    }

    /**
     * Post review as GitHub PR comment
     */
    private async postGitHubComment(prUrl: string, token: string, result: ReviewResult): Promise<void> {
        // Extract owner/repo/number from URL
        const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        if (!match) {
            console.warn('Invalid GitHub PR URL:', prUrl);
            return;
        }

        const [, owner, repo, numberStr] = match;
        const number = parseInt(numberStr, 10);

        const scoreEmoji = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
        
        const issuesByCategory = result.issues.reduce((acc, issue) => {
            acc[issue.severity] = (acc[issue.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const body = `## ${scoreEmoji} AIOS Code Review

**Score: ${result.score}/100**

${result.summary}

### Issue Summary
| Severity | Count |
|----------|-------|
| Critical | ${issuesByCategory.critical || 0} |
| High | ${issuesByCategory.high || 0} |
| Medium | ${issuesByCategory.medium || 0} |
| Low | ${issuesByCategory.low || 0} |

${result.issues.length > 0 ? `### Top Issues
${result.issues.slice(0, 5).map(i => 
    `- **[${i.severity.toUpperCase()}]** ${i.description}${i.line ? ` _(line ${i.line})_` : ''}`
).join('\n')}` : ''}

${result.recommendations?.length ? `### Recommendations
${result.recommendations.map(r => `- ${r}`).join('\n')}` : ''}

---
_Automated review by AIOS_`;

        try {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ body }),
                }
            );

            if (!response.ok) {
                console.error('Failed to post GitHub comment:', await response.text());
            } else {
                this.emit('github:commented', { prUrl, owner, repo, number });
            }
        } catch (error) {
            console.error('Failed to post GitHub comment:', error);
        }
    }

    /**
     * Normalize issue severity and categories
     */
    private normalizeIssues(issues: any[]): ReviewIssue[] {
        const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
        const validCategories = ['Security', 'Performance', 'Style', 'Logic', 'Maintainability', 'Documentation', 'Testing'];

        return issues.map(issue => ({
            severity: validSeverities.includes(issue.severity) ? issue.severity : 'medium',
            category: validCategories.includes(issue.category) ? issue.category : 'Logic',
            description: issue.description || 'No description',
            suggestion: issue.suggestion || 'No suggestion provided',
            file: issue.file,
            line: typeof issue.line === 'number' ? issue.line : undefined,
            codeSnippet: issue.codeSnippet,
        }));
    }

    /**
     * Parse markdown review to result structure
     */
    private parseMarkdownToResult(markdown: string): ReviewResult {
        // Simple heuristic scoring based on content
        const issues: ReviewIssue[] = [];
        let score = 70;

        // Look for severity indicators
        const criticalMatches = markdown.match(/critical|severe|dangerous|vulnerability/gi);
        const highMatches = markdown.match(/security|bug|error|issue/gi);
        const mediumMatches = markdown.match(/warning|consider|should|might/gi);

        if (criticalMatches) {
            score -= criticalMatches.length * 10;
            issues.push({
                severity: 'critical',
                category: 'Security',
                description: `Found ${criticalMatches.length} critical issue indicator(s)`,
                suggestion: 'Review the detailed analysis above',
            });
        }
        if (highMatches) {
            score -= highMatches.length * 3;
        }
        if (mediumMatches) {
            score -= mediumMatches.length * 1;
        }

        // Clamp score
        score = Math.min(100, Math.max(0, score));

        return {
            summary: markdown.slice(0, 500) + (markdown.length > 500 ? '...' : ''),
            score,
            issues,
            rawOutput: markdown,
        };
    }

    /**
     * Quick review helper
     */
    async quickReview(params: {
        code: string;
        provider?: string;
        model?: string;
        apiKey: string;
        language?: string;
    }): Promise<ReviewResult> {
        return this.review({
            codeContext: params.code,
            provider: params.provider || 'anthropic',
            model: params.model || 'claude-sonnet-4-20250514',
            apiKey: params.apiKey,
            language: params.language,
            outputFormat: 'json',
        });
    }
}

// Singleton instance
let serviceInstance: CodeReviewService | null = null;

export function getCodeReviewService(): CodeReviewService {
    if (!serviceInstance) {
        serviceInstance = new CodeReviewService();
    }
    return serviceInstance;
}
