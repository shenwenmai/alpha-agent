// ============================================================
// 共享 API 客户端 — 封装 /api/chat 调用
// ============================================================

export interface ChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export async function callChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  model: string = 'gpt-4.1-mini',
  maxTokens: number = 350,
): Promise<ChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, messages, temperature, model, maxTokens }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(`API ${res.status}: ${errData.error || ''}`),
      { status: res.status },
    );
  }

  const data = await res.json();
  return {
    text: data.text || '',
    usage: data.usage || { inputTokens: 0, outputTokens: 0 },
    model: data.model || model,
  };
}

// 清理 AI 回复中的常见问题
export function cleanResponse(text: string): string {
  let cleaned = text.trim();
  // 去掉角色自称前缀（AI 有时会加 "[军师]:" 这种）
  cleaned = cleaned.replace(/^\[.*?\]\s*[:：]\s*/, '');
  // 去掉开头的引号
  cleaned = cleaned.replace(/^["「]/, '').replace(/["」]$/, '');
  // 去掉 markdown 格式（**粗体**、*斜体*、~~删除线~~）
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');
  // 去掉 markdown 标题
  cleaned = cleaned.replace(/^#{1,3}\s+/gm, '');
  return cleaned;
}
