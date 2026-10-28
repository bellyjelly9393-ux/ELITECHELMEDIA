# VOD spending limit

Set `VOD_MAX_AI_USD_PER_GAME=1.50` to enable prospective, persistent per-review
USD accounting. It spans worker jobs, retries, reanalysis and restarts. Creating
a different review creates a different allowance. Historical charges before
activation cannot be reconstructed and are not included.

Budgeted requests use Gemini AI Studio native generateContent. Before every
generation, countTokens measures the complete request. The worker atomically
reserves input cost with a 20% + 1024-token margin and the full output cap,
including thinking. Successful usage settles the reservation at standard list
rates without cache discounts. Missing usage or uncertain network failures keep
the reservation. No startup AI probe runs outside the ledger. Missing counts,
database failures, unsupported models, and expired prices stop paid requests.

Recommended economy configuration:

```
VOD_MAX_AI_USD_PER_GAME=1.50
VOD_MODEL_BASIC=gemini/gemini-3.8-flash
VOD_MODEL_DEEP=gemini/gemini-3.8-flash
VOD_MODEL_FALLBACK=gemini/gemini-3.8-flash
GEMINI_DEEP_THINKING=LOW
```

This retains the hockey prompts, selected closer looks, period reports and game
synthesis. It removes automatic escalation to Argon. Free models are not silently
enabled: unknown pricing/provider routes fail closed until explicitly supported.

`/health` reports the configured cap and routing. `VOD AI cost` logs report
estimated call cost and the game's total used/reserved USD. Provider invoices are
authoritative: this is an application-side reservation limit, not an account-wide
billing limit. Hosting, tax, unrelated apps and prior charges are excluded.
Pricing is dated in spend_budget.py and must be reverified before expiry.
