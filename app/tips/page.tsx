"use client";

import NavBar from "@/components/NavBar";

export default function TipsPage() {
    return (
        <main style={{ padding: "32px", fontFamily: "Arial, sans-serif" }}>
            <NavBar />

            <h1>💡 Studietips</h1>

            <ul>
                <li>📖 Läs kort – stäng boken – återberätta</li>
                <li>🧠 Testa dig själv istället för att läsa om</li>
                <li>🔁 Repetera dagen efter</li>
                <li>🗣 Förklara för någon annan</li>
            </ul>
        </main>
    );
}