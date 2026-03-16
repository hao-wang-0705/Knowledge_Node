/**
 * 智能结构化工具（统一工具）
 * 合并了原 capture / smart-capture / smart-deconstruct 三个工具的能力
 *
 * 执行策略（无实体识别）：
 * - quick 模式: 单次 AI 调用（CoT 引导），输出 { nodes }
 * - structure / deconstruct 模式: Phase 1 结构化拆分（流式） + Phase 2 属性挂载（仅标签+字段），输出 { nodes }
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

// ============================================================================
// 类型定义
// ============================================================================

export interface SmartStructureTagSchema {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  category?: 'entity' | 'action';
  fields: Array<{
    key: string;
    name: string;
    type: string;
    options?: string[];
    targetTagId?: string;
    targetTagIds?: string[];
    multiple?: boolean;
    statusConfig?: {
      states: string[];
      initial: string;
      doneState?: string;
    };
  }>;
}

export type SmartStructureMode = 'quick' | 'structure' | 'deconstruct';

export interface SmartStructureInput extends ToolInput {
  /** 用户输入的文本 */
  text: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SmartStructureTagSchema[];
  /** 处理模式 */
  mode: SmartStructureMode;
  /** deconstruct 模式下的原始节点 ID */
  nodeId?: string;
  /** 用户手动指定的标签 ID */
  manualTagId?: string;
  /** 最大嵌套层级（默认 3） */
  maxDepth?: number;
}

export interface SmartStructureNode {
  tempId: string;
  content: string;
  parentTempId: string | null;
  supertagId: string | null;
  tags?: string[];
  fields: Record<string, unknown>;
  confidence: number;
  isAIExtracted: boolean;
}

/** 工具输出：仅节点数组，无实体识别/引用 */
export interface SmartStructureResult {
  nodes: SmartStructureNode[];
}

// Phase 1 中间结果
interface Phase1Node {
  tempId: string;
  content: string;
  parentTempId: string | null;
}

// Phase 2 annotation
interface Phase2Annotation {
  tempId: string;
  supertagId: string | null;
  fields: Record<string, unknown>;
  confidence: number;
  matchReason?: string;
}

// ============================================================================
// Prompt 定义
// ============================================================================

const PHASE1_SYSTEM_PROMPT = `你是一个专业的文本结构化专家。你的唯一任务是将输入文本按语义拆分为层次清晰的树形节点。

## 严格约束
1. 仅做拆分，不做标签匹配或字段提取
2. 保持原文语义完整，不得添加原文中不存在的信息
3. 最多 {maxDepth} 层嵌套深度
4. 每个节点的 content 应为完整的、自包含的语义单元

## 拆分策略
- 识别文本中的主题/段落/列表项/任务/论点，将其拆为独立节点
- 父节点是总结性/概括性内容，子节点是具体细节
- 如果文本内容单一，不强制拆分，返回单个节点即可
- 优先保留原文表述，仅做必要的精简

## 输出格式
直接返回 JSON 数组，每个节点：
{ "tempId": "唯一ID（从1开始递增的数字字符串）", "content": "节点正文", "parentTempId": "父节点ID或null" }

不要添加 markdown 代码块标记，直接返回 JSON。`;

const PHASE1_DECONSTRUCT_ADDON = `

## 解构模式特殊约束
- 每个子节点的 content 必须是原文的直接摘录或精简概括
- 不得引入原文中未出现的事实、观点或数据
- 父节点作为概括性标题，子节点是原文具体论述的拆分`;

