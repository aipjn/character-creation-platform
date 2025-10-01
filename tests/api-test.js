/**
 * API Test Suite
 * Tests all API endpoints with real HTTP requests
 */

const API_BASE = 'http://localhost:3000/api/v1';
const AUTH_TOKEN = 'test-token-123';

// Test result tracking
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Utility functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

function logTest(name, passed, error = null) {
    results.tests.push({ name, passed, error });
    if (passed) {
        results.passed++;
        log(`TEST PASSED: ${name}`, 'success');
    } else {
        results.failed++;
        log(`TEST FAILED: ${name} - ${error}`, 'error');
    }
}

async function makeRequest(method, path, data = null, headers = {}) {
    const url = `${API_BASE}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    log(`${method} ${url}`);
    try {
        const response = await fetch(url, options);
        const responseData = await response.json();
        
        log(`Response: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            log(`Error Response: ${JSON.stringify(responseData, null, 2)}`);
        }
        
        return { response, data: responseData };
    } catch (error) {
        log(`Request failed: ${error.message}`, 'error');
        throw error;
    }
}

// Test Functions

async function testHealthCheck() {
    try {
        const { response, data } = await makeRequest('GET', '');
        
        if (response.ok && data.success) {
            logTest('API Root Endpoint', true);
            return true;
        } else {
            logTest('API Root Endpoint', false, 'Invalid response structure');
            return false;
        }
    } catch (error) {
        logTest('API Root Endpoint', false, error.message);
        return false;
    }
}

