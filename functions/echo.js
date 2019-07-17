const { of } = require("rxjs");
const { delay } = require("rxjs/operators");

module.exports = (event, context) => {
  return of(event.data)
    .pipe(delay(1000))
    .toPromise();
};
