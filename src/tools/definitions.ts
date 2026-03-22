import { FunctionDeclaration, Type } from "@google/genai";

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "recordFinancialRecord",
    description: "记录财务事件（损失、收入、挽回）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "金额，正数" },
        category: { type: Type.STRING, enum: ["loss", "income", "saved"], description: "财务类别" },
        currency: { type: Type.STRING, enum: ["CNY", "USD", "HKD", "MOP", "MYR"], description: "货币单位" },
        occurredAt: { type: Type.STRING, description: "ISO时间格式" },
        confidence: { type: Type.NUMBER, description: "置信度 0.0-1.0" },
        sourceMessageId: { type: Type.STRING, description: "来源消息ID" }
      },
      required: ["amount", "category", "confidence", "sourceMessageId"]
    }
  },
  {
    name: "recordCollapseEvent",
    description: "记录崩塌/失控事件",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "相关金额（如有）" },
        trigger: { type: Type.STRING, description: "触发原因" },
        behavior: { type: Type.STRING, description: "具体行为描述" },
        occurredAt: { type: Type.STRING, description: "ISO时间格式" },
        confidence: { type: Type.NUMBER, description: "置信度 0.0-1.0" },
        sourceMessageId: { type: Type.STRING, description: "来源消息ID" }
      },
      required: ["behavior", "confidence", "sourceMessageId"]
    }
  },
  {
    name: "upsertEmotionLog",
    description: "记录情绪日志",
    parameters: {
      type: Type.OBJECT,
      properties: {
        intensity: { type: Type.NUMBER, description: "情绪强度 1-10" },
        labels: { type: Type.ARRAY, items: { type: Type.STRING }, description: "情绪标签列表" },
        occurredAt: { type: Type.STRING, description: "ISO时间格式" },
        confidence: { type: Type.NUMBER, description: "置信度 0.0-1.0" },
        sourceMessageId: { type: Type.STRING, description: "来源消息ID" }
      },
      required: ["intensity", "confidence", "sourceMessageId"]
    }
  },
  {
    name: "linkEvidence",
    description: "建立证据链关联",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourceMessageId: { type: Type.STRING, description: "来源消息ID" },
        targetId: { type: Type.STRING, description: "目标实体ID" },
        type: { type: Type.STRING, enum: ["self_report", "behavior", "association"], description: "证据类型" }
      },
      required: ["sourceMessageId", "targetId", "type"]
    }
  }
];
