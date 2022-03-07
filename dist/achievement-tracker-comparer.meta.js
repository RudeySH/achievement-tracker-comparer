// ==UserScript==
// @name        Achievement Tracker Comparer
// @version     1.3.2
// @author      Rudey
// @description Compare achievements between AStats, completionist.me, Exophase, MetaGamerScore, Steam Hunters, TrueSteamAchievements and Steam Community profiles.
// @homepage    https://github.com/RudeySH/achievement-tracker-comparer#readme
// @supportURL  https://github.com/RudeySH/achievement-tracker-comparer/issues
// @include     /^https://steamcommunity\.com/id/\w{3,32}/*$/
// @include     /^https://steamcommunity\.com/profiles/\d{17}/*$/
// @namespace   https://github.com/RudeySH/achievement-tracker-comparer
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.xmlHttpRequest
// @connect     astats.nl
// @connect     completionist.me
// @connect     exophase.com
// @connect     metagamerscore.com
// @connect     steamhunters.com
// @connect     truesteamachievements.com
// @require     https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/he/1.2.0/he.min.js
// @downloadURL https://github.com/RudeySH/achievement-tracker-comparer/raw/main/dist/achievement-tracker-comparer.user.js
// @updateURL   https://github.com/RudeySH/achievement-tracker-comparer/raw/main/dist/achievement-tracker-comparer.meta.js
// ==/UserScript==
