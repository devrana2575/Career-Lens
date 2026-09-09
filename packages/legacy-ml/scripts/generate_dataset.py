"""
generate_dataset.py
Generates a synthetic placement dataset at data/placementdata.csv that
simulates how a university placement cell might maintain student
records — using logical, probability-weighted relationships between
features rather than pure independent randomness.

Every feature here is something a student objectively knows about
themselves (marks, backlogs, project/internship/workshop counts,
extracurricular involvement, whether they completed placement training)
— no self-rated or subjective fields (aptitude, communication, resume
score, GitHub score, etc.) are included, by design.

Feature relationships modeled (see generate() for the exact code):
  - SSC_Marks / HSC_Marks are correlated with CGPA (stronger students in
    college tended to be stronger students in school too), not sampled
    independently.
  - Internship_Count is drawn from a fixed weighted distribution
    (40% / 35% / 20% / 5% for 0/1/2/3 internships).
  - Internship_Duration_Months is derived entirely from Internship_Count
    (never sampled on its own) — 0 internships means 0 months, 1
    internship means 1-3 months, 2 means 3-6 months, 3 means 6-12 months.
  - Projects is partially driven by Internship_Count — students with
    internship experience tend to also have built more projects.
  - Workshops_Certifications is partially driven by Placement_Training —
    students who attended placement training are more likely to have
    also completed workshops/certifications.
  - Extracurricular_Activities follows a weighted distribution where most
    students fall in the 1-3 range and very few reach 4-5.
  - Active_Backlogs follows a realistic skewed distribution (80% have
    zero, shrinking shares have 1/2/3).

Placement_Status is never assigned randomly or by a hard threshold:
  1. A Recruiter Evaluation Score is computed from a weighted, directional
     combination of every feature (never persisted to the dataset).
  2. Small Gaussian noise is added to that score, so two students with
     identical profiles aren't guaranteed identical outcomes.
  3. The noisy score is passed through a sigmoid to get a smooth
     Placement Probability in (0, 1) — never a hard cutoff.
  4. Placement_Status is then *sampled* from that probability (a coin
     flip weighted by the probability), not thresholded, so the dataset
     has realistic overlap between placed and not-placed students.

Usage:
    python scripts/generate_dataset.py
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config  # noqa: E402

N_STUDENTS = 15_000
RNG = np.random.default_rng(config.RANDOM_STATE)

# Relative weight each feature carries in the underlying Recruiter
# Evaluation Score. These are directional, not literal coefficients — the
# percentile-rank + sigmoid approach below turns them into a smooth,
# realistic probability curve rather than a linear formula a student
# could reverse-engineer exactly.
_WEIGHTS = {
    "CGPA": 26,
    "SSC_Marks": 6,
    "HSC_Marks": 6,
    "Internship_Count": 16,
    "Internship_Duration_Months": 8,
    "Projects": 12,
    "Workshops_Certifications": 8,
    "Extracurricular_Activities": 4,
    "Active_Backlogs": 18,  # applied negatively — see generate()
}
_PLACEMENT_TRAINING_BONUS = 6

# Standard deviation of the Gaussian noise added to the raw evaluation
# score before it's passed through the sigmoid (see step 2 in the module
# docstring) — keeps otherwise-identical profiles from always producing
# identical outcomes.
_SCORE_NOISE_STD = 4.0


def _percentile_rank(series: pd.Series) -> pd.Series:
    """Percentile-rank a series so unlike-scaled features combine fairly."""
    return series.rank(pct=True)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def generate() -> pd.DataFrame:
    student_ids = [f"STU{i:05d}" for i in range(1, N_STUDENTS + 1)]

    # ── Academic profile ───────────────────────────────────────────────
    cgpa = np.clip(RNG.normal(7.0, 1.15, N_STUDENTS), 4.0, 10.0)

    # SSC/HSC marks positively correlate with CGPA: derived from the same
    # underlying "academic strength" (CGPA's own percentile) plus
    # independent per-exam noise, rather than sampled independently.
    cgpa_percentile = _percentile_rank(pd.Series(cgpa))
    ssc_marks = np.clip(
        45 + cgpa_percentile.to_numpy() * 45 + RNG.normal(0, 6, N_STUDENTS), 35, 100
    )
    hsc_marks = np.clip(
        42 + cgpa_percentile.to_numpy() * 45 + RNG.normal(0, 6, N_STUDENTS), 35, 100
    )

    # Backlogs: realistic skew, most students have none.
    active_backlogs = RNG.choice(
        [0, 1, 2, 3], size=N_STUDENTS, p=[0.80, 0.12, 0.06, 0.02],
    )

    # ── Internships: count first (fixed weighted distribution), then
    #    duration derived entirely from that count — never sampled
    #    independently. ────────────────────────────────────────────────
    internship_count = RNG.choice(
        [0, 1, 2, 3], size=N_STUDENTS, p=[0.40, 0.35, 0.20, 0.05],
    )

    internship_duration_months = np.zeros(N_STUDENTS, dtype=int)
    duration_ranges = {1: (1, 3), 2: (3, 6), 3: (6, 12)}
    for count, (low, high) in duration_ranges.items():
        mask = internship_count == count
        internship_duration_months[mask] = RNG.integers(low, high + 1, mask.sum())

    # ── Projects: partially driven by internship count — students with
    #    internship experience tend to have built more projects too. ────
    projects = np.clip(
        RNG.poisson(1.5 + internship_count * 1.1, N_STUDENTS), 0, 12
    )

    # ── Placement training (independent Yes/No, feeds workshops below). ─
    placement_training = RNG.choice(["Yes", "No"], size=N_STUDENTS, p=[0.5, 0.5])

    # ── Workshops/Certifications: partially driven by placement training
    #    — students who attended training are more likely to have also
    #    completed workshops/certifications. ─────────────────────────────
    workshops_lambda = np.where(placement_training == "Yes", 2.6, 1.4)
    workshops_certifications = np.clip(RNG.poisson(workshops_lambda), 0, 10)

    # ── Extracurricular activities: weighted distribution, most students
    #    in the 1-3 range, very few at 4-5. ──────────────────────────────
    extracurricular_activities = RNG.choice(
        [0, 1, 2, 3, 4, 5], size=N_STUDENTS,
        p=[0.05, 0.28, 0.35, 0.20, 0.08, 0.04],
    )

    df = pd.DataFrame({
        config.STUDENT_ID_COLUMN: student_ids,
        "CGPA": np.round(cgpa, 2),
        "SSC_Marks": np.round(ssc_marks, 2),
        "HSC_Marks": np.round(hsc_marks, 2),
        "Internship_Count": internship_count,
        "Internship_Duration_Months": internship_duration_months,
        "Projects": projects,
        "Workshops_Certifications": workshops_certifications,
        "Extracurricular_Activities": extracurricular_activities,
        "Active_Backlogs": active_backlogs,
        "Placement_Training": placement_training,
    })

    # ── Step 1: Recruiter Evaluation Score (never persisted) ────────────
    # Weighted, percentile-based score -> smooth sigmoid probability
    # curve. Backlogs subtract (more backlogs = lower placement
    # probability); everything else adds.
    raw_score = (
        _percentile_rank(df["CGPA"]) * _WEIGHTS["CGPA"]
        + _percentile_rank(df["SSC_Marks"]) * _WEIGHTS["SSC_Marks"]
        + _percentile_rank(df["HSC_Marks"]) * _WEIGHTS["HSC_Marks"]
        + _percentile_rank(df["Internship_Count"]) * _WEIGHTS["Internship_Count"]
        + _percentile_rank(df["Internship_Duration_Months"]) * _WEIGHTS["Internship_Duration_Months"]
        + _percentile_rank(df["Projects"]) * _WEIGHTS["Projects"]
        + _percentile_rank(df["Workshops_Certifications"]) * _WEIGHTS["Workshops_Certifications"]
        + _percentile_rank(df["Extracurricular_Activities"]) * _WEIGHTS["Extracurricular_Activities"]
        - _percentile_rank(df["Active_Backlogs"]) * _WEIGHTS["Active_Backlogs"]
        + (df["Placement_Training"] == "Yes") * _PLACEMENT_TRAINING_BONUS
    )

    # ── Step 2: Gaussian noise ───────────────────────────────────────────
    # Prevents two students with identical profiles from always getting
    # identical outcomes.
    raw_score = raw_score + RNG.normal(0, _SCORE_NOISE_STD, N_STUDENTS)

    # ── Step 3: sigmoid -> smooth Placement Probability ──────────────────
    # Centered on the score distribution's own mean (minus a small offset)
    # rather than a fixed constant, so the overall placement rate lands in
    # a realistic ~55-65% range regardless of how the feature weights
    # above are tuned, instead of a hardcoded threshold silently producing
    # an unrealistically low or high base rate.
    center = raw_score.mean() - 4.0
    placement_probability = _sigmoid((raw_score - center) / 12)

    # ── Step 4: sample Placement_Status probabilistically (never a hard
    #    threshold on the probability). ──────────────────────────────────
    df[config.TARGET_COLUMN] = (
        RNG.uniform(0, 1, N_STUDENTS) < placement_probability
    ).astype(int)

    return df[config.REQUIRED_COLUMNS]


if __name__ == "__main__":
    dataset = generate()
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(config.DATA_PATH, index=False)

    placement_rate = dataset[config.TARGET_COLUMN].mean() * 100
    print(f"✅ Synthetic dataset written to {config.DATA_PATH}")
    print(f"   {len(dataset)} students | placement rate: {placement_rate:.1f}%")
    print("   Regenerate anytime with: python scripts/generate_dataset.py")
