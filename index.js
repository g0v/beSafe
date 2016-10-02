/* globals jdenticon */
const Hyperfeed = require('hyperfeed')
const level = require('level-browserify')
const yo = require('yo-yo')
const co = require('co')
const crypto = require('crypto')
const moment = require('moment')

moment.locale('zh-tw')

const KEYCODE_ENTER = 13

var t = Date.now()

var keys = [
  '51d5703abc2848dae2fd0511adebf1d28f62bcffa6fa45a49a55bcfbea07a86d',
  'b7130eb23c5ce42834d1e80b59240f7c8bb9dc8a4b8fdec6f628a2588926641e',
  '1827968a8ea7271976f4b0c17c18a3cc67fa8b51fb84697ddcafd64ee6e877e2'
]

var entries = {}
var items = []
var feeds = []

for (var i = 0; i < keys.length; i++) {
  var feed = new Hyperfeed(keys[i], {storage: level('./feed'), own: false})
  console.log('opened', keys[i])
  feed.swarm()
  feeds[keys[i]] = feed
  entries[keys[i]] = []

  console.log('listing')
  var list = feed.list({live: true})
  list.on('data', entry => {
    if (moment(entry.ctime) > moment().substract(7, 'days')) {
      entries[keys[i]].push(entry)
    }
  })
}

function updateApp () {
  co(function * () {
    items = []
    for (var i = 0; i < Object.keys(entries).length; i++) {
      var feedKey = Object.keys(entries)[i]
      for (var j = 0; j < entries[feedKey].length; j++) {
        var item = yield feeds[feedKey].load(entries[feedKey][j])
        items.push(item)
      }
    }
    console.log(items)
    console.log(Date.now() - t)
    items = items.sort((x, y) => { return y.date - x.date })

    render()
    jdenticon()
  })
}

function render () {
  console.log('render', items)
  yo.update(document.querySelector('#app'), yo`
    <div id="app">
      <div class="ui two column centered grid">
        <div class="column">
          <div class="ui feed">${items.map(x => { return renderItem(x) })}</div>
        </div>
      </div>
    </div>
  `)
}

function renderInput () {
  return yo`
    <div class="ui input">
      <input
        type="text"
        placeholder="Say..."
        onkeydown=${onInputKeyDown}>
    </div>
  `
}

function onInputKeyDown (e) {
  if (e.keyCode === KEYCODE_ENTER) {
    e.preventDefault()
    var value = e.target.value

    co(function * () {
      yield feed.push({ title: value, author: { name: feed.key().toString('hex') } })
      e.target.value = ''
      updateApp()
    })
  }
}

function renderItem (x) {
  return yo`
    <div class="event">
      <div class="label">
        <svg width="35" height="35" data-jdenticon-hash="${crypto.createHash('sha256').update(x.author).digest('hex')}"></svg>
      </div>
      <div class="content">
        <div class="summary">
          <a class="user">${x.author}</a>
          alerted
          <div class="date">${moment(x.date).fromNow()}</div>
        </div>
        <div class="extra text">
          ${x.title}<br />
          ${x.description}
        </div>
        <div class="meta">
          ${x.guid}
        </div>
      </div>
    </div>
  `
}

updateApp()
setInterval(updateApp, 10000)
