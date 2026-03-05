/**
 * 流式内容解析器 - 逐字符流式输出
 * 
 * 将 AI 返回的 JSON 数组解析为逐字符流式事件：
 * - node:create - 检测到节点结构开始时发送
 * - node:delta - content 字段的每个字符
 * - done - 完成
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 节点创建事件 */
export interface NodeCreateEvent {
  type: 'node:create';
  tempId: string;
  parentTempId: string | null;
}

/** 内容增量事件 */
export interface NodeDeltaEvent {
  type: 'node:delta';
  tempId: string;
  delta: string;
}

/** 完成事件 */
export interface DoneEvent {
  type: 'done';
  nodeCount: number;
}

/** 错误事件 */
export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type StreamEvent = NodeCreateEvent | NodeDeltaEvent | DoneEvent | ErrorEvent;

/** 解析器状态 */
enum ParserState {
  /** 等待数组开始 [ */
  WAIT_ARRAY_START,
  /** 等待对象开始 { */
  WAIT_OBJECT_START,
  /** 在对象内部，等待键名 */
  IN_OBJECT_WAIT_KEY,
  /** 正在读取键名字符串 */
  IN_KEY_STRING,
  /** 等待冒号 */
  WAIT_COLON,
  /** 等待值 */
  WAIT_VALUE,
  /** 正在读取字符串值 */
  IN_STRING_VALUE,
  /** 正在读取 null 值 */
  IN_NULL_VALUE,
  /** 等待逗号或对象结束 */
  WAIT_COMMA_OR_OBJECT_END,
  /** 等待逗号或数组结束 */
  WAIT_COMMA_OR_ARRAY_END,
  /** 解析完成 */
  DONE,
}

// ============================================================================
// StreamingContentParser
// ============================================================================

/**
 * 状态机解析器
 * 支持逐字符流式解析 AI 返回的 JSON 数组
 */
export class StreamingContentParser {
  private state: ParserState = ParserState.WAIT_ARRAY_START;
  
  // 字符串解析状态
  private inString = false;
  private escapeNext = false;
  private stringBuffer = '';
  
  // 当前节点状态
  private currentKey = '';
  private currentTempId = '';
  private currentParentTempId: string | null = null;
  private currentContent = '';
  private nodeCreated = false;
  
  // 统计
  private nodeCount = 0;
  
  // null 值解析
  private nullBuffer = '';
  
  // 事件队列
  private eventQueue: StreamEvent[] = [];

  /**
   * 添加新的文本块并获取产生的事件
   */
  addChunk(chunk: string): StreamEvent[] {
    this.eventQueue = [];
    
    for (const char of chunk) {
      this.processChar(char);
    }
    
    return this.eventQueue;
  }

  /**
   * 处理单个字符
   */
  private processChar(char: string): void {
    // 处理转义字符
    if (this.escapeNext) {
      this.escapeNext = false;
      if (this.inString) {
        // 解析转义序列
        const escapedChar = this.parseEscapedChar(char);
        this.stringBuffer += escapedChar;
      }
      return;
    }
    
    if (char === '\\' && this.inString) {
      this.escapeNext = true;
      return;
    }

    switch (this.state) {
      case ParserState.WAIT_ARRAY_START:
        if (char === '[') {
          this.state = ParserState.WAIT_OBJECT_START;
        }
        break;
        
      case ParserState.WAIT_OBJECT_START:
        if (char === '{') {
          this.resetCurrentNode();
          this.state = ParserState.IN_OBJECT_WAIT_KEY;
        } else if (char === ']') {
          this.emitDone();
          this.state = ParserState.DONE;
        }
        break;
        
      case ParserState.IN_OBJECT_WAIT_KEY:
        if (char === '"') {
          this.inString = true;
          this.stringBuffer = '';
          this.state = ParserState.IN_KEY_STRING;
        } else if (char === '}') {
          // 对象结束
          this.finalizeNode();
          this.state = ParserState.WAIT_COMMA_OR_ARRAY_END;
        }
        break;
        
      case ParserState.IN_KEY_STRING:
        if (char === '"' && !this.escapeNext) {
          this.inString = false;
          this.currentKey = this.stringBuffer;
          this.state = ParserState.WAIT_COLON;
        } else {
          this.stringBuffer += char;
        }
        break;
        
      case ParserState.WAIT_COLON:
        if (char === ':') {
          this.state = ParserState.WAIT_VALUE;
        }
        break;
        
      case ParserState.WAIT_VALUE:
        if (char === '"') {
          this.inString = true;
          this.stringBuffer = '';
          this.state = ParserState.IN_STRING_VALUE;
        } else if (char === 'n') {
          // 可能是 null
          this.nullBuffer = 'n';
          this.state = ParserState.IN_NULL_VALUE;
        } else if (!this.isWhitespace(char)) {
          // 其他值类型（不应该出现在我们的 schema 中）
          console.warn('[StreamingContentParser] Unexpected value type');
        }
        break;
        
      case ParserState.IN_STRING_VALUE:
        if (char === '"' && !this.escapeNext) {
          this.inString = false;
          this.handleStringValue(this.currentKey, this.stringBuffer);
          this.state = ParserState.WAIT_COMMA_OR_OBJECT_END;
        } else {
          this.stringBuffer += char;
          // 如果正在读取 content，且节点已创建，逐字符发送
          if (this.currentKey === 'content' && this.nodeCreated) {
            this.emitDelta(char);
          }
        }
        break;
        
      case ParserState.IN_NULL_VALUE:
        this.nullBuffer += char;
        if (this.nullBuffer === 'null') {
          this.handleNullValue(this.currentKey);
          this.state = ParserState.WAIT_COMMA_OR_OBJECT_END;
        } else if (!'null'.startsWith(this.nullBuffer)) {
          // 不是 null，出错
          console.warn('[StreamingContentParser] Expected null');
          this.state = ParserState.WAIT_COMMA_OR_OBJECT_END;
        }
        break;
        
      case ParserState.WAIT_COMMA_OR_OBJECT_END:
        if (char === ',') {
          this.state = ParserState.IN_OBJECT_WAIT_KEY;
        } else if (char === '}') {
          this.finalizeNode();
          this.state = ParserState.WAIT_COMMA_OR_ARRAY_END;
        }
        break;
        
      case ParserState.WAIT_COMMA_OR_ARRAY_END:
        if (char === ',') {
          this.state = ParserState.WAIT_OBJECT_START;
        } else if (char === ']') {
          this.emitDone();
          this.state = ParserState.DONE;
        }
        break;
        
      case ParserState.DONE:
        // 忽略后续字符
        break;
    }
  }

