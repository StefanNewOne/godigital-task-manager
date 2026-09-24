import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-task-status-write.js';

// Правилото работи на обичен JS AST (CallExpression/MemberExpression/ObjectExpression),
// па примероците се валиден JS — не треба TS parser.
const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-task-status-write', () => {
  it('спроведува ја инваријантата И2', () => {
    ruleTester.run('no-task-status-write', rule, {
      valid: [
        // без status во data
        "prisma.task.update({ where: { id }, data: { title: 'x' } });",
        'tx.task.update({ where: { id }, data: { slotId, title } });',
        // друг модел (посебен животен циклус) — дозволено
        "tx.publishingSlot.update({ where: { id }, data: { status: 'free' } });",
        "prisma.uploadSession.update({ where: { id }, data: { status: 'completed' } });",
        "tx.scenario.update({ where: { id }, data: { status: 'odobreno' } });",
        // create (иницијално креирање) не е преод — надвор од инваријантата
        "prisma.task.create({ data: { status: 'mrtov' } });",
        "prisma.taskGroup.create({ data: { status: 'podgotovka' } });",
        // читање/филтер — не е запис
        "prisma.task.findMany({ where: { status: 'montaza' } });",
        'where.status = q.status;',
        // upsert без status во update гранката
        'prisma.task.upsert({ where: { id }, create: { title }, update: { title } });',
      ],
      invalid: [
        {
          code: "prisma.task.update({ where: { id }, data: { status: 'montaza' } });",
          errors: [{ messageId: 'forbidden' }],
        },
        {
          code: "tx.taskGroup.update({ where: { id }, data: { status: 'zatvoren' } });",
          errors: [{ messageId: 'forbidden' }],
        },
        {
          code: "tx.task.updateMany({ where: {}, data: { status: 'otkazano' } });",
          errors: [{ messageId: 'forbidden' }],
        },
        {
          // string-literal клуч
          code: "prisma.task.update({ where: { id }, data: { 'status': 'pauza' } });",
          errors: [{ messageId: 'forbidden' }],
        },
        {
          // upsert со status во мутациската (update) гранка
          code: "prisma.task.upsert({ where: { id }, create: { title }, update: { status: 'montaza' } });",
          errors: [{ messageId: 'forbidden' }],
        },
        {
          // ctx.tx.taskGroup.update(...) — подлабок ланец
          code: "ctx.tx.taskGroup.update({ where: { id }, data: { status: 'scenarija' } });",
          errors: [{ messageId: 'forbidden' }],
        },
      ],
    });
  });
});
