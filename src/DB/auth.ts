// 'ok' property is as const to ensure it can't be modified later
export const requireAdmin = (user: { type?: string } | null) => {
    if (!user) {
        return { ok: false as const , status: 401, error: 'No user is currently logged in' };
    }
    if (user.type !== 'admin') {
        return { ok: false as const , status: 403, error: 'User is not an admin' };
    }
    return { ok: true as const, user }
}