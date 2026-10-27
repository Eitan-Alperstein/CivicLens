let records = []
let latestSearch = 0   // race guard: bumped on every search so older AI streams know to stop
const fillers = new Set([
    "what", "is", "are", "the", "a", "an", "about", "doing", "does", "do", "how", "for", "to", 
    "of", "in", "on", "and", "or", "has", "have", "been", "being", "city", "considering", 
    "changes", "decided", "address", "denver"
])

async function load_data() {
    /* Load the data once at startup. 
    Fetch ../data/records.json and keep the array in a variable. 
    Log the count to the console to confirm it worked. */

    const response = await fetch("../data/records.json");
    if (response.ok === false) throw Error("Records not found! " + response.status);
    records = await response.json();
}

function keywordize(question) {
    /* Turn a question into search terms. 
    Lowercase it, split it into words, and drop common filler words and words under 3 letters. 
    "What is Denver doing about water?" should become something like ["denver", "water"].
    - Note that "denver" now matches every city record, so it carries no signal. 
      You could treat place names as filters rather than search terms, or just let it be for today.
    */

    question = question.toLowerCase();
    let keywords = question.split(/[^a-zA-Z0-9]+/);
    keywords = keywords.filter(key=>key!="");
    keywords = keywords.filter(key=>!fillers.has(key))
    keywords = keywords.filter(key=>!(key.length<3))

    return keywords;
}

function score(keywords) {
    /* Score each record against the terms. 
    Points for each term found, with title and keyword matches worth more than excerpt matches. 
    Keep records scoring above zero, sort highest first, and cap the list (around 20). */

    let scoredRecords = []

    function scoreRecord(record) {
        let score = 0;
        for (const keyword of keywords) {
            if (record.title.toLowerCase().includes(keyword)) score += 2;
            if (record.keywords.join(" ").toLowerCase().includes(keyword)) score += 1;
            if (record.committee.toLowerCase().includes(keyword)) score += 1;
            if (record.excerpt.toLowerCase().includes(keyword)) score += 1;
        }

        return score
    }

    for (const doc in records) {
        // Keep the record and its score together, so after sorting we still know which record each score belongs to
        scoredRecords.push({ record: records[doc], score: scoreRecord(records[doc]) })
    }

    // Drop non-matches, sort best first (newest first on ties), keep the top 20
    return scoredRecords
        .filter(item => item.score > 0)
        .sort((a, b) => (b.score - a.score) || b.record.date.localeCompare(a.record.date))
        .slice(0, 20);
}

function render(scores) {
    /* Render the cards. For each result, a card containing:
   - A meta line (card-meta): a level badge (badge city or badge state), the agency, the committee if any, the date and the status.
   - The title (card-title)
   - The excerpt (card-excerpt), skipped when it's empty.
   - A link to the official source (card-link), opening in a new tab.

   Give each card an id based on its result number, so citations can scroll to it later. Show the empty message when there are no results. */

    const results = document.querySelector(".results")
    const empty = document.querySelector(".empty")

    results.innerHTML = "";
    empty.hidden = scores.length > 0;   // the `hidden` property, not setAttribute: hidden="false" still hides
    if (scores.length == 0) return;

    const count = document.createElement("p");
    count.className = "results-count";
    count.textContent = `${scores.length} record${scores.length == 1 ? "" : "s"} found`;
    results.appendChild(count);

    // Every value goes in through textContent/href, never innerHTML, so text from the records can't inject HTML
    scores.forEach((item, i) => {
        const record = item.record;

        const card = document.createElement("article");
        card.className = `card ${record.level}`;
        card.id = `card-${i + 1}`;              // matches the AI's [1], [2]... citations
        card.style.setProperty("--i", i);       // used by the CSS to stagger the fade-in

        const meta = document.createElement("div");
        meta.className = "card-meta";

        const badge = document.createElement("span");
        badge.className = `badge ${record.level}`;
        badge.textContent = record.level;
        meta.appendChild(badge);

        const details = [record.agency, record.committee, formatDate(record.date), record.status];
        for (const detail of details.filter(Boolean)) {
            const span = document.createElement("span");
            span.className = "meta-item";
            span.textContent = detail;
            meta.appendChild(span);
        }

        const title = document.createElement("h3");
        title.className = "card-title";
        title.textContent = record.title;

        card.append(meta, title);

        if (record.excerpt) {
            const excerpt = document.createElement("p");
            excerpt.className = "card-excerpt";
            excerpt.textContent = record.excerpt;
            card.appendChild(excerpt);
        }

        const link = document.createElement("a");
        link.className = "card-link";
        link.href = record.source_url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "View official record →";
        card.appendChild(link);

        results.appendChild(card);
    });
}

