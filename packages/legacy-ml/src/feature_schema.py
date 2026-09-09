"""
feature_schema.py
Single source of truth for how each dataset column is presented and
validated in the UI.

app.py never hardcodes a field name, widget type, or valid range — it
loops over this schema. To support a new dataset, update config.py's
NUMERIC_FEATURES/CATEGORICAL_FEATURES/TARGET_COLUMN and the entries
below; nothing in app.py needs to change.

v2.1: every field here is something a student objectively knows about
themselves — no self-rated fields (aptitude, communication, soft skills)
and nothing they'd need to look up (board, stream, degree type).

Each entry is keyed by the exact dataset column name (must match
config.FEATURE_COLUMNS) and describes:
    section     - which form section it belongs under
    label       - human-readable field label
    help        - tooltip text
    widget      - "slider" | "number_input" | "toggle"
    dtype       - python type the raw value should be cast to (numeric only)
    min / max   - valid range for numeric widgets (also used for validation)
    step        - widget increment (numeric only)
    default     - widget default value
    options     - valid choices for "toggle" widgets
"""

from src import config

SECTION_ORDER = ["Academic", "Experience", "Additional"]

FIELD_SCHEMA = {
    # ── Academic ─────────────────────────────────────────────────────────
    "CGPA": {
        "section": "Academic",
        "label": "CGPA",
        "help": "Cumulative Grade Point Average, out of 10.",
        "widget": "slider",
        "dtype": float,
        "min": 0.0,
        "max": 10.0,
        "step": 0.1,
        "default": 7.0,
    },
    "SSC_Marks": {
        "section": "Academic",
        "label": "SSC Marks (%)",
        "help": "10th standard (SSC) percentage.",
        "widget": "slider",
        "dtype": float,
        "min": 35.0,
        "max": 100.0,
        "step": 0.5,
        "default": 75.0,
    },
    "HSC_Marks": {
        "section": "Academic",
        "label": "HSC Marks (%)",
        "help": "12th standard (HSC) percentage.",
        "widget": "slider",
        "dtype": float,
        "min": 35.0,
        "max": 100.0,
        "step": 0.5,
        "default": 75.0,
    },
    # ── Experience ───────────────────────────────────────────────────────
    "Internship_Count": {
        "section": "Experience",
        "label": "Internships Completed",
        "help": "Count of internships completed.",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 3,
        "step": 1,
        "default": 0,
    },
    "Internship_Duration_Months": {
        "section": "Experience",
        "label": "Internship Duration (months)",
        "help": "Total internship duration in months, across all internships.",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 12,
        "step": 1,
        "default": 0,
    },
    "Projects": {
        "section": "Experience",
        "label": "Projects Completed",
        "help": "Count of academic or personal projects completed.",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 15,
        "step": 1,
        "default": 2,
    },
    "Workshops_Certifications": {
        "section": "Experience",
        "label": "Certifications",
        "help": "Count of workshops attended or certifications completed (online courses, professional certifications, etc.).",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 12,
        "step": 1,
        "default": 1,
    },
    # ── Additional ───────────────────────────────────────────────────────
    "Placement_Training": {
        "section": "Additional",
        "label": "Placement Training Completed",
        "help": "Have you completed a formal placement-training program?",
        "widget": "toggle",
        "options": ["No", "Yes"],
        "default": "No",
    },
    "Extracurricular_Activities": {
        "section": "Additional",
        "label": "Extracurricular Activities",
        "help": "Count of extracurricular activities/clubs/sports you're actively involved in.",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 5,
        "step": 1,
        "default": 2,
    },
    "Active_Backlogs": {
        "section": "Additional",
        "label": "Active Backlogs",
        "help": "Number of currently unresolved backlog subjects.",
        "widget": "number_input",
        "dtype": int,
        "min": 0,
        "max": 10,
        "step": 1,
        "default": 0,
    },
}


def _check_schema_matches_config() -> None:
    """Fail loudly at import time if the schema drifts from config.py."""
    schema_cols = set(FIELD_SCHEMA.keys())
    config_cols = set(config.FEATURE_COLUMNS)
    if schema_cols != config_cols:
        raise RuntimeError(
            "feature_schema.py is out of sync with config.FEATURE_COLUMNS.\n"
            f"In schema but not config: {schema_cols - config_cols}\n"
            f"In config but not schema: {config_cols - schema_cols}"
        )


_check_schema_matches_config()


def fields_by_section() -> dict:
    """Return {section_name: [column_name, ...]} in schema-declared order."""
    grouped = {section: [] for section in SECTION_ORDER}
    for column in config.FEATURE_COLUMNS:
        section = FIELD_SCHEMA[column]["section"]
        grouped.setdefault(section, []).append(column)
    return grouped
