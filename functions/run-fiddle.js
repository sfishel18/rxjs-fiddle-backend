const { mapValues, pick } = require("lodash");
const rxjsStaticImports = require("rxjs");
const rxjsOperatorImports = require("rxjs/operators");
const { VirtualTimeScheduler } = require("rxjs");
const {
  endWith,
  catchError,
  timestamp,
  tap,
  pluck,
  filter
} = require("rxjs/operators");
const vm = require("vm");

const COMPLETE = Symbol("__COMPLETE__");
const ERROR = Symbol("__ERROR__");

const processCollectedEvent = ({ timestamp, value }) => {
  if (value === COMPLETE) {
    return { timestamp, type: "complete" };
  }
  if (value === ERROR) {
    return { timestamp, type: "error" };
  }
  return { timestamp, type: "value", value };
};

const collectOutput = (collectFn, scheduler) => source =>
  source.pipe(
    endWith(COMPLETE),
    catchError(() => [ERROR]),
    timestamp(scheduler),
    tap(output =>
      collectFn(processCollectedEvent(pick(output, "timestamp", "value")))
    ),
    pluck("value"),
    filter(value => value !== COMPLETE && value !== ERROR)
  );

const runCode = code => {
  const scheduler = new VirtualTimeScheduler();
  const output = [];

  const context = {
    ...mapValues(rxjsStaticImports, (fn, name) => {
      return (...args) => {
        const entry = { name, events: [] };
        output.push(entry);
        return fn(...args, scheduler).pipe(
          collectOutput(val => entry.events.push(val), scheduler)
        );
      };
    }),
    ...mapValues(rxjsOperatorImports, (fn, name) => {
      return (...args) => source => {
        const entry = { name, events: [] };
        output.push(entry);
        return source.pipe(
          fn(...args),
          collectOutput(val => entry.events.push(val), scheduler)
        );
      };
    })
  };

  vm.runInNewContext(code, context);
  scheduler.flush();
  return output;
};

module.exports = (event, context) => {
  return runCode(event.data.source);
};
