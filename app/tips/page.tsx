"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

export const TIPS_VERSION = "2026-05-17-1";

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
        short: "Så håller du motivationen uppe och förbättrar koncentrationen.",
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
        short: "Tips för att komma ihåg fakta, begrepp och formler lättare.",
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
        short: "Så läser du effektivare och förstår mer av det du läser.",
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
        short: "Hur du gör anteckningar som faktiskt hjälper dig senare.",
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
        short: "Din hjärna fungerar bättre när du tar hand om dig själv.",
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

type Section = (typeof sections)[number];

function TipCard({
    theme,
    section,
    active,
    onOpen,
}: {
    theme: typeof THEMES[ThemeKey];
    section: Section;
    active: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            onClick={onOpen}
            style={{
                background: active ? theme.cardSoft : theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: "22px",
                padding: "22px",
                boxShadow: active
                    ? "0 20px 50px rgba(37,99,235,0.25)"
                    : "0 20px 40px rgba(0,0,0,0.28)",
                backdropFilter: "blur(10px)",
                color: theme.text,
                textAlign: "left",
                cursor: "pointer",
                transition: "0.2s ease",
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
                        <span>{section.emoji}</span>
                        {section.title}
                    </h2>

                    <p
                        style={{
                            margin: "10px 0 0",
                            color: "#94a3b8",
                            lineHeight: 1.6,
                            fontSize: "15px",
                        }}
                    >
                        {section.short}
                    </p>
                </div>

                <div
                    style={{
                        fontSize: "28px",
                        color: "#60a5fa",
                        fontWeight: "bold",
                    }}
                >
                    +
                </div>
            </div>
        </button>
    );
}

function ExpandedTip({
    theme,
    section,
    activeIndex,
    setActiveIndex,
    onClose,
}: {
    theme: typeof THEMES[ThemeKey];
    section: Section;
    activeIndex: number;
    setActiveIndex: (index: number) => void;
    onClose: () => void;
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2, 6, 23, 0.72)",
                backdropFilter: "blur(8px)",
                zIndex: 100,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "28px",
                animation: "fadeIn 0.18s ease",
            }}
        >
            <div
                style={{
                    width: "min(980px, 100%)",
                    maxHeight: "86vh",
                    overflowY: "auto",
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "28px",
                    padding: "30px",
                    boxShadow: "0 35px 90px rgba(0,0,0,0.55)",
                    transform: "scale(1)",
                    animation: "popIn 0.18s ease",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "18px",
                        alignItems: "flex-start",
                        marginBottom: "22px",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: "36px",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <span>{section.emoji}</span>
                            {section.title}
                        </h2>

                        <p
                            style={{
                                margin: "12px 0 0",
                                color: "#94a3b8",
                                fontSize: "17px",
                                lineHeight: 1.7,
                            }}
                        >
                            {section.short}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            minWidth: "44px",
                            height: "44px",
                            borderRadius: "14px",
                            border: "1px solid rgba(148, 163, 184, 0.3)",
                            background: "rgba(2, 6, 23, 0.7)",
                            color: "#bfdbfe",
                            fontSize: "28px",
                            cursor: "pointer",
                            lineHeight: "38px",
                        }}
                        title="Stäng"
                    >
                        −
                    </button>
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginBottom: "24px",
                    }}
                >
                    {sections.map((item, index) => (
                        <button
                            key={item.title}
                            onClick={() => setActiveIndex(index)}
                            style={{
                                padding: "9px 12px",
                                borderRadius: "999px",
                                border: index === activeIndex
                                    ? "1px solid rgba(96, 165, 250, 0.75)"
                                    : "1px solid rgba(148, 163, 184, 0.22)",
                                background: index === activeIndex
                                    ? "rgba(37, 99, 235, 0.25)"
                                    : "rgba(2, 6, 23, 0.55)",
                                color: index === activeIndex ? "#dbeafe" : "#cbd5e1",
                                fontWeight: "bold",
                                cursor: "pointer",
                            }}
                        >
                            {item.emoji} {item.title}
                        </button>
                    ))}
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "16px",
                    }}
                >
                    {section.content.map((item) => (
                        <div
                            key={item.heading}
                            style={{
                                padding: "20px",
                                borderRadius: "18px",
                                background: "rgba(2, 6, 23, 0.65)",
                                border: "1px solid rgba(148, 163, 184, 0.16)",
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    marginBottom: "10px",
                                    color: "#dbeafe",
                                    fontSize: "20px",
                                }}
                            >
                                {item.heading}
                            </h3>

                            <p
                                style={{
                                    margin: 0,
                                    color: "#cbd5e1",
                                    lineHeight: 1.85,
                                    fontSize: "16px",
                                }}
                            >
                                {item.text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function TipsPage() {
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());

        localStorage.setItem("seenTipsVersion", TIPS_VERSION);
    }, []);

    const theme = THEMES[themeKey];
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const activeSection = activeIndex === null ? null : sections[activeIndex];

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "32px",
                paddingBottom: "120px",
                fontFamily: "Arial, sans-serif",
                background: theme.background,
                color: theme.text,
            }}
        >
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

            <NavBar />
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />

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
                        lära dig effektivare. Tryck på en kategori för att öppna den stort.
                    </p>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "22px",
                    }}
                >
                    {sections.map((section, index) => (
                        <TipCard
                            key={section.title}
                            theme={theme}
                            section={section}
                            active={activeIndex === index}
                            onOpen={() => setActiveIndex(index)}
                        />
                    ))}
                </div>

                <div
                    style={{
                        marginTop: "50px",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "34px",
                            marginBottom: "12px",
                        }}
                    >
                        🎥 Videotips för smartare plugg
                    </h2>

                    <p
                        style={{
                            color: "#94a3b8",
                            lineHeight: 1.7,
                            marginBottom: "26px",
                            maxWidth: "800px",
                        }}
                    >
                        Här hittar du videor med tips om studieteknik, fokus,
                        motivation och hur du pluggar effektivare.
                    </p>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: "22px",
                        }}
                    >
                        {[
                            "qsUrEMpSmTc",
                            "0rIjFCNay2Q",
                            "TjPFZaMe2yw",
                        ].map((videoId) => (
                            <div
                                key={videoId}
                                style={{
                                    borderRadius: "24px",
                                    overflow: "hidden",
                                    background: theme.card,
                                    border: `1px solid ${theme.border}`,
                                    boxShadow: "0 20px 45px rgba(0,0,0,0.28)",
                                }}
                            >
                                <iframe
                                    width="100%"
                                    height="220"
                                    src={`https://www.youtube.com/embed/${videoId}`}
                                    title="YouTube video"
                                    style={{
                                        border: "none",
                                    }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />

                                <div
                                    style={{
                                        padding: "18px",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            color: "#cbd5e1",
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        Smarta tips för bättre fokus, planering och effektivare studier.
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        marginTop: "40px",
                        padding: "24px",
                        borderRadius: "22px",
                        background: theme.cardSoft,
                        border: `1px solid ${theme.border}`,
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
                    Studieverkstad vid Umeå universitet.
                </p>
            </div>

            {activeSection && activeIndex !== null && (
                <ExpandedTip
                    theme={theme}
                    section={activeSection}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    onClose={() => setActiveIndex(null)}
                />
            )}
        </main>
    );
}