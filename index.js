
var fs = require('fs')
var path = require('path')
var basePath = 'docs'
let markdown = require('markdown-it')
var md = new markdown({
    html: true,
    langPrefix: 'code-',
})
const config = require('./pass.json')
const pvPath = './pv.txt'

var mdsCache = {}

function collectMds() {
    let level1Cates = getDirsInDocsFolder()
    level1Cates.forEach(c => {
        mdsCache[c] = {}
        let cateMds = getMdsInFolder(c)
        cateMds.forEach(md => {
            mdsCache[c][md] = readMd(md, c)
        })
    })
}
collectMds();

function refreshMdsCache() {
    mdsCache = {}
    collectMds()
}

function mkCate(cate) {
    fs.mkdir(path.join(basePath, cate), function (err) {

    })
}

function getDirsInDocsFolder() {
    var paths = fs.readdirSync(basePath)
    // let paths = []
    // for (const k in mdsCache) {
    //     paths.push(k)
    // }
    return paths
}

function getMdsInFolder(folderName) {
    let paths = fs.readdirSync(path.join(basePath, folderName))
    // let paths = []
    // for (const k in mdsCache[folderName]) {
    //     paths.push(k)
    // }
    return paths
}

function writeMdFile(folderPath, fileName, content) {
    fs.writeFileSync(path.join(basePath, folderPath, fileName), content, function (err) {
        console.error(err)
    })
    refreshMdsCache()
}

function readMd(fileName, folderPath) {
    let content = fs.readFileSync(path.join(basePath, folderPath, fileName), 'utf-8')
    return content
}


function readMdFromCache(fileName, folderPath) {
    return mdsCache[folderPath][fileName]
}

function readMdFileToHtml(fileName, folderPath) {
    var content = readMdFromCache(fileName, folderPath)
    var html = md.render(content)
    return html
}

function checkAdmin(req) {
    var username = req.signedCookies.username
    return username === 'admin'
}

function checkVip(req) {
    var vip = req.signedCookies.vip
    return vip === 'true'
}

function vipContent(req, callback) {
    const { cate, name } = req.query
    var ret = "viponly"
    if (name.indexOf('vip') !== -1) {
        if (checkAdmin(req) || checkVip(req)) {
            ret = callback(`${name}`, cate)
        }
    }
    else ret = callback(`${name}`, cate)
    return ret
}



function main() {
    console.log('Starting web server')
    var express = require('express')
    var cookieParser = require('cookie-parser')

    var app = express()
    app.use(express.static(path.join(__dirname, 'static')))

    const bodyParser = require('body-parser');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use(cookieParser(config.cookieParser))

    app.use(function (req, res, next) {
        var username = req.signedCookies.username
        const userIsNotAdmin = username !== 'admin'
        const isNotAuthAction = req.url !== '/auth'
        const isVipAuthAction = req.url === '/vip'
        if (req.method === 'POST' && userIsNotAdmin && isNotAuthAction && !isVipAuthAction) {
            res.send('Unauthorized.')
            res.end()
        }
        else
            next()
    })


    app.post('/auth', function (req, res, next) {
        if (req.body.key === config.pass) {
            res.cookie("username", "admin", { maxAge: 240 * 60 * 1000, signed: true });
            res.send('OK')
        }
        else res.send('Failure.')
    })

    app.get('/logout', function (req, res, next) {
        res.clearCookie('username')
        res.clearCookie('vip')
        res.send('OK')
    })

    app.post('/vip', function (req, res, next) {
        if (req.body.key === config.vip) {
            res.cookie("vip", "true", { maxAge: 60 * 60 * 1000, signed: true });
            res.send('OK')
        }
        else {
            res.send('Failed')
        }
    })

    app.get('/cates', function (req, res, next) {
        var list = getDirsInDocsFolder()
        res.send(list)
    })

    app.post('/cate', function (req, res, next) {
        if (!checkAdmin(req)) return
        const { cate } = req.body
        mkCate(cate)
        refreshMdsCache()
        res.send(cate)
    })

    app.get('/mds', function (req, res, next) {
        const { cate } = req.query
        if (!cate) res.send([])
        var mds = getMdsInFolder(cate)
        res.send(mds)
    })


    app.get('/mdhtml', function (req, res, next) {
        let html = vipContent(req, readMdFileToHtml)
        res.send(html)
    })
    app.get('/md', function (req, res, next) {
        let ret = vipContent(req, readMdFromCache)
        res.send(ret)
    })

    app.post('/md', function (req, res, next) {
        if (!checkAdmin(req)) return
        const { cate, name, content } = req.body
        writeMdFile(cate, name, content + '\n\n' + "<font color='purple'> Last edit: " + new Date().toString() + "</font>")
        refreshMdsCache()
        res.send('OK')

    })

    app.get('/pv', function (req, res, next) {
        let content = fs.readFileSync(pvPath, 'utf-8')
        let visits = parseInt(content) + 1
        fs.writeFileSync(pvPath, visits)
        res.send(visits.toString())
    })

    app.post("/addlink", function (req, res, next) {
        if (!checkAdmin(req)) return
        const { newlink } = req.body
        const parts = newlink.split(' ')
        const links = JSON.parse(fs.readFileSync("./static/links.json"))
        links.push({ name: parts[0], url: parts[1] })
        fs.writeFileSync("./static/links.json", JSON.stringify(links))
    })

    var server = app.listen(8091, function () {
        const { address, port } = server.address()
        console.log('Listening on http://%s:%s', address, port)

    })


}
main();
