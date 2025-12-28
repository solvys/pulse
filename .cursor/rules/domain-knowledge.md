# Pulse Knowledge Base & Domain Rules

## Trading & Market Logic
- **Domain Expert**: Price
- **Focus**: Market analysis, IV scoring, trading strategies.

## Knowledge Base Structure
Local knowledge is stored in `/knowledge-base/`:
- `platform/`: Internal platform architecture.
- `risk-management/`: Rules for capital protection and trade sizing.
- `strategies/`: Specific trading algorithms and models (e.g., 22 VIX Fix).
- `trading-psychology/`: Emotional resonance and tilt prevention rules.

## IV Scoring (Industry Standard)
- Utilize Gemini API for IV reasoning.
- Incorporate economic news and industry-standard volatility matrices.

## Psychological Safeguards (PsychAssist)
- Detect yelling/loud voice (-1.3 penalty).
- Detect curse words (-0.7 penalty per word).
- Batch penalty (-5.0 for 3+ curse words).
- Tilt warning: Two infractions triggers "Step away from the set".
