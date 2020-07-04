require('signalfx-tracing').init({
  service: 'rxjs-fiddle-backend',
  url: `http://${process.env.SIGNALFX_AGENT_HOST}:9080/v1/trace`,
});

const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const echo = require("./functions/echo");
const runFiddle = require("./functions/run-fiddle");

const functions = { echo, "run-fiddle": runFiddle };

const meta = {
  env: process.env.ENVIRONMENT_NAME,
  version: process.env.API_VERSION
};

const app = express();
const port = process.env.PORT || 8080;
app.use(express.json());
app.use(cors());

app.use("/v1/trace", createProxyMiddleware(`http://${process.env.SIGNALFX_AGENT_HOST}:9080/`));

Object.keys(functions).forEach(name => {
  app.all(`/${name}`, (req, res) => {
    const ret = functions[name]({ data: req.body });
    if (ret instanceof Promise) {
      ret.then(response => res.json({ response, meta }));
    } else {
      res.json({ response: ret, meta });
    }
  });
});

app.listen(port);
