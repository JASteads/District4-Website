import 'dotenv/config';

import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import argon2 from 'argon2';
import { Pool } from 'pg';
import type { CookieOptions, Response as ExpressResponse } from 'express';
import { fileURLToPath } from 'url';

// Source code imports
import { selectTable, type TableName } from './columns.ts';
import { requireAdmin } from './auth.ts';
import { imageTarget } from './imageTarget.ts';

// Reference values
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempFolder = 'Resources/tmp';
const devHost = process.env.DEV_HOST || '';
const prodHost = process.env.PROD_HOST || '';
const debugMode = process.env.DEV_MODE === 'true';
const SRC_DIR = path.resolve(__dirname, '..');
const SESSION_COOKIE = 'session';


/* ================================= SETUP ================================= */

const pool = new Pool({ connectionString: process.env.DB_CONNECTION_STRING });
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: debugMode ? devHost : prodHost,
    credentials: true
}));

// Use dist on production build
if (!debugMode) {
    app.use(express.static(path.resolve(__dirname, '../../dist')));
}

const onDatabaseConnect = async () => {
    try {
        await initialiazeDatabase();
        console.log('Current root:', SRC_DIR);
        if (debugMode) { console.log('Debug Mode:', debugMode); }
        console.log('✅ Database connected and initialized');
    }
    catch (e: any) {
        console.error('❌', e);
    }
}

const startServer = async () => await onDatabaseConnect();


/* ================================= API ROUTES ================================= */

// =========== USER MANAGEMENT ===========

app.get('/api/me', async (req, res) => {
    try {
        const user = await requireUser(req, res);

        if (!user) {
            res.status(401).json({ error: 'No user is currently logged in' });
            return;
        }

        res.json({ username: user.username, alias: user.alias, email: user.email, type: user.type });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user', async (req, res) => {
    try {
        const { username, password, alias, email } = req.body;
        const user = await getUser(username);

        if (user && (user.username === username || user.email === email)) {
            safeRedirect(res, 'login.html?mode=register&error=taken');
            return;
        }

        const hash = await argon2.hash(password);
        const result = await pool.query(`
            INSERT INTO users (username, password, alias, type, email)
            VALUES ($1, $2, $3, 'standard', $4)
            RETURNING *
        `, [username, hash, alias, email]);
        const newUser = result.rows[0];

        const session = await generateSession(newUser.username, true);
        res.cookie(SESSION_COOKIE, session.rows[0].id, getCookieProperties(daysToMS(true)));
        safeRedirect(res, 'index.html');
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password, remember } = req.body;
        const user = await getUser(username);

        if (!(user && await argon2.verify(user.password, password))) { 
            safeRedirect(res, 'login.html?error=invalid');
            return;
        }

        const session = await generateSession(user.username, remember);
        res.cookie(SESSION_COOKIE, session.rows[0].id, getCookieProperties(daysToMS(remember)));
        safeRedirect(res, 'index.html');
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/login', async (req, res) => {
    try {
        await removeItem('sessions', getSessionID(req));
        res.clearCookie(SESSION_COOKIE, getCookieProperties());
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// =========== INJECTIONS ===========

app.post('/api/admin_panel', async (req, res) => {
    const user = await requireUser(req, res);
    safeRedirect(res, requireAdmin(user).ok ? 'admin_panel.html' : 'load_fail.html');
});

// TODO : Make this an addon for a general get_nav route that uses user info
app.get('/api/get_admin_nav', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).send('');
            return;
        }
        const panelButtonStr = '<a id="admin-panel-button">Admin Panel</a>';
        const portalButtonStr = '<a id="admin-portal-button">Upload Portal</a>';

        return res.send(`${panelButtonStr} ${portalButtonStr}`);
    } catch (e: any) {
        res.status(500).send('');
    }
});

// =========== IMAGE UPLOADING ===========

