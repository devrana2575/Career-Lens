# 🎓 Placement Intelligence

A Machine Learning web application that predicts a student's placement probability, explains the factors influencing the prediction, and provides personalized recommendations to improve placement readiness.

Built with **Python, Scikit-learn, Streamlit, Pandas, NumPy, and Plotly**.

---

## 🚀 Features

- Predicts student placement probability using a trained Random Forest model
- Displays an overall Career Readiness Score
- Explains prediction using feature importance analysis
- Generates personalized improvement recommendations
- Interactive analytics dashboard
- Model Evaluation page with:
  - Confusion Matrix
  - ROC Curve
  - Precision-Recall Curve
  - Classification Report
  - Model Comparison
- Dataset Explorer with visual analytics
- Responsive Streamlit interface

---

## 🛠 Tech Stack

| Category | Technologies |
|----------|--------------|
| Language | Python |
| Machine Learning | Scikit-learn |
| Web Framework | Streamlit |
| Data Processing | Pandas, NumPy |
| Visualization | Plotly |
| Model Storage | Joblib |

---

## 🧠 Machine Learning Workflow

```
Dataset
      │
      ▼
Data Validation
      │
      ▼
Preprocessing
      │
      ▼
Feature Engineering
      │
      ▼
Model Training
(Random Forest)
      │
      ▼
Model Evaluation
      │
      ▼
Prediction & Analytics
```

---

## 📊 Input Features

The model predicts placement using objective academic and experience-related attributes:

- CGPA
- SSC Marks
- HSC Marks
- Internship Count
- Internship Duration
- Projects
- Workshops / Certifications
- Placement Training
- Extracurricular Activities
- Active Backlogs

---

## 📈 Model Performance

| Metric | Score |
|---------|-------|
| Accuracy | 70.8% |
| Precision | 72.3% |
| Recall | 76.7% |
| F1 Score | 74.5% |
| ROC-AUC | 0.774 |

---

## 📂 Project Structure

```
placement_ai/
│
├── app.py
├── data/
├── models/
├── pages/
├── src/
├── utils/
├── scripts/
├── notebooks/
├── assets/
├── requirements.txt
└── README.md
```

---

## ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/devrana2575/placement-intelligence.git
```

Move into the project

```bash
cd placement_ai
```

Create virtual environment

```bash
python -m venv venv
```

Activate environment

**Windows**

```bash
venv\Scripts\activate
```

**Linux / macOS**

```bash
source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

## ▶️ Run the Application

```bash
streamlit run app.py
```

## 💡 Key Highlights

- End-to-end Machine Learning pipeline
- Modular project architecture
- Explainable AI using feature importance
- Interactive Streamlit dashboard
- Clean and reusable codebase
- Production-ready project structure

---

## 🔮 Future Improvements

- SHAP-based explainability
- Prediction history
- User authentication
- Database integration
- REST API deployment
- Real-world dataset integration

---

## 👨‍💻 Author

**Dev Rana**

GitHub: https://github.com/devrana2575

LinkedIn: https://linkedin.com/in/devrana2575

---

## 📄 License

This project is licensed under the MIT License.