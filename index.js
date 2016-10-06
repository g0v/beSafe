/* globals jdenticon, CalHeatMap */
const hyperfeed = require('hyperfeed')
const hyperdrive = require('hyperdrive')
const level = require('level-browserify')
const yo = require('yo-yo')
const crypto = require('crypto')
const moment = require('moment')
const async = require('async')
const _ = require('lodash')

moment.locale('zh-tw')

var hf = hyperfeed(hyperdrive(level('feed')))

var keys = ['93ee801c6d562f29f01dce5c38a60ed61cc0985c97e552dfa54bc75e707effa2']

var items = []
var feeds = []
window.items = items

var heatmap = {}

var cal = new CalHeatMap()
cal.init({
  domain: 'month',
  colLimit: 31,
  range: 1,
  cellSize: 15,
  displayLegend: false
})

var tasks = []
for (var i = 0; i < keys.length; i++) {
  tasks.push(connect(keys[i]))
}

async.series(tasks, (err, connections) => {
  console.log('all connected', connections.length)
})

var update = _.debounce(updateApp, 500)

function connect (key) {
  return (cb) => {
    console.log('start connect', key)
    var feed = hf.createFeed(key, {own: false})
    console.log('opened', key)
    var sw = feed.swarm()
    console.log('swarming', key)
    sw.on('error', e => console.error(e))
    sw.on('connection', function (peer, type) {
      console.log(`[${feed.key().toString('hex')}]`, 'got', type) // type is 'webrtc-swarm' or 'discovery-swarm'
      console.log(`[${feed.key().toString('hex')}]`, 'connected to', sw.connections, 'peers')
      peer.on('close', function () {
        console.log(`[${feed.key().toString('hex')}]`, 'peer disconnected')
      })
      cb()
    })
    feeds[key] = feed

    var list = feed.list({live: true})
    list.on('data', entry => {
      if (moment(entry.ctime) > moment().subtract(1, 'month')) {
        feeds[key].load(entry).then(item => {
          items.push(item)
          var time = item.date.getTime() / 1000
          if (!heatmap[time]) heatmap[time] = 0
          heatmap[time] += 1

          update()
        })
      }
    })
  }
}

function updateApp () {
  items = items.sort((x, y) => { return y.date - x.date })

  render()
  jdenticon()
  cal.update(heatmap)
}

function render () {
  console.log('render', items.length)
  yo.update(document.querySelector('#timeline'), yo`
    <div id="timeline">
      <div class="ui feed">${items.map(x => { return renderItem(x) })}</div>
    </div>
  `)
}

function renderItem (x) {
  var author = x.author || x.guid
  return yo`
    <div class="event">
      <div class="label">
        <svg width="35" height="35" data-jdenticon-hash="${crypto.createHash('sha256').update(author).digest('hex')}"></svg>
      </div>
      <div class="content">
        <div class="summary">
          <a class="user">${x.author}</a>
          發佈 <a href="${x.link}" target="_blank">${x.title}</a>
          <div class="date">${moment(x.date).fromNow()}</div>
        </div>
        <div class="extra text">
          ${x.description}<br />
        </div>
        <div class="meta">
          ${x.guid}
        </div>
      </div>
    </div>
  `
}
