# Monster Hunter Website Scraper

Launches a webservice on port 8081 which requests the website https://teambrg.com/monster-hunter-world/mhw-monster-elemental-weakness-table/ and scrapes the elemental weakness table from it, then filters the data for a given monster. The scraped data gets transformed into a json response.

## Installation
### Requirements:
- Node 12.10 or higher
- npm installed

### Installation Steps
1. Clone the repo
2. `cd` into the repo and run `npm install` to install the required node dependency packages for the project
3. run `node index.js` to launch the webserver
4. The webserver should now respond at `http://localhost:8081/scrape/{monster_name}`

## Response Model
```json
{
    "monster": "name of the monster",
    "elementWeakness" : {
        "fire": "value(mudeffected)",
        "water": "value(mudeffected)",
        "thunder": "value(mudeffected)",
        "ice": "value(mudeffected)",
        "dragon": "value(mudeffected)",
        "poison": "value(mudeffected)",
        "sleep": "value(mudeffected)",
        "paralysis": "value(mudeffected)",
        "blast": "value(mudeffected)",
        "stun": "value(mudeffected)"
    },
    "weakPoints" : [""],
    "breakableParts" : [""],
    "severable" : false
}
```