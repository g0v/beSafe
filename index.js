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
  '13e084e9cfb26d20a7fdfa873e794bd83c9f735c5522e227c5966f159988db74',
  '11ca8522704537528e5e5b0575564564cfca3af452f353ddfca5973f50cf9283',
  '529df2efe8f349ffc62a56e80131d98175e78c89fdbe26e3c6a3e02bd72ac896'
]
keys = ['13e084e9cfb26d20a7fdfa873e794bd83c9f735c5522e227c5966f159988db74']

var entries = {}
var items = []
var feeds = []

for (var i = 0; i < keys.length; i++) {
  (function (key) {
    var feed = new Hyperfeed(key, {storage: level(`./feed-${key}`), own: false})
    console.log('opened', key)
    var sw = feed.swarm()
    sw.on('connection', function (peer, type) {
      console.log(`[${feed.key().toString('hex')}]`, 'got', type) // type is 'webrtc-swarm' or 'discovery-swarm'
      console.log(`[${feed.key().toString('hex')}]`, 'connected to', sw.connections, 'peers')
      peer.on('close', function () {
        console.log(`[${feed.key().toString('hex')}]`, 'peer disconnected')
      })
    })
    feed.list((err, entries) => {
      console.log(err, entries.length)
    })
    feeds[key] = feed
    entries[key] = []

    console.log('listing')
    var list = feed.list({live: true})
    list.on('data', entry => {
      if (moment(entry.ctime) > moment().subtract(3, 'days')) {
        entries[key].push(entry)
      }
    })
  })(keys[i])
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
