const {
  every,
  includes,
  mapValues,
  omit,
  pick,
  some,
  uniqueId,
  wrap
} = require("lodash");
const rxjsStaticFunctions = require("rxjs");
const rxjsOperators = require("rxjs/operators");
const { VirtualTimeScheduler, isObservable } = require("rxjs");
const {
  endWith,
  catchError,
  timestamp,
  tap,
  pluck,
  filter
} = require("rxjs/operators");
const vm = require("vm");

const COMPLETE = Symbol("COMPLETE");
const ERROR = Symbol("ERROR");
const ID = Symbol("ID");
const NAME = Symbol("NAME");
const EVENTS = Symbol("EVENTS");
const PIPES = Symbol("PIPES");
const INPUTS = Symbol("INPUTS");

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
  if (isObservable(value)) {
    return { timestamp, type: "observableValue", id: value[ID] };
  }
  return { timestamp, type: "value", value };
};

const withOutputCollected = (observable, scheduler) => {
  const ret = observable.pipe(
    endWith(COMPLETE),
    catchError(() => [ERROR]),
    timestamp(scheduler),
    tap(event => {
      if (!ret[EVENTS]) {
        ret[EVENTS] = [];
      }
      ret[EVENTS].push(
        processCollectedEvent(pick(event, "timestamp", "value"))
      );
    }),
    pluck("value"),
    filter(value => value !== COMPLETE && value !== ERROR)
  );
  return ret;
};

const decorateObservable = (observable, name, id, inputArgs) => {
  observable[ID] = id;
  observable[NAME] = name;
  observable[PIPES] = [];
  observable[INPUTS] = inputArgs.filter(isObservable).map(obs => obs[ID]);
  observable.pipe = wrap(observable.pipe, (pipe, ...args) => {
    if (every(args, op => !!op[ID])) {
      observable[PIPES] = args.map(op => op[ID]);
    }
    return pipe.call(observable, ...args);
  });
};

const observableIsTopLevel = (observable, observables) =>
  !some(
    observables,
    otherObservable =>
      includes(otherObservable[INPUTS], observable[ID]) ||
      includes(otherObservable[PIPES], observable[ID]) ||
      some(
        otherObservable[EVENTS],
        event => event.type === "observableValue" && event.id === observable.id
      )
  );

const runCode = code => {
  const scheduler = new VirtualTimeScheduler();
  const observables = [];

  const context = {
    ...omit(
      mapValues(rxjsStaticFunctions, (fn, name) => {
        return (...args) => {
          const allArgs = includes(STATIC_FUNCTIONS_THAT_TAKE_SCHEDULER, name)
            ? [...args, scheduler]
            : args;
          const ret = withOutputCollected(fn(...allArgs), scheduler);
          decorateObservable(ret, name, uniqueId(`${name}-`), allArgs);
          observables.push(ret);
          return ret;
        };
      }),
      UNSUPPORTED_STATIC_FUNCTIONS
    ),
    ...omit(
      mapValues(rxjsOperators, (fn, name) => (...args) => {
        const id = uniqueId(`${name}-`);
        const operatorFn = source => {
          const allArgs = includes(OPERATORS_THAT_TAKE_SCHEDULER, name)
            ? [...args, scheduler]
            : args;
          const ret = withOutputCollected(
            source.pipe(fn(...allArgs)),
            scheduler
          );
          decorateObservable(ret, name, id, allArgs);
          observables.push(ret);
          return ret;
        };
        operatorFn[ID] = id;
        return operatorFn;
      }),
      UNSUPPORTED_OPERATORS
    )
  };

  vm.runInNewContext(code, context);
  scheduler.flush();

  return observables.map(observable => ({
    name: observable[NAME],
    id: observable[ID],
    events: observable[EVENTS],
    pipes: observable[PIPES],
    inputs: observable[INPUTS],
    isTopLevel: observableIsTopLevel(observable, observables)
  }));
};

module.exports = (event, context) => {
  return runCode(event.data.source);
};
