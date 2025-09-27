import { useEffect, useState } from 'react'
import { Portrait, type PortraitContent } from '../components/Portrait'
import { type SectionContent } from '../components/SectionCard'
import { colors } from '../styles/colors'
import { HomeSection } from '../components/HomeSection'

type HomeContent = {
  title: string,
  icon: string,
  name: string,
  email: string,
  portrait: PortraitContent,
  sections: SectionContent[]
}

interface LinkElement extends Element {
  rel: string;
  href: string | null;
}

const HOME_JSON_URL = "./data/home.json"

function MinimalHomePage() {
  const [homeContent, setHomeContent] = useState<HomeContent | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [highContent, setHighContent] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch(HOME_JSON_URL, { cache: "no-store" }) // edit file and refresh to see changes
      .then((r) => r.json())
      .then(setHomeContent)
      .catch((e) => setErr(e?.message || "Failed to load content"));
  }, []);

  useEffect(() => {
    document.title = homeContent?.title ?? "Haoyang Li";
    const link: LinkElement =
      document.querySelector("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = homeContent?.icon ?? null;
    document.head.appendChild(link);
  }, [homeContent]);

  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!homeContent) return <div>Loading...</div>;

  return (
    <>
      <div>
        <div>
          <Portrait highContent={highContent} portrait={homeContent.portrait} />
        </div>
        {!highContent && <h2>{homeContent.name}</h2>}
        {/* <ContentPanel open={highContent != undefined}>{highContent}</ContentPanel>*/}
        <HomeSection selectContent={(content) => {
            setHighContent(content? undefined: undefined);
        }} sections={homeContent.sections} />
        <div style={{
          marginTop: "3em"
        }}>
          <div>Welcome to Haoyang Li's history, contact me at</div>
          <div><a style={{
            color: `${colors.text}`
          }} href={`mailto:${homeContent.email}`}>{homeContent.email}</a></div>
        </div>
      </div>
    </>
  )
}

export default MinimalHomePage
