import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import { DomainValidationError } from '../../src/domain/exceptions';
import { PahcerConfig } from '../../src/domain/models/configFile';
import { Execution } from '../../src/domain/models/execution';
import { PahcerRunOptions } from '../../src/domain/models/pahcerStatus';
import { TestCase, TestCaseId } from '../../src/domain/models/testCase';

describe('domain models', () => {
  it('validates and exposes pahcer config values', () => {
    const config = new PahcerConfig('normal', 'pahcer_config.toml', 'abc001', 0, 9, 'max');

    assert.equal(config.id, 'normal');
    assert.equal(config.path, 'pahcer_config.toml');
    assert.equal(config.problemName, 'abc001');
    assert.equal(config.startSeed, 0);
    assert.equal(config.endSeed, 9);
    assert.equal(config.objective, 'max');

    config.startSeed = 2;
    config.endSeed = 5;
    config.objective = 'min';

    assert.equal(config.startSeed, 2);
    assert.equal(config.endSeed, 5);
    assert.equal(config.objective, 'min');
  });

  it('rejects invalid pahcer config seed ranges', () => {
    assert.throws(
      () => new PahcerConfig('normal', 'pahcer_config.toml', 'abc001', -1, 9, 'max'),
      DomainValidationError,
    );
    assert.throws(
      () => new PahcerConfig('normal', 'pahcer_config.toml', 'abc001', 10, 9, 'max'),
      DomainValidationError,
    );
  });

  it('formats execution titles and allows comment updates', () => {
    const execution = new Execution(
      '20260102030405',
      dayjs('2026-01-02T03:04:05'),
      'first',
      'tag',
      'abcdef123456',
    );

    assert.equal(execution.getShortTitle(), '01/02 03:04');
    assert.equal(execution.getLongTitle(), '2026/01/02 03:04:05');
    assert.equal(execution.getTitleWithHash(), '01/02 03:04@abcdef1');

    execution.comment = 'second';
    assert.equal(execution.comment, 'second');
  });

  it('rejects empty execution ids', () => {
    assert.throws(() => new Execution('', dayjs(), '', null), /Execution id must not be empty/);
    assert.throws(() => new Execution('   ', dayjs(), '', null), /Execution id must not be empty/);
  });

  it('identifies test cases by execution and seed', () => {
    const id = new TestCaseId('execution-1', 42);
    const testCase = new TestCase(id, 100, 1.5, '', true, 'N=1', { width: 10 });

    assert.equal(id.toString(), 'execution-1:42');
    assert.equal(testCase.id, id);
    assert.equal(testCase.score, 100);
    assert.equal(testCase.executionTime, 1.5);
    assert.equal(testCase.firstInputLine, 'N=1');
    assert.deepEqual(testCase.stderrVars, { width: 10 });
  });

  it('stores pahcer run options', () => {
    const options = new PahcerRunOptions(1, 5, true);

    assert.equal(options.startSeed, 1);
    assert.equal(options.endSeed, 5);
    assert.equal(options.freezeBestScores, true);
  });
});
