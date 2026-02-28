# ADR-003: 日历节点多用户 ID 前缀策略与解析约定

- 状态: Accepted
- 日期: 2026-02-28
- 决策者: 技术债治理（阶段三）

## 背景

日历节点使用确定性 ID（如 `year-2026`、`day-2026-02-27`）。在多用户或多租户场景下，后端可能为同一逻辑 ID 附加用户前缀（如 `user123_day-2026-02-27`），导致前端用原始 ID 查找节点失败。

## 决策

1. **解析与映射**：前端通过独立模块 `utils/calendarNodeId` 维护「原始 ID → 实际 ID」映射，对外提供：
   - `findCalendarNodeActualId(originalId, nodes)`：解析出实际节点 ID（无前缀或带前缀）。
   - `resolveCalendarParentId(originalParentId, nodes)`：解析父节点实际 ID（仅对日历 ID 做解析，其余原样返回）。
   - `initCalendarNodeIdMap(nodes)`：从已加载节点树构建映射（加载/恢复时调用）。
   - `setCalendarNodeIdMapping(originalId, actualId)`：由 nodeStore 在创建或发现日历时写入一条映射。

2. **ID 形态约定**：
   - 无前缀：`year-*`、`month-*`、`week-*`、`day-*` 直接作为节点 ID。
   - 带前缀：`{prefix}_{originalId}`，其中 `originalId` 为上述之一；解析时通过「以 `_originalId` 结尾」或正则 `^[a-z0-9]+_(year-|month-|week-|day-)(.+)$` 识别。

3. **职责边界**：nodeStore 仅调用上述 API 并持有/更新映射的「使用方」；所有解析与缓存逻辑集中在 `calendarNodeId.ts`，便于单测与后续策略变更。

## 影响

- 日历节点在多用户/前缀场景下可正确解析父子关系与聚焦。
- 新增单测覆盖无前缀、带前缀、多用户前缀及映射更新场景。
- nodeStore 行数减少，日历 ID 逻辑可独立演进。
