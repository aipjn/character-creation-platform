import { SanitizationUtils } from '../../../src/utils/sanitization';

describe('SanitizationUtils', () => {
  
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const testCases = [
        { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;' },
        { input: 'Hello & goodbye', expected: 'Hello &amp; goodbye' },
        { input: 'Quote: "Hello"', expected: 'Quote: &quot;Hello&quot;' },
        { input: "Apostrophe: 'test'", expected: "Apostrophe: &#x27;test&#x27;" },
        { input: 'Path: /usr/bin', expected: 'Path: &#x2F;usr&#x2F;bin' },
        { input: 'Template: `hello`', expected: 'Template: &#96;hello&#96;' },
        { input: 'Equals: a=b', expected: 'Equals: a&#x3D;b' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(SanitizationUtils.escapeHtml(input)).toBe(expected);
      });
    });
    
    it('should handle empty and null inputs', () => {
      expect(SanitizationUtils.escapeHtml('')).toBe('');
      expect(SanitizationUtils.escapeHtml(null as any)).toBe('');
      expect(SanitizationUtils.escapeHtml(undefined as any)).toBe('');
    });
    
    it('should handle non-string inputs', () => {
      expect(SanitizationUtils.escapeHtml(123 as any)).toBe('');
      expect(SanitizationUtils.escapeHtml({} as any)).toBe('');
    });
  });
  
  describe('stripDangerousHtml', () => {
    it('should remove dangerous HTML tags', () => {
      const testCases = [
        { input: '<script>alert("xss")</script>Hello', expected: 'Hello' },
        { input: '<iframe src="malicious.com"></iframe>Content', expected: 'Content' },
        { input: '<object data="malicious.swf"></object>Text', expected: 'Text' },
        { input: '<embed src="malicious.swf">Content', expected: 'Content' },
        { input: '<link rel="stylesheet" href="malicious.css">Text', expected: 'Text' },
        { input: '<meta http-equiv="refresh" content="0;url=malicious.com">Text', expected: 'Text' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(SanitizationUtils.stripDangerousHtml(input)).toBe(expected);
      });
    });
    
    it('should remove dangerous URL schemes', () => {
      const testCases = [
        { input: 'Click <a href="javascript:alert(1)">here</a>', expected: 'Click <a href="">here</a>' },
        { input: 'Image: <img src="vbscript:malicious">text', expected: 'Image: <img src="">text' },
        { input: 'Link with data: <a href="data:text/html,<script>alert(1)</script>">click</a>', expected: 'Link with <a href="">click</a>' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = SanitizationUtils.stripDangerousHtml(input);
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('vbscript:');
        expect(result).not.toContain('data:');
      });
    });
    
    it('should remove event handlers', () => {
      const input = '<div onload="malicious()" onclick="alert(1)" onmouseover="bad()">Content</div>';
      const result = SanitizationUtils.stripDangerousHtml(input);
      
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('Content');
    });
  });
  
  describe('detectSqlInjection', () => {
    it('should detect SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "admin' OR '1'='1",
        "1' UNION SELECT * FROM passwords --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "1' AND 1=1 --",
        "'; EXEC xp_cmdshell('format c:'); --"
      ];
      
      sqlInjectionAttempts.forEach(attempt => {
        expect(SanitizationUtils.detectSqlInjection(attempt)).toBe(true);
      });
    });
    
    it('should not flag safe inputs', () => {
      const safeInputs = [
        'Normal user input',
        'Email: user@example.com',
        'Price: $19.99',
        'Date: 2023-12-01',
        'Simple text with numbers 123'
      ];
      
      safeInputs.forEach(input => {
        expect(SanitizationUtils.detectSqlInjection(input)).toBe(false);
      });
    });
    
    it('should handle empty inputs', () => {
      expect(SanitizationUtils.detectSqlInjection('')).toBe(false);
      expect(SanitizationUtils.detectSqlInjection(null as any)).toBe(false);
      expect(SanitizationUtils.detectSqlInjection(undefined as any)).toBe(false);
    });
  });
  
  describe('sanitizePath', () => {
    it('should remove path traversal attempts', () => {
      const testCases = [
        { input: '../../../etc/passwd', expected: 'etc/passwd' },
        { input: '..\\..\\windows\\system32', expected: 'windows\\system32' },
        { input: 'normal/path/file.txt', expected: 'normal/path/file.txt' },
        { input: '%2e%2e%2fetc%2fpasswd', expected: 'etc%2fpasswd' },
        { input: '%2e%2e%5cwindows%5csystem32', expected: 'windows%5csystem32' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = SanitizationUtils.sanitizePath(input);
        expect(result).toBe(expected);
        expect(result).not.toContain('../');
        expect(result).not.toContain('..\\');
      });
    });
  });
  
  describe('removeControlCharacters', () => {
    it('should remove null bytes and control characters', () => {
      const input = 'Hello\x00World\x01Test\x1fContent\x7f';
      const result = SanitizationUtils.removeControlCharacters(input);
      
      expect(result).toBe('HelloWorldTestContent');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).not.toContain('\x1f');
      expect(result).not.toContain('\x7f');
    });
    
    it('should preserve allowed characters', () => {
      const input = 'Hello\tWorld\nNext\rLine';
      const result = SanitizationUtils.removeControlCharacters(input);
      
      expect(result).toContain('\t');
      expect(result).toContain('\n');
      expect(result).toContain('\r');
    });
  });
  
  describe('normalizeUnicode', () => {
    it('should normalize Unicode characters', () => {
      // Test with combining characters
      const input = 'café'; // 'e' + combining acute accent
      const result = SanitizationUtils.normalizeUnicode(input);
      
      expect(result).toBe('café'); // Normalized form
      expect(result.length).toBeLessThanOrEqual(input.length);
    });
    
    it('should handle normalization errors gracefully', () => {
      const input = 'normal text';
      const result = SanitizationUtils.normalizeUnicode(input);
      
      expect(result).toBe(input);
    });
  });
  
  describe('sanitizeText', () => {
    it('should apply comprehensive sanitization with default options', () => {
      const input = '  <script>alert("xss")</script>Hello\x00World../..  ';
      const result = SanitizationUtils.sanitizeText(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('../');
      expect(result).toBe('HelloWorld');
    });
    
    it('should respect maxLength option', () => {
      const input = 'A'.repeat(100);
      const result = SanitizationUtils.sanitizeText(input, { maxLength: 50 });
      
      expect(result.length).toBe(50);
      expect(result).toBe('A'.repeat(50));
    });
    
    it('should handle allowHtml option', () => {
      const input = '<p>Safe paragraph</p><script>alert("xss")</script>';
      const resultNoHtml = SanitizationUtils.sanitizeText(input, { allowHtml: false });
      const resultWithHtml = SanitizationUtils.sanitizeText(input, { allowHtml: true });
      
      expect(resultNoHtml).not.toContain('<p>');
      expect(resultWithHtml).toContain('<p>');
      expect(resultWithHtml).not.toContain('<script>');
    });
    
    it('should handle trimWhitespace option', () => {
      const input = '  Hello World  ';
      const resultTrimmed = SanitizationUtils.sanitizeText(input, { trimWhitespace: true });
      const resultNotTrimmed = SanitizationUtils.sanitizeText(input, { trimWhitespace: false });
      
      expect(resultTrimmed).toBe('Hello World');
      expect(resultNotTrimmed).toBe('  Hello World  ');
    });
  });
  
  describe('sanitizeFilename', () => {
    it('should remove dangerous characters from filenames', () => {
      const testCases = [
        { input: 'file<script>.txt', expected: 'filescript.txt' },
        { input: 'my|file?.jpg', expected: 'myfile.jpg' },
        { input: 'document"with:quotes*.pdf', expected: 'documentwithquotes.pdf' },
        { input: '../../../etc/passwd', expected: 'etcpasswd' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = SanitizationUtils.sanitizeFilename(input);
        expect(result).toBe(expected);
      });
    });
    
    it('should handle extension validation', () => {
      const input = 'image.exe';
      const result = SanitizationUtils.sanitizeFilename(input, {
        allowedExtensions: ['.jpg', '.png', '.gif'],
        preserveExtension: true
      });
      
      expect(result).toBe('image');
      expect(result).not.toContain('.exe');
    });
    
    it('should enforce length limits', () => {
      const longFilename = 'a'.repeat(300) + '.txt';
      const result = SanitizationUtils.sanitizeFilename(longFilename, { maxLength: 50 });
      
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain('.txt');
    });
    
    it('should provide default filename for empty input', () => {
      const testCases = ['', '   ', null, undefined, '...', '   . . . '];
      
      testCases.forEach(input => {
        const result = SanitizationUtils.sanitizeFilename(input as any);
        expect(result).toBe('untitled');
      });
    });
  });
  
  describe('sanitizeUrl', () => {
    it('should accept valid HTTP/HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com/path',
        'https://subdomain.example.com:8080/path?query=value'
      ];
      
      validUrls.forEach(url => {
        const result = SanitizationUtils.sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });
    
    it('should reject dangerous URL schemes', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:malicious',
        'file:///etc/passwd',
        'ftp://example.com/file.txt'
      ];
      
      dangerousUrls.forEach(url => {
        const result = SanitizationUtils.sanitizeUrl(url);
        expect(result).toBe('');
      });
    });
    
    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        '://example.com',
        ''
      ];
      
      malformedUrls.forEach(url => {
        const result = SanitizationUtils.sanitizeUrl(url);
        expect(result).toBe('');
      });
    });
  });
  
  describe('sanitizeEmail', () => {
    it('should normalize email addresses', () => {
      const testCases = [
        { input: '  USER@EXAMPLE.COM  ', expected: 'user@example.com' },
        { input: 'Test.User+Tag@Example.Org', expected: 'test.user+tag@example.org' },
        { input: 'user_123@example-domain.co.uk', expected: 'user_123@example-domain.co.uk' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(SanitizationUtils.sanitizeEmail(input)).toBe(expected);
      });
    });
    
    it('should remove control characters and invalid characters', () => {
      const input = 'user@exam\x00ple.com\x01test';
      const result = SanitizationUtils.sanitizeEmail(input);
      
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).toBe('user@example.comtest');
    });
    
    it('should handle empty inputs', () => {
      expect(SanitizationUtils.sanitizeEmail('')).toBe('');
      expect(SanitizationUtils.sanitizeEmail(null as any)).toBe('');
      expect(SanitizationUtils.sanitizeEmail(undefined as any)).toBe('');
    });
  });
  
  describe('sanitizeSearchQuery', () => {
    it('should sanitize search queries', () => {
      const input = '<script>alert("xss")</script>search term';
      const result = SanitizationUtils.sanitizeSearchQuery(input);
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('search term');
    });
    
    it('should detect and handle SQL injection in search', () => {
      const input = "search' OR '1'='1 --";
      const result = SanitizationUtils.sanitizeSearchQuery(input);
      
      expect(result).not.toContain("OR '1'='1");
      expect(result).toContain('search');
    });
    
    it('should enforce search query length limits', () => {
      const longQuery = 'search '.repeat(50);
      const result = SanitizationUtils.sanitizeSearchQuery(longQuery);
      
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('sanitizeJsonObject', () => {
    it('should sanitize object properties recursively', () => {
      const input = {
        name: '<script>alert("xss")</script>test',
        nested: {
          value: 'safe\x00value',
          number: 123
        },
        array: ['item1<script>', 'item2\x00clean']
      };
      
      const result = SanitizationUtils.sanitizeJsonObject(input);
      
      expect(result.name).not.toContain('<script>');
      expect(result.nested.value).not.toContain('\x00');
      expect(result.array[0]).not.toContain('<script>');
      expect(result.nested.number).toBe(123);
    });
    
    it('should handle deep nesting with maxDepth limit', () => {
      const deepObject: any = { level: 1 };
      let current = deepObject;
      for (let i = 2; i <= 15; i++) {
        current.next = { level: i };
        current = current.next;
      }
      
      const result = SanitizationUtils.sanitizeJsonObject(deepObject, 5);
      
      let depth = 0;
      let curr = result;
      while (curr && curr.next) {
        depth++;
        curr = curr.next;
      }
      
      expect(depth).toBeLessThan(5);
    });
    
    it('should limit array and object sizes', () => {
      const largeArray = Array(200).fill('item');
      const result = SanitizationUtils.sanitizeJsonObject(largeArray);
      
      expect(result.length).toBeLessThanOrEqual(100);
    });
    
    it('should handle null and primitive values', () => {
      const input = {
        nullValue: null,
        stringValue: 'test',
        numberValue: 42,
        boolValue: true,
        undefinedValue: undefined
      };
      
      const result = SanitizationUtils.sanitizeJsonObject(input);
      
      expect(result.nullValue).toBe(null);
      expect(result.stringValue).toBe('test');
      expect(result.numberValue).toBe(42);
      expect(result.boolValue).toBe(true);
      expect('undefinedValue' in result).toBe(false);
    });
  });
  
  describe('securitySanitize', () => {
    it('should route to appropriate sanitization methods', () => {
      const testCases = [
        { input: 'user@EXAMPLE.COM', type: 'email' as const, expected: 'user@example.com' },
        { input: 'https://EXAMPLE.COM/path', type: 'url' as const },
        { input: 'file<script>.txt', type: 'filename' as const, expected: 'filescript.txt' },
        { input: '<script>search</script>', type: 'search' as const },
        { input: '<script>text</script>', type: 'text' as const }
      ];
      
      testCases.forEach(({ input, type, expected }) => {
        const result = SanitizationUtils.securitySanitize(input, type);
        
        if (expected) {
          expect(result).toBe(expected);
        } else {
          expect(typeof result).toBe('string');
          expect(result).not.toContain('<script>');
        }
      });
    });
    
    it('should handle errors gracefully', () => {
      const result = SanitizationUtils.securitySanitize('test', 'text');
      expect(typeof result).toBe('string');
    });
  });
});