// Used to determine whether a query to any of these tables is legal. 
// All values must exist in a query of these tables
export const LEGAL_ENTRY = {
    blogs: ['title', 'body'],
    products: ['title', 'hook', 'description', 'release_date'],
    gallery_items: ['title', 'caption', 'created_at', 'game_id'],
    portfolio_items: ['title', 'lang_api', 'date', 'description', 'project_link']
} as const;

export type TableName = keyof typeof LEGAL_ENTRY;

export const selectTable = (table: TableName, columns: Record<string, unknown>) => {
    const legalRows = new Set<string>(LEGAL_ENTRY[table]); // Parses the table into easily accessible values
    const selected: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(columns ?? {})) {
        if (!legalRows.has(key)) {
            throw Object.assign(
                new Error(`Unknown column found: ${key}. Query refused`), { status: 400 }
            );
        }
        if (value !== undefined) selected[key] = value;
    }

    // In the event that the no legal rows are found from columns
    if (Object.keys(selected).length === 0) {
        throw Object.assign(new Error('No writable columns'), { status: 400 });
    }

    return selected;
}