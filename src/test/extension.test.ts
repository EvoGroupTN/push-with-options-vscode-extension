import * as assert from 'assert';
import { parsePushOptions, buildPushArgs } from '../extension';

suite('Extension Test Suite', () => {
    test('parsePushOptions - simple option --no-verify', () => {
        const res = parsePushOptions(['--no-verify']);
        assert.deepStrictEqual(res, { pushOptions: [], noVerify: true, clientFlags: ['--no-verify'] });
    });

    test('parsePushOptions - force options', () => {
        const res = parsePushOptions(['--force-with-lease']);
        assert.deepStrictEqual(res, { pushOptions: [], force: true, clientFlags: ['--force-with-lease'] });
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
        assert.deepStrictEqual(res, {
            pushOptions: ['ci.skip', 'mr.create', 'extra.option'],
            noVerify: true,
            clientFlags: ['--no-verify']
        });
    });

    test('parsePushOptions - multiple inputs', () => {
        const res = parsePushOptions(['--no-verify', '-o ci.skip']);
        assert.deepStrictEqual(res, {
            pushOptions: ['ci.skip'],
            noVerify: true,
            clientFlags: ['--no-verify']
        });
    });

    test('buildPushArgs - constructs correct CLI argv', () => {
        const options = parsePushOptions(['--no-verify -o ci.skip --force-with-lease']);
        const args = buildPushArgs(options, 'origin', 'main');
        assert.deepStrictEqual(args, [
            'push',
            'origin',
            'main',
            '--no-verify',
            '--force-with-lease',
            '-o',
            'ci.skip'
        ]);
    });
});