  /**
   * 处理字符串值
   */
  private handleStringValue(key: string, value: string): void {
    switch (key) {
      case 'tempId':
        this.currentTempId = value;
        this.tryEmitNodeCreate();
        break;
      case 'parentTempId':
        this.currentParentTempId = value;
        this.tryEmitNodeCreate();
        break;
      case 'content':
        // content 已经在 IN_STRING_VALUE 中逐字符发送了
        // 这里只记录完整值
        this.currentContent = value;
        break;
    }
  }

  /**
   * 处理 null 值
   */
  private handleNullValue(key: string): void {
    if (key === 'parentTempId') {
      this.currentParentTempId = null;
      this.tryEmitNodeCreate();
    }
  }

  /**
   * 尝试发送节点创建事件
   * 当 tempId 已知，且 parentTempId 已处理（有值或 null）时发送
   */
  private tryEmitNodeCreate(): void {
    // 需要 tempId 已知
    if (!this.currentTempId) return;
    // 如果已经创建过，不重复创建
    if (this.nodeCreated) return;
    
    // 当 tempId 存在时立即创建节点
    // parentTempId 可能还没解析到，默认为 null
    this.emitNodeCreate();
  }

  /**
   * 发送节点创建事件
   */
  private emitNodeCreate(): void {
    this.nodeCreated = true;
    this.nodeCount++;
    
    this.eventQueue.push({
      type: 'node:create',
      tempId: this.currentTempId,
      parentTempId: this.currentParentTempId,
    });
  }

  /**
   * 发送内容增量事件
   */
  private emitDelta(char: string): void {
    this.eventQueue.push({
      type: 'node:delta',
      tempId: this.currentTempId,
      delta: char,
    });
  }

  /**
   * 完成当前节点
   */
  private finalizeNode(): void {
    // 如果节点还没创建（比如 content 在 tempId 前面），现在创建
    if (!this.nodeCreated && this.currentTempId) {
      this.emitNodeCreate();
      // 并且把已积累的 content 一次性发出
      if (this.currentContent) {
        this.eventQueue.push({
          type: 'node:delta',
          tempId: this.currentTempId,
          delta: this.currentContent,
        });
      }
    }
  }

  /**
   * 重置当前节点状态
   */
  private resetCurrentNode(): void {
    this.currentKey = '';
    this.currentTempId = '';
    this.currentParentTempId = null;
    this.currentContent = '';
    this.nodeCreated = false;
    this.nullBuffer = '';
  }

  /**
   * 发送完成事件
   */
  private emitDone(): void {
    this.eventQueue.push({
      type: 'done',
      nodeCount: this.nodeCount,
    });
  }

  /**
   * 解析转义字符
   */
  private parseEscapedChar(char: string): string {
    switch (char) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      case '"': return '"';
      case '\\': return '\\';
      case '/': return '/';
      default: return char;
    }
  }

  /**
   * 判断是否为空白字符
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\n' || char === '\r' || char === '\t';
  }

  /**
   * 获取已解析节点数
   */
  getNodeCount(): number {
    return this.nodeCount;
  }

  /**
   * 重置解析器
   */
  reset(): void {
    this.state = ParserState.WAIT_ARRAY_START;
    this.inString = false;
    this.escapeNext = false;
    this.stringBuffer = '';
    this.currentKey = '';
    this.currentTempId = '';
    this.currentParentTempId = null;
    this.currentContent = '';
    this.nodeCreated = false;
    this.nodeCount = 0;
    this.nullBuffer = '';
    this.eventQueue = [];
  }
}
