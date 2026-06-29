// app/resume/_components/resume-preview.jsx
"use client";

/**
 * ResumePreview
 * Renders markdown-based resume content in a clean LaTeX/academic style
 * matching the target template:
 *   - Large centered ALL-CAPS name
 *   - Single row of contact icons
 *   - ALL-CAPS bold section headers with a full-width rule
 *   - Org/title bold-left, dates bold-right, role italic below
 *   - Compact bullet lists
 */

import { useMemo } from "react";

// ─── tiny markdown parser helpers ────────────────────────────────────────────

/** Strip HTML tags (for div align wrappers the builder injects) */
const stripHtml = (str) => str.replace(/<[^>]+>/g, "").trim();

/** Convert inline markdown: **bold**, *italic*, [text](url) */
const renderInline = (text) => {
  // links
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:inherit;text-decoration:underline;" target="_blank" rel="noopener">$1</a>'
  );
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic (but not inside bold)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  return text;
};

/** Parse contact icons line like: 📧 email | 📱 phone | 💼 [LinkedIn](url) */
const parseContact = (line) => {
  // remove emoji, parse links, split on |
  return line
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // strip leading emoji
      const clean = part.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, "").trim();
      // check for link
      const linkMatch = clean.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return { label: linkMatch[1], href: linkMatch[2] };
      }
      return { label: clean, href: null };
    });
};

// ─── parse markdown into sections ────────────────────────────────────────────

function parseResume(markdown) {
  if (!markdown) return { name: "", contact: [], sections: [] };

  const lines = markdown.split("\n");
  let name = "";
  let contact = [];
  const sections = [];
  let currentSection = null;
  let bodyLines = [];
  let i = 0;

  // Flush accumulated body lines into currentSection
  const flushSection = () => {
    if (currentSection) {
      currentSection.body = bodyLines.join("\n").trim();
      sections.push(currentSection);
      currentSection = null;
      bodyLines = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // H1 → name
    if (line.startsWith("# ")) {
      name = stripHtml(line.slice(2).trim());
      i++;
      continue;
    }

    // H2 inside a div (the builder wraps the name in ## <div align="center">Name</div>)
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      const stripped = stripHtml(heading);

      // If the heading text is also the name candidate (first ## we see and name empty)
      if (!name && stripped) {
        name = stripped;
        i++;
        continue;
      }

      // Otherwise it's a section header
      flushSection();
      currentSection = { title: stripped, body: "" };
      bodyLines = [];
      i++;
      continue;
    }

    // div align center → contact line or name
    if (line.includes("<div") && line.includes("align")) {
      // could be name or contact
      const inner = stripHtml(line);
      if (inner && !name) {
        name = inner;
      } else if (inner) {
        // treat as contact line
        contact = parseContact(inner);
      }
      i++;
      continue;
    }

    // Plain contact line (email | phone | ...)
    if (!currentSection && line.includes("|") && (line.includes("@") || line.includes("http") || line.includes("📧") || line.includes("📱"))) {
      contact = parseContact(line);
      i++;
      continue;
    }

    // Accumulate into current section
    if (currentSection) {
      bodyLines.push(line);
    }

    i++;
  }

  flushSection();
  return { name, contact, sections };
}

// ─── section body parser → structured entries ────────────────────────────────

/**
 * Tries to detect entry blocks like:
 *   ### Title @ Org
 *   date1 - date2
 *   description...
 *
 * Falls back to rendering as plain bullet / paragraph text.
 */
function parseSectionBody(body) {
  const lines = body.split("\n");
  const blocks = [];
  let current = null;

  const flushBlock = () => {
    if (current) {
      blocks.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // H3/H4 → new entry
    if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
      flushBlock();
      const raw = trimmed.replace(/^#{3,4}\s*/, "");
      // "Title @ Org"
      const atIdx = raw.indexOf(" @ ");
      if (atIdx !== -1) {
        current = {
          type: "entry",
          title: raw.slice(0, atIdx).trim(),
          org: raw.slice(atIdx + 3).trim(),
          dates: "",
          description: [],
        };
      } else {
        current = { type: "entry", title: raw, org: "", dates: "", description: [] };
      }
      continue;
    }

    if (current) {
      // Date line: "Jan 2020 - Dec 2022" or "Jan 2020 - Present"
      if (!current.dates && /^[A-Z][a-z]{2}\s\d{4}/.test(trimmed)) {
        current.dates = trimmed;
        continue;
      }
      // Bullet
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        current.description.push({ type: "bullet", text: trimmed.slice(2) });
      } else {
        current.description.push({ type: "para", text: trimmed });
      }
    } else {
      // No current block: raw bullets or paragraphs
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        blocks.push({ type: "bullet", text: trimmed.slice(2) });
      } else {
        blocks.push({ type: "para", text: trimmed });
      }
    }
  }

  flushBlock();
  return blocks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <div style={{ marginTop: "10px", marginBottom: "4px" }}>
      <div
        style={{
          fontFamily: "'Times New Roman', Georgia, serif",
          fontSize: "11pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#000",
        }}
      >
        {title}
      </div>
      <hr style={{ border: "none", borderTop: "1.5px solid #000", margin: "2px 0 6px 0" }} />
    </div>
  );
}

function EntryBlock({ entry }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      {/* Row 1: org bold-left, dates bold-right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{ fontWeight: "bold", fontSize: "10.5pt", fontFamily: "'Times New Roman', Georgia, serif" }}
          dangerouslySetInnerHTML={{ __html: renderInline(entry.org || entry.title) }}
        />
        <span style={{ fontSize: "10pt", fontFamily: "'Times New Roman', Georgia, serif" }}>
          {entry.dates}
        </span>
      </div>
      {/* Row 2: title italic (if org is separate) */}
      {entry.org && entry.title && (
        <div>
          <em
            style={{ fontSize: "10pt", fontFamily: "'Times New Roman', Georgia, serif" }}
            dangerouslySetInnerHTML={{ __html: renderInline(entry.title) }}
          />
        </div>
      )}
      {/* Description bullets */}
      {entry.description && entry.description.length > 0 && (
        <ul style={{ margin: "3px 0 0 16px", padding: 0, listStyleType: "disc" }}>
          {entry.description.map((item, i) =>
            item.type === "bullet" ? (
              <li
                key={i}
                style={{
                  fontSize: "10pt",
                  fontFamily: "'Times New Roman', Georgia, serif",
                  marginBottom: "2px",
                  lineHeight: "1.35",
                }}
                dangerouslySetInnerHTML={{ __html: renderInline(item.text) }}
              />
            ) : (
              <p
                key={i}
                style={{
                  fontSize: "10pt",
                  fontFamily: "'Times New Roman', Georgia, serif",
                  margin: "2px 0",
                  lineHeight: "1.35",
                }}
                dangerouslySetInnerHTML={{ __html: renderInline(item.text) }}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}

function SectionBody({ body }) {
  const blocks = useMemo(() => parseSectionBody(body), [body]);
  const hasEntries = blocks.some((b) => b.type === "entry");

  if (hasEntries) {
    return (
      <div>
        {blocks.map((block, i) => {
          if (block.type === "entry") return <EntryBlock key={i} entry={block} />;
          if (block.type === "bullet")
            return (
              <li
                key={i}
                style={{
                  fontSize: "10pt",
                  fontFamily: "'Times New Roman', Georgia, serif",
                  marginLeft: "16px",
                  marginBottom: "2px",
                }}
                dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
              />
            );
          return (
            <p
              key={i}
              style={{
                fontSize: "10pt",
                fontFamily: "'Times New Roman', Georgia, serif",
                margin: "2px 0",
              }}
              dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
            />
          );
        })}
      </div>
    );
  }

  // Simple bullet list or paragraph section (Skills, Summary, etc.)
  const bullets = blocks.filter((b) => b.type === "bullet");
  const paras = blocks.filter((b) => b.type === "para");

  return (
    <div>
      {paras.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: "10pt",
            fontFamily: "'Times New Roman', Georgia, serif",
            margin: "2px 0 4px",
            lineHeight: "1.4",
          }}
          dangerouslySetInnerHTML={{ __html: renderInline(p.text) }}
        />
      ))}
      {bullets.length > 0 && (
        <ul style={{ margin: "2px 0 0 16px", padding: 0, listStyleType: "disc" }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{
                fontSize: "10pt",
                fontFamily: "'Times New Roman', Georgia, serif",
                marginBottom: "2px",
                lineHeight: "1.35",
              }}
              dangerouslySetInnerHTML={{ __html: renderInline(b.text) }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResumePreview({ content, id }) {
  const { name, contact, sections } = useMemo(() => parseResume(content), [content]);

  return (
    <div
      id={id}
      style={{
        background: "white",
        color: "#000",
        fontFamily: "'Times New Roman', Georgia, serif",
        padding: "28px 36px",
        maxWidth: "780px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* ── Name ── */}
      {name && (
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <span
            style={{
              fontSize: "22pt",
              fontWeight: "bold",
              fontFamily: "'Times New Roman', Georgia, serif",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {name}
          </span>
        </div>
      )}

      {/* ── Contact row ── */}
      {contact.length > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "9.5pt",
            marginBottom: "6px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "6px 12px",
            fontFamily: "'Times New Roman', Georgia, serif",
          }}
        >
          {contact.map((c, i) => (
            <span key={i}>
              {c.href ? (
                <a href={c.href} style={{ color: "inherit", textDecoration: "underline" }} target="_blank" rel="noopener">
                  {c.label}
                </a>
              ) : (
                c.label
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Sections ── */}
      {sections.map((sec, i) => (
        <div key={i}>
          <SectionHeader title={sec.title} />
          <SectionBody body={sec.body} />
        </div>
      ))}
    </div>
  );
}
