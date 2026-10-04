import path from "path";

const LEGAL_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export const imageTarget = (folder: string, filename: string) => {
    const name = path.basename(filename ?? '');
    const ext = path.extname(name).toLowerCase();

    if (name === '' || name === '.' || name === '..') {
        return { ok: false as const, status: 400, error: 'Invalid file name provided' };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(folder)) {
        return { ok: false as const, status: 400, error: 'Invalid type provided' };
    }
    if (!LEGAL_TYPES.has(ext)) {
        return { ok: false as const, status: 415, error: 'File must by JPG, PNG, WEBP, or GIF' };
    }

    return { ok: true as const, folder, filename: name };
}