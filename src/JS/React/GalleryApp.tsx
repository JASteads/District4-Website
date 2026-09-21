import { useEffect, useMemo, useState } from "react"

type GalleryItemView = {
    id: number
    title: string
    category: string
    caption: string
    date_created: string
}

export function GalleryApp({ onReady }: { onReady?: () => void }) {
    const [items, setItems] = useState<GalleryItemView[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [category, setCategory] = useState('None')
    const [loading, setLoading] = useState(true)

    // Does a one-time fetch of all data needed from the database
    // By setting the effect condition to [], we assert that it only runs once
    useEffect(() => {
        let cancelled = false

        async function load() { 
            try {
                const [galleryRes, productRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL}/api/gallery`),
                    fetch(`${import.meta.env.VITE_API_URL}/api/products?onlyTitles=true`)
                ])

                if (!galleryRes.ok) throw new Error(`HTTP error! status: ${galleryRes.status}`)

                let titles: string[] = []
                if (productRes.ok) titles = await productRes.json()

                if (!cancelled) {
                    setItems((await galleryRes.json()).map((i: any) => ({
                        id: i.id,
                        title: i.title,
                        caption: i.caption,
                        category: i.category,
                        createdAt: new Date(Date.parse(i.created_at)).toLocaleString()
                    })) as GalleryItemView[])

                    setCategories(titles)
                }
            }
            catch (e) {
                console.error("Failed to fetch gallery items:", e)
                if (!cancelled) setItems([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [])
    
    useEffect(() => { if (!loading) onReady?.() }, [loading, onReady])

    // Only run groupByCategory() when items changes
    const sections = useMemo(() => groupByCategory(items), [items])
    const visible = [...sections.entries()].filter(
        ([name]) => category === 'None' || name === category
    )

    if (loading) return null

    return (
        <>
            <h1>Gallery</h1>
            <label htmlFor="gallery-select" className="gallery-label" id="gallery-label">
                Filter by Category:
            </label>
            <select className="gallery-select" id="gallery-select"
                value={category}
                disabled={loading}
                onChange={e => setCategory(e.target.value)}
            >
                <option value="None">None</option>
                <CategoryOptions categories={categories} />
            </select>
            
            <div className="gallery-grid" id="gallery-grid">
                {loading ? null : visible.length === 0 ? <EmptyMessage/>
                : (
                    visible.map(([name, cards]) => (
                        <CardSection key={name} categoryName={name} cards={cards} />
                    ))
                )}
            </div>
        </>
    )
}

export function groupByCategory(items: GalleryItemView[]) {
    const map = new Map<string, GalleryItemView[]>()
    for (const i of items) {
        // Find list of existing category or make a new one
        const list = map.get(i.category) || []

        // Add this item to that category, then update the map (overwriting key-value pair is trivial)
        list.push(i)
        map.set(i.category, list)
    }

    return map
}

export function GalleryCard({ item }: { item: GalleryItemView }) {
    const GALLERY_DIR = 'Resources/Images/Gallery/'

    return (
        <div className="gallery-card">
            <a href={`${GALLERY_DIR}gallery_${item.id}.png`} target="_blank">
                <img 
                    className="card-thumbnail" 
                    src={`${GALLERY_DIR}preview_gallery_${item.id}.png`}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                />
            </a>
        </div>
    )
}

export function CardSection(
    { categoryName, cards }: { categoryName: string, cards: GalleryItemView[] }
) {
    return (
        <section className="card-section">
            <h2>{categoryName}</h2>
            <div className="image-container">
                {cards.map(item => (
                    <GalleryCard key={item.id} item={item} />
                ))}
            </div>
        </section>
    )
}

export function CategoryOptions({ categories }: { categories: string[] }) {
    return (
        categories.map(name => (
            <option key={name} value={name}>{name}</option>
        ))
    )
}

export function EmptyMessage() {
    return (
        <div className="empty-gallery-message" id="empty-gallery-message">
            <h3>Nothing to see here!</h3>
            <p>Stay tuned for new art drops for this category.</p>
        </div>
    )
}