function formatDate(isoDate) {
    // "2026-10-19" -> "Oct 19, 2026". Built from parts so the browser's timezone can't shift it a day.
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTopRecords(results, limit = 8) {
    // Numbered from 1 in card order, so the model's [1] is card-1 on the page
    return "\n\n" + results.slice(0, limit).map((item, i) => {
        const r = item.record;
        return [
            `[${i + 1}] ${r.title}`,
            `Agency: ${r.agency}${r.committee ? ` (${r.committee})` : ""}`,
            `Date: ${r.date}`,
            `Status: ${r.status}`,
            r.excerpt ? `Excerpt: ${r.excerpt}` : "",
        ].filter(Boolean).join("\n");
    }).join("\n\n");
}

async function overview(question, results) {
    const thisSearch = ++latestSearch;
    const isStale = () => thisSearch !== latestSearch;   // true once a newer search has started

    if (results.length == 0) {
        document.querySelector(".overview").hidden = true;
        return;
    }

    const overviewText = document.querySelector(".overview-text")
    let aiSummary;

    overviewText.innerHTML = "";
    document.querySelector(".overview").hidden = false;
    document.querySelector(".overview").classList.add("loading")

    try {
        let response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            body: JSON.stringify({
                "model": "llama3.1:8b",
                "messages": [
                    {"role": "system", "content": "You are a civic assistant for Colorado and Denver residents. You will answer and cite only based on the numbered records below. Cite like [2], for example, for Document 2. If you need to cite two documents at once, use the format [1][3] rather than [1,3]. Keep it to one short paragraph in plain English, and say plainly when the records don't quite answer the question. Use chronological terms to help build out timelines of events."},
                    {"role": "user", "content": `Question: ${question}. Top documents: ${formatTopRecords(results)}`}
                ],
                "stream": true,
                "options": { temperature: 0.2 }
            })
        })
        if (isStale()) return;
        if (!response.ok) throw Error("Ollama returned " + response.status);

        // Streamed reply: one JSON object per line, e.g. {"message":{"content":"Den"},"done":false}
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        aiSummary = "";

        while (true) {
            const { done, value } = await reader.read();
            if (isStale()) {
                reader.cancel();   // closing the connection also tells Ollama to stop generating
                return;
            }
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();   // the last piece may be half a line; keep it for the next round

            for (const line of lines) {
                if (!line.trim()) continue;
                const chunk = JSON.parse(line);
                const text = chunk.message?.content ?? "";
                if (!text) continue;

                if (aiSummary === "") document.querySelector(".overview").classList.remove("loading");
                aiSummary += text;
                overviewText.textContent += text;

                let interactiveAiSummary = "";

                for (const part of aiSummary.split(/(\[\d+\])/)) {
                    if (part.match(/\[\d+\]/) && Number(part.slice(1,part.length-1)) <= Math.min(8,results.length)) {
                        interactiveAiSummary += `<a class='cite' href='#card-${part.slice(1,part.length-1)}'>${part}</a>`
                    } else {
                        interactiveAiSummary += part;
                    }
                }

                overviewText.innerHTML = interactiveAiSummary;
            }
        }

        

        // Empty answer (unusual) shouldn't leave the loading text pulsing
        document.querySelector(".overview").classList.remove("loading")
    } catch (e) {
        if (isStale()) return;   // a newer search owns the panel now
        document.querySelector(".overview").classList.remove("loading")
        overviewText.innerHTML = "<b class='ai-overview-error'>AI Overview unavailable.</b>"
    }

    

}

async function main() {
    await load_data();
    console.log("Record retrieval successful! Number: " + records.length);

    document.querySelector("#search-form").addEventListener("submit", e=>{
        e.preventDefault();
        const keywords = keywordize(document.querySelector(".search-input").value);
        const docScore = score(keywords);
        render(docScore);

        overview(document.querySelector(".search-input").value, docScore);
    })

    for (const chip of document.querySelectorAll(".sample-chip")) {
        chip.addEventListener("click", e=>{
            document.querySelector(".search-input").value = chip.innerText;
            document.querySelector("#search-form").requestSubmit();
        })
    }
}

main();