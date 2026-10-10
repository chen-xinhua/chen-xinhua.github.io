# Updating News

Add entries to `news.json` in reverse chronological order. Keep entries with only a year before dated entries in that year, since their month is unspecified.

Always set `category` to an existing category. The renderer in `script.js` uses this field to assign the icon and color consistently, independent of entry position.

| Category | News | Icon |
| --- | --- | --- |
| `review` | Reviewer invitations and academic reviewing | Clipboard with check |
| `education` | Starting a degree or educational program | Graduation cap |
| `honor` | Awards and graduation honors | Medal |
| `internship` | Starting an internship at any institution | Briefcase |
| `publication` | Paper acceptances | Document with check |
| `update` | Other updates | Information circle |

Use `content` for the message, with `<strong>` around the main milestone or institution when appropriate. Use `links` for optional links. The homepage shows the latest three entries and expands the remaining entries in place with View All.