app.post('/api/image', async (req, res) => {
    const user = requireAdmin(await requireUser(req, res));
    if (!user.ok) {
        res.status(user.status).json({ error: user.error });
        return;
    }

    // VALIDATE UPLOAD ARGUMENTS

    const { type, isThumbnail } = req.query;

    const folder = typeof type === 'string' ? type : '';
    const header = req.headers['x-file-name'];
    const target = imageTarget(folder, typeof header === 'string' ? header : '');
    if (!target.ok) {
        res.status(target.status).json({ error: target.error });
        return;
    }

    const dest = path.join(SRC_DIR, 'Resources/Images/', target.folder);
    const finalPath = path.join(dest, target.filename);

    if (debugMode) {
        console.log('File Name:', target.filename);
        console.log('Destination:', dest);
        console.log('Final path:', finalPath);
    }

    // PREPARE FOR UPLOAD

    if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }) }

    const { tempPath, tempName, stream } = prepareTemp();
    req.pipe(stream);
    stream.on('finish', async () => {
        try {
            // Move the temp file into its permanent location
            await fs.promises.rename(path.join(tempPath, tempName), finalPath);
            
            const thumb = isThumbnail === 'true';
            const response = {
                message: `${( thumb ? 'Thumbnail' : 'Image')} downloaded to gallery`,
                savedAs: thumb ? `preview_${target.filename}` : target.filename
            };

            res.status(200).json(response);
        } catch (e: any) {
            console.error('Image download failed');
            res.status(500).json(e);
        }
    });
    stream.on('error', () => {
        console.error('Something went wrong with the download..');
        res.status(500).json('Image download failed');
    });
});

// =========== PRODUCTS ===========

app.get('/api/product/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT id, title, description, hook, release_date, txn_link
            FROM products
            WHERE id = $1
        `, [id]);

        const product = result.rows[0];

        if (!product) {
            return res.status(404).json({ error: 'Product does not exist!' });
        }

        res.json(product);
    } catch (e: any) {
        res.status(500).json({ error: `Product fetch failed: ${e.message}` });
    }
});

app.post('/api/product', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { title, hook, description }: Record<string, unknown> = req.body.columns;
        const result = await basicPost(
            'products', { title, hook, description, release_date: new Date().toISOString() }
        );
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.put('/api/product', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id, columns }: { id: number; columns: Record<string, unknown> } = req.body;
        const result = await basicPut('products', id, columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.delete('/api/product/:id', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id } = req.params;
        res.json(await removeItem('products', id));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Gets all existing products. Use category query to get only categories
app.get('/api/products', async (req, res) => {
    try {
        const { onlyTitles } = req.query;
        const selectArgs = (onlyTitles === 'true') ? 'title' : '*';
        const result = await pool.query(`SELECT ${selectArgs} FROM products`);

        // Return an array of titles if we only want titles
        if (selectArgs === 'title') {
            return res.json(result.rows.map(row => row.title));
        }
        
        res.json(result.rows);
    }
    catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// =========== NEWS ARTICLES =========== 

// Get target blog entry
app.get('/api/blog/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT id, title, author, body, created_at, game_id
            FROM blogs
            WHERE id = $1
            LIMIT 1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Add blog entry
app.post('/api/blog', async (req, res) => {
    try {
        const session = await requireUser(req, res);
        const user = requireAdmin(session);
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const result = await basicPost('blogs', req.body.columns, { 
            author: session?.alias || 'Unknown' 
        });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.put('/api/blog', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id, columns }: { id: number; columns: Record<string, unknown> } = req.body;
        const result = await basicPut('blogs', id, columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.delete('/api/blog/:id', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id } = req.params;
        res.json(await removeItem('blogs', id));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get blog entries - defaults to ALL if no limit or id is given
app.get('/api/blogs', async (req, res) => {
    try {
        const { limit, game_id } = req.query;
        const params = [];

        let queryText = 'SELECT id, title, author, body, created_at, game_id, hook FROM blogs';

        if (game_id) {
            params.push(`${game_id}`);
            queryText += ` WHERE game_id = $${params.length}`;
        }
        queryText += ' ORDER BY id DESC';

        if (limit) {
            const upperRecentLimit = 15;

            const safeLimit = Math.min(Math.max(parseInt(limit as string) || 10), upperRecentLimit);
            params.push(safeLimit);
            queryText += ` LIMIT $${params.length}`;
        }
        const result = await pool.query(queryText, params);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});

// =========== PORTFOLIO ENTRIES ===========

app.get('/api/portfolio', async (_, res) => {
    try {
        const result = await pool.query(`
            SELECT id, title, lang_api, date, description, project_link
            FROM portfolio_items
            ORDER BY id DESC
        `);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/portfolio', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const result = await basicPost('portfolio_items', req.body.columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.put('/api/portfolio', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }
        const { id, columns }: { id: number; columns: Record<string, unknown> } = req.body;
        const result = await basicPut('portfolio_items', id, columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.delete('/api/portfolio/:id', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id } = req.params;
        res.json(await removeItem('portfolio_items', id));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// =========== GALLERY ===========

// Lazy method for now. Add filter when gallery grows too large
app.get('/api/gallery', async (req, res) => {
    try {
        const { id, category } = req.query;
        const requestParams = [];

        let query = `
            SELECT g.id, g.title, g.game_id, p.title AS category, g.caption, g.created_at
            FROM gallery_items g
            LEFT JOIN products p
              ON g.game_id = p.id
        `;

        if (id) {
            requestParams.push(id);
            query += ` WHERE g.id = $${requestParams.length}`;
        }

        if (category) {
            requestParams.push(category);
            query += ` ${(requestParams.length > 0 ? 'AND' : 'WHERE')} p.title = $${requestParams.length}`;
        }

        // Order items last
        query += ' ORDER BY g.game_id, g.created_at DESC';

        const result = await pool.query(query, requestParams);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/gallery', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const result = await basicPost('gallery_items', req.body.columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.put('/api/gallery', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id, columns }: { id: number; columns: Record<string, unknown> } = req.body;
        const result = await basicPut('gallery_items', id, columns);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(e.status ?? 500).json({ error: e.message });
    }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const user = requireAdmin(await requireUser(req, res));
        if (!user.ok) {
            res.status(user.status).json({ error: user.error });
            return;
        }

        const { id } = req.params;
        res.json(await removeItem('gallery_items', id));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.use((_, res) => safeRedirect(res, 'load_fail.html'));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🐭 Server running at http://localhost:${PORT}`));


