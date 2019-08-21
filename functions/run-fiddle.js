const { includes, mapValues, omit, pick } = require("lodash");
const rxjsStaticFunctions = require("rxjs");
const rxjsOperators = require("rxjs/operators");
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

const STATIC_FUNCTIONS_THAT_TAKE_SCHEDULER = [
  "bindCallback",
  "bindNodeCallback",
  "combineLatest",
  "concat",
  "from",
  "generate",
  "interval",
  "merge",
  "of",
  "pairs",
  "range",
  "scheduled",
  "throwError",
  "timer"
];

const UNSUPPORTED_STATIC_FUNCTIONS = ["fromEvent", "fromEventPattern"];

const OPERATORS_THAT_TAKE_SCHEDULER = [
  "auditTime",
  "debounceTime",
  "delay",
  "endWith",
  "expand",
  "publishReplay",
  "sampleTime",
  "shareReplay",
  "startWith",
  "throttleTime", // <-- as second of three possible args...
  "timeInterval",
  "timeout",
  "timeoutWith",
  "timestamp",
  "windowTime"
];

const UNSUPPORTED_OPERATORS = ["subscribeOn", "observeOn"];

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
    ...omit(
      mapValues(rxjsStaticFunctions, (fn, name) => {
        return (...args) => {
          const entry = { name, events: [] };
          const allArgs = includes(STATIC_FUNCTIONS_THAT_TAKE_SCHEDULER, name)
            ? [...args, scheduler]
            : args;
          output.push(entry);
          return fn(...allArgs, scheduler).pipe(
            collectOutput(val => entry.events.push(val), scheduler)
          );
        };
      }),
      UNSUPPORTED_STATIC_FUNCTIONS
    ),
    ...omit(
      mapValues(rxjsOperators, (fn, name) => {
        return (...args) => source => {
          const entry = { name, events: [] };
          const allArgs = includes(OPERATORS_THAT_TAKE_SCHEDULER, name)
            ? [...args, scheduler]
            : args;
          output.push(entry);
          return source.pipe(
            fn(...allArgs),
            collectOutput(val => entry.events.push(val), scheduler)
          );
        };
      }),
      UNSUPPORTED_OPERATORS
    )
  };

  vm.runInNewContext(code, context);
  scheduler.flush();
  return output;
};

module.exports = (event, context) => {
  return runCode(event.data.source);
};
