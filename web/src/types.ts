export interface SessionMeta {
  id: string;
  jsonlPath: string;
  cwd: string;
  startedAt: string;
  title: string;
  messageCount: number;
  model?: string;
  durationMs?: number;
}

export interface ChatMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  thinking?: string;
  tools: { name: string; isError?: boolean }[];
  error?: string;
  aborted?: boolean;
}

export interface SearchResult extends SessionMeta {
  snippet: string; // 第一处匹配的上下文片段
  matchCount: number; // 命中次数
}
