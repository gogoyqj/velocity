var fs = require('fs')
var path = require('path')
var express = require('express')
var utilx = require('utilx')

var logger = require('./logger')
var common = require('./common')
var Engine = require('./engine')

module.exports = function(cfg) {
  var engine = new Engine(cfg)
  var app = express()
  // 存储macro的改动时间，确定是否刷新global macro
  var macroChanged = {}
  var reg = /[^\.\/\\]+\.vm/g
  // bak default config
  var raw = cfg.template.raw
  var fullPath = cfg.template.fullPath
  var context = cfg.context
  var tplRouter= cfg.tplRouter || function(req) {
    return req.query.tpl
  }
  var contextRouter = cfg.contextRouter || function() {
    return cfg.context
  }
  var contextChanger = cfg.contextChanger

  app.get('*', function(req, res){
    res.setHeader('Cache-Control', ['private', 'max-age=0', 'no-cache'])

    try {
      // tpl参数指定模板
      var tpl = tplRouter(req)
      cfg.template.raw = tpl ? cfg.template.raw.replace(reg, tpl) : raw
      cfg.template.fullPath = tpl ? cfg.template.fullPath.replace(reg, tpl) : fullPath
      // 切换数据文件
      cfg.context = contextRouter(tpl, req) || cfg.context
      var ctx = common.perfectContext(cfg.context)
      // 加工数据
      if(contextChanger) ctx = contextChanger(ctx, tpl, req) || ctx
      // 自动刷新global macro模板
      var changeList = []
      engine.cfg.macro && engine.cfg.macro.forEach(function(tpl) {
        var file = tpl.raw,
          last = macroChanged[file] || 0,
          changeTime = +(new Date(fs.statSync(file).mtime))
        if(changeTime > last) {
            macroChanged[file] = changeTime
            changeList.push(tpl)
        }
      })
      engine.GMacro(changeList)
      
      var result = engine.render(ctx)
      res.send(result)
    } catch (e) {
      res.send('<pre>' + e.stack.replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;') + '</pre>')
    }
  })

  app.listen(6789)
  logger.info('Start server, please visit <localhost:6789>')
}


