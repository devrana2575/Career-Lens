"""
config.py
Single source of truth for paths, dataset schema, and model settings.

Nothing in this project should hardcode a path, column name, or
hyperparameter outside of this file — change it here and it propagates
everywhere.
"""

from pathlib import Path

# ── Project paths ────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

DATA_PATH = DATA_DIR / "placementdata.csv"

MODEL_PATH = MODELS_DIR / "placement_pipeline.pkl"
FEATURE_NAMES_PATH = MODELS_DIR / "feature_names.pkl"
TRANSFORMED_FEATURE_NAMES_PATH = MODELS_DIR / "transformed_feature_names.pkl"
METADATA_PATH = MODELS_DIR / "training_metadata.json"

# ── Dataset schema ───────────────────────────────────────────────────────
# These are the exact columns train_model.py and predict.py expect.
# Swap in a new dataset any time as long as it matches this schema and the
# widget metadata in feature_schema.py — nothing else in the pipeline
# needs to change.
#
# v2.1: mirrors the fields an actual university placement cell tracks per
# student — academic marks (SSC/HSC/CGPA), internship history (count +
# duration), projects, workshops/certifications, extracurricular
# involvement, placement training, and active backlogs. No self-rated
# fields (aptitude, communication, soft skills, etc.) and no subjective
# scores (resume ATS score, GitHub score, etc.) — see
# scripts/generate_dataset.py's module docstring for the exact
# feature-relationship and probability model used to assign placement
# outcomes.
STUDENT_ID_COLUMN = "Student_ID"

NUMERIC_FEATURES = [
    "CGPA",
    "SSC_Marks",
    "HSC_Marks",
    "Internship_Count",
    "Internship_Duration_Months",
    "Projects",
    "Workshops_Certifications",
    "Extracurricular_Activities",
    "Active_Backlogs",
]
CATEGORICAL_FEATURES = [
    "Placement_Training",
]
FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET_COLUMN = "Placement_Status"
# Student_ID is carried in the dataset for identification/display only —
# it is deliberately excluded from FEATURE_COLUMNS and never reaches the
# model (see preprocessing.split_features_target).
REQUIRED_COLUMNS = [STUDENT_ID_COLUMN] + FEATURE_COLUMNS + [TARGET_COLUMN]

# ── Dataset provenance (surfaced on the Dataset Explorer page / README) ──
DATASET_NAME = "Synthetic Placement Dataset (probability-weighted)"
DATASET_SOURCE_URL = None
DATASET_IS_SYNTHETIC = True

# ── Train/test split & reproducibility ───────────────────────────────────
RANDOM_STATE = 42
TEST_SIZE = 0.2

# ── Model hyperparameters (RandomForestClassifier) ───────────────────────
# These are fallback defaults only. train_model.py runs
# src/hyperparameter_tuning.py (RandomizedSearchCV) against the actual
# training data on every run and uses *those* params for the deployed
# model — see HYPERPARAMETER_SEARCH_SPACE below. RF_PARAMS is what's used
# if tuning is skipped (e.g. by candidate models other than the deployed
# one in model_comparison.py's transparency table).
RF_PARAMS = {
    "n_estimators": 400,
    "max_depth": 12,
    "min_samples_split": 4,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}

# Search space for RandomizedSearchCV over the deployed Random Forest.
# Keys match RandomForestClassifier constructor arguments directly.
HYPERPARAMETER_SEARCH_SPACE = {
    "n_estimators": [200, 300, 400, 500, 600],
    "max_depth": [6, 8, 10, 12, 16, None],
    "min_samples_split": [2, 4, 6, 10],
    "min_samples_leaf": [1, 2, 4, 6],
    "max_features": ["sqrt", "log2"],
}
HYPERPARAMETER_SEARCH_ITER = 15
HYPERPARAMETER_SEARCH_CV_FOLDS = 3

# ── Baseline candidates cross-validated for a transparency table ────────
# train_model.py cross-validates Logistic Regression, Decision Tree,
# Gradient Boosting, and Random Forest via src/model_comparison.py and
# displays the results in the app, but Random Forest is the fixed
# production model (see model_comparison.DEPLOYED_MODEL_NAME) — the
# comparison exists to make that choice auditable, not to re-derive it
# each run.
LOGISTIC_REGRESSION_PARAMS = {
    "max_iter": 1000,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
}
DECISION_TREE_PARAMS = {
    "max_depth": 5,
    "min_samples_split": 6,
    "min_samples_leaf": 3,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
}
GRADIENT_BOOSTING_PARAMS = {
    "n_estimators": 200,
    "learning_rate": 0.05,
    "max_depth": 3,
    "subsample": 0.9,
    "random_state": RANDOM_STATE,
}

# Metric highlighted in the model-comparison table/rationale. Does not
# control which model is deployed — that's fixed to Random Forest.
PRIMARY_COMPARISON_METRIC = "roc_auc"
CV_FOLDS = 5

# ── Prediction behaviour ─────────────────────────────────────────────────
# A student is classified "Placed" when predicted probability >= this value.
PLACEMENT_THRESHOLD = 50.0

# ── Logging ───────────────────────────────────────────────────────────────
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

# ── Branding / app metadata ──────────────────────────────────────────────
# Single source of truth for product naming and version numbers so app.py,
# the sidebar, and README never hardcode these separately.
APP_NAME = "Placement Intelligence"
PROJECT_VERSION = "2.4.0"
MODEL_VERSION = "3.0.0"

# ── Author / footer links ────────────────────────────────────────────────
# Used only by utils.ui.footer(). Update these values with your own
# details before publishing/deploying — they're placeholders.
AUTHOR_NAME = "Dev Rana"
AUTHOR_TAGLINE = "AI-powered Placement Prediction & Career Readiness Platform"
AUTHOR_GITHUB_URL = "https://github.com/devrana2575"
AUTHOR_LINKEDIN_URL = "https://www.linkedin.com/in/devrana2575"
AUTHOR_EMAIL = "devrana2575@gmail.com"
