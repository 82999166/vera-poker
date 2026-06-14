import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getConfigValue: vi.fn(),
}));

import * as db from "./db";
import { invokeDeepSeek, invalidateDeepSeekConfigCache } from "./deepseek";

describe("DeepSeek LLM Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateDeepSeekConfigCache();
  });

  it("should throw error when API key is not configured", async () => {
    (db.getConfigValue as any).mockResolvedValue("");
    
    await expect(invokeDeepSeek({
      messages: [{ role: "user", content: "hello" }],
    })).rejects.toThrow("DeepSeek API Key 未配置");
  });

  it("should read config from db.getConfigValue", async () => {
    (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
      const configs: Record<string, string> = {
        deepseek_api_key: "sk-test-key",
        deepseek_api_url: "https://api.deepseek.com",
        deepseek_model: "deepseek-chat",
        deepseek_max_tokens: "4096",
        deepseek_temperature: "0.7",
      };
      return Promise.resolve(configs[key] || defaultVal);
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: "test-id",
        created: Date.now(),
        model: "deepseek-chat",
        choices: [{ index: 0, message: { role: "assistant", content: "Hello!" }, finish_reason: "stop" }],
      }),
    });

    const result = await invokeDeepSeek({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.choices[0].message.content).toBe("Hello!");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer sk-test-key",
        }),
      })
    );

    // Verify model in request body
    const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(callBody.model).toBe("deepseek-chat");
    expect(callBody.max_tokens).toBe(4096);
  });

  it("should handle json_object response format", async () => {
    (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
      const configs: Record<string, string> = {
        deepseek_api_key: "sk-test-key",
        deepseek_api_url: "https://api.deepseek.com",
        deepseek_model: "deepseek-chat",
        deepseek_max_tokens: "4096",
        deepseek_temperature: "0.7",
      };
      return Promise.resolve(configs[key] || defaultVal);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: "test-id",
        created: Date.now(),
        model: "deepseek-chat",
        choices: [{ index: 0, message: { role: "assistant", content: '{"name":"test"}' }, finish_reason: "stop" }],
      }),
    });

    await invokeDeepSeek({
      messages: [{ role: "user", content: "hello" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "test", schema: { type: "object", properties: { name: { type: "string" } } } },
      },
    });

    const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    // json_schema should be converted to json_object for DeepSeek
    expect(callBody.response_format).toEqual({ type: "json_object" });
  });

  it("should cache config for 60 seconds", async () => {
    (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
      const configs: Record<string, string> = {
        deepseek_api_key: "sk-test-key",
        deepseek_api_url: "https://api.deepseek.com",
        deepseek_model: "deepseek-chat",
        deepseek_max_tokens: "4096",
        deepseek_temperature: "0.7",
      };
      return Promise.resolve(configs[key] || defaultVal);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: "test-id",
        created: Date.now(),
        model: "deepseek-chat",
        choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
      }),
    });

    // First call - reads config
    await invokeDeepSeek({ messages: [{ role: "user", content: "hello" }] });
    // Second call - should use cache
    await invokeDeepSeek({ messages: [{ role: "user", content: "hello again" }] });

    // getConfigValue should be called 5 times (first call) not 10 (both calls)
    expect(db.getConfigValue).toHaveBeenCalledTimes(5);
  });

  it("should handle API errors gracefully", async () => {
    (db.getConfigValue as any).mockImplementation((key: string, defaultVal: string) => {
      const configs: Record<string, string> = {
        deepseek_api_key: "sk-test-key",
        deepseek_api_url: "https://api.deepseek.com",
        deepseek_model: "deepseek-chat",
        deepseek_max_tokens: "4096",
        deepseek_temperature: "0.7",
      };
      return Promise.resolve(configs[key] || defaultVal);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(invokeDeepSeek({
      messages: [{ role: "user", content: "hello" }],
    })).rejects.toThrow("DeepSeek API 调用失败: 429 Too Many Requests");
  });
});
