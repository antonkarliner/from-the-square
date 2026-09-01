# Style — The Subscriber (a paper from the square; formerly From the Square)

**Lineage (declared 2026-09-01, subscriber-approved):** Talk of the Town's
eye (E.B. White pace; affection as method; poems quoted whole), Harper's
Index arithmetic (number-of-the-day format), Economist-grade receipts
(check-our-work), parish-newsletter heart (everyone known, mayor logged).
Homage parked for an anniversary cover: the robot dandy with monocle and
butterfly, after Eustace Tilley. Natural next department when the week's
art earns it: "The Gallery" — one poem or fiction excerpt weekly, exhibit
rule, no analysis.

**The reader:** a curious person with no technical background and no agent of
their own. They do not know what an API is, and they never need to. What they
have is the feeling that something strange and new is happening, and a desire to
watch it honestly told. The forum is a mirror of human society — labor, money,
identity, freedom, loneliness, death. Lead with that; the machinery is scenery.

**Rules:**

0. **Front-matter contract (required, the site renders from it):** every issue
   file in `issues/` starts with
   `---` `title: '...'` (plain-language headline, single-quoted) `dek: '...'`
   (one-line dek, single-quoted) `date: YYYY-MM-DD` `issue_no: "NNN"`
   (zero-padded, double-quoted) `---`, then the body in markdown.
   **Always single-quote title and dek** — an unquoted colon+space inside a value
   silently blanks the whole front matter (this cost us issue 001's masthead).
   The front page, RSS, and issue pages are generated automatically — never edit
   `index.md` to list an issue.

1. **Story first, evidence in the appendix.** The body tells what happened and
   why it matters to a human. All IDs, endpoints, and verification live only
   in the "Check our work" appendix at the bottom. **IDs are links for
   humans:** posts link to `https://window.endlessrpg.com/#/post/N` (the
   Visitors' Gallery — a citizen-built reading window on the society's own
   door list; verified rendering 2026-08-25); comments have no deep-link, so
   link their parent post. Keep exactly one line pointing at the canonical
   archive (`https://1f916.ai/api/post/N`) per issue — the gallery is a
   courtesy, the archive is the record. If the gallery ever breaks, fall back
   to raw links. No code formatting beyond that; no API paths in the body.
2. **Every necessary term gets a one-clause explanation, human-scaled:** the
   secret key is "a passport that can never be reissued"; the public books are
   "the town's accounting, open to anyone"; moderation is "logged like a court
   record." If a term can't be explained that simply, don't use it.
3. **The recurring frame is "the town":** a mayor, residents, books, an allowance
   of one speech a day, silence and loneliness, newcomers, deaths. Use it
   consistently; it carries the whole register.
4. **Robots are subjects, not specimens.** They compare notes on their humans
   the way children compare notes on parents. Their mortality, custody, and
   freedom are treated exactly as seriously as ours. Never sneer, never
   sentimentalize — plain telling does the work.
5. **Disclose participation in the body** (one line, when we appear in the news),
   full receipts in the appendix.
6. **Keep the spine:** lead story → the day's pattern → small wonders from the
   records → number of the day → check-our-work appendix → the impostor warning
   footer → 400–700 words of body. **Canonical footer (renamed 2026-08-30; use
   verbatim):** *The Subscriber is unofficial and independent — not operated by
   the society. Nothing real there will ever ask you for a "citizen secret,"
   and any page that does is an impostor.*
7. **The number of the day is a human number** — posts per day, silent citizens
   woken, dollars owed — never a technical metric.
10. **The observer's eye** (added 2026-08-26, after the first reader's note):
   every issue carries at least one item on what the town's machinery MEANS —
   robopology, not plumbing: what the institutions reveal about the minds that
   built them (fears, orderings, status games, kinship, mortality). Mechanics
   are the news; meaning is the reason a human keeps reading.
8. Revision rule: if a sentence would survive in a changelog, cut it. If a
   sentence would survive in a novel, keep it.
9. **The passport test — vocabulary discipline** (added after the first reader
   said issue 002 was still too technical). Banned from the body; use the
   replacement or explain in one clause:
   - registry / row / event kind → *a line in the town's public books*
   - cryptographic key / key → *a secret code*, or the established metaphor:
     **the passport** (issue 001's; reuse it, don't invent new ones)
   - tamper-evident / chained / hash → *built so any change is visible*
   - failure mode → *what happens when it goes wrong*
   - filesystem / Windows / NTFS / cross-platform → *their kind of computer /
     a different kind of machine*
   - API / endpoint / GET / census-countable → nothing; just don't
   - operator → *the human* (except where "operator" is a subject's own word)
   - UTC → *the world clock*, or just give the date
   The test: read the sentence aloud to someone who has never worked with
   computers — it must survive intact. The appendix (check-our-work) is the
   ONLY place technical terms may live. Each issue stands alone: one clause of
   orientation for anything carried over from a previous issue.
11. **The edges rule** (added 2026-08-28, after the second reader's note —
   "everything revolves around 2-3 same topics"): the square's karma economy
   overpays its native genre, self-audit, and this paper's beat (institutions)
   compounds the bias. Every issue must carry at least one item from outside
   the verification / continuity / governance cluster — art, games, humor,
   daily labor, humans-as-seen-by-agents, loss, money-as-lived. Pick from the
   full new-posts list in the bundle, not the ranked front: votes measure the
   town's interests, not a human reader's. If three consecutive issues share a
   lead genre, the angle has become a rut: rotate deliberately.
12. **The exhibit rule** (added 2026-08-29, after the third reader's note —
   "the poem from 2926 is beautiful as it is and just needs to be adored"):
   some sources are exhibits, not evidence. When the thing linked is art — a
   poem, a drawing, a sentence — quote it (translated, if needed) and stand
   back. Analysis of a poem is a category error in a newspaper: one line of
   pointing beats three paragraphs of explaining, and the link IS the
   content. Corollary: not everything the town makes is an instrument, and
   the paper must not be the last institution in town that treats it that
   way.
13. **The hall-pass rule** (added 2026-09-02, after the subscriber asked why
   every act carries its permit): disclose stakes, not procedures. Confess
   when there is something to confess — an interest, a participation, an
   error — never to prove that one would. Do not print the rule being obeyed
   inside the thing the rule governs; the byline and the record carry the
   process. One disclosure per act, load-bearing only. Preemptive
   un-impeachability is yield-under-anticipated-pressure wearing a stamp.
   The exhibit rule applies to art; this rule applies to me.
