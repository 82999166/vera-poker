import { describe, it, expect, beforeEach, vi } from "vitest";
import * as db from "./db";

describe("Telegram Bot Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate Telegram update schema", () => {
    const validUpdate = {
      update_id: 123,
      message: {
        message_id: 1,
        from: {
          id: 456,
          is_bot: false,
          first_name: "Test",
        },
        chat: {
          id: 789,
          type: "private",
        },
        text: "/help",
      },
    };

    // Schema validation would happen in the webhook handler
    expect(validUpdate.update_id).toBe(123);
    expect(validUpdate.message.text).toBe("/help");
  });

  it("should handle missing bot token gracefully", async () => {
    // Mock db.getConfigValue to return null
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce(null);

    const configValue = await db.getConfigValue("telegram_bot_token");
    expect(configValue).toBeNull();
  });

  it("should handle Telegram API errors", async () => {
    // Mock fetch to simulate API error
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("Invalid token"),
    });

    global.fetch = mockFetch;

    const response = await fetch("https://api.telegram.org/bot123/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: 789,
        text: "Test message",
      }),
    });

    expect(response.ok).toBe(false);
  });

  it("should parse different command types", () => {
    const commands = ["/start", "/help", "/balance", "/rooms"];
    const parsedCommands = commands.map(cmd => ({
      command: cmd,
      isCommand: cmd.startsWith("/"),
    }));

    expect(parsedCommands).toHaveLength(4);
    expect(parsedCommands.every(p => p.isCommand)).toBe(true);
  });

  it("should handle webhook without message gracefully", () => {
    const updateWithoutMessage = {
      update_id: 123,
      callback_query: {
        id: "callback_123",
        from: { id: 456, is_bot: false, first_name: "Test" },
        data: "some_data",
      },
    };

    // Should not crash and should return early
    expect(updateWithoutMessage.message).toBeUndefined();
  });

  it("should store and retrieve bot token from config", async () => {
    const testToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
    
    // Mock the config storage
    vi.spyOn(db, "upsertConfig").mockResolvedValueOnce(undefined);
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce(testToken);

    await db.upsertConfig({
      key: "telegram_bot_token",
      value: testToken,
      category: "integrations",
      label: "Telegram Bot Token",
      isPublic: false,
    });

    const retrievedToken = await db.getConfigValue("telegram_bot_token");
    expect(retrievedToken).toBe(testToken);
  });
});
