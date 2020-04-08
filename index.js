// 1. Launch Web Server
// 2. Visit URL on our server that activates the web scraper
// 3. the scraper will make a request to the website we want to scrape
// 4. the request will capture the HTML of the website and pass it along to our server
// 5. we will traverse the DOM and extract the information we want
// 6. next we will format the extracted data into a format we need
// 7. finally we will save this formatted data into a json file on our machine

var express = require('express')
var fs = require('fs')
var request = require('request')
var cheerio = require('cheerio')
var app = express()

var MongoClient = require('mongodb').MongoClient
const mongoDBName = "monsterdb"
const mongoMonsterCollectionName = "monsters"
const mongoMonsterNamesCollectionName = "monsterNames"
var mongoURL = "mongodb://localhost:27017/"

MongoClient.connect(mongoURL, function (err, db) {
    if (err) throw err

    var dbo = db.db(mongoDBName)
    if (!dbo) {
        MongoClient.connect(`${mongoURL}${mongoDBName}`, function (err, db) {
            if (err) throw err

            console.log("Database Created!")

            db.createCollection(mongoMonsterCollectionName, function (err, res) {
                if (err) throw err

                console.log("Collection created!")
                db.close()
            })
        })
    } else {
        console.log("Got already a database")
        db.close()
    }
})

