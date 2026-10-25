# Data attribution and provenance

Source: FiveThirtyEight, Historical NBA Elo, https://github.com/fivethirtyeight/data/tree/master/nba-elo

Original CSV: https://raw.githubusercontent.com/fivethirtyeight/data/master/nba-elo/nbaallelo.csv

Downloaded: 25 October 2026. Exact snapshot SHA-256 is pinned in scripts/prepare_data.py and public/data/manifest.json. The original CSV is retained unchanged in data/raw/.

Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/. The source repository states datasets use this licence unless otherwise noted: https://github.com/fivethirtyeight/data. FiveThirtyEight credits Basketball-Reference.com for game information. No endorsement is implied.

Changes: selected NBA regular-season games for seasons ending 2013, 2014 and 2015; merged both team perspectives into one game; converted dates to ISO format and numeric fields to numbers; retained published Elo values and franchise identifiers. Neutral-site games retain their neutralSite flag; home/away fields designate the schedule sides for these games, not home-court advantage. Historical abbreviations are preserved, including NOH/NOP and CHA/CHO.

Known coverage exception: Boston and Indiana each played 81 games in 2012–13. Their April 16 game was cancelled and not rescheduled: https://pr.nba.com/pacers-celtics-game-canceled/.

Display attribution in the dashboard: “Data: FiveThirtyEight, Historical NBA Elo (CC BY 4.0). Filtered and transformed for this dashboard.” Link to the source, licence and transformation notes.
