import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Info, Lightbulb, AlertTriangle } from "lucide-react";
import { bffClient } from "@/lib/api/bffClient";

type ContentBlock =
  | { type: "p"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; content: string; author?: string }
  | { type: "callout"; variant: "info" | "tip" | "warning"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "cta"; title: string; description: string; href: string; label: string }
  | { type: "img"; src: string; alt: string; caption?: string };

interface HelpArticle {
  slug: string;
  categoryId: string;
  title: string;
  excerpt: string;
  readTime: string;
  body: ContentBlock[];
}

interface RelatedSummary {
  slug: string;
  title: string;
  excerpt: string;
  readTime: string;
}

const CALLOUT_STYLE: Record<string, { icon: JSX.Element; classes: string }> = {
  info: { icon: <Info className="w-4 h-4" />, classes: "bg-blue-50 border-blue-200 text-blue-900" },
  tip: { icon: <Lightbulb className="w-4 h-4" />, classes: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, classes: "bg-amber-50 border-amber-200 text-amber-900" },
};

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-gray-700 leading-relaxed mb-4">{block.content}</p>;
    case "h2":
      return <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">{block.content}</h2>;
    case "h3":
      return <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{block.content}</h3>;
    case "ul":
      return (
        <ul className="list-disc pl-5 space-y-1.5 text-gray-700 mb-4">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-5 space-y-1.5 text-gray-700 mb-4">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-emerald-300 pl-4 italic text-gray-600 my-4">
          {block.content}
          {block.author && <div className="text-sm text-gray-400 mt-1">— {block.author}</div>}
        </blockquote>
      );
    case "callout": {
      const style = CALLOUT_STYLE[block.variant] ?? CALLOUT_STYLE.info;
      return (
        <div className={`border rounded-lg p-3.5 flex gap-2.5 items-start text-sm mb-4 ${style.classes}`}>
          <div className="mt-0.5">{style.icon}</div>
          <div>{block.content}</div>
        </div>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-100 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "img":
      return (
        <figure className="mb-5">
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <img src={block.src} alt={block.alt} className="w-full h-auto block" loading="lazy" />
          </div>
          {block.caption && <figcaption className="text-xs text-gray-400 mt-1.5 italic">{block.caption}</figcaption>}
        </figure>
      );
    case "cta":
      return (
        <Link
          to={block.href}
          className="block bg-emerald-50 border border-emerald-200 rounded-xl p-4 my-5 hover:border-emerald-400 transition"
        >
          <div className="font-semibold text-emerald-900">{block.title}</div>
          <div className="text-sm text-emerald-700 mt-0.5">{block.description}</div>
          <div className="text-sm font-medium text-emerald-800 mt-2">{block.label} →</div>
        </Link>
      );
    default:
      return null;
  }
}

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [related, setRelated] = useState<RelatedSummary[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "not-found">("loading");

  useEffect(() => {
    if (!slug) return;
    setState("loading");
    bffClient
      .get<{ article: HelpArticle; related: RelatedSummary[] }>(`/api/v1/help/articles/${slug}`, undefined, "public")
      .then((res) => {
        setArticle(res.article);
        setRelated(res.related);
        setState("ok");
      })
      .catch(() => setState("not-found"));
  }, [slug]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>;
  }

  if (state === "not-found" || !article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-gray-600">No encontramos esta guía.</p>
        <Link to="/ayuda" className="text-emerald-700 font-medium hover:underline">
          Volver al Centro de Ayuda
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/ayuda" className="inline-flex items-center gap-1 text-emerald-700 text-sm mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Centro de Ayuda
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl font-extrabold text-gray-900">{article.title}</h1>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <Clock className="w-3.5 h-3.5" /> {article.readTime} de lectura
          </div>

          <div className="mt-6">
            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Guías relacionadas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/ayuda/${r.slug}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-400 transition"
                >
                  <div className="font-medium text-gray-900 text-sm">{r.title}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.excerpt}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
