import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isPlainMessage, logRef, publicMessage, unexpectedErrorLines } from './public-error';

const sha8 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8);

describe('logRef and publicMessage', () => {
  it('a reference is the first 8 hex characters of the text\'s SHA-256', () => {
    expect(logRef('abc')).toBe(`(ref ${sha8('abc')})`);
  });
  it.each([
    ['plain ASCII', 'connect ECONNREFUSED 127.0.0.1:5432', true],
    ['a double quote', 'value "x"', false],
    ['a percent sign', '5%e6', false],
    ['an address', 'see https://example.test', false],
    ['non-ASCII text', '測試', false],
    ['a line break', 'a\nb', false],
  ])('isPlainMessage: %s', (_name, text, plain) => {
    expect(isPlainMessage(text)).toBe(plain);
    expect(publicMessage(text)).toBe(plain ? text : `* ${logRef(text)}`);
  });
});

/** A node-postgres DatabaseError as it arrives (name `error`), with invented values. */
const pgError = (message: string, fields: Record<string, string>) =>
  Object.assign(new Error(message), { name: 'error', ...fields });

describe('unexpectedErrorLines: an error as a public log may print it', () => {
  it('a unique violation: its message (the quoted part is the constraint it names), and the fields that hold no row data', () => {
    const error = pgError('duplicate key value violates unique constraint "tours_pkey"', {
      code: '23505', severity: 'ERROR', schema: 'public', table: 'tours', constraint: 'tours_pkey', routine: '_bt_check_unique',
      detail: 'Key (operator_id, code)=(jetour, 測試之旅) already exists.', where: 'SQL statement 測試', hint: '測試',
      internalQuery: 'select 測試',
    });
    const lines = unexpectedErrorLines(error);
    expect(lines[0]).toBe('error (code 23505, severity ERROR, schema public, table tours, constraint tours_pkey, '
      + 'routine _bt_check_unique): duplicate key value violates unique constraint "tours_pkey"');
    expect(lines.slice(1).every(line => line.startsWith('    at '))).toBe(true);
    for (const line of lines) expect(line).not.toContain('測試');
  });

  it('a not-null violation names its column and table in quotes: printed, since the fields name them', () => {
    const error = pgError('null value in column "title" of relation "tours" violates not-null constraint', {
      code: '23502', table: 'tours', column: 'title', detail: 'Failing row contains (測試).',
    });
    expect(unexpectedErrorLines(error)[0]).toBe('error (code 23502, table tours, column title): '
      + 'null value in column "title" of relation "tours" violates not-null constraint');
  });

  it('a quoted part the fields do not name keeps the message hidden', () => {
    const message = 'invalid input syntax for type integer: "測試"';
    expect(unexpectedErrorLines(pgError(message, { code: '22P02' }))[0]).toBe(`error (code 22P02): * ${logRef(message)}`);
    const quotedValue = 'duplicate key value violates unique constraint "tours_pkey" for "Autumn trip"';
    expect(unexpectedErrorLines(pgError(quotedValue, { code: '23505', constraint: 'tours_pkey' }))[0])
      .toBe(`error (code 23505, constraint tours_pkey): * ${logRef(quotedValue)}`);
  });

  it('a field whose value is not an identifier is left out', () => {
    const error = pgError('boom', { code: '23505', table: 'tours; 測試', column: 'a b', severity: 'error!' });
    expect(unexpectedErrorLines(error)[0]).toBe('error (code 23505): boom');
  });

  it('a TLS error: Node\'s long code is printed', () => {
    const error = Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' });
    expect(unexpectedErrorLines(error)[0]).toBe('Error (code SELF_SIGNED_CERT_IN_CHAIN): self-signed certificate in certificate chain');
  });

  it('the cause is printed by the same rule, one level deep, without its stack', () => {
    const tls = Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' });
    const inner = Object.assign(new Error('deeper "測試"', { cause: new Error('deepest') }));
    const outer = new TypeError('fetch failed', { cause: tls });
    const lines = unexpectedErrorLines(outer);
    expect(lines[0]).toBe('TypeError: fetch failed');
    expect(lines[1]).toBe('  cause: Error (code UNABLE_TO_VERIFY_LEAF_SIGNATURE): unable to verify the first certificate');
    expect(lines.slice(2).every(line => line.startsWith('    at '))).toBe(true);

    const two = unexpectedErrorLines(new Error('outer', { cause: inner }));
    expect(two[1]).toBe(`  cause: Error: * ${logRef('deeper "測試"')}`);
    expect(two.join('\n')).not.toContain('deepest'); // one level only
  });

  it('a thrown value that is not an Error', () => {
    expect(unexpectedErrorLines('測試')).toEqual([`string: * ${logRef('測試')}`]);
  });
});
