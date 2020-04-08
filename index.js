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
const mongoCollectionName = "monsters"
var mongoURL = "mongodb://localhost:27017/"

MongoClient.connect(mongoURL, function (err, db) {
    if (err) throw err

    var dbo = db.db(mongoDBName)
    if (!dbo) {
        MongoClient.connect(`${mongoURL}${mongoDBName}`, function (err, db) {
            if (err) throw err

            console.log("Database Created!")

            dbo.createCollection(mongoCollectionName, function(err, res) {
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

function scrapeFor(requestedMonster, res) {
// the URL we will scrape from - in our example teambrg
    // https://teambrg.com/monster-hunter-world/mhw-monster-elemental-weakness-table/
    url = 'https://teambrg.com/monster-hunter-world/mhw-monster-elemental-weakness-table/'

    // the structure of our request call
    // the first parameter is the url
    // the callback function takes 3 paramters, an error, reponse status code, and the html
    request(url, function(error, responsecode, html) {
        // first we check to make sure no errors occured when making the request
        if (!error) {
            // next we'll utilize the cheerio library on the returned html which will essentially give us qQueury functionality
            var $ = cheerio.load(html);

            // Finally we define the variable were going to capture
            var properties = ["monster", "fire", "water", "thunder", "ice", "dragon", "poison", "sleep", "paralysis", "blast", "stun"]

            var monsters = []

            // we'll use the uniqe header class row-hover as a starting point
            $('.row-hover').filter(function() {
                // lets store the data we filter into a variable so we can easily see whats going on
                var data = $(this)

                // console.log(data)
                data.children().each(function (i, tableRow) {
                    // for each row create a new monster dict object
                    var monster = {
                        monster: "",
                        fire: "",
                        water: "",
                        thunder:"", 
                        ice: "",
                        dragon: "",
                        poison: "",
                        sleep: "",
                        paralysis: "",
                        blast: "",
                        stun: ""
                    }
                    // console.log(tableRow)
                    $(tableRow).children().each(function (i, td) {
                        // console.log(properties[i]+ ": " + $(td).text())
                        // each td in the row is a property 
                        // set the i property of the monster to the td's text
                        monster[properties[i]] = $(td).text()
                        // add monster to monsters
                        monsters.push(monster)
                    })
                })

                // filter the fetched table of monsters
                const monsterToFilter = requestedMonster
                // console.log(monsterToFilter)
                
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

                // console.log('there are ' + searchResults.length + 'Monsters filtererd')

                // somehow the results are weird and they are always 11 copies of the monster
                //7 eg its only 3 times contained in the real list but we got a result of 33 in our searchResults array
                // maybe make some modulo to get the magic number 11
                // currently its 11 because yeah its 11
                var filteredSearchResults = []
                for (var i = 0; i < searchResults.length; i += 11) {
                    filteredSearchResults.push(searchResults[i])
                }

                // the results seem not to be more than 4
                // if there are 4 than it must mean its tail is severable
                // create one reponse json from all filtered Results now
                var resultModel = {
                    monster: filteredSearchResults[0].monster,
                    elementWeakness : {
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
                    weakPoints : [],
                    breakableParts : [],
                    severable : false
                }

                // setup the result Model with the filteredSearch Results
                for (const result in filteredSearchResults) {
                    if (filteredSearchResults.hasOwnProperty(result)) {
                        const element = filteredSearchResults[result];
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
                    }
                }

                // set it in the db
                MongoClient.connect(mongoURL, function(err, db) {
                    if (err) throw err

                    var dbo = db.db(mongoDBName)
                    dbo.collection(mongoCollectionName).insertOne(resultModel, function(err, res) {
                        if (err) throw err
                        console.log("1 document inserted")
                        db.close()
                    })
                })

                // reponse it to the request
                res.json({result:resultModel})
            })
        } else {
            console.log('filthy error appeared')
        }
    })
}

app.get('/scrape/:monster', function(req, res) {
    // all the web scraping magic will happen here
    if (req.params.monster === undefined) {
        return res.send("Error")
    }
    console.log("SEARCHING FOR: " + req.params.monster)

    // check the database if it exist
    MongoClient.connect(mongoURL, function(err, db) {
        if (err) throw err

        var dbo = db.db(mongoDBName)
        var query = {monster:req.params.monster}

        dbo.collection(mongoCollectionName).find(query).toArray(function (err, monsters) {
            if (err) throw err

            if (monsters.length <= 0) {
                console.log("nothing found going to scrape")
                // else scrape the website and insert the result
                scrapeFor(req.params.monster, res)
            } else {
                console.log("Got one in the database")
                res.json({result: monsters[0]})
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