/* ================================= HELPER FUNCTIONS ================================= */

const safeRedirect = (res: ExpressResponse, file: string) =>
    res.redirect(debugMode ? `${devHost}/${file}` : `/${file}`);

const prepareTemp = () => {
    const tempName = `temp_${crypto.randomBytes(10).toString('hex')}.dat`;
    const tempPath = path.join(SRC_DIR, tempFolder);

    if (debugMode) {
        console.log('Temp Name:', tempName)
        console.log('Temporary Path:', tempPath);
    }
    
    if (!fs.existsSync(tempPath)) {
        console.log('Temp folder does not exist. Creating new one...');
        fs.mkdirSync(tempPath, { recursive: true });
    }

    return { tempPath: tempPath, tempName: tempName, 
        stream: fs.createWriteStream(path.join(tempPath, tempName)) 
    };
}

// =========== SQL QUERIES ===========

const basicPost = async (
    tableName: TableName, 
    columns: Record<string, unknown>, 
    serverColumns: Record<string, unknown> = {}
) => {
    const selected = { ...selectTable(tableName, columns), ...serverColumns };
    const keys = Object.keys(selected);
    const values = Object.values(selected);

    if (debugMode) {
        console.log(`
            INSERT INTO ${tableName} (${keys.join(', ')})
            VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
            RETURNING *
        `, values);
    }
    
    return await pool.query(`
        INSERT INTO ${tableName} (${keys.join(', ')})
        VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING *
    `, values);
}

const basicPut = async (tableName: TableName, id: number, columns: Record<string, unknown>) => {
    const selected = selectTable(tableName, columns);
    const setClauses: string[] = [];
    const queryParams: any[] = [];

    for (const [column, value] of Object.entries(selected)) {
        setClauses.push(`${column} = $${queryParams.length + 1}`);
        queryParams.push(value);
    }
    queryParams.push(id);

    if (debugMode) {
        console.log(`
            UPDATE ${tableName} SET ${setClauses.join(', ')}
            WHERE id = $${queryParams.length} RETURNING *
        `);
        console.log(queryParams);
    }

    return await pool.query(`
        UPDATE ${tableName} SET ${setClauses.join(', ')}
        WHERE id = $${queryParams.length} RETURNING *`, queryParams
    );
}

const removeItem = async (tableName: string, targetID: string) => {
    await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [targetID]);
    
    return { message: `${tableName} -- Record #${targetID} has been deleted.` };
}

// =========== ACCOUNT MANAGEMENT ===========

const parseCookie = (header: string | undefined) => {
    const result: Record<string, string> = {};

    if (!header) { return result; }

    // Read through each piece of the cookie
    for (const piece of header.split(';')) {
        const [key, ...content] = piece.trim().split('=');

        if (!key) { continue; }

        result[decodeURIComponent(key)] = decodeURIComponent(content.join('='));
    }

    return result;
}

