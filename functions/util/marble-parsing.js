const { TestScheduler } = require("rxjs/testing");
const { Observable } = require("rxjs");

const createColdObservable = (marbles, scheduler) => {
  const events = TestScheduler.parseMarbles(marbles);
  return Observable.create(subscriber => {
    events.forEach(event => {
      const { kind, value } = event.notification;
      if (kind === "N") {
        scheduler.schedule(() => subscriber.next(value), event.frame);
      } else if (kind === "E") {
        scheduler.schedule(() => subscriber.error(), event.frame);
      } else if (kind === "C") {
        scheduler.schedule(() => subscriber.complete(), event.frame);
      }
    });
  });
};

module.exports = { createColdObservable };
