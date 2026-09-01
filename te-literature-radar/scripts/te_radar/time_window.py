from __future__ import annotations

from dataclasses import dataclass
import datetime as dt

UTC = dt.timezone.utc


@dataclass(frozen=True)
class SearchWindow:
    mode: str
    start: dt.datetime
    end: dt.datetime
    advance_auto_state: bool


def _aware(value: dt.datetime) -> dt.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _parse_boundary(value: str, *, end_of_day: bool = False) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"invalid ISO date/time: {value}") from exc
    if len(value) == 10:
        parsed = parsed.replace(
            hour=23 if end_of_day else 0,
            minute=59 if end_of_day else 0,
            second=59 if end_of_day else 0,
            microsecond=999999 if end_of_day else 0,
        )
    return _aware(parsed)


def resolve_search_window(
    config,
    state,
    *,
    mode=None,
    lookback_days=None,
    start_date=None,
    end_date=None,
    now=None,
    advance_auto_state=False,
):
    now = _aware(now or dt.datetime.now(UTC))
    search = config.get("search", {})
    mode = mode or search.get("mode", "auto")

    if mode == "auto":
        if any(value is not None for value in (lookback_days, start_date, end_date)):
            raise ValueError("auto mode cannot use lookback/range arguments")
        last = state.get("last_success_utc")
        if last:
            boundary = _parse_boundary(last)
            start = boundary - dt.timedelta(hours=int(search.get("overlap_hours", 48)))
        else:
            start = now - dt.timedelta(days=int(search.get("first_run_lookback_days", 7)))
        return SearchWindow("auto", start, now, True)

    if mode == "lookback":
        if start_date is not None or end_date is not None:
            raise ValueError("lookback mode cannot use range dates")
        days = int(lookback_days if lookback_days is not None else search.get("lookback_days", 7))
        if days <= 0:
            raise ValueError("lookback_days must be positive")
        return SearchWindow("lookback", now - dt.timedelta(days=days), now, bool(advance_auto_state))

    if mode == "range":
        if lookback_days is not None or not start_date or not end_date:
            raise ValueError("range mode requires start_date and end_date only")
        start = _parse_boundary(start_date)
        end = _parse_boundary(end_date, end_of_day=True)
        if end < start:
            raise ValueError("end_date must not precede start_date")
        return SearchWindow("range", start, end, bool(advance_auto_state))

    raise ValueError(f"unsupported search mode: {mode}")
