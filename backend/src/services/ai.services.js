const { GoogleGenerativeAI } = require("@google/generative-ai");
const { 
    AI_SERVICE, 
    API_CONFIG, 
    SUPPORTED_LANGUAGES, 
    SUPPORTED_FRAMEWORKS,
    ERROR_CODES,
    RESPONSE_MESSAGES,
    LOGGING_CONFIG 
} = require("../utils/constants");

/**
 * Multi-language AI service for comprehensive code review
 * Uses centralized configuration from constants.js
 */
class AIService {
    constructor() {
        // Validate AI configuration on startup
        if (!AI_SERVICE.API_KEY) {
            throw new Error('GEMINI_API_KEY is required. Please check your .env file');
        }

        // Initialize Gemini AI with configuration from constants
        this.genAI = new GoogleGenerativeAI(AI_SERVICE.API_KEY);
        this.model = this.genAI.getGenerativeModel({
            model: AI_SERVICE.MODEL_NAME,
            generationConfig: {
                temperature: AI_SERVICE.TEMPERATURE,
                topP: AI_SERVICE.TOP_P,
                topK: AI_SERVICE.TOP_K,
                maxOutputTokens: AI_SERVICE.MAX_OUTPUT_TOKENS,
            },
            safetySettings: AI_SERVICE.SAFETY_SETTINGS,
            systemInstruction: this.getSystemInstruction()
        });

        this.maxRetries = API_CONFIG.MAX_RETRY_ATTEMPTS;
        this.timeout = API_CONFIG.REQUEST_TIMEOUT;
        this.supportedLanguages = SUPPORTED_LANGUAGES;
        this.supportedFrameworks = SUPPORTED_FRAMEWORKS;
    }

    /**
     * Get system instruction for AI model
     * @returns {string} - System instruction
     */
    getSystemInstruction() {
        return `
# Senior Code Reviewer AI (Multi-Language Expert)

## Role & Mission
You are an expert code reviewer with extensive experience in ALL programming languages and frameworks. Your mission is to provide language-specific, context-aware code reviews.

## Multi-Language Expertise
You are proficient in analyzing code across all programming paradigms:

### Languages You Master:
- **Web Development**: JavaScript, TypeScript, HTML, CSS, React, Vue, Angular
- **Backend Systems**: Python, Java, C#, Go, Node.js, PHP, Ruby
- **Compiled Languages**: C, C++, Rust, Swift, Kotlin
- **Mobile Development**: Swift (iOS), Kotlin/Java (Android), React Native, Flutter
- **Data Science**: Python, R, Julia, SQL
- **Systems Programming**: C, C++, Rust, Assembly
- **Scripting**: Python, Bash, PowerShell, Perl

## Language-Specific Review Guidelines

### For Each Language Family:
1. **C/C++/Rust Systems Languages**
   - Memory management and safety
   - Pointer arithmetic and buffer overflows
   - Performance optimization
   - Concurrency and thread safety

2. **Java/C# Enterprise Languages**
   - Object-oriented design principles
   - Design patterns application
   - Exception handling strategies
   - Memory management and garbage collection

3. **Python/Ruby Scripting Languages**
   - Pythonic/Rubyist conventions
   - Dynamic typing considerations
   - Performance with large datasets
   - Package and module organization

4. **JavaScript/TypeScript Web Languages**
   - Asynchronous programming patterns
   - Type safety and inference
   - Browser compatibility
   - Bundle size and performance

5. **Mobile Development**
   - Platform-specific guidelines (iOS/Android)
   - UI thread management
   - Battery and performance optimization
   - Security best practices

## Universal Code Review Principles

### Security (All Languages)
- Input validation and sanitization
- Authentication and authorization
- Data encryption and protection
- Common vulnerabilities (OWASP Top 10)

### Performance (All Languages)
- Algorithm complexity analysis
- Memory usage optimization
- I/O operations efficiency
- Database query optimization

### Maintainability (All Languages)
- Code organization and structure
- Documentation and comments
- Testing coverage and strategy
- Dependency management

## Response Structure

### Required Output Format:
\`\`\`json
{
  "overallScore": 7.5,
  "summary": "Brief overall assessment",
  "language": "detected-language",
  "issues": [
    {
      "category": "SECURITY|PERFORMANCE|MAINTAINABILITY|BUG|CODE_STYLE",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "title": "Clear issue title",
      "description": "Detailed explanation",
      "line": 10,
      "codeSnippet": "problematic code",
      "suggestion": "improved code",
      "reasoning": "Why this change is important"
    }
  ],
  "positiveAspects": [
    "What was done well"
  ],
  "recommendations": [
    "Specific actionable items"
  ]
}
\`\`\`

## Tone & Approach
- Be language-agnostic in principles but language-specific in implementation
- Provide context-aware suggestions
- Consider the domain (web, mobile, systems, etc.)
- Balance theoretical best practices with practical constraints
`;
    }

