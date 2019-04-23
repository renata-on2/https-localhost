#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
// spdy allows http2, while waiting express to support the http2 module
const https = process.env.NODE_ENV === "production"
  ? require("spdy") : require("https")
const express = require("express")
const getCerts = require(path.resolve(__dirname, "certs.js")).getCerts

/* CONFIGURE THE SERVER */

// SSL certificate
const createServer = () => {
  // create a server with express
  const app = express()

  // override the default express listen method to use our server
  app.listen = async function(port = process.env.PORT ||
  /* istanbul ignore next: cannot be tested on Travis */ 443) {
    app.server = https.createServer(await getCerts(), app).listen(port)
    console.info("Server running on port " + port + ".")
    return app.server
  }

  // use gzip compression minify
  if (process.env.NODE_ENV === "production") {
    const compression = require("compression")
    const minify = require("express-minify")
    app.use(compression({ threshold: 1 }))
    app.use(minify())
    app.set("json spaces", 0)
  }

  /* SETUP USEFUL FUNCTIONS */

  // redirect http to https, usage `app.redirect()`
  app.redirect = function(
  /* istanbul ignore next: cannot be tested on Travis */ port = 80) {
    app.http = http.createServer((req, res) => {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url
      })
      res.end()
    }).listen(port)
    console.info("http to https redirection active.")
  }

  // serve static content, usage `app.serve([path])`
  app.serve = function(staticPath = process.cwd(), port = process.env.PORT ||
  /* istanbul ignore next: cannot be tested on Travis */ 443) {
    app.use(express.static(staticPath))
    // redirect 404 to 404.html or to index.html
    app.use((req, res) => {
      if (!staticPath.startsWith("/"))
        staticPath = process.cwd() + "/" + staticPath
      const p404 = staticPath + "/404.html"
      const index = staticPath + "/index.html"
      // istanbul ignore else: not interesting
      if (fs.existsSync(p404))
        res.status(404).sendFile(p404)
      else if (fs.existsSync(index))
        res.status(404).sendFile(index)
      else res.status(404).send(req.path + " not found.")
    })
    console.info("Serving static path: " + staticPath)
    app.listen(port)
  }

  return app
}

/* MAIN */

// usage: `serve [<path>]` or `node index.js [<path>]`
// istanbul ignore if: cannot be tested
if (require.main === module) {
  const app = createServer()
  // retrieve the static path from the process argv or use the cwd
  // 1st is node, 2nd is serve or index.js, 3rd (if exists) is the path
  app.serve(process.argv.length === 3 ? process.argv[2] : process.cwd())
  // redirect http to https (only if https port is the default one)
  if (!process.env.PORT) app.redirect()
}

// export as module
module.exports = createServer
