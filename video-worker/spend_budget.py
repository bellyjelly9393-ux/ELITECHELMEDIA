"""Persistent USD reservations. Unknown prices and uncertain calls fail closed.

Rates: https://ai.google.dev/gemini-api/docs/pricing (standard paid tier).
Provider invoices remain authoritative; taxes and hosting are outside this cap.
"""
import datetime
import math
from decimal import Decimal
from uuid import uuid4


def rates(model, today=None):
    today = today or datetime.datetime.now(datetime.timezone.utc).date()
    prices = {
        'gemini/gemini-3.8-flash': (0.75, 3.75, datetime.date(2026, 12, 31)),
        'gemini/gemini-4-argon': (2.0, 10.0, datetime.date(2026, 11, 30)),
    }
    if model not in prices or today > prices[model][2]:
        raise ValueError('Model pricing is unknown or expired; analysis paused before spending.')
    return prices[model][:2]


def reserve(connect, scope, model, input_tokens, output_cap, limit_usd):
    incoming, outgoing = rates(model)
    if not scope or input_tokens < 0 or output_cap <= 0:
        raise ValueError('Cannot establish this game’s AI spending reservation.')
    # Extra margin covers differences in provider token counting. No tools or
    # external grounding are enabled on budgeted requests.
    held = math.ceil((math.ceil(input_tokens * 1.2) + 1024) * incoming + output_cap * outgoing)
    limit = int(Decimal(str(limit_usd)) * 1000000)
    reservation = str(uuid4())
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        used = db.execute('SELECT COALESCE(SUM(microusd),0) FROM ai_spend WHERE scope=?', (scope,)).fetchone()[0]
        if used + held > limit:
            raise ValueError(f'Game AI budget reached: ${used/1000000:.2f} used/reserved of ${limit/1000000:.2f}. Saved work is kept.')
        db.execute('INSERT INTO ai_spend VALUES (?,?,?,?,?,?)',
                   (reservation, scope, model, held, incoming, outgoing))
    return reservation


def settle(connect, reservation, usage):
    # A timeout, missing usage, or malformed response retains the full reservation.
    if not isinstance(usage, dict):
        return
    tokens_in, tokens_out = usage.get('input_tokens'), usage.get('output_tokens')
    if (not isinstance(tokens_in, int) or not isinstance(tokens_out, int)
            or tokens_in < 0 or tokens_out < 0):
        return
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT input_rate,output_rate FROM ai_spend WHERE id=?', (reservation,)).fetchone()
        if row is None:
            raise ValueError('AI spending reservation was lost.')
        charged = math.ceil(tokens_in * row[0] + tokens_out * row[1])
        db.execute('UPDATE ai_spend SET microusd=? WHERE id=?', (charged, reservation))
        scope = db.execute('SELECT scope FROM ai_spend WHERE id=?', (reservation,)).fetchone()[0]
        used = db.execute('SELECT SUM(microusd) FROM ai_spend WHERE scope=?', (scope,)).fetchone()[0]
    print(f'VOD AI cost: game={scope} estimated_usd={charged/1000000:.6f} game_used_reserved_usd={used/1000000:.6f}', flush=True)
