const { of } = require("rxjs");
const { delay } = require("rxjs/operators");

const meta = {
  environment: process.env.RXJS_FIDDLE_ENV,
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
