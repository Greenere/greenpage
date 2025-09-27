import { useEffect, useState } from 'react'
import './App.css'
import { Portrait, type PortraitContent } from './components/Portrait'
import { SectionCard, type SectionContent } from './components/SectionCard'

type HomeContent = {
  title: string,
  icon: string,
  name: string,
  email: string,
  portrait: PortraitContent,
  sections: SectionContent[]
}

const HOME_JSON_URL = "./data/home.json"

function App() {
  const [homeContent, setHomeContent] = useState<HomeContent | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(HOME_JSON_URL, { cache: "no-store" }) // edit file and refresh to see changes
      .then((r) => r.json())
      .then(setHomeContent)
      .catch((e) => setErr(e?.message || "Failed to load content"));
  }, []);

  useEffect(() => {
    document.title = homeContent?.title ?? "Haoyang Li";
    const link =
      document.querySelector("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = homeContent?.icon ?? null;
    document.head.appendChild(link);
  }, [homeContent]);

  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!homeContent) return <div>Loading...</div>;

  return (
    <div>
      <div>
        <Portrait portrait={homeContent.portrait} />
      </div>
      <h2>{homeContent.name}</h2>
      <div className="card">
        {homeContent.sections && homeContent.sections.map((section, idx) => {
          return (
            <SectionCard key={idx} sectionContent={section} />
          )
        })
        }
      </div>
    </div>
  )
}

export default App