// scrape the websites table with the monster weaknesses
function scrapeFor(requestedMonster, res) {
    // the URL we will scrape from - in our example teambrg
    // https://teambrg.com/monster-hunter-world/mhw-monster-elemental-weakness-table/
    const url = 'https://teambrg.com/monster-hunter-world/mhw-monster-elemental-weakness-table/'

    // the structure of our request call
    // the first parameter is the url
    // the callback function takes 3 paramters, an error, reponse status code, and the html
    request(url, function (error, responsecode, html) {
        // first we check to make sure no errors occured when making the request
        if (!error) {
            // next we'll utilize the cheerio library on the returned html which will essentially give us qQueury functionality
            var $ = cheerio.load(html);

            // define the variables were going to capture
            const tdPropertyOrder = ["monster", "fire", "water", "thunder", "ice", "dragon", "poison", "sleep", "paralysis", "blast", "stun"]

            // create an array for the resulting monsters
            var monsters = []

            // keep a reference of all the names
            // we just want a list of all monster names which we use later for some processing
            var filteredMonsterNames = []

            // we'll use the uniqe header class row-hover as a starting point for scraping.
            // this will give us an table object
            $('.row-hover').filter(function () {
                // lets store the data we filtered into a variable so we can easily see whats going on
                // this should be an table
                var data = $(this)
                // console.log(data)

                // because data should be an table we can loop over its children table rows <tr> 
                data.children().each(function (i, tableRow) {

                    // for each row create a new monster dict object because one row defines one monster
                    // console.log(tableRow)
                    var monster = {
                        monster: "",
                        fire: "",
                        water: "",
                        thunder: "",
                        ice: "",
                        dragon: "",
                        poison: "",
                        sleep: "",
                        paralysis: "",
                        blast: "",
                        stun: ""
                    }

                    // one row contains many <td> which hold the actual text
                    // the order should be the same as the order of tdPropertyOrder
                    // means we can reference over tablerow.children[i] == tdPropertyOrder[i] the corresponing name for the td value
                    $(tableRow).children().each(function (i, td) {
                        // set the i property of the monster to the td's text
                        // i 0 = monstername
                        // i 1 = fire weakness and so on
                        // console.log(properties[i]+ ": " + $(td).text())
                        monster[tdPropertyOrder[i]] = $(td).text()
                    })

                    // add monster to monsters
                    monsters.push(monster)

                    // check if the monster names array already contains this monster name
                    if (!filteredMonsterNames.includes(monster.monster)) {
                        filteredMonsterNames.push(monster.monster)
                    }
                })

                // console.log(monsters)
                console.log(filteredMonsterNames)

                // we want to save the filtered names extra
                // so we get a monster name collection
                // MongoClient.connect(mongoURL, function(err, db) {
                //     if (err) throw err

                //     var dbo = db.db(mongoDBName)
                //     dbo.collection(mongoMonsterNamesCollectionName).insertMany(filteredMonsterNames, function(err, res) {
                //         db.close()
                //     })
                // })

                var resultModels = []
                // filter the fetched table of monsters
                filteredMonsterNames.forEach(monstername => {
                    const monsterToFilter = monstername
                    // console.log(monsterToFilter)

                    // maybe they appear more often. thats because some rows are for breakable, severable and weakpoints
                    var searchResults = []
                    // console.log(monsters)
                    monsters.forEach(child => {
                        if (child.monster.toLowerCase() == monsterToFilter.toLowerCase()) {
                            searchResults.push(child)
                        }
                    })

                    if (searchResults.length == 0) {
                        return res.send("Error")
                    }

                    // the results seem not to be more than 4
                    // if there are 4 than it must mean its tail is severable
                    // create one reponse json from all filtered Results now
                    var resultModel = {
                        monster: searchResults[0].monster,
                        elementWeakness: {
                            fire: "",
                            water: "",
                            thunder: "",
                            ice: "",
                            dragon: "",
                            poison: "",
                            sleep: "",
                            paralysis: "",
                            blast: "",
                            stun: ""
                        },
                        weakPoints: [],
                        breakableParts: [],
                        severable: false
                    }

                    // setup the result Model with the filteredSearch Results
                    searchResults.forEach(element => {
                        if (element.fire === 'Weak point') {
                            // setup the weakpoints array
                            // loop overall keys in the element
                            // if its value is not empty or whitespace add it to the weakpoints array
                            pushElementKeyValuesInto(resultModel.weakPoints, element)
                            resultModel.weakPoints.shift()
                        } else if (element.fire === 'Breakable') {
                            // setup breakable parts array
                            pushElementKeyValuesInto(resultModel.breakableParts, element)
                            resultModel.breakableParts.shift()
                        } else if (element.fire === 'Severable') {
                            // setup severable true
                            resultModel.severable = true
                        } else {
                            // it must be the element weakness result element
                            // setup elemental weakness dict
                            for (const key in resultModel.elementWeakness) {
                                if (resultModel.elementWeakness.hasOwnProperty(key)) {
                                    resultModel.elementWeakness[key] = element[key];
                                }
                            }
                        }
                    })

                    resultModels.push(resultModel)

                    // set it in the db
                    MongoClient.connect(mongoURL, function (err, db) {
                        if (err) throw err

                        var dbo = db.db(mongoDBName)
                        dbo.collection(mongoMonsterCollectionName).insertOne(resultModel, function (err, res) {
                            if (err) throw err
                            
                            // console.log("1 document inserted")
                            db.close()
                        })
                    })
                });

                // reponse it to the request
                resultModels.forEach(element => {
                    if (element.monster.toLowerCase() === requestedMonster.toLowerCase()) {
                        return res.json({
                            result: element
                        })
                    }
                });
                
                return res.json("Error")
            })
        } else {
            console.log('filthy error appeared')
        }
    })
}

app.get('/scrape/:monster', function (req, res) {
    // all the web scraping magic will happen here
    if (req.params.monster === undefined) {
        return res.send("Error")
    }
    console.log("SEARCHING FOR: " + req.params.monster)

    // check the database if it exist
    MongoClient.connect(mongoURL, function (err, db) {
        if (err) throw err

        var dbo = db.db(mongoDBName)
        var query = {
            monster: req.params.monster
        }

        dbo.collection(mongoMonsterCollectionName).find(query).toArray(function (err, monsters) {
            if (err) throw err

            if (monsters.length <= 0) {
                console.log("nothing found going to scrape")
                // else scrape the website and insert the result
                scrapeFor(req.params.monster, res)
            } else {
                console.log("Got one in the database")
                res.json({
                    result: monsters[0]
                })
            }
        })
    })
})

function pushElementKeyValuesInto(array, element) {
    for (const key in element) {
        if (key === 'monster') continue
        if (element.hasOwnProperty(key)) {
            if (element[key].length > 0) {
                array.push(element[key])
            }
        }
    }
}

app.listen('8081')

console.log('Magic happens on port 8081')

exports = module.exports = app