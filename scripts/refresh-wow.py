"""Refresh public Wowhead US snapshots. Preserve each edition on upstream failure."""
import datetime as dt
import json
from pathlib import Path
import re
import urllib.request

DEST = Path(__file__).resolve().parents[1] / 'data' / 'wow.json'
SOURCES = {'retail': 'https://www.wowhead.com/today-in-wow', 'forever': 'https://www.wowhead.com/forever/events'}


def extract(html, identifier):
    match = re.search(r'<script[^>]*id="' + re.escape(identifier) + r'"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError('Source schema changed')
    return json.loads(match[1])


def normalize(edition, html):
    if edition == 'retail':
        sections = extract(html, 'data.wow.todayInWow')
        groups = [g for s in sections if s.get('regionId') == 'US' and s['id'] in ('events-and-rares', 'dungeons-and-raids', 'quests') for g in s['groups'] if g['type'] == 'lines' and g['id'] not in ('season-caps', 'tww-notable-world-quests')]
        if not groups:
            raise ValueError('No US event groups')
        return {'groups': groups}
    views = extract(html, 'data.page.listPage.listviews')
    events = [e for v in views for e in v.get('data', []) if e.get('name') and not e['name'].startswith('[#')]
    if not events:
        raise ValueError('No Forever calendar')
    # Source supplies calendar strings without an explicit timezone. Keep date-only
    # ranges rather than inventing exact reset/spawn timestamps.
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    rows = []
    for event in events:
        for occurrence in event.get('occurrences', []):
            start, end = occurrence['start'][:10].replace('/', '-'), occurrence['end'][:10].replace('/', '-')
            if end >= today:
                rows.append({'name': event['name'], 'startDate': start, 'endDate': end, 'url': 'https://www.wowhead.com/forever/event=' + str(event['id'])})
    return {'events': sorted(rows, key=lambda r: r['startDate'])[:60]}


def main():
    try:
        saved = json.loads(DEST.read_text())
    except (FileNotFoundError, ValueError):
        saved = {}
    success = 0
    for edition, url in SOURCES.items():
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'SageHomepage/1.0 (public event reader)'})
            with urllib.request.urlopen(req, timeout=25) as response:
                body = response.read(5_000_001)
            if len(body) > 5_000_000:
                raise ValueError('Source too large')
            snapshot = normalize(edition, body.decode('utf-8'))
            saved[edition] = {**snapshot, 'source': url, 'updated': dt.datetime.now(dt.timezone.utc).isoformat()}
            success += 1
            print(edition + ': refreshed public events')
        except Exception as error:
            print(edition + ': previous snapshot preserved (' + type(error).__name__ + ')')
    if not success:
        raise SystemExit('All event sources failed')
    DEST.write_text(json.dumps(saved, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
