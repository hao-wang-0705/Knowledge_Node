-- Daily notes hierarchy: remove month layer (year -> week -> day).
-- 1) Reparent week nodes from month to year.
-- 2) Delete month nodes.

UPDATE nodes AS w
SET "parentId" = m."parentId"
FROM nodes AS m
WHERE w."parentId" = m.id AND m.id LIKE 'month-%';

DELETE FROM nodes WHERE id LIKE 'month-%';