async function testAuthVerification() {
    try {
        // Test without token
        const { response: noTokenResp } = await makeRequest('POST', '/auth/verify');
        
        if (noTokenResp.status === 401) {
            logTest('Auth - No Token (401)', true);
        } else {
            logTest('Auth - No Token (401)', false, `Expected 401, got ${noTokenResp.status}`);
        }

        // Test with token
        const { response: withTokenResp, data } = await makeRequest('POST', '/auth/verify', null, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (withTokenResp.ok && data.success && data.data.user) {
            logTest('Auth - Valid Token', true);
            return data.data.user;
        } else {
            logTest('Auth - Valid Token', false, 'Invalid response or missing user data');
            return null;
        }
    } catch (error) {
        logTest('Auth Verification', false, error.message);
        return null;
    }
}

async function testCharacterCRUD() {
    const testCharacter = {
        name: 'Test Character API',
        description: 'A test character for API validation',
        enhancedDescription: 'A detailed test character created during API testing',
        style: 'realistic',
        tags: ['test', 'api', 'validation'],
        metadata: { source: 'api-test' }
    };

    let createdCharacterId = null;

    try {
        // Test GET /characters (empty list initially)
        const { response: listResp, data: listData } = await makeRequest('GET', '/characters');
        
        if (listResp.ok && listData.success && Array.isArray(listData.data.items)) {
            logTest('Characters - List Characters', true);
        } else {
            logTest('Characters - List Characters', false, 'Invalid response structure');
        }

        // Test POST /characters (create)
        const { response: createResp, data: createData } = await makeRequest('POST', '/characters', testCharacter, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (createResp.status === 201 && createData.success && createData.data.id) {
            createdCharacterId = createData.data.id;
            logTest('Characters - Create Character', true);
        } else {
            logTest('Characters - Create Character', false, 'Failed to create character');
            return false;
        }

        // Test GET /characters/:id (read)
        const { response: getResp, data: getData } = await makeRequest('GET', `/characters/${createdCharacterId}`, null, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (getResp.ok && getData.success && getData.data.name === testCharacter.name) {
            logTest('Characters - Get Character by ID', true);
        } else {
            logTest('Characters - Get Character by ID', false, 'Failed to retrieve character');
        }

        // Test PUT /characters/:id (update)
        const updateData = { ...testCharacter, name: 'Updated Test Character' };
        const { response: updateResp, data: updatedData } = await makeRequest('PUT', `/characters/${createdCharacterId}`, updateData, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (updateResp.ok && updatedData.success && updatedData.data.name === 'Updated Test Character') {
            logTest('Characters - Update Character', true);
        } else {
            logTest('Characters - Update Character', false, 'Failed to update character');
        }

        // Test DELETE /characters/:id (delete)
        const { response: deleteResp, data: deleteData } = await makeRequest('DELETE', `/characters/${createdCharacterId}`, null, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (deleteResp.ok && deleteData.success) {
            logTest('Characters - Delete Character', true);
        } else {
            logTest('Characters - Delete Character', false, 'Failed to delete character');
        }

        // Verify deletion - should return 404
        const { response: verifyResp } = await makeRequest('GET', `/characters/${createdCharacterId}`, null, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (verifyResp.status === 404) {
            logTest('Characters - Verify Deletion (404)', true);
        } else {
            logTest('Characters - Verify Deletion (404)', false, `Expected 404, got ${verifyResp.status}`);
        }

        return true;
    } catch (error) {
        logTest('Character CRUD Operations', false, error.message);
        return false;
    }
}

async function testPromptOptimization() {
    try {
        const testPrompt = {
            userDescription: 'A brave warrior with a sword',
            style: 'fantasy',
            gender: 'male'
        };

        const { response, data } = await makeRequest('POST', '/characters/optimize-prompt', testPrompt, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (response.ok && data.success && data.data.optimizedPrompt) {
            logTest('Prompt - Optimize Prompt', true);
            
            // Test conversation continuation
            const feedbackData = {
                conversationId: data.data.conversationId,
                feedback: 'Make the character more heroic',
                previousPrompt: data.data.optimizedPrompt
            };

            const { response: contResp, data: contData } = await makeRequest('POST', '/characters/continue-conversation', feedbackData, {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            });
            
            if (contResp.ok && contData.success && contData.data.optimizedPrompt) {
                logTest('Prompt - Continue Conversation', true);
            } else {
                logTest('Prompt - Continue Conversation', false, 'Failed to continue conversation');
            }
            
            return true;
        } else {
            logTest('Prompt - Optimize Prompt', false, 'Failed to optimize prompt');
            return false;
        }
    } catch (error) {
        logTest('Prompt Optimization', false, error.message);
        return false;
    }
}

async function testImageGeneration() {
    try {
        const imageData = {
            prompt: 'A beautiful fantasy landscape with mountains',
            style: 'realistic'
        };

        const { response, data } = await makeRequest('POST', '/characters/generate-image', imageData, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (response.ok && data.success && data.data) {
            logTest('Image - Generate Image', true);
            return true;
        } else {
            logTest('Image - Generate Image', false, 'Failed to generate image');
            return false;
        }
    } catch (error) {
        logTest('Image Generation', false, error.message);
        return false;
    }
}

async function testErrorHandling() {
    try {
        // Test 404 for non-existent character
        const { response: notFoundResp } = await makeRequest('GET', '/characters/nonexistent', null, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (notFoundResp.status === 404) {
            logTest('Error - 404 for Non-existent Character', true);
        } else {
            logTest('Error - 404 for Non-existent Character', false, `Expected 404, got ${notFoundResp.status}`);
        }

        // Test validation error
        const { response: validationResp } = await makeRequest('POST', '/characters', {}, {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        });
        
        if (validationResp.status === 400) {
            logTest('Error - 400 for Invalid Data', true);
        } else {
            logTest('Error - 400 for Invalid Data', false, `Expected 400, got ${validationResp.status}`);
        }

        return true;
    } catch (error) {
        logTest('Error Handling', false, error.message);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    log('Starting API Test Suite...', 'info');
    log(`Testing API at: ${API_BASE}`, 'info');
    
    // Check if server is running
    try {
        await fetch(`${API_BASE}`);
    } catch (error) {
        log('❌ Server is not running! Please start the server first.', 'error');
        process.exit(1);
    }

    log('Server is running. Starting tests...', 'success');
    
    // Run all tests
    await testHealthCheck();
    await testAuthVerification();
    await testCharacterCRUD();
    await testPromptOptimization();
    await testImageGeneration();
    await testErrorHandling();
    
    // Print summary
    log(`\n🏁 Test Summary:`, 'info');
    log(`✅ Passed: ${results.passed}`, 'success');
    log(`❌ Failed: ${results.failed}`, 'error');
    log(`📊 Total: ${results.tests.length}`, 'info');
    
    if (results.failed > 0) {
        log('\n❌ Failed Tests:', 'error');
        results.tests.filter(t => !t.passed).forEach(test => {
            log(`  - ${test.name}: ${test.error}`, 'error');
        });
        process.exit(1);
    } else {
        log('\n🎉 All tests passed!', 'success');
        process.exit(0);
    }
}

// Check if running in Node.js environment
if (typeof window === 'undefined') {
    // Node.js environment - need to import fetch
    const fetch = require('node-fetch');
    global.fetch = fetch;
    
    runAllTests().catch(error => {
        log(`Test suite failed: ${error.message}`, 'error');
        process.exit(1);
    });
}