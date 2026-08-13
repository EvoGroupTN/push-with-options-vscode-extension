import * as assert from 'assert';
import { parsePushOptions } from '../extension';

suite('Extension Test Suite', () => {
    test('parsePushOptions - simple option', () => {
        const res = parsePushOptions(['--no-verify']);
        assert.deepStrictEqual(res, { pushOptions: ['--no-verify'] });
    });

    test('parsePushOptions - force options', () => {
        const res = parsePushOptions(['--force-with-lease']);
        assert.deepStrictEqual(res, { pushOptions: [], force: true });
    });

    test('parsePushOptions - push option with =', () => {
        const res = parsePushOptions(['--push-option=ci.skip']);
        assert.deepStrictEqual(res, { pushOptions: ['ci.skip'] });
    });

    test('parsePushOptions - -o shorthand space separated', () => {
        const res = parsePushOptions(['-o ci.skip']);
        assert.deepStrictEqual(res, { pushOptions: ['ci.skip'] });
    });

    test('parsePushOptions - -o shorthand with =', () => {
        const res = parsePushOptions(['-o=ci.skip']);
        assert.deepStrictEqual(res, { pushOptions: ['ci.skip'] });
    });

    test('parsePushOptions - multiple space-separated options', () => {
        const res = parsePushOptions(['--no-verify -o ci.skip --push-option=mr.create extra.option']);
        assert.deepStrictEqual(res, { pushOptions: ['--no-verify', 'ci.skip', 'mr.create', 'extra.option'] });
    });

    test('parsePushOptions - multiple inputs', () => {
        const res = parsePushOptions(['--no-verify', '-o ci.skip']);
        assert.deepStrictEqual(res, { pushOptions: ['--no-verify', 'ci.skip'] });
    });
});
