/**
 * 智能解构候选嗅探器（规则预筛）
 * 仅做本地、无延迟的候选筛选，不直接决定是否展示解构按钮；通过预筛的节点再经 LLM 二次判断。
 */

/** 字数阈值：超过即视为候选（长文本） */
export const DECONSTRUCT_CHAR_THRESHOLD = 100;

/** 至少出现几次转折词即视为候选 */
export const DECONSTRUCT_MIN_TRANSITION_COUNT = 2;

/** 语义转折/多要点常用短语（非重叠匹配） */
export const DECONSTRUCT_TRANSITION_PHRASES = [
  '另外',
  '但是',
  '还需要',
  '同时',
  '此外',
  '然而',
  '不过',
  '接下来',
  '首先',
  '其次',
  '最后',
  '一方面',
  '另一方面',
  '更重要的是',
  '具体来说',
] as const;

/**
 * 统计 content 中转折词出现的总次数（非重叠：从左到右扫描，同一段文字只计一次）
 */
function countTransitionOccurrences(content: string): number {
  let count = 0;
  let pos = 0;
  const phrases = [...DECONSTRUCT_TRANSITION_PHRASES].sort((a, b) => b.length - a.length);
  while (pos < content.length) {
    let matched = false;
    for (const phrase of phrases) {
      if (content.slice(pos, pos + phrase.length) === phrase) {
        count++;
        pos += phrase.length;
        matched = true;
        break;
      }
    }
    if (!matched) pos += 1;
  }
  return count;
}

/**
 * 判断节点内容是否为「解构候选」（通过规则预筛）。
 * 满足任一即返回 true：字数 >= 阈值，或转折词出现次数 >= 最少次数。
 */
export function isDeconstructCandidate(content: string): boolean {
  const trimmed = (content ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.length >= DECONSTRUCT_CHAR_THRESHOLD) return true;
  if (countTransitionOccurrences(trimmed) >= DECONSTRUCT_MIN_TRANSITION_COUNT) return true;
  return false;
}
