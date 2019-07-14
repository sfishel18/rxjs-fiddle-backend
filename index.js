const express = require("express");
const echo = require("./functions/echo");

const functions = { echo };

const meta = {
  ns: process.env.RXJS_FIDDLE_NS,
  version: process.env.RXJS_FIDDLE_VERSION
};

const app = express();
const port = 8080;
app.use(express.json());

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
