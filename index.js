/* globals jdenticon, CalHeatMap, WebSocket */
const hyperfeed = require('hyperfeed')
const hyperdrive = require('hyperdrive')
const level = require('level-browserify')
const yo = require('yo-yo')
const crypto = require('crypto')
const moment = require('moment')
const async = require('async')
const _ = require('lodash')

moment.locale('zh-tw')

var items = []
window.items = items

var heatmap = {}

var cal = new CalHeatMap()
cal.init({
  domain: 'week',
  colLimit: 7,
  range: 1,
  cellSize: 15,
  displayLegend: false,
  tooltip: true
})

var update = _.debounce(updateApp, 200)

var loaded = 0

connect('ws://devpoga.org:9091')

function connect (url) {
  var socket = new WebSocket(url)
  socket.onmessage = function (e) {
    var entry = JSON.parse(e.data)

    var loadMsg = document.querySelector('#loading_msg')
    if (loadMsg) loadMsg.innerHTML = `讀取中 (${loaded})...`
    update()

    loaded += 1
    var time = entry.ctime / 1000
    if (!heatmap[time]) heatmap[time] = 0
    heatmap[time] += 1
    items.push(entry.item)

    update()
  }
}

function updateApp () {
  items = items.sort((x, y) => { return new Date(y.date) - new Date(x.date) })

  render()
  jdenticon()
  cal.update(heatmap)
}

function render () {
  console.log('render', items.length)
  document.querySelector('#heatmap').style.display = 'block'
  yo.update(document.querySelector('#timeline'), yo`
    <div id="timeline" class="ui basic segment">
      <div class="ui feed">${renderItems(items)}</div>
    </div>
  `)
}

function renderItems (items) {
  var results = []
  items.forEach((x, i) => {
    if (i === 0) {
      results.push(yo`<div class="ui horizontal divider">${moment(x.date).format('ll')}</div>`)
    } else if (i > 0) {
      var currentDate = moment(x.date)
      var prevDate = moment(items[i-1].date)
      if (currentDate.day() !== prevDate.day()) {
        results.push(yo`<div class="ui horizontal divider">${moment(x.date).format('ll')}</div>`)
      } else if (currentDate.isBefore(prevDate.subtract(1, 'hour'))) {
        results.push(yo`<div class="ui hidden divider"></div>`)
      }
    }

    results.push(renderItem(x))
  })

  return results
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
          <a class="user" href="${x.meta.link}">${x.author}</a>
          發佈 <a href="${x.link}" target="_blank">${x.title}</a>
          <div class="date">
            ${moment(x.date).format('MMMM Do YYYY, h:mm:ss a')}
          </div>
        </div>
        <div class="extra text">
          ${x.description}
          <div id="map-${x.guid}" class="map"></div>
        </div>
        <div class="meta">
          ${x.link.endsWith('.cap') ? yo`<i class="map pin icon" onclick=${openMap(x)}></i>` : ''}
          ${x.guid}
        </div>
      </div>
    </div>
  `
}

function openMap (item) {
  return () => {
    console.log('opening map', item.guid)
    window.feed.load(`scrap/${item.guid}`, {raw: true}).then(data => {
      var el = document.getElementById(`map-${item.guid}`)
      var map = new google.maps.Map(el, {
          zoom: 10
        })
      var infoWindow = new google.maps.InfoWindow({map: map});
      console.log(data)
      var coord = data.match(/<circle>(.+)<\/circle>/)[1]
      var geo = coord.split(' ')[0].split(',').map(x => parseFloat(x))
      console.log(geo)
      var pos = {lat: geo[0], lng: geo[1]}
      //window.open(`http://maps.google.com/maps?q=${pos['lat']},${pos['lng']}`)
      infoWindow.setPosition(pos)
      infoWindow.setContent(item.title)
      map.setCenter(pos)
      el.style.display = 'block'
    })
  }
}
