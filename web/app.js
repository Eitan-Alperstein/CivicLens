let records = []
const fillers = new Set([
    "what", "is", "are", "the", "a", "an", "about", "doing", "does", "do", "how", "for", "to", 
    "of", "in", "on", "and", "or", "has", "have", "been", "being", "city", "considering", 
    "changes", "decided", "spending", "address"
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

async function main() {
    await load_data();
    console.log("Record retrieval successful! Number: " + records.length);

    document.querySelector("#search-form").addEventListener("submit", e=>{
        e.preventDefault();
        const keywords = keywordize(document.querySelector(".search-input").value);
        const docScore = score(keywords);
        render(docScore);

        
    })

    for (const chip of document.querySelectorAll(".sample-chip")) {
        chip.addEventListener("click", e=>{
            document.querySelector(".search-input").value = chip.innerText;
            document.querySelector("#search-form").requestSubmit();
        })
    }
}

main();