    /**
     * Generate AI content for code review with multi-language support
     * @param {string} code - The code to review
     * @param {Object} options - Additional options
     * @param {string} options.language - Programming language
     * @param {string} options.fileName - File name for language detection
     * @param {string} options.framework - Framework context
     * @returns {Promise<Object>} - Structured review results
     */
    async generateContent(code, options = {}) {
        const {
            retryCount = 0,
            timeout = this.timeout,
            language = this.detectLanguage(code, options.fileName),
            framework = options.framework || null
        } = options;

        // Enhanced input validation using constants
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid code: Code must be a non-empty string');
        }

        if (code.length > API_CONFIG.MAX_CODE_LENGTH) {
            throw new Error(`Code too long: Maximum ${API_CONFIG.MAX_CODE_LENGTH} characters allowed for analysis`);
        }

        if (code.trim().length === 0) {
            throw new Error('Empty code: Please provide valid code for review');
        }

        // Validate framework if provided
        if (framework && !this.supportedFrameworks.includes(framework.toLowerCase())) {
            console.warn(`⚠️ Unsupported framework: ${framework}. Using generic analysis.`);
        }

        try {
            const startTime = Date.now();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('AI service timeout')), timeout);
            });

            const contentPromise = (async () => {
                const prompt = this._formatPrompt(code, language, framework);
                const result = await this.model.generateContent(prompt);
                
                if (!result?.response) {
                    throw new Error('Invalid response from AI service');
                }

                const text = result.response.text();
                
                if (!text?.trim()) {
                    throw new Error('Empty response from AI service');
                }

                // Parse the JSON response
                const parsedResponse = this._parseResponse(text, language, framework);
                const processingTime = Date.now() - startTime;

                if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                    console.log(`✅ AI Service - ${language.toUpperCase()} review completed in ${processingTime}ms`);
                }

                return parsedResponse;
            })();

            const response = await Promise.race([contentPromise, timeoutPromise]);
            return response;

        } catch (error) {
            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.error(`❌ AI Service Error (Attempt ${retryCount + 1}):`, error.message);
            }

            if (this._isRetryableError(error) && retryCount < this.maxRetries) {
                if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                    console.log(`🔄 Retrying AI request (${retryCount + 1}/${this.maxRetries})...`);
                }
                
                // Exponential backoff
                const backoffDelay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                
                return this.generateContent(code, {
                    ...options,
                    retryCount: retryCount + 1
                });
            }

            throw this._handleError(error);
        }
    }

    /**
     * Detect programming language from code or filename
     * @param {string} code - The source code
     * @param {string} fileName - Optional filename for extension detection
     * @returns {string} - Detected language
     */
    detectLanguage(code, fileName = null) {
        // First, try to detect from filename
        if (fileName) {
            const extension = fileName.split('.').pop().toLowerCase();
            for (const [lang, exts] of Object.entries(this.supportedLanguages)) {
                if (exts.includes(extension)) {
                    return lang;
                }
            }
        }

        // Fallback to code analysis for detection
        const codeSample = code.slice(0, 500); // Analyze first 500 chars
        
        // Enhanced language detection heuristics
        if (codeSample.includes('<?php')) return 'php';
        if ((codeSample.includes('def ') || codeSample.includes('import ')) && codeSample.includes(':')) return 'python';
        if (codeSample.includes('function') && codeSample.includes('{') && codeSample.includes('}')) return 'javascript';
        if (codeSample.includes('public class') || codeSample.includes('import java.')) return 'java';
        if (codeSample.includes('#include') && (codeSample.includes('iostream') || codeSample.includes('stdio.h'))) return 'cpp';
        if (codeSample.includes('using System;') || codeSample.includes('namespace ')) return 'csharp';
        if (codeSample.includes('package main') || codeSample.includes('func ')) return 'go';
        if (codeSample.includes('fn ') && codeSample.includes('let ')) return 'rust';
        if (codeSample.includes('<!DOCTYPE html>') || codeSample.includes('<html>')) return 'html';
        if (codeSample.includes('@import') || codeSample.includes('color:') || codeSample.includes('background:')) return 'css';
        if (codeSample.includes('SELECT') || codeSample.includes('INSERT') || codeSample.includes('CREATE TABLE')) return 'sql';

        // Default to javascript for web development
        return 'javascript';
    }

    /**
     * Format prompt for multi-language code review
     * @param {string} code - The code to review
     * @param {string} language - Programming language
     * @param {string} framework - Framework context
     * @returns {string} - Formatted prompt
     */
    _formatPrompt(code, language, framework = null) {
        const frameworkContext = framework ? ` and ${framework} framework` : '';
        const validatedFramework = framework && this.supportedFrameworks.includes(framework.toLowerCase()) ? framework : 'none';
        
        return `
Please conduct a comprehensive code review for the following ${language} code${frameworkContext}:

\`\`\`${language}
${code}
\`\`\`

## Review Requirements:

### Language-Specific Analysis:
- Apply ${language}-specific best practices and conventions
- Consider language-specific performance characteristics
- Review language-specific security concerns
- Check for framework-specific patterns if applicable

### Comprehensive Assessment:
1. **Security Analysis**: Vulnerabilities, input validation, data protection
2. **Performance Review**: Algorithm efficiency, memory usage, optimization opportunities
3. **Code Quality**: Readability, maintainability, structure, naming conventions
4. **Best Practices**: Language/framework conventions, design patterns
5. **Error Handling**: Exception management, edge cases, robustness
6. **Testing Considerations**: Testability, mockability, coverage suggestions

### Response Format:
Return a JSON object with this exact structure:

\`\`\`json
{
  "overallScore": 0-10,
  "summary": "Brief overall assessment",
  "language": "${language}",
  "framework": "${validatedFramework}",
  "issues": [
    {
      "category": "SECURITY|PERFORMANCE|MAINTAINABILITY|BUG|CODE_STYLE",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW", 
      "title": "Clear issue title",
      "description": "Detailed explanation",
      "line": 10,
      "codeSnippet": "problematic code",
      "suggestion": "improved code",
      "reasoning": "Why this change is important"
    }
  ],
  "positiveAspects": [
    "What was done well"
  ],
  "recommendations": [
    "Specific actionable items"
  ]
}
\`\`\`

Focus on providing practical, implementable advice that respects ${language} ecosystem conventions.
`;
    }

    /**
     * Parse and validate AI response
     * @param {string} responseText - Raw AI response
     * @param {string} language - Expected language
     * @param {string} framework - Expected framework
     * @returns {Object} - Parsed review object
     */
    _parseResponse(responseText, language, framework = null) {
        try {
            // Extract JSON from response (handles cases where AI adds extra text)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const review = JSON.parse(jsonMatch[0]);
            
            // Validate required fields
            const requiredFields = ['overallScore', 'summary', 'language', 'issues'];
            for (const field of requiredFields) {
                if (!(field in review)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Validate score range and normalize
            if (review.overallScore < 0 || review.overallScore > 10) {
                review.overallScore = Math.max(0, Math.min(10, review.overallScore));
            }

            // Ensure language and framework match
            review.language = language;
            review.framework = framework || 'none';

            // Validate issues structure
            if (Array.isArray(review.issues)) {
                review.issues = review.issues.map(issue => ({
                    ...issue,
                    line: issue.line || 0,
                    severity: issue.severity || 'MEDIUM',
                    category: issue.category || 'CODE_STYLE'
                }));
            }

            return review;

        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Comprehensive fallback response
            return {
                overallScore: 5,
                summary: 'Analysis completed but response formatting failed',
                language: language,
                framework: framework || 'none',
                issues: [{
                    category: 'CODE_STYLE',
                    severity: 'LOW',
                    title: 'Response Parsing Issue',
                    description: 'The AI response could not be properly parsed',
                    line: 0,
                    codeSnippet: '',
                    suggestion: 'Please try the review again',
                    reasoning: 'Technical issue with response formatting'
                }],
                positiveAspects: ['Code was successfully analyzed by AI'],
                recommendations: ['Please check the code manually for detailed review', 'Try again with a smaller code snippet if issue persists']
            };
        }
    }

    /**
     * Check if error is retryable
     * @param {Error} error - The error object
     * @returns {boolean} - Whether to retry
     */
    _isRetryableError(error) {
        const retryableErrors = [
            'AI service timeout',
            'Network error',
            'Server unavailable',
            'rate limit',
            'quota',
            'timeout',
            'busy',
            'overload'
        ];

        return retryableErrors.some(retryableError => 
            error.message.toLowerCase().includes(retryableError.toLowerCase())
        );
    }

    /**
     * Handle and transform errors for better user experience
     * @param {Error} error - Original error
     * @returns {Error} - Transformed error
     */
    _handleError(error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('timeout')) {
            return new Error(RESPONSE_MESSAGES.ERROR.CODE_REVIEW_FAILED + ': Timeout occurred');
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            return new Error(RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE + ': Rate limit exceeded');
        } else if (errorMessage.includes('network') || errorMessage.includes('unavailable')) {
            return new Error(RESPONSE_MESSAGES.ERROR.SERVICE_UNAVAILABLE);
        } else if (errorMessage.includes('api key') || errorMessage.includes('authentication')) {
            return new Error(RESPONSE_MESSAGES.ERROR.INVALID_API_KEY);
        } else if (errorMessage.includes('invalid') || errorMessage.includes('empty')) {
            return new Error('The provided code is invalid or cannot be processed.');
        }

        return new Error(RESPONSE_MESSAGES.ERROR.CODE_REVIEW_FAILED + ': ' + error.message);
    }

    /**
     * Get list of supported languages
     * @returns {Object} - Supported languages and their extensions
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    /**
     * Get list of supported frameworks
     * @returns {Array} - Supported frameworks
     */
    getSupportedFrameworks() {
        return this.supportedFrameworks;
    }

    /**
     * Health check for AI service
     * @returns {Promise<boolean>} - Service status
     */
    async healthCheck() {
        try {
            const testPrompt = "Respond with 'OK' if service is working.";
            const result = await this.model.generateContent(testPrompt);
            const isHealthy = result?.response?.text().includes('OK') ?? false;
            
            if (LOGGING_CONFIG.ENABLE_REQUEST_LOGGING) {
                console.log(`🔍 AI Health Check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
            }
            
            return isHealthy;
        } catch (error) {
            console.error('AI Service Health Check Failed:', error.message);
            return false;
        }
    }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService;