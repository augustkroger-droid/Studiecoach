"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";

const sections = [
  {
    emoji: "📅",
    title: "Planering",
    short:
      "Lär dig planera dina veckor och studiepass smartare för att minska stress.",
    content: [
      {
        heading: "Varför planering hjälper",
        text:
          "När du planerar får du bättre koll på vad som behöver göras och när det ska göras. Det gör det lättare att minska stress och faktiskt komma igång. Många elever pluggar först när stressen blir akut, men med planering kan du sprida ut arbetet istället.",
      },
      {
        heading: "Planera veckan först",
        text:
          "Börja med att lägga in prov, läxor, träningar och andra fasta aktiviteter. Därefter kan du lägga in studiepass på tider där du oftast har energi och fokus.",
      },
      {
        heading: "Gör tydliga studiepass",
        text:
          "Ett studiepass blir bättre om det har ett tydligt mål. Skriv inte bara 'plugga matte'. Skriv istället 'räkna uppgift 1–10 på derivata' eller 'repetera glosor kapitel 4'.",
      },
      {
        heading: "Planera kvällen innan",
        text:
          "Att bestämma nästa dags studiepass kvällen innan gör det mycket lättare att komma igång direkt när du ska plugga.",
      },
      {
        heading: "Tänk långsiktigt",
        text:
          "Många små pass över tid fungerar ofta bättre än att försöka lära sig allt sista dagen. Försök därför börja plugga till prov flera dagar innan.",
      },
    ],
  },
  {
    emoji: "🎯",
    title: "Motivation & fokus",
    short:
      "Så håller du motivationen uppe och förbättrar koncentrationen.",
    content: [
      {
        heading: "Motivation kommer inte alltid först",
        text:
          "Många väntar på motivation innan de börjar plugga. Men ofta fungerar det tvärtom — motivationen kommer efter att man har kommit igång.",
      },
      {
        heading: "Börja litet",
        text:
          "Om det känns jobbigt att börja kan du bestämma dig för att plugga i bara fem minuter. Ofta fortsätter man längre när man väl har startat.",
      },
      {
        heading: "Ta bort distraktioner",
        text:
          "Mobilen är en av de största anledningarna till tappat fokus. Lägg den långt bort eller använd fokusläge när du pluggar.",
      },
      {
        heading: "En sak i taget",
        text:
          "Försök inte göra flera saker samtidigt. Hjärnan arbetar bättre när du fokuserar på en uppgift åt gången.",
      },
      {
        heading: "Ta pauser",
        text:
          "Korta pauser hjälper hjärnan att orka längre. Ett vanligt upplägg är 25–50 minuter fokus följt av 5–10 minuter paus.",
      },
    ],
  },
  {
    emoji: "🧠",
    title: "Minnestekniker",
    short:
      "Tips för att komma ihåg fakta, begrepp och formler lättare.",
    content: [
      {
        heading: "Förstå först",
        text:
          "Det är mycket lättare att minnas något du förstår än något du bara försöker memorera. Försök alltid förstå sambanden först.",
      },
      {
        heading: "Koppla till något du redan kan",
        text:
          "Hjärnan minns bättre när ny information kopplas ihop med något bekant. Försök därför hitta exempel från vardagen eller tidigare kunskaper.",
      },
      {
        heading: "Använd bilder och färger",
        text:
          "Tankekartor, färger och visuella anteckningar hjälper många att minnas bättre eftersom hjärnan lättare kommer ihåg bilder än ren text.",
      },
      {
        heading: "Repetition är viktigt",
        text:
          "Att repetera lite flera gånger fungerar mycket bättre än att försöka lära sig allt på en kväll.",
      },
      {
        heading: "Testa dig själv",
        text:
          "Försök återberätta utan att titta i boken. Om du kan förklara något med egna ord har du ofta förstått det på riktigt.",
      },
    ],
  },
  {
    emoji: "📖",
    title: "Lästeknik",
    short:
      "Så läser du effektivare och förstår mer av det du läser.",
    content: [
      {
        heading: "Skumma först",
        text:
          "Innan du börjar läsa på riktigt kan du snabbt titta på rubriker, bilder och sammanfattningar. Då förstår hjärnan lättare helheten.",
      },
      {
        heading: "Läs aktivt",
        text:
          "Försök ställa frågor medan du läser. Vad är viktigast här? Hur hänger detta ihop med det jag redan kan?",
      },
      {
        heading: "Fastna inte på varje ord",
        text:
          "Du behöver inte förstå exakt allt direkt. Försök få en helhetsbild först och gå tillbaka senare om något är oklart.",
      },
      {
        heading: "Anteckna nyckelord",
        text:
          "Skriv inte av hela texter. Fokusera istället på viktiga ord, begrepp och samband.",
      },
      {
        heading: "Förklara för någon annan",
        text:
          "Om du kan lära ut något till en kompis betyder det ofta att du själv förstått det ordentligt.",
      },
    ],
  },
  {
    emoji: "✍️",
    title: "Anteckningar",
    short:
      "Hur du gör anteckningar som faktiskt hjälper dig senare.",
    content: [
      {
        heading: "Skriv kort och tydligt",
        text:
          "Anteckningar ska hjälpa dig förstå och repetera senare. Skriv därför kortfattat och tydligt istället för att försöka skriva exakt allt.",
      },
      {
        heading: "Använd egna ord",
        text:
          "När du omformulerar information med egna ord måste hjärnan tänka aktivt, vilket gör att du lär dig bättre.",
      },
      {
        heading: "Markera det viktigaste",
        text:
          "Använd färger, rubriker eller symboler för att snabbt kunna hitta viktiga delar senare.",
      },
      {
        heading: "Testa tankekartor",
        text:
          "Tankekartor fungerar bra när du vill se samband mellan olika delar av ett ämne.",
      },
      {
        heading: "Repetera anteckningarna snabbt",
        text:
          "Om du tittar igenom dina anteckningar samma dag kommer du ihåg mycket mer.",
      },
    ],
  },
  {
    emoji: "😴",
    title: "Sömn, stress & återhämtning",
    short:
      "Din hjärna fungerar bättre när du tar hand om dig själv.",
    content: [
      {
        heading: "Sömn påverkar allt",
        text:
          "Sömn är viktigt för både minne, koncentration och motivation. För lite sömn gör det svårare att lära sig nya saker.",
      },
      {
        heading: "Stress är normalt",
        text:
          "Lite stress inför prov är normalt och kan till och med hjälpa dig fokusera. Men för mycket stress gör det svårare att tänka klart.",
      },
      {
        heading: "Ta hand om kroppen",
        text:
          "Mat, vatten och rörelse påverkar hjärnan mer än många tror. En kort promenad kan ibland hjälpa mer än att fortsätta plugga trött.",
      },
      {
        heading: "Jämför dig inte för mycket",
        text:
          "Alla lär sig olika snabbt och på olika sätt. Försök fokusera på din egen utveckling istället för att jämföra dig med andra hela tiden.",
      },
    ],
  },
];

function TipCard({
  emoji,
  title,
  short,
  content,
}: {
  emoji: string;
  title: string;
  short: string;
  content: {
    heading: string;
    text: string;
  }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.72)",
        border: "1px solid rgba(148, 163, 184, 0.22)",
        borderRadius: "22px",
        padding: "22px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "white",
          textAlign: "left",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>{emoji}</span>
                {title}
              </h2>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "#94a3b8",
                  lineHeight: 1.6,
                  fontSize: "15px",
                }}
              >
                {short}
              </p>
            </div>

          <div
            style={{
              fontSize: "24px",
              color: "#60a5fa",
              fontWeight: "bold",
            }}
          >
            {open ? "−" : "+"}
          </div>
        </div>
      </button>

      {open && (
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {content.map((item) => (
            <div
              key={item.heading}
              style={{
                padding: "18px",
                borderRadius: "16px",
                background: "rgba(2, 6, 23, 0.65)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: "10px",
                  color: "#dbeafe",
                  fontSize: "18px",
                }}
              >
                {item.heading}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#cbd5e1",
                  lineHeight: 1.8,
                  fontSize: "15px",
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TipsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        paddingBottom: "120px",
        fontFamily: "Arial, sans-serif",
        background:
          "linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)",
        color: "white",
      }}
    >
      <NavBar />

      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ marginBottom: "34px" }}>
          <h1
            style={{
              fontSize: "48px",
              marginBottom: "12px",
            }}
          >
            💡 Plugga smart
          </h1>

          <p
            style={{
              color: "#94a3b8",
              fontSize: "18px",
              lineHeight: 1.7,
              maxWidth: "850px",
            }}
          >
            Här hittar du tips för att planera bättre, fokusera mer och
            lära dig effektivare. Tryck på en kategori för att läsa mer.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "22px",
          }}
        >
          {sections.map((section) => (
            <TipCard key={section.title} {...section} />
          ))}
        </div>

        <div
          style={{
            marginTop: "40px",
            padding: "24px",
            borderRadius: "22px",
            background: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(96, 165, 250, 0.22)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>🚀 Viktigaste tipset</h2>

          <p
            style={{
              color: "#cbd5e1",
              lineHeight: 1.8,
              marginBottom: 0,
            }}
          >
            Det viktigaste är inte att plugga perfekt — utan att plugga
            regelbundet. Små studiepass över tid slår nästan alltid
            sista-minuten-plugg.
          </p>
        </div>

        <p
          style={{
            marginTop: "24px",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          Inspirerad av material om studieteknik och planering från
          Studieverkstad vid Umeå universitet. fileciteturn0file0L1-L15
        </p>
      </div>
    </main>
  );
}