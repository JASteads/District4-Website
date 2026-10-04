import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { imageTarget } from './imageTarget.ts'

describe('imageTarget', () => {
    it('refuses an invalid file name', () => {
        const target = imageTarget('gallery', '..');
        assert.deepEqual(target, { 
            ok: false, status: 400, error: 'Invalid file name provided' 
        });
    });

    it('refuses an invalid type value', () => {
        const target = imageTarget('../secret', 'Cat.png');
        assert.deepEqual(target, { 
            ok: false, status: 400, error: 'Invalid type provided'
        });
    });

    it('refuses non-image file extensions', () => {
        const target = imageTarget('gallery', 'Cat.mp4');
        assert.deepEqual(target, { 
            ok: false, status: 415, error: 'File must be JPG, PNG, WEBP, or GIF'
        });
    });

    it('it accepts image files', () => {
        const target = imageTarget('gallery', 'Cat.PNG');
        assert.deepEqual(target, {
            ok: true, folder: 'gallery', filename: 'Cat.PNG'
        });
    });

    it('it handles image files in nested folders', () => {
       const target = imageTarget('gallery', '../../Cat.png');
        assert.deepEqual(target, {
            ok: true, folder: 'gallery', filename: 'Cat.png'
        }); 
    });
});