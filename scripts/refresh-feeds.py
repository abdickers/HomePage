"""Download public RSS feeds to a browser-readable snapshot; keep last good data on failure."""
import datetime
import email.utils
import json
from pathlib import Path
import urllib.request
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

FEEDS = {
    'fox': 'https://moxie.foxnews.com/google-publisher/latest.xml',
    'wowhead': 'https://www.wowhead.com/news/rss/all',
}
DEST = Path(__file__).resolve().parents[1] / 'data' / 'news.json'


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'SageHomepage/1.0 (public RSS reader)', 'Accept': 'application/rss+xml, application/xml, text/xml'})
    with urllib.request.urlopen(request, timeout=25) as response:
        body = response.read(5_000_001)
    if len(body) > 5_000_000:
        raise ValueError('RSS feed exceeds 5 MB')
    root = ET.fromstring(body)
    items = []
    for item in root.findall('./channel/item'):
        title, link = item.findtext('title', '').strip(), item.findtext('link', '').strip()
        if not title or urlparse(link).scheme not in ('http', 'https'):
            continue
        date = item.findtext('pubDate', '')
        try:
            date = email.utils.parsedate_to_datetime(date).isoformat()
        except (TypeError, ValueError):
            date = ''
        items.append({'title': title, 'link': link, 'pubDate': date})
        if len(items) == 4:
            break
    if not items:
        raise ValueError('Feed contained no usable items')
    return items


def main():
    try:
        saved = json.loads(DEST.read_text(encoding='utf-8'))
    except (FileNotFoundError, ValueError):
        saved = {'feeds': {}}
    successful = 0
    for key, url in FEEDS.items():
        try:
            items = download(url)
            saved['feeds'][key] = {'items': items, 'updated': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            print(f'{key}: refreshed {len(items)} items')
            successful += 1
        except Exception as error:
            print(f'{key}: keeping previous snapshot ({type(error).__name__})')
    if not successful:
        raise SystemExit('All RSS feeds failed; existing snapshots were preserved.')
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(saved, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
