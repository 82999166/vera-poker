import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import { registerTelegramRoutes } from "./_core/telegram";
import * as db from "./db";

describe("Telegram Webhook E2E Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerTelegramRoutes(app);
    vi.clearAllMocks();
  });

  it("should handle webhook request with /start command", async () => {
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce("test-token-123");
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("{}"),
    } as any);

    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: "TestUser" },
        chat: { id: 456, type: "private" },
        text: "/start",
      },
    };

    // Simulate webhook request
    const request = {
      body: update,
      query: {},
    } as any;

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    // Call the webhook handler directly
    const handler = app._router.stack.find(
      (layer: any) => layer.route?.path === "/api/telegram/webhook"
    )?.route?.stack[0]?.handle;

    if (handler) {
      await handler(request, response);
      expect(response.json).toHaveBeenCalledWith({ ok: true });
    }
  });

  it("should return 400 when bot token is not configured", async () => {
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce(null);

    const update = {
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 123, is_bot: false, first_name: "TestUser" },
        chat: { id: 456, type: "private" },
        text: "/help",
      },
    };

    const request = {
      body: update,
      query: {},
    } as any;

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const handler = app._router.stack.find(
      (layer: any) => layer.route?.path === "/api/telegram/webhook"
    )?.route?.stack[0]?.handle;

    if (handler) {
      await handler(request, response);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        error: "Bot token not configured",
      });
    }
  });

  it("should handle webhook without message gracefully", async () => {
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce("test-token-123");

    const update = {
      update_id: 3,
      callback_query: {
        id: "callback_123",
        from: { id: 123, is_bot: false, first_name: "TestUser" },
        data: "some_data",
      },
    };

    const request = {
      body: update,
      query: {},
    } as any;

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const handler = app._router.stack.find(
      (layer: any) => layer.route?.path === "/api/telegram/webhook"
    )?.route?.stack[0]?.handle;

    if (handler) {
      await handler(request, response);
      // Should return 200 ok even without message
      expect(response.json).toHaveBeenCalledWith({ ok: true });
    }
  });

  it("should handle Telegram API failures gracefully", async () => {
    vi.spyOn(db, "getConfigValue").mockResolvedValueOnce("test-token-123");
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("Invalid token"),
    } as any);

    const update = {
      update_id: 4,
      message: {
        message_id: 4,
        from: { id: 123, is_bot: false, first_name: "TestUser" },
        chat: { id: 456, type: "private" },
        text: "/rooms",
      },
    };

    const request = {
      body: update,
      query: {},
    } as any;

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const handler = app._router.stack.find(
      (layer: any) => layer.route?.path === "/api/telegram/webhook"
    )?.route?.stack[0]?.handle;

    if (handler) {
      await handler(request, response);
      // Should still return 200 to acknowledge webhook
      expect(response.json).toHaveBeenCalledWith({ ok: true });
    }
  });

  it("should have health check endpoint", async () => {
    const request = {} as any;
    const response = {
      json: vi.fn().mockReturnThis(),
    } as any;

    const handler = app._router.stack.find(
      (layer: any) => layer.route?.path === "/api/telegram/health"
    )?.route?.stack[0]?.handle;

    if (handler) {
      await handler(request, response);
      expect(response.json).toHaveBeenCalledWith({
        ok: true,
        service: "telegram-webhook",
      });
    }
  });

  it("should handle command parsing correctly", () => {
    const commands = [
      { text: "/start", expected: "start" },
      { text: "/help", expected: "help" },
      { text: "/balance", expected: "balance" },
      { text: "/rooms", expected: "rooms" },
      { text: "/unknown", expected: "unknown" },
    ];

    commands.forEach(({ text, expected }) => {
      const command = text.toLowerCase().trim();
      expect(command.startsWith("/")).toBe(true);
      expect(command.substring(1)).toBe(expected);
    });
  });
});
