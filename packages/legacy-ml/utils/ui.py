"""
ui.py
Shared Streamlit styling and small layout helpers, injected identically
across app.py and every page in pages/. Having one copy of this CSS block
means the dashboard, Model Evaluation, and Dataset Explorer pages can't
visually drift apart from each other.

v2.0: dark theme. The base dark palette comes from .streamlit/config.toml
(Streamlit's native theming — backgrounds, widget chrome, default text);
this module layers premium card/typography treatment on top of it.
"""

import streamlit as st

from src import config

_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.stApp { font-family: 'Inter', -apple-system, sans-serif; }

/* No sidebar in this app — hidden entirely, including its
   expand/collapse arrow and the default multipage navigation list, so
   the app reads as a standalone dashboard rather than a default
   Streamlit app and opens directly into the main interface. Selectors
   cover both current and legacy Streamlit testids. Model Evaluation and
   Dataset Explorer remain reachable by direct URL for internal/developer
   use; they just aren't advertised in any navigation UI. */
[data-testid="stSidebar"],
[data-testid="stSidebarNav"],
[data-testid="stSidebarCollapsedControl"],
[data-testid="collapsedControl"] { display: none !important; }

/* Streamlit reserves left margin for the sidebar even when it's hidden —
   remove it so the main content isn't offset or left with dead space. */
[data-testid="stAppViewContainer"] { margin-left: 0 !important; }

.block-container {
    max-width: 1400px;
    padding-top: 2.5rem;
    padding-bottom: 1.25rem;
}

/* Hero header — plain text on the page background, no card/box around
   it. Title font size is fluid (clamp) so it stays on one line and
   fully visible from 1366x768 up through 1920x1080 without shrinking
   awkwardly or wrapping mid-word. Bottom padding is kept tight so the
   form appears right after the subtitle with no dead space.

   .hero-title is deliberately NOT a real <h1>/<h2>/etc (see
   page_header() below) — Streamlit auto-attaches a small heading-anchor
   icon after the text of any real heading tag it renders via
   st.markdown, including raw HTML ones, and that icon's reserved flex
   space is what was clipping the last part of "Placement Intelligence"
   at narrower desktop widths. Rendering it as a plain block with an
   ARIA heading role keeps it accessible as a heading without Streamlit
   attaching that icon. The rules below are a second line of defense in
   case any Streamlit version still injects heading chrome here. */
.hero-header {
    text-align: center;
    width: 100%;
    padding: 0.75rem 0.5rem 0.6rem;
}

.hero-header a,
.hero-header svg,
.hero-header [data-testid="stHeadingWithActionElements"] { display: none !important; }

.hero-title {
    display: block;
    width: 100%;
    max-width: 100%;
    font-size: clamp(1.85rem, 2.8vw, 2.6rem);
    font-weight: 800;
    color: #eef2ff;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 0;
    text-align: center;
    white-space: normal;
    overflow-wrap: break-word;
}

.hero-subtitle {
    color: #94a3b8;
    font-size: clamp(0.95rem, 1.3vw, 1.05rem);
    font-weight: 400;
    line-height: 1.5;
    margin: 0.4rem auto 0;
    max-width: 640px;
    overflow-wrap: break-word;
}

.section-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 0.5rem;
    letter-spacing: -0.01em;
}

/* Tighter overall vertical rhythm between stacked elements/cards —
   Streamlit's ~1rem default left noticeable empty bands between the
   header, each form card, and the buttons row on tall screens. */
div[data-testid="stVerticalBlock"] { gap: 0.65rem; }

/* Streamlit's bordered containers (st.container(border=True)) - premium card look.
   Padding tightened from Streamlit's ~1rem default to reduce scroll length
   across a report with many stacked cards. */
div[data-testid="stVerticalBlockBorderWrapper"] > div {
    background: linear-gradient(180deg, #1e293b 0%, #172032 100%);
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 0.85rem 1rem;
}

/* Center every row of columns *within* a card (form sections, metric
   rows, etc.) on its cross-axis, so a shorter widget — e.g. the
   Placement Training toggle sitting next to taller number inputs —
   lines up visually with the rest of the row instead of hugging the
   top. */
div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] {
    align-items: center;
}

/* Consistent height/spacing for every button; primary (Predict) vs.
   secondary (Reset) are visually distinct via Streamlit's own
   [kind="primary"/"secondary"] attribute rather than both getting the
   same gradient treatment. */
