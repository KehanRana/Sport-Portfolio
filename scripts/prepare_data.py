"""Validate and prepare the pinned FiveThirtyEight NBA snapshot (Python stdlib)."""
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/raw/nbaallelo.csv'
OUT = ROOT / 'public/data'
EXPECTED = {2013: 1229, 2014: 1230, 2015: 1230}
SHA256 = 'd46ed3540ee8d9eca31b3e94cc8c777e0be5156173d814ebf65b8195e8d616bc'


def prepare():
    raw = SOURCE.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA256:
        raise ValueError('Source checksum mismatch; review snapshot before updating the pin')
    with SOURCE.open(newline='') as stream:
        rows = list(csv.DictReader(stream))
    selected = [r for r in rows if r['lg_id'] == 'NBA'
                and r['is_playoffs'] == '0' and int(r['year_id']) in EXPECTED]
    grouped = defaultdict(list)
    for row in selected:
        grouped[row['game_id']].append(row)
    seasons = defaultdict(list)
    for game_id, pair in grouped.items():
        if len(pair) != 2 or {r['_iscopy'] for r in pair} != {'0', '1'}:
            raise ValueError(f'{game_id}: expected two opposing source rows')
        home = next((r for r in pair if r['game_location'] == 'H'), None)
        away = next((r for r in pair if r['game_location'] == 'A'), None)
        neutral = all(r['game_location'] == 'N' for r in pair)
        if neutral:
            home = next((r for r in pair if r['team_id'] == game_id[-3:]), None)
            away = next((r for r in pair if r is not home), None)
        if home is None or away is None:
            raise ValueError(f'{game_id}: invalid home/away pair')
        for a, b in ((home, away), (away, home)):
            if (a['team_id'] != b['opp_id'] or a['pts'] != b['opp_pts']
                    or a['date_game'] != b['date_game'] or a['year_id'] != b['year_id']):
                raise ValueError(f'{game_id}: inconsistent opposing records')
        date = datetime.strptime(home['date_game'], '%m/%d/%Y').date().isoformat()
        season = int(home['year_id'])
        teams = []
        for row in (home, away):
            score = int(row['pts'])
            before, after = float(row['elo_i']), float(row['elo_n'])
            if score < 0 or not all(math.isfinite(x) for x in (before, after)):
                raise ValueError(f'{game_id}: invalid score/rating')
            teams.append({'id': row['team_id'], 'franchise': row['fran_id'],
                          'score': score, 'eloBefore': before, 'eloAfter': after})
        if teams[0]['score'] == teams[1]['score']:
            raise ValueError(f'{game_id}: tied final NBA score')
        if abs(sum(t['eloAfter'] - t['eloBefore'] for t in teams)) > .01:
            raise ValueError(f'{game_id}: non-conserving Elo update')
        seasons[season].append({'id': game_id, 'date': date, 'season': season,
                                'neutralSite': neutral, 'home': teams[0], 'away': teams[1]})
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = {}
    summaries = []
    for season, expected in EXPECTED.items():
        games = sorted(seasons[season], key=lambda g: (g['date'], g['id']))
        counts = Counter(t['id'] for g in games for t in (g['home'], g['away']))
        if len(games) != expected or len(counts) != 30:
            raise ValueError(f'{season}: unexpected coverage')
        for team, count in counts.items():
            target = 81 if season == 2013 and team in {'BOS', 'IND'} else 82
            if count != target:
                raise ValueError(f'{season}/{team}: expected {target}, got {count}')
        label = f'{season - 1}-{str(season)[2:]}'
        outputs[f'{label}.json'] = {'schemaVersion': 1, 'season': label, 'games': games}
        summaries.append({'season': label, 'file': f'{label}.json', 'games': len(games),
                          'teams': len(counts), 'start': games[0]['date'], 'end': games[-1]['date'],
                          'teamGameCounts': dict(sorted(counts.items()))})
    outputs['manifest.json'] = {
        'schemaVersion': 1, 'source': 'FiveThirtyEight Historical NBA Elo',
        'sourceUrl': 'https://github.com/fivethirtyeight/data/tree/master/nba-elo',
        'sourceSha256': digest, 'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'model': 'Published FiveThirtyEight Elo; not a locally fitted model',
        'datePrecision': 'day', 'sourceRows': len(rows), 'selectedRows': len(selected),
        'uniqueGames': len(grouped), 'seasons': summaries,
        'notes': ['Regular season NBA only; opposing rows merged into one game.',
                  '2012-13 BOS and IND each played 81 games due to an official cancellation.',
                  'Historical snapshot; do not present as current NBA data.']}
    # Write only after all selected seasons pass validation.
    for filename, content in outputs.items():
        (OUT / filename).write_text(json.dumps(content, separators=(',', ':'), allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'games': len(grouped), 'seasons': summaries}, indent=2))


if __name__ == '__main__':
    prepare()
