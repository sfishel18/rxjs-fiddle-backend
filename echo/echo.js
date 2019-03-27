const { of } = require("rxjs");
const { delay } = require("rxjs/operators");

const meta = {
  ns: process.env.RXJS_FIDDLE_NS,
  version: process.env.RXJS_FIDDLE_VERSION
};

module.exports = {
  main: function(event, context) {
    console.log(event);
    return of({ response: event.data, meta })
      .pipe(delay(1000))
      .toPromise();
  }
};
