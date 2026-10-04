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
        const user = requireAdmin({ type: 'standard' });
        assert.deepEqual(user.ok, false);
        assert.deepEqual(user.status, 403);
    });

    it('accepts an admin', () => {
        const user = requireAdmin({ type: 'admin' });
        assert.deepEqual(user.ok, true);
    });
});