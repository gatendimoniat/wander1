import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface WikipediaInfoProps {
  poiName: string;
  wikipediaTag?: string;
  wikidataTag?: string;
  category?: string;
}

interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

function extractWikipediaTitle(wikipediaTag: string): { lang: string; title: string } | null {
  const match = wikipediaTag.match(/^(\w{2,3}):(.+)$/);
  if (match) {
    return { lang: match[1], title: match[2] };
  }
  return null;
}

function generateNameVariants(name: string): string[] {
  const variants: string[] = [];
  
  const cleanName = name
    .replace(/^(Hotel|Restaurant|Museu|Museo|Museum|Church|Església|Iglesia|Castell|Castle|Monument|Mirador|Viewpoint)\s+/gi, '')
    .replace(/^\d+\s*★?\s*/, '')
    .trim();
  
  if (cleanName !== name && cleanName.length > 2) {
    variants.push(cleanName);
  }
  
  const words = name.split(/\s+/);
  if (words.length > 2) {
    variants.push(words.slice(0, 3).join(' '));
  }
  
  return [...new Set([name, ...variants])];
}

async function fetchWikiTitle(lang: string, title: string): Promise<WikiSummary | null> {
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (!data.type || data.type !== 'disambiguation') {
        return data;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default function WikipediaInfo({ poiName, wikipediaTag, wikidataTag }: WikipediaInfoProps) {
  const [summary, setSummary] = useState<WikiSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchWikipedia = async () => {
      const languages = ['en', 'ca', 'es'];
      
      if (wikipediaTag) {
        const parsed = extractWikipediaTitle(wikipediaTag);
        if (parsed) {
          languages.unshift(parsed.lang);
        }
      }
      
      for (const lang of languages) {
        if (cancelled) break;
        
        if (wikipediaTag) {
          const parsed = extractWikipediaTitle(wikipediaTag);
          if (parsed && parsed.lang === lang) {
            const result = await fetchWikiTitle(lang, parsed.title);
            if (result && !cancelled) {
              setSummary(result);
              return;
            }
          }
        }
        
        const variants = generateNameVariants(poiName);
        for (const variant of variants) {
          if (cancelled) break;
          
          const result = await fetchWikiTitle(lang, variant);
          if (result && !cancelled) {
            setSummary(result);
            return;
          }
        }
      }
    };

    if (!wikipediaTag && !wikidataTag) {
      return;
    }
    
    fetchWikipedia();
    
    return () => {
      cancelled = true;
    };
  }, [poiName, wikipediaTag, wikidataTag]);

  if (!summary) {
    return null;
  }

  return (
    <div style={{
      marginTop: '10px',
      padding: '0',
      background: '#ffffff',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {summary.thumbnail && (
        <div style={{ width: '100%', height: '120px', overflow: 'hidden', position: 'relative' }}>
          <img
            src={summary.thumbnail.source}
            alt={summary.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => { 
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) parent.style.display = 'none';
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '20px 10px 5px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
            color: 'white',
            fontSize: '11px',
            fontWeight: 700,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}>
            {summary.title}
          </div>
        </div>
      )}
      
      <div style={{ padding: '10px' }}>
        {!summary.thumbnail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>📖</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
              {summary.title}
            </span>
          </div>
        )}
        
        <p style={{ 
          fontSize: '11px', 
          color: '#475569', 
          lineHeight: '1.5', 
          margin: '0 0 8px 0',
          fontStyle: 'italic'
        }}>
          "{summary.extract}"
        </p>
        
        {summary.content_urls?.desktop?.page && (
          <a
            href={summary.content_urls.desktop.page}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: '#3b82f6',
              textDecoration: 'none',
              fontWeight: 600,
              padding: '4px 8px',
              background: '#eff6ff',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
          >
            <ExternalLink style={{ width: '10px', height: '10px' }} />
            Llegir més a Wikipedia
          </a>
        )}
      </div>
    </div>
  );
}
