"""Refresh public Google Scholar statistics; never overwrite a good cache on failure."""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess

PROFILE = 'https://scholar.google.com/citations?user=9-QFSy4AAAAJ&hl=en'
OUTPUT = Path(__file__).resolve().parents[1] / 'site' / 'data' / 'citations.json'


class ScholarStats(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_stats = False
        self.cell = None
        self.values = []
        self.name = None
        self.profile_name = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table' and attrs.get('id') == 'gsc_rsb_st':
            self.in_stats = True
        if self.in_stats and tag == 'td' and 'gsc_rsb_std' in attrs.get('class', '').split():
            self.cell = ''
        if attrs.get('id') == 'gsc_prf_in':
            self.name = tag

    def handle_data(self, text):
        if self.cell is not None:
            self.cell += text
        if self.name:
            self.profile_name += text

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.values.append(self.cell.strip().replace(',', ''))
            self.cell = None
        if tag == 'table':
            self.in_stats = False
        if tag == self.name:
            self.name = None


def parse_stats(html):
    parser = ScholarStats()
    parser.feed(html)
    if parser.profile_name.strip() != 'Xinhua Chen':
        raise ValueError('Scholar profile identity could not be verified')
    if len(parser.values) < 6 or not all(value.isdecimal() for value in parser.values[:6]):
        raise ValueError('Scholar statistics missing; the response may be a challenge or error page')
    return {
        'totalCitations': int(parser.values[0]),
        'hIndex': int(parser.values[2]),
        'i10Index': int(parser.values[4]),
        'profileUrl': PROFILE,
        'updatedAt': datetime.now(timezone.utc).isoformat(),
    }


def refresh(html=None):
    if html is None:
        response = subprocess.run(
            ['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '25',
             '--user-agent', 'Mozilla/5.0', PROFILE],
            check=True, capture_output=True, text=True, timeout=30,
        )
        html = response.stdout
    stats = parse_stats(html)
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(stats, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUTPUT)
    print(f"Google Scholar: {stats['totalCitations']} total citations; updated {stats['updatedAt']}")
    return stats


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--html', type=Path, help='Parse an already retrieved Scholar response')
    args.add_argument('--keep-on-error', action='store_true')
    options = args.parse_args()
    try:
        refresh(options.html.read_text(encoding='utf-8') if options.html else None)
    except Exception as error:
        if not options.keep_on_error or not OUTPUT.exists():
            raise
        print(f'Citation refresh failed; keeping the last successful snapshot: {error}')