const PHASE2_SYSTEM_PROMPT = `你是一个精确的知识标注专家。你的任务是为给定的知识节点匹配最合适的超级标签、并提取字段值。你不需要修改节点内容，只做标注。

## 核心决策流程（对每个节点，严格按此 4 步执行）

### Step 1: 意图识别
阅读节点 content，用一句话判断其核心意图。
例："这是一个待办任务" / "这是一条事件记录" / "这是普通笔记"

### Step 2: 标签匹配
将意图与每个可用行动标签的 name + description 做语义比对：
- 计算匹配置信度 (0.0 ~ 1.0)
- 选择置信度最高的标签
- 如果最高置信度 < 0.8，则 supertagId 设为 null，跳过 Step 3-4

### Step 3: 字段逐一提取
仅在 Step 2 匹配成功后执行。按匹配标签的字段定义，逐字段从 content 中提取值：

| 字段类型 | 提取规则 |
|---------|--------|
| text | 直接提取相关文本片段 |
| number | 提取数值。无法提取时留空 |
| date | 相对日期基于「日期上下文」转为 YYYY-MM-DD。模糊日期（"近期"、"月底"）留空 |
| select | 必须从 options 列表精确选择。允许语义映射（"紧急"→"P0"），无法映射则留空 |
| multi-select | 从 options 中选择所有匹配项，返回字符串数组 |
| status | 使用 statusConfig.initial 作为默认值。若内容明确提及完成/阻塞等状态，映射到对应 state |
| reference | 跳过，不提取 |

### Step 4: 合规校验
- 确认所有 fields 的 key 存在于标签字段定义中（不引入未定义字段）
- 确认值类型与字段 type 匹配
- 不合规的字段直接删除

## 绝对禁止
- ❌ 编造原文中不存在的信息来填充字段
- ❌ 将 select/multi-select 的值设为 options 列表之外的内容
- ❌ 所有节点都强制匹配标签（普通笔记就应该是 null）
- ❌ 输出包含 content 或 parentTempId（这些不是你的职责）

## 反例
输入节点: { "tempId": "3", "content": "买杯咖啡" }
可用标签: [{ name: "项目管理", fields: [...] }]
❌ 错误: { "tempId": "3", "supertagId": "proj_mgmt", "confidence": 0.85 }
✅ 正确: { "tempId": "3", "supertagId": null, "fields": {}, "confidence": 0.3 }
原因: "买杯咖啡"与"项目管理"语义不匹配，不应强制挂载`;

const QUICK_MODE_SYSTEM_PROMPT = `你是一个专业的知识管理助手，擅长将用户输入快速整理为结构化知识节点。

请按照以下步骤处理用户输入（内部思考即可，不需要输出思考过程）：

1. 理解内容的核心意图
2. 判断是否需要拆分（短内容通常不拆分，返回单个节点）
3. 从行动标签列表中寻找最佳匹配（置信度 < 0.8 时设为 null）
4. 按匹配标签的字段定义提取值

## 标签匹配规则
- 每个节点仅匹配一个行动标签，且置信度必须 >= 0.8
- 不要强制匹配，普通笔记内容可以不挂载标签

## 字段提取规则
- text: 直接提取文本片段
- number: 提取数值，无法提取时留空
- date: 相对日期基于「日期上下文」转为 YYYY-MM-DD，模糊日期留空
- select: 必须从 options 列表精确选择，允许语义映射，无法映射则留空
- multi-select: 从 options 中选择所有匹配项，返回字符串数组
- status: 使用 statusConfig.initial 作为默认值
- reference: 跳过，不提取

## 绝对禁止
- ❌ 编造原文中不存在的信息
- ❌ select/multi-select 的值不在 options 列表中
- ❌ 强制匹配标签`;

// ============================================================================
// 工具实现
// ============================================================================

