import { GeminiClient } from '../gemini.client';

// Mock fetch globally
const mockFetch = jest.fn();
(global as Record<string, unknown>).fetch = mockFetch;

/**
 * Creates a mock Gemini API JSON response.
 */
function createGeminiResponse(data: Record<string, unknown>): object {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(data) }],
        },
      },
    ],
  };
}

function createMockConfigService(overrides: Partial<{ geminiApiKey: string; apiRetryCount: number }> = {}) {
  return {
    geminiApiKey: overrides.geminiApiKey ?? 'test-api-key',
    apiRetryCount: overrides.apiRetryCount ?? 3,
  };
}

describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use a zero-delay client for most tests to avoid timer complexity
    client = GeminiClient.createForTesting(createMockConfigService() as never, 0);
  });

  describe('extract', () => {
    it('should return parsed extraction result on successful API call', async () => {
      const extractionData = {
        invoice_number: '00123',
        seller_name: 'Digiworld',
        confidence: { invoice_number: 0.99, seller_name: 0.85 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createGeminiResponse(extractionData),
      });

      const result = await client.extract('cGRmLWRhdGE=', 'Extract invoice fields...');

      expect(result.extractedData).toBeDefined();
      expect(result.rawText).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify API URL contains the key
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('key=test-api-key');
    });

    it('should retry on 429 (rate limit) and succeed on retry', async () => {
      const extractionData = { invoice_number: '00123' };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createGeminiResponse(extractionData),
        });

      const result = await client.extract('cGRmLWRhdGE=', 'Extract...');
      expect(result.extractedData).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 (server error) and succeed on retry', async () => {
      const extractionData = { invoice_number: '00456' };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createGeminiResponse(extractionData),
        });

      const result = await client.extract('cGRmLWRhdGE=', 'Extract...');
      expect(result.extractedData).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.extract('cGRmLWRhdGE=', 'Extract...')).rejects.toThrow(
        /max retries exceeded/i,
      );
      expect(mockFetch).toHaveBeenCalledTimes(3); // 3 attempts
    });

    it('should throw immediately on 400 (client error, no retry)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(client.extract('bad-data', 'Extract...')).rejects.toThrow(/400/);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed JSON in response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'This is not valid JSON {{{' }],
              },
            },
          ],
        }),
      });

      await expect(client.extract('cGRmLWRhdGE=', 'Extract...')).rejects.toThrow(/parse/i);
    });
  });

  describe('extractAndClassify', () => {
    it('should return classification and extraction data', async () => {
      const responseData = {
        classification: {
          schema_name: 'Digiworld',
          confidence: 0.92,
          reason: 'MST matches',
        },
        extracted_data: {
          invoice_number: '00789',
          seller_name: 'Digiworld Corp',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createGeminiResponse(responseData),
      });

      const schemas = [
        { name: 'Digiworld', description: 'Digiworld invoices', nccTaxId: '0302861742' },
        { name: 'Samsung', description: 'Samsung invoices', nccTaxId: '0100105012' },
      ];

      const result = await client.extractAndClassify('cGRmLWRhdGE=', schemas);

      expect(result.extractedData).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.classification?.schemaName).toBe('Digiworld');
      expect(result.classification?.confidence).toBe(0.92);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify prompt includes schema info
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const promptText = callBody.contents[0].parts[1].text as string;
      expect(promptText).toContain('Digiworld');
      expect(promptText).toContain('Samsung');
    });
  });

  describe('request format', () => {
    it('should send PDF as inlineData with correct MIME type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createGeminiResponse({ test: true }),
      });

      await client.extract('dGVzdC1wZGY=', 'Extract...');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const parts = callBody.contents[0].parts;
      expect(parts[0].inlineData.mimeType).toBe('application/pdf');
      expect(parts[0].inlineData.data).toBe('dGVzdC1wZGY=');
      expect(callBody.generationConfig.responseMimeType).toBe('application/json');
      expect(callBody.generationConfig.temperature).toBe(0);
    });
  });
});
