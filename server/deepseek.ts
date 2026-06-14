/**
 * DeepSeek LLM 服务模块
 * 替代 Manus 内置 LLM，通过管理后台配置 API Key 和模型
 * 兼容 OpenAI Chat Completions API 格式
 */
import * as db from "./db";

// ==================== Types (保持与原 _core/llm.ts 兼容) ====================
export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};

export type ToolChoice = "none" | "auto" | "required" | { name: string } | { type: "function"; function: { name: string } };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  temperature?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type ResponseFormat = { type: "text" } | { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };

// ==================== Config Cache ====================
interface DeepSeekConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

let configCache: DeepSeekConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minute

export function invalidateDeepSeekConfigCache() {
  configCache = null;
  configCacheTime = 0;
}

async function getDeepSeekConfig(): Promise<DeepSeekConfig> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }
  const [apiKey, apiUrl, model, maxTokens, temperature] = await Promise.all([
    db.getConfigValue("deepseek_api_key", ""),
    db.getConfigValue("deepseek_api_url", "https://api.deepseek.com"),
    db.getConfigValue("deepseek_model", "deepseek-chat"),
    db.getConfigValue("deepseek_max_tokens", "4096"),
    db.getConfigValue("deepseek_temperature", "0.7"),
  ]);
  configCache = {
    apiKey,
    apiUrl: apiUrl || "https://api.deepseek.com",
    model: model || "deepseek-chat",
    maxTokens: parseInt(maxTokens) || 4096,
    temperature: parseFloat(temperature) || 0.7,
  };
  configCacheTime = now;
  return configCache;
}

// ==================== Message Normalization ====================
function normalizeMessage(message: Message): Record<string, unknown> {
  const { role, name, tool_call_id, content } = message;

  if (role === "tool" || role === "function") {
    const textContent = Array.isArray(content)
      ? content.map(part => (typeof part === "string" ? part : JSON.stringify(part))).join("\n")
      : (typeof content === "string" ? content : JSON.stringify(content));
    return { role, name, tool_call_id, content: textContent };
  }

  const parts = Array.isArray(content) ? content : [content];
  // DeepSeek primarily supports text content; collapse to string if all text
  const textParts: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      textParts.push(part);
    } else if (part.type === "text") {
      textParts.push(part.text);
    } else {
      // DeepSeek doesn't support image/file content natively; skip or stringify
      textParts.push(`[${part.type}]`);
    }
  }
  return { role, name, content: textParts.join("\n") };
}

function normalizeToolChoice(toolChoice: ToolChoice | undefined, tools: Tool[] | undefined): unknown {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) return "auto";
    if (tools.length === 1) return { type: "function", function: { name: tools[0].function.name } };
    return "auto";
  }
  if (typeof toolChoice === "object" && "name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return toolChoice;
}

// ==================== Main Invoke Function ====================
/**
 * 调用 DeepSeek API（兼容 OpenAI Chat Completions 格式）
 * 配置从系统 config 表动态读取，管理后台可修改
 */
export async function invokeDeepSeek(params: InvokeParams): Promise<InvokeResult> {
  const config = await getDeepSeekConfig();

  if (!config.apiKey) {
    throw new Error("DeepSeek API Key 未配置。请在管理后台 → 系统配置 中设置 deepseek_api_key");
  }

  const { messages, tools, toolChoice, tool_choice, responseFormat, response_format, temperature, maxTokens, max_tokens } = params;

  const payload: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(normalizeMessage),
    max_tokens: maxTokens || max_tokens || config.maxTokens,
    temperature: temperature ?? config.temperature,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const tc = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (tc) payload.tool_choice = tc;

  const rf = responseFormat || response_format;
  if (rf) {
    // DeepSeek supports json_object mode
    if (rf.type === "json_schema") {
      // DeepSeek doesn't support json_schema directly, use json_object + system prompt
      payload.response_format = { type: "json_object" };
    } else {
      payload.response_format = rf;
    }
  }

  const apiUrl = `${config.apiUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API 调用失败: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

/**
 * 兼容旧接口的别名 - 直接替换 invokeLLM
 */
export const invokeLLM = invokeDeepSeek;
