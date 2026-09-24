// @ts-check
/**
 * ESLint правило (CLAUDE.md И2 / §14): Task.status и TaskGroup.status се менуваат
 * САМО преку state machine (`transitionTask` / `transitionTaskGroup`), никогаш со
 * директен Prisma запис. Правилото ја фаќа формата
 *   `<x>.task.update({ ..., data: { status } })`
 *   `<x>.taskGroup.updateMany({ ..., data: { status } })`
 *   `<x>.task.upsert({ ..., update: { status } })`
 * за моделите `task` и `taskGroup`. Другите животни циклуси (`publishingSlot.status`,
 * `uploadSession.status`, `scenario.status`, …) НЕ се workflow-статуси и се дозволени.
 *
 * Легитимниот запис (самиот state machine, `apps/api/src/services/workflow/**`) се
 * изземa преку `ignores` во flat config — не преку исклучок во правилото.
 */

const MUTATORS = new Set(['update', 'updateMany', 'upsert']);
const MODELS = new Set(['task', 'taskGroup']);

/** Име на не-computed клуч (`foo` или `'foo'`) во property, инаку null. */
function keyName(prop) {
  if (prop.type !== 'Property' || prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

/** Врати ја вредноста (node) на дадениот клуч во ObjectExpression, или null. */
function getProp(objExpr, name) {
  if (!objExpr || objExpr.type !== 'ObjectExpression') return null;
  for (const p of objExpr.properties) {
    if (keyName(p) === name) return p.value;
  }
  return null;
}

/** Дали ObjectExpression носи не-computed клуч `status`. */
function hasStatusKey(objExpr) {
  if (!objExpr || objExpr.type !== 'ObjectExpression') return false;
  return objExpr.properties.some((p) => keyName(p) === 'status');
}

/**
 * За update/updateMany статусот е во `data: { status }`; за upsert е во мутациската
 * гранка `update: { status }` (create = иницијално креирање, надвор од инваријантата).
 */
function writesStatus(argObj, method) {
  if (method === 'upsert') return hasStatusKey(getProp(argObj, 'update'));
  return hasStatusKey(getProp(argObj, 'data'));
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Забрани директен Prisma запис на Task/TaskGroup статус — се менува само преку state machine (CLAUDE.md И2).',
    },
    messages: {
      forbidden:
        'Забрането: `{{model}}.{{method}}` со `status`. Task/TaskGroup статусот се менува само преку transitionTask/transitionTaskGroup (state machine, CLAUDE.md И2). Ако ти треба нов преод — додади ред во packages/core/src/workflow/transitions.ts.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const method = callee.property.type === 'Identifier' ? callee.property.name : null;
        if (!method || !MUTATORS.has(method)) return;

        // callee.object мора да е `<нешто>.task` / `<нешто>.taskGroup`.
        const obj = callee.object;
        if (obj.type !== 'MemberExpression' || obj.computed) return;
        const model = obj.property.type === 'Identifier' ? obj.property.name : null;
        if (!model || !MODELS.has(model)) return;

        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        if (writesStatus(arg, method)) {
          context.report({ node, messageId: 'forbidden', data: { model, method } });
        }
      },
    };
  },
};