const getUser = async (username: string): Promise<Record<string, string> | null> => {
    const user = await pool.query(`
        SELECT username, password, alias, email
        FROM users
        WHERE username = $1`, [username]
    );

    return user && user.rows.length > 0 ? user.rows[0] : null;
}

const REMEMBER_DURATION = 21; // 21 Days
const daysToMS = (remember: boolean) => 1000 * 60 * 60 * 24 * (remember ? REMEMBER_DURATION : 1);

const getSessionID = (req: express.Request) => parseCookie(req.headers.cookie)[SESSION_COOKIE];

const getCookieProperties = (maxAge?: number) => ({
    httpOnly: true,
    secure: !debugMode,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAge || undefined
}) as CookieOptions;

const generateSession = async (username: string, remember: boolean) => {
    const query = `INSERT INTO sessions (id, username, created_at, expires_at, remember)
        VALUES($1, $2, $3, $4, $5) 
        RETURNING *`;
    const id = crypto.randomBytes(16).toString('hex'); // Random session number to obfuscate
    const now = new Date();
    const expiry = new Date(Date.now() + daysToMS(remember));
    
    return await pool.query(query, [id, username, now, expiry, remember]);
}

const renewSession = async (id: string, remember: boolean) => {
    await pool.query(`
        UPDATE sessions 
        SET expires_at = $2 
        WHERE id = $1`, [id, new Date(Date.now() + daysToMS(remember))]
    );
}

const requireUser = async (req: express.Request, res: ExpressResponse) => {
    const id = getSessionID(req);
    
    if (!id) { return null; }

    const users = await pool.query(`
        SELECT u.username, u.alias, u.type, u.email, s.remember
        FROM sessions s
        INNER JOIN users u
           ON u.username = s.username
        WHERE s.id = $1
          AND s.expires_at > NOW()
    `, [id]);
    
    // Remove the cookie from the request if no valid user
    if (!(users && users.rows.length > 0)) {
        res.clearCookie(SESSION_COOKIE, getCookieProperties());
        return null;
    }
    const user = users.rows[0]; // Get the target user from DB

    await renewSession(id, user.remember); // Authorized -- refresh session
    res.cookie(SESSION_COOKIE, id, getCookieProperties(daysToMS(user.remember)));

    return user;
}

/**
 * Ensures all DB tables exist and creates them if they don't.
 */
const initialiazeDatabase = async () => {
    // Table creation queries to run
    const queries = [
        { name: 'Products', sql: 
            `CREATE TABLE IF NOT EXISTS products(
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title TEXT UNIQUE,
                description TEXT,
                hook TEXT,
                release_date TIMESTAMP,
                txn_link TEXT,
                is_locked BOOLEAN
            );`
        },
        { name: 'Portfolio Items', sql: 
            `CREATE TABLE IF NOT EXISTS portfolio_items(
                id SERIAL PRIMARY KEY,
                title TEXT,
                type TEXT,
                lang_api TEXT,
                date TEXT,
                description TEXT,
                project_link TEXT
            );`
        },
        { name: 'Blogs', sql: 
            `CREATE TABLE IF NOT EXISTS blogs(
                id SERIAL PRIMARY KEY,
                title TEXT DEFAULT "Untitled",
                author TEXT,
                subject TEXT, -- Short description used in blips
                body TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                game_id INT,
                FOREIGN KEY (game_id) REFERENCES products(id) ON DELETE SET DEFAULT
            );`
        },
        { name: 'Gallery Items', sql: 
            `CREATE TABLE IF NOT EXISTS gallery_items(
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title TEXT,
                game_id INT,
                caption TEXT,
                created_at TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES products(id) ON DELETE SET DEFAULT
            );`
        },
        { name: 'Users', sql: 
            `CREATE TABLE IF NOT EXISTS users(
                username TEXT PRIMARY KEY,
                password TEXT,
                alias TEXT,
                type TEXT,
                email TEXT
            );`
        },
        { name: 'Sessions', sql:
            `CREATE TABLE IF NOT EXISTS sessions(
                id TEXT PRIMARY KEY,
                username TEXT,
                created_at TIMESTAMPTZ,
                expires_at TIMESTAMPTZ,
                remember boolean,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE SET DEFAULT
            );` // TIMESTAMPTZ considers timezone
        }
    ];

    // Run all queries in order
    for (const q of queries) { await pool.query(q.sql); };
}

startServer();