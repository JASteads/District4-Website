import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { selectTable } from './columns.ts'

describe('selectTable', () => {
    it('keeps a legal column', () => {
        const selected = selectTable('blogs', { title: 'Test' });
        assert.deepEqual(selected, { title: 'Test' });
    });

    it('refuses an unknown column', () => {
        // Must throw : `Unknown column found: ${author}. Query refused`, { status: 400 }
        assert.throws(
            () => selectTable('blogs', { title: 'Test', author: 'Lemon' }),
            (err: any) => err.status === 400 && /author/.test(err.message)
        );
    })

    it('drops undefined but keeps null', () => {
        const selected = selectTable('blogs', { title: 'Test', body: undefined });
        assert.deepEqual(selected, { title: 'Test' }); // 'body' must not included because it's undefined
        assert.deepEqual(selectTable('blogs', { title: null }), { title: null }); // 'title' is nullable
    });

    it('refuses a body that picks down to nothing', () => {
        assert.throws(
            () => selectTable('blogs', { title: undefined, body: undefined }),
            (err: any) => err.status === 400
        )
    });
});