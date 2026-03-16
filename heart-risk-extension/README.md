# Heart Marker Risk Tracker

A Microsoft Edge browser extension proof of concept for tracking three cardiovascular biomarkers over time:

- ApoB
- Lipoprotein(a) or Lp(a)
- hs-CRP

The tool calculates a simple educational weighted biomarker risk score, stores historical assessments locally in the browser, and displays risk trends over time.

## Important Disclaimer

This project is for:

- Educational use
- Research prototype use
- Personal biomarker tracking

This project is **not**:

- Medical advice
- A medical device
- A diagnostic tool
- A validated predictor of heart attack or stroke
- A substitute for clinician assessment

The score does **not** include many important clinical factors such as:

- Age
- Sex
- Blood pressure
- Smoking
- Diabetes
- Kidney function
- Family history
- Medications
- Imaging such as coronary artery calcium
- Prior cardiovascular disease

## Features

- Enter and track:
  - ApoB
  - Lp(a)
  - hs-CRP
  - Test date
  - Notes
- Calculate a simple weighted score from 0 to 100
- Assign a biomarker risk band
- Compare current result to the previous saved result
- Track historical assessments over time
- View score trend on a dashboard
- Export local data to CSV
- Store all data locally in the browser using extension storage

## Scoring Model

This proof-of-concept uses a simple weighted scoring approach:

- ApoB: 50%
- Lp(a): 30%
- hs-CRP: 20%

### Marker point bins

#### ApoB

- Less than 70: 0 points
- 70 to 89: 1 point
- 90 to 109: 2 points
- 110 to 129: 3 points
- 130 or higher: 4 points

#### Lp(a) in mg/dL

- Less than 30: 0 points
- 30 to 49: 1 point
- 50 to 99: 2 points
- 100 to 149: 3 points
- 150 or higher: 4 points

#### Lp(a) in nmol/L

- Less than 75: 0 points
- 75 to 124: 1 point
- 125 to 249: 2 points
- 250 to 374: 3 points
- 375 or higher: 4 points

#### hs-CRP in mg/L

- Less than 1.0: 0 points
- 1.0 to 2.9: 1 point
- 3.0 to 4.9: 2 points
- 5.0 to 9.9: 3 points
- 10.0 or higher: 4 points

### Weighted score formula

Raw score:

$0.50 * ApoBPoints + 0.30 * Lp(a)Points + 0.20 * hsCRPPoints$

Normalized score:

$(RawScore / 4.0) * 100$

### Risk bands

- 0 to 19: Low biomarker risk
- 20 to 39: Mildly elevated biomarker risk
- 40 to 59: Moderate biomarker risk
- 60 to 79: High biomarker risk
- 80 to 100: Very high biomarker risk

## Project Structure

```plaintext
heart-risk-extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── options.html
├── options.css
├── options.js
├── background.js
├── scoring.js
├── storage.js
├── charts.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png