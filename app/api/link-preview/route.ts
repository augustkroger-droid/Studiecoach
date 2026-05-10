import { NextResponse } from "next/server";

function fallbackTitle(url: string) {
    try {
        const hostname = new URL(url).hostname.replace("www.", "");

        if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
            return "YouTube-länk";
        }

        if (hostname.includes("quizlet.com")) {
            return "Quizlet-länk";
        }

        if (hostname.includes("drive.google.com")) {
            return "Google Drive";
        }

        return hostname;
    } catch {
        return "Länk";
    }
}

function getMetaContent(html: string, property: string) {
    const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
    );

    return html.match(regex)?.[1];
}

function getHtmlTitle(html: string) {
    return html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1];
}

function cleanTitle(title: string) {
    return title
        .replace(/\s+/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const rawUrl = String(body.url || "").trim();

        if (!rawUrl) {
            return NextResponse.json({ title: "Länk" });
        }

        const url =
            rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                ? rawUrl
                : `https://${rawUrl}`;

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 LinkPreviewBot",
            },
        });

        const html = await response.text();

        const title =
            getMetaContent(html, "og:title") ||
            getMetaContent(html, "twitter:title") ||
            getHtmlTitle(html) ||
            fallbackTitle(url);

        return NextResponse.json({
            title: cleanTitle(title),
            url,
        });
    } catch {
        return NextResponse.json({
            title: "Länk",
        });
    }
}