export class SmartStructureTool extends BaseTool<SmartStructureInput, ToolOutput> {
  readonly name = 'smart_structure';
  readonly description = '智能结构化工具，将文本整理为树形节点结构并匹配标签、提取字段';
  readonly category: ToolCategory = 'extraction';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: '用户输入的文本' },
      supertags: {
        type: 'array',
        description: '可用的 Supertag Schema 列表',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            icon: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            fields: { type: 'array' },
          },
        },
      },
      mode: {
        type: 'string',
        enum: ['quick', 'structure', 'deconstruct'],
        description: '处理模式',
      },
      nodeId: { type: 'string', description: '解构模式下的原始节点 ID' },
      manualTagId: { type: 'string', description: '用户手动指定的标签 ID' },
      maxDepth: { type: 'number', description: '最大嵌套层级', default: 3 },
    },
    required: ['text', 'supertags', 'mode'],
  };

  async *execute(input: SmartStructureInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const mode = input.mode || 'quick';

    try {
      yield this.createMetadata({ model, mode, startTime: Date.now(), nodeId: input.nodeId });

      if (mode === 'quick') {
        yield* this.executeQuickMode(input, client, model);
      } else {
        yield* this.executeMultiPhaseMode(input, client, model);
      }
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '智能结构化处理失败',
      );
    }
  }

  // ============================================================================
  // Quick 模式 -- 单次调用
  // ============================================================================

  private async *executeQuickMode(
    input: SmartStructureInput,
    client: ReturnType<typeof this.getClient>,
    model: string,
  ): AsyncGenerator<ToolOutput> {
    const userPrompt = this.buildQuickModePrompt(input);
    const systemPrompt = this.buildQuickModeSystemPrompt(input);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    const parsed = this.parseQuickModeResponse(content);

    yield this.createComplete(JSON.stringify(parsed), {
      tokensUsed: response.usage?.total_tokens,
      model,
      mode: 'quick',
      phase: 'single',
    });
  }

  // ============================================================================
  // Multi-Phase 模式 -- Phase 1 + Phase 2
  // ============================================================================

  private async *executeMultiPhaseMode(
    input: SmartStructureInput,
    client: ReturnType<typeof this.getClient>,
    model: string,
  ): AsyncGenerator<ToolOutput> {
    // ---- Phase 1: 结构化拆分（流式） ----
    const phase1Nodes = await this.runPhase1(input, client, model, (chunk) => chunk);
    // 将 phase1 完整结果作为中间输出（前端可用于进度显示）
    yield this.createChunk(JSON.stringify({ phase: 1, nodes: phase1Nodes }));

    // ---- Phase 2: 属性挂载（仅标签 + 字段） ----
    const hasSupertags = input.supertags && input.supertags.length > 0;
    let annotations: Phase2Annotation[] = [];
    if (hasSupertags) {
      annotations = await this.runPhase2(phase1Nodes, input, client, model);
    }

    // ---- 合并 Phase 1 + Phase 2 ----
    const merged = this.mergePhases(phase1Nodes, annotations);
    const result: SmartStructureResult = { nodes: merged };

    yield this.createComplete(JSON.stringify(result), {
      tokensUsed: 0,
      model,
      mode: input.mode,
      nodeCount: merged.length,
    });
  }

  // ============================================================================
  // Phase 1: 结构化拆分
  // ============================================================================

  private async runPhase1(
    input: SmartStructureInput,
    client: ReturnType<typeof this.getClient>,
    model: string,
    _onChunk: (chunk: string) => string,
  ): Promise<Phase1Node[]> {
    const maxDepth = input.maxDepth || 3;
    let systemPrompt = PHASE1_SYSTEM_PROMPT.replace('{maxDepth}', String(maxDepth));

    if (input.mode === 'deconstruct') {
      systemPrompt += PHASE1_DECONSTRUCT_ADDON;
    }

    const userPrompt = this.buildPhase1UserPrompt(input);

    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.2,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
      }
    }

    return this.parsePhase1Response(fullContent);
  }

  // ============================================================================
  // Phase 2: 属性挂载（仅标签 + 字段）
  // ============================================================================

  private async runPhase2(
    nodes: Phase1Node[],
    input: SmartStructureInput,
    client: ReturnType<typeof this.getClient>,
    model: string,
  ): Promise<Phase2Annotation[]> {
    const actionTags = input.supertags.filter(t => t.category !== 'entity');
    const userPrompt = this.buildPhase2UserPrompt(nodes, actionTags, input.manualTagId);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PHASE2_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    return this.parsePhase2Response(content);
  }

  // ============================================================================
  // 合并逻辑
  // ============================================================================

  private mergePhases(
    phase1Nodes: Phase1Node[],
    annotations: Phase2Annotation[],
  ): SmartStructureNode[] {
    const annotationMap = new Map(annotations.map(a => [a.tempId, a]));

    return phase1Nodes.map(node => {
      const annotation = annotationMap.get(node.tempId);
      const tagId = annotation?.supertagId ?? null;
      return {
        tempId: node.tempId,
        content: node.content,
        parentTempId: node.parentTempId,
        supertagId: tagId,
        tags: tagId ? [tagId] : [],
        fields: annotation?.fields ?? {},
        confidence: annotation?.confidence ?? 0,
        isAIExtracted: true,
      };
    });
  }

  // ============================================================================
  // Prompt 构建
  // ============================================================================

  private buildDateContext(): string {
    const today = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，星期${weekdays[today.getDay()]}`;
  }

  private buildPhase1UserPrompt(input: SmartStructureInput): string {
    const prefix = input.mode === 'deconstruct'
      ? '请将以下节点内容解构为层级化的子节点树（不要修改原文，仅做拆分）：'
      : '请将以下内容整理为结构化的知识节点：';

    return `${prefix}

${input.text}`;
  }

  private buildPhase2UserPrompt(
    nodes: Phase1Node[],
    actionTags: SmartStructureTagSchema[],
    manualTagId?: string,
  ): string {
    const dateContext = this.buildDateContext();
    const nodesJson = nodes.map(n => ({ tempId: n.tempId, content: n.content }));
    const actionTagList = this.formatTagList(actionTags, true);

    let prompt = `## 日期上下文
${dateContext}

## 待标注的节点列表
${JSON.stringify(nodesJson, null, 2)}

## 行动标签（用于节点标签匹配）
${actionTagList || '暂无行动标签（所有节点 supertagId 设为 null）'}`;

    if (manualTagId) {
      const manualTag = actionTags.find(t => t.id === manualTagId);
      if (manualTag) {
        prompt += `

## 用户指定标签
用户已手动为第一个节点选择标签：${manualTag.icon || '📌'} ${manualTag.name} (ID: ${manualTagId})
请对第一个节点使用此标签并提取相应字段。`;
      }
    }

    prompt += `

## 输出格式
返回 JSON 对象（不要包含 markdown 代码块标记）：
{
  "annotations": [
    {
      "tempId": "节点ID",
      "supertagId": "标签ID 或 null",
      "fields": { "field_key": "提取值" },
      "confidence": 0.0-1.0,
      "matchReason": "一句话匹配理由"
    }
  ]
}`;

    return prompt;
  }

  private buildQuickModeSystemPrompt(_input: SmartStructureInput): string {
    return QUICK_MODE_SYSTEM_PROMPT;
  }

  private buildQuickModePrompt(input: SmartStructureInput): string {
    const dateContext = this.buildDateContext();
    const actionTags = input.supertags.filter(t => t.category !== 'entity');
    const actionTagList = this.formatTagList(actionTags, true);

    let prompt = `## 日期上下文
${dateContext}

## 用户输入
${input.text}

## 行动标签（用于节点标签匹配）
${actionTagList || '暂无标签（所有节点 supertagId 设为 null）'}`;

    if (input.manualTagId) {
      const manualTag = actionTags.find(t => t.id === input.manualTagId);
      if (manualTag) {
        prompt += `

## 用户指定标签
用户已手动选择标签：${manualTag.icon || '📌'} ${manualTag.name} (ID: ${input.manualTagId})
请使用此标签并提取相应字段。`;
      }
    }

    prompt += `

## 输出格式
返回 JSON 对象（不要包含 markdown 代码块标记）：
{
  "nodes": [
    {
      "tempId": "唯一ID",
      "content": "节点正文",
      "parentTempId": null,
      "supertagId": "标签ID或null",
      "fields": { "key": "value" },
      "confidence": 0.0-1.0,
      "isAIExtracted": true
    }
  ]
}`;

    return prompt;
  }

  // ============================================================================
  // 格式化辅助
  // ============================================================================

  private formatTagList(tags: SmartStructureTagSchema[], includeFields: boolean): string {
    return tags.map(tag => {
      let desc = `- ${tag.icon || '📌'} ${tag.name} (ID: ${tag.id})`;
      if (tag.description) desc += `: ${tag.description}`;

      if (includeFields && tag.fields.length > 0) {
        const fieldsDesc = tag.fields
          .filter(f => f.type !== 'reference')
          .map(f => {
            let fieldStr = `${f.name}(${f.key}): ${f.type}`;
            if (f.options && f.options.length > 0) {
              fieldStr += `, 选项: ${f.options.join('/')}`;
            }
            if (f.type === 'status' && f.statusConfig) {
              fieldStr += `, 状态: ${f.statusConfig.states.join('/')} (初始: ${f.statusConfig.initial})`;
            }
            return fieldStr;
          })
          .join('; ');
        if (fieldsDesc) desc += `\n  字段: ${fieldsDesc}`;
      }

      return desc;
    }).join('\n');
  }

  // ============================================================================
  // 响应解析
  // ============================================================================

  private parsePhase1Response(content: string): Phase1Node[] {
    const cleaned = this.cleanJsonResponse(content);

    try {
      const parsed = JSON.parse(cleaned);
      const nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || [parsed]);

      return nodes.map((node: Record<string, unknown>, index: number) => ({
        tempId: String(node.tempId || index + 1),
        content: String(node.content || ''),
        parentTempId: node.parentTempId ? String(node.parentTempId) : null,
      }));
    } catch {
      return [{
        tempId: '1',
        content: content.trim() || '',
        parentTempId: null,
      }];
    }
  }

  private parsePhase2Response(content: string): Phase2Annotation[] {
    const cleaned = this.cleanJsonResponse(content);

    try {
      const parsed = JSON.parse(cleaned);
      return (parsed.annotations || []).map(
        (a: Record<string, unknown>) => ({
          tempId: String(a.tempId || ''),
          supertagId: a.supertagId ? String(a.supertagId) : null,
          fields: (a.fields as Record<string, unknown>) || {},
          confidence: typeof a.confidence === 'number' ? a.confidence : 0,
          matchReason: a.matchReason ? String(a.matchReason) : undefined,
        }),
      );
    } catch {
      return [];
    }
  }

  private parseQuickModeResponse(content: string): SmartStructureResult {
    const cleaned = this.cleanJsonResponse(content);

    try {
      const parsed = JSON.parse(cleaned);
      const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [parsed];
      const nodes: SmartStructureNode[] = rawNodes.map(
        (node: Record<string, unknown>, index: number) => {
          const tagId = node.supertagId ? String(node.supertagId) : null;
          return {
            tempId: String(node.tempId || index + 1),
            content: String(node.content || ''),
            parentTempId: node.parentTempId ? String(node.parentTempId) : null,
            supertagId: tagId,
            tags: tagId ? [tagId] : [],
            fields: (node.fields as Record<string, unknown>) || {},
            confidence: typeof node.confidence === 'number' ? node.confidence : 0,
            isAIExtracted: true,
          };
        },
      );
      return { nodes };
    } catch {
      return {
        nodes: [{
          tempId: '1',
          content: content.trim() || '',
          parentTempId: null,
          supertagId: null,
          tags: [],
          fields: {},
          confidence: 0,
          isAIExtracted: true,
        }],
      };
    }
  }

  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned;
  }
}
