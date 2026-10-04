import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requireAdmin } from './auth.ts'

describe('requireAdmin', () => {
    it('refuses a missing user', () => {
        assert.deepEqual(requireAdmin(null), {
            ok: false, status: 401, error: 'No user is currently logged in' 
        });
    });

    it('refuses a non-admin user', () => {
        const result = requireAdmin({ type: 'standard' });
        assert.deepEqual(result.ok, false);
        assert.deepEqual(result.status, 403);
    });

    it('accepts an admin', () => {
        const user = { type: 'admin' };
        const result = requireAdmin(user);
        assert.deepEqual(result.ok, true);
        assert.deepEqual(result.user, user);
    });
});