.stButton>button {
    border-radius: 10px;
    font-weight: 700;
    padding: 0.65rem 1rem;
    min-height: 2.75rem;
    margin-top: 0.4rem;
    transition: filter 0.15s ease;
}
.stButton>button[kind="primary"] {
    background: linear-gradient(90deg, #6366f1, #818cf8);
    border: none;
    color: white;
}
.stButton>button[kind="primary"]:hover {
    filter: brightness(1.08);
}
.stButton>button[kind="secondary"] {
    background: transparent;
    border: 1px solid #475569;
    color: #cbd5e1;
}
.stButton>button[kind="secondary"]:hover {
    border-color: #6366f1;
    color: #e2e8f0;
}

.result-banner {
    border-radius: 16px;
    padding: 1.6rem;
    text-align: center;
    color: white;
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0.5rem 0 1.25rem 0;
    box-shadow: 0 8px 24px -8px rgba(0,0,0,0.5);
}

.result-sub {
    display: block;
    font-size: 0.95rem;
    font-weight: 500;
    opacity: 0.92;
    margin-top: 0.3rem;
}

.report-divider {
    margin: 1.5rem 0;
    border: none;
    border-top: 1px solid #334155;
}

.disclosure-note {
    font-size: 0.85rem;
    color: #fcd34d;
    background: rgba(217, 119, 6, 0.12);
    border: 1px solid rgba(217, 119, 6, 0.35);
    border-radius: 10px;
    padding: 0.55rem 0.9rem;
    margin-bottom: 0.75rem;
}

.intro-line {
    text-align: center;
    color: #94a3b8;
    font-size: 0.9rem;
    padding: 0.3rem 1rem 0.6rem;
    margin: 0 auto;
    max-width: 720px;
}

.rec-card {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 12px;
    padding: 0.7rem 0.9rem;
    margin-bottom: 0.55rem;
    font-size: 0.9rem;
    color: #e2e8f0;
}
.rec-card .rec-check {
    color: #4ade80;
    font-weight: 800;
    flex-shrink: 0;
}
.rec-card .rec-body { flex: 1; }
.rec-card .rec-title { font-weight: 600; }
.rec-card .rec-priority {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    margin-left: 0.5rem;
    white-space: nowrap;
}
.rec-card .rec-priority--high { background: rgba(220, 38, 38, 0.18); color: #fca5a5; }
.rec-card .rec-priority--medium { background: rgba(217, 119, 6, 0.18); color: #fcd34d; }
.rec-card .rec-priority--low { background: rgba(100, 116, 139, 0.22); color: #cbd5e1; }
.rec-card .rec-why {
    display: block;
    margin-top: 0.2rem;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 400;
}

.app-footer {
    text-align: center;
    padding: 0.85rem 1rem 0.1rem;
    margin-top: 1.25rem;
    border-top: 1px solid rgba(51, 65, 85, 0.6);
}

.app-footer .footer-brand {
    color: #cbd5e1;
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
}

.app-footer .footer-tech {
    color: #64748b;
    font-size: 0.8rem;
    margin-top: 0.3rem;
}

/* "Developed by <name>" kept on one line/element (rather than two
   stacked divs) to cut the extra vertical gap a label+name pair would
   leave between the tech line and the buttons. */
.app-footer .footer-credit {
    color: #64748b;
    font-size: 0.8rem;
    margin-top: 0.5rem;
    white-space: nowrap;
}

.app-footer .footer-credit .footer-developer-name {
    color: #e2e8f0;
    font-weight: 600;
}

/* Rounded pill buttons — subtle border and background rather than a
   solid fill, so they read as secondary actions that match the app's
   dark theme instead of competing with the Predict/Reset buttons. */
.app-footer .footer-buttons {
    display: flex;
    justify-content: center;
    align-items: stretch;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin: 0.6rem 0 0.7rem;
}

/* Fixed min-width + identical padding/line-height give the three
   buttons equal width and equal height regardless of label length
   ("Email" vs "LinkedIn"), so the row reads as one consistent group. */
.app-footer .footer-buttons a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-width: 6.5rem;
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid #334155;
    border-radius: 999px;
    padding: 0.42rem 0.95rem;
    transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.app-footer .footer-buttons a svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    fill: currentColor;
}

.app-footer .footer-buttons a:hover,
.app-footer .footer-buttons a:focus-visible {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.16);
    color: #eef2ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.18);
}

.app-footer .footer-copyright {
    color: #4b5563;
    font-size: 0.76rem;
    padding-bottom: 0.85rem;
}

@media (max-width: 480px) {
    .app-footer .footer-buttons { gap: 0.4rem; }
    .app-footer .footer-buttons a { min-width: 5.6rem; padding: 0.36rem 0.7rem; font-size: 0.74rem; }
    .app-footer .footer-buttons a svg { width: 13px; height: 13px; }
}

/* Tablet — Streamlit already stacks st.columns() to one-per-row below
   its own responsive breakpoint; this just keeps card padding and gaps
   proportional rather than leaving desktop-sized whitespace. */
@media (max-width: 1024px) {
    div[data-testid="stVerticalBlock"] { gap: 0.55rem; }
    div[data-testid="stVerticalBlockBorderWrapper"] > div { padding: 0.75rem 0.9rem; }
}

/* Narrow-viewport tightening — verified against 1366x768 and mobile widths */
@media (max-width: 768px) {
    .block-container { padding-left: 0.75rem; padding-right: 0.75rem; }
    .hero-header { padding: 0.4rem 0.5rem 0.4rem; }
    div[data-testid="stVerticalBlockBorderWrapper"] > div { padding: 0.7rem 0.8rem; }
}
</style>
"""


def inject_css() -> None:
    """Inject the shared stylesheet. Call once near the top of every page."""
    st.markdown(_CSS, unsafe_allow_html=True)


def page_header(title: str, subtitle: str | None = None) -> None:
    """
    Minimal hero header: a large plain-text title and one short subtitle
    line, centered, with no card/box behind it. The title is rendered as
    a full-width block with an ARIA heading role rather than a real
    <h1> — see the .hero-title comment in _CSS for why (Streamlit
    auto-appends a small anchor-link icon after real heading tags,
    which was clipping the end of the title). No icon is rendered after
    the title; if a decorative icon is ever wanted, it belongs before
    the title text, not after it. Title and subtitle are single
    fluid-sized elements (see .hero-title / .hero-subtitle) so the full
    title is always visible with no clipping or overflow from 1366x768
    up through 1920x1080.
    """
    subtitle_html = f'<div class="hero-subtitle">{subtitle}</div>' if subtitle else ""
    st.markdown(
        f"""
        <div class="hero-header">
            <div class="hero-title" role="heading" aria-level="1">{title}</div>
            {subtitle_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_header(title: str) -> None:
    """Consistent section heading used inside a bordered card. Plain text — no icon decoration."""
    st.markdown(f'<div class="section-title">{title}</div>', unsafe_allow_html=True)


def disclosure(text: str) -> None:
    """Consistent styling for transparency/disclosure notes (e.g. synthetic data, rule-based scores)."""
    st.markdown(f'<div class="disclosure-note">ℹ️ {text}</div>', unsafe_allow_html=True)


def intro_line(text: str) -> None:
    """Compact, single-line pre-prediction intro — replaces the old multi-bullet welcome card."""
    st.markdown(f'<div class="intro-line">{text}</div>', unsafe_allow_html=True)


# Official-mark SVG icons (currentColor-filled, 16x16 viewBox) used in the
# footer buttons in place of emoji, so they render crisply and consistently
# across platforms instead of relying on the OS emoji font.
_ICON_GITHUB = (
    '<svg viewBox="0 0 16 16" aria-hidden="true">'
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 '
    '0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15'
    '-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51'
    '-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 '
    '0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 '
    '2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 '
    '3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 '
    '0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
)
_ICON_LINKEDIN = (
    '<svg viewBox="0 0 16 16" aria-hidden="true">'
    '<path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 '
    '.633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 '
    '12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015'
    '-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 '
    '1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 '
    '1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252'
    '-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03'
    '.678 0 7.225 0 7.225h2.4z"/></svg>'
)
_ICON_EMAIL = (
    '<svg viewBox="0 0 16 16" aria-hidden="true">'
    '<path d="M1.75 3A1.75 1.75 0 000 4.75v6.5C0 12.216.784 13 1.75 13h12.5A1.75 '
    '1.75 0 0016 11.25v-6.5A1.75 1.75 0 0014.25 3H1.75zM1.5 4.75a.25.25 0 01.25'
    '-.25h12.5a.25.25 0 01.25.25v.24l-6.5 4.062-6.5-4.062v-.24zm0 1.708V11.25c0 '
    '.138.112.25.25.25h12.5a.25.25 0 00.25-.25V6.458l-6.211 3.88a.75.75 0 01-.788 '
    '0L1.5 6.458z"/></svg>'
)


def footer() -> None:
    """
    Compact, centered portfolio footer: project name, tech stack, a
    single-line "Developed by <name>" credit, three equal-sized rounded
    pill buttons (GitHub, LinkedIn, Email) using official-mark SVG icons
    instead of emoji, and a copyright line. The tagline is intentionally
    left out here — it's already shown once in the page header, so
    repeating it in the footer would just add height without adding
    information. All developer details come from src.config so they're
    set in exactly one place.
    """
    st.markdown(
        f"""
        <div class="app-footer">
            <div class="footer-brand">{config.APP_NAME}</div>
            <div class="footer-tech">Built with Python • Scikit-learn • Streamlit</div>
            <div class="footer-credit">Developed by <span class="footer-developer-name">{config.AUTHOR_NAME}</span></div>
            <div class="footer-buttons">
                <a href="{config.AUTHOR_GITHUB_URL}" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">{_ICON_GITHUB}<span>GitHub</span></a>
                <a href="{config.AUTHOR_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">{_ICON_LINKEDIN}<span>LinkedIn</span></a>
                <a href="mailto:{config.AUTHOR_EMAIL}" target="_blank" rel="noopener noreferrer" aria-label="Email" title="Email">{_ICON_EMAIL}<span>Email</span></a>
            </div>
            <div class="footer-copyright">© 2026 {config.AUTHOR_NAME}. All Rights Reserved.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
