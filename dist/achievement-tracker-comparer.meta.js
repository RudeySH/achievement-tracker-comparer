// ==UserScript==
// @name Achievement Tracker Comparer
// @description Compare achievements between AStats, completionist.me, Exophase, MetaGamerScore, Steam Hunters, TrueSteamAchievements and Steam Community profiles.
// @version 1.3.8
// @author Rudey
// @homepage https://github.com/RudeySH/achievement-tracker-comparer#readme
// @supportURL https://github.com/RudeySH/achievement-tracker-comparer/issues
// @include /^https://steamcommunity\.com/id/[a-zA-Z0-9_-]{3,32}/*$/
// @include /^https://steamcommunity\.com/profiles/\d{17}/*$/
// @connect astats.nl
// @connect completionist.me
// @connect exophase.com
// @connect metagamerscore.com
// @connect steamhunters.com
// @connect truesteamachievements.com
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.xmlHttpRequest
// @namespace https://github.com/RudeySH/achievement-tracker-comparer
// @require https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/he/1.2.0/he.min.js
// ==/UserScript==
