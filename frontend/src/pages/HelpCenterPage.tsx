import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowLeft, Clock } from "lucide-react";
import { bffClient } from "@/lib/api/bffClient";
import { Input } from "@/components/ui/input";

interface HelpCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
}

interface HelpArticleSummary {
  slug: string;
  categoryId: string;
  title: string;
  excerpt: string;
  readTime: string;
}

export default function HelpCenterPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [catsRes, artsRes] = await Promise.all([
          bffClient.get<{ categories: HelpCategory[] }>("/api/v1/help/categories", undefined, "public"),
          bffClient.get<{ articles: HelpArticleSummary[] }>("/api/v1/help/articles", undefined, "public"),
        ]);
        setCategories(catsRes.categories);
        setArticles(artsRes.articles);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory) list = list.filter((a) => a.categoryId === activeCategory);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(needle) || a.excerpt.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [articles, activeCategory, q]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link to="/" className="inline-flex items-center gap-1 text-emerald-100 text-sm mb-4 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Volver a SportMaps
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold">Centro de Ayuda</h1>
          <p className="text-emerald-100 mt-1">Guías paso a paso para sacarle el jugo a SportMaps.</p>
          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar una guía…"
              className="pl-9 bg-white text-gray-900"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
              activeCategory === null
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                activeCategory === c.id
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
              }`}
            >
              {c.emoji} {c.title}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No encontramos guías para esa búsqueda.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((a) => (
              <Link
                key={a.slug}
                to={`/ayuda/${a.slug}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-400 hover:shadow-sm transition"
              >
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{a.excerpt}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-3">
                  <Clock className="w-3.5 h-3.5" /> {a.readTime} de lectura
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
