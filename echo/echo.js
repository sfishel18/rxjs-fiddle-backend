const { of } = require("rxjs");
const { delay } = require("rxjs/operators");

module.exports = {
  main: function(event, context) {
    console.log(event);
    return of({ response: event.data })
      .pipe(delay(1000))
      .toPromise();
